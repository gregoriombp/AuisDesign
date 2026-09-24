#!/usr/bin/env node
// Runner of the Review Bridge mention trigger. It is opened by the route that
// just stored the comment (app/api/review-bridge/_mention.ts), detached — which
// is why it survives the dev server's HMR, which would kill a supervisor living
// inside Next.
//
//   node scripts/mention-run.mjs cmt-abc123 claude
//   node scripts/mention-run.mjs cmt-abc123 claude,grok
//   MENTION_DRY_RUN=1 node scripts/mention-run.mjs cmt-abc123 claude,grok
//
// For each mentioned agent, in order: reads its ceiling and model from the
// Agents panel, opens ITS CLI (claude or grok) with the ceiling's flags
// (scripts/mention-cli.mjs), and checks whether a reply landed. Reply runs at
// once; Edit waits for the working-tree lock.
//
// No automatic retry, on purpose. The trigger fires once, on the write; if it
// failed, you decide whether to try again, and the natural way to do it is to
// reply in the thread once more (which fires again). There is no loop here
// that could bleed tokens on its own.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import {
  agentEnv,
  answeredSince,
  claudeArgs,
  errorReason,
  grokArgs,
  parseCliJson,
  planRuns,
  refreshRun,
  resultText,
} from "./mention-cli.mjs";

// Fixed on purpose: a BRIDGE_BASE exported by the shell may point at a
// deployment. A configurable base here would be too short a path for the agent
// to resolve a comment somewhere other than this machine.
const BASE = "http://127.0.0.1:3000";
const API = `${BASE}/api/review-bridge`;
const REPO = process.cwd();

const STATE_DIR = path.join(os.homedir(), ".auis");
const LOCK = path.join(STATE_DIR, "mention-run.lock");
const LOG = path.join(STATE_DIR, "mention-run.log");
const LOG_MAX_BYTES = 2 * 1024 * 1024;

const RUN_TIMEOUT_MS = 30 * 60 * 1000; // Edit: a real fix fits here
const REPLY_TIMEOUT_MS = 10 * 60 * 1000; // a Reply past this is stuck
const KILL_GRACE_MS = 20 * 1000;
const LOCK_WAIT_MS = 45 * 60 * 1000;
const LOCK_POLL_MS = 3 * 1000;
// A ceiling that cuts a run in half is more expensive than no ceiling: it pays
// for the run and still leaves the tree half-edited. 5 gives room for the
// common case without becoming a blank cheque. MENTION_MAX_USD adjusts it.
const MAX_BUDGET_USD = process.env.MENTION_MAX_USD || "5";
const PROMPT_FILE = "scripts/mention-prompt.md";

const [commentId, agentsArg] = process.argv.slice(2);
const agentIds = (agentsArg || "").split(",").map((s) => s.trim()).filter(Boolean);
const dryRun = process.env.MENTION_DRY_RUN === "1";

// ── log ──────────────────────────────────────────────────────────────────────

function log(line) {
  const stamp = new Date().toISOString();
  const text = `${stamp} [${commentId || "-"}] ${line}\n`;
  try {
    fs.mkdirSync(STATE_DIR, { recursive: true });
    if (fs.existsSync(LOG) && fs.statSync(LOG).size > LOG_MAX_BYTES) {
      fs.renameSync(LOG, `${LOG}.1`);
    }
    fs.appendFileSync(LOG, text);
  } catch {
    // The log is a convenience; it never takes the run down.
  }
  process.stdout.write(text);
}

// ── bridge ───────────────────────────────────────────────────────────────────

async function getComment(id) {
  const res = await fetch(`${API}/comments/${encodeURIComponent(id)}?view=lean`);
  if (!res.ok) return null;
  const body = await res.json().catch(() => null);
  return body?.comment ?? body ?? null;
}

async function getRoster() {
  try {
    const res = await fetch(`${API}/agent-settings`);
    if (!res.ok) return null;
    const body = await res.json();
    return body?.settings && body?.runtime ? body : null;
  } catch {
    return null;
  }
}

async function postReply(agentId, text) {
  try {
    const res = await fetch(`${API}/comments/${encodeURIComponent(commentId)}/replies`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-bridge-agent-id": agentId },
      // authorName goes as a placeholder: the server swaps in the canonical
      // name when the x-bridge-agent-id header is present.
      body: JSON.stringify({ authorKind: "agent", authorId: agentId, authorName: agentId, text }),
    });
    if (!res.ok) {
      log(`warning: ${agentId}'s reply did not land (HTTP ${res.status})`);
      return;
    }
    log(`reply posted as ${agentId}`);
  } catch (err) {
    log(`warning: ${agentId}'s reply did not land (${err.message})`);
  }
}

// ── working-tree lock ────────────────────────────────────────────────────────
// The reason is not cost, it is git: two agents editing the same checkout at
// the same time is corruption. Three mentions in a row become three tiny
// runners waiting their turn. Reply does not write to the checkout and skips
// the queue.

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function alive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function tryLock() {
  try {
    const fd = fs.openSync(LOCK, "wx"); // atomic: fails if it already exists
    fs.writeSync(fd, JSON.stringify({ pid: process.pid, commentId, at: Date.now() }));
    fs.closeSync(fd);
    return true;
  } catch (err) {
    if (err.code !== "EEXIST") throw err;
    let held = null;
    try {
      held = JSON.parse(fs.readFileSync(LOCK, "utf8"));
    } catch {
      // An unreadable lock is an orphan lock.
    }
    if (!held?.pid || !alive(held.pid)) {
      log(`orphan lock (pid ${held?.pid ?? "?"}) — taking over`);
      try {
        fs.unlinkSync(LOCK);
      } catch {
        /* another runner won the race */
      }
    }
    return false;
  }
}

async function acquireLock() {
  fs.mkdirSync(STATE_DIR, { recursive: true });
  const deadline = Date.now() + LOCK_WAIT_MS;
  let waited = false;
  while (Date.now() < deadline) {
    if (tryLock()) {
      if (waited) log("lock acquired");
      return true;
    }
    if (!waited) {
      log("another run in progress — waiting for a turn");
      waited = true;
    }
    await sleep(LOCK_POLL_MS);
  }
  return false;
}

function releaseLock() {
  try {
    const held = JSON.parse(fs.readFileSync(LOCK, "utf8"));
    if (held?.pid === process.pid) fs.unlinkSync(LOCK);
  } catch {
    /* already gone */
  }
}

// ── git ──────────────────────────────────────────────────────────────────────

function dirtyPaths() {
  const out = spawnSync("git", ["status", "--porcelain"], { cwd: REPO, encoding: "utf8" });
  if (out.status !== 0) return new Set();
  return new Set(
    out.stdout.split("\n").map((l) => l.slice(3).trim()).filter(Boolean),
  );
}

// ── CLIs ─────────────────────────────────────────────────────────────────────

function claudeBin() {
  if (process.env.CLAUDE_BIN) return process.env.CLAUDE_BIN;
  const local = path.join(os.homedir(), ".local", "bin", "claude");
  if (fs.existsSync(local)) return local;
  const which = spawnSync("which", ["claude"], { encoding: "utf8" });
  return which.status === 0 ? which.stdout.trim() : "claude";
}

function grokBin() {
  if (process.env.GROK_BIN) return process.env.GROK_BIN;
  // The official installer puts the binary here; the dev server's PATH may not have it.
  const local = path.join(os.homedir(), ".local", "bin", "grok");
  if (fs.existsSync(local)) return local;
  const which = spawnSync("which", ["grok"], { encoding: "utf8" });
  return which.status === 0 ? which.stdout.trim() : "grok";
}

// Replacement by FUNCTION: with a string, a "$&" in the comment text would turn
// back into the placeholder. The comment JSON goes in last, so no "{{...}}"
// typed inside it gets replaced.
function buildPrompt(run, roster, comment) {
  const agent = roster.runtime[run.agentId] ?? {};
  const values = {
    "{{COMMENT_ID}}": commentId,
    "{{AGENT_ID}}": run.agentId,
    "{{AGENT_NAME}}": agent.name ?? run.agentId,
    "{{AGENT_HANDLE}}": agent.handle ?? run.agentId,
    "{{PERMISSION}}": run.permission,
  };
  let md = fs.readFileSync(path.join(REPO, PROMPT_FILE), "utf8");
  for (const [key, value] of Object.entries(values)) md = md.replaceAll(key, () => value);
  const json = JSON.stringify(comment, null, 2);
  return md.replaceAll("{{COMMENT_JSON}}", () => json);
}

function commandFor(run, prompt) {
  if (run.cli === "grok") {
    return {
      bin: grokBin(),
      args: grokArgs({ prompt, permission: run.permission, model: run.model, effort: run.effort, cwd: REPO }),
    };
  }
  return {
    bin: claudeBin(),
    args: claudeArgs({
      prompt,
      permission: run.permission,
      model: run.model,
      effort: run.effort,
      maxBudgetUsd: MAX_BUDGET_USD,
    }),
  };
}

// The child's environment is the most dangerous point of the script: without
// the fixed BRIDGE_BASE, one exported by the shell could make the run resolve
// somewhere else. The rest is an allowlist (agentEnv): app secrets and API keys
// never reach the agent.
function runEnv(cli) {
  return agentEnv(process.env, cli, BASE);
}

function runCli(cli, bin, args, timeoutMs) {
  return new Promise((resolve) => {
    const child = spawn(bin, args, {
      cwd: REPO,
      env: runEnv(cli),
      // stdin closed: a CLI waiting for input on an open pipe is the classic hang.
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;
    child.stdout.on("data", (d) => {
      // Keep the END: in Grok's streaming the line that matters (`result`) is
      // the last one, and a long run can pass 1 MB of tool_result.
      stdout += d;
      if (stdout.length > 2_000_000) stdout = stdout.slice(-1_000_000);
    });
    child.stderr.on("data", (d) => {
      stderr += d;
      if (stderr.length > 20_000) stderr = stderr.slice(-20_000);
    });

    const watchdog = setTimeout(() => {
      timedOut = true;
      log(`watchdog: ${timeoutMs / 60000} min exceeded — SIGTERM`);
      child.kill("SIGTERM");
      setTimeout(() => child.kill("SIGKILL"), KILL_GRACE_MS);
    }, timeoutMs);

    child.on("error", (err) => {
      clearTimeout(watchdog);
      resolve({ code: -1, timedOut, stderr: err.message, parsed: null });
    });
    child.on("close", (code) => {
      clearTimeout(watchdog);
      resolve({
        code,
        timedOut,
        stderr: stderr.trim().split("\n").slice(-20).join("\n"),
        parsed: parseCliJson(stdout),
      });
    });
  });
}

// ── one agent ────────────────────────────────────────────────────────────────

async function runOne(planned, roster) {
  const { agentId } = planned;
  const locked = planned.needsLock && !dryRun ? await acquireLock() : false;
  if (planned.needsLock && !dryRun && !locked) {
    log(`${agentId}: gave up waiting for the lock`);
    await postReply(
      agentId,
      "I could not start: I spent 45 minutes waiting for another run to finish. Mention me here again.",
    );
    return;
  }
  try {
    // The Agents panel re-read AFTER the lock: switching off an agent that is
    // queued makes it skip, and lowering the ceiling applies to whoever has not
    // started yet.
    const latest = (await getRoster()) ?? roster;
    const run = refreshRun(planned, latest.settings, latest.runtime);
    if (!run) {
      log(`${agentId}: switched off in the Agents panel while waiting — skipping`);
      return;
    }
    // Read AFTER the lock: whoever waited sees the thread as it is now,
    // including the previous run's reply.
    const comment = await getComment(commentId);
    if (!comment) {
      log(`${agentId}: comment not found on the local bridge`);
      return;
    }
    const { bin, args } = commandFor(run, buildPrompt(run, roster, comment));
    if (dryRun) {
      const shown = args.map((a, i) => (args[i - 1] === "-p" ? `<prompt ${a.length} chars>` : a));
      log(
        `DRY RUN ${agentId} · ${run.permission}${run.demoted ? " (demoted: another agent edits)" : ""}` +
          ` · lock ${run.needsLock ? "yes" : "no"}\n  ${bin} ${JSON.stringify(shown)}`,
      );
      return;
    }

    const dirtyBefore = dirtyPaths();
    log(
      `running ${agentId} · ${run.permission}` +
        (run.model ? ` · ${run.model}` : "") +
        (run.effort ? ` · ${run.effort}` : ""),
    );
    const startedAt = Date.now();
    const { code, timedOut, stderr, parsed } = await runCli(
      run.cli,
      bin,
      args,
      run.permission === "reply" ? REPLY_TIMEOUT_MS : RUN_TIMEOUT_MS,
    );
    const mins = ((Date.now() - startedAt) / 60000).toFixed(1);
    const session = parsed?.session_id ?? parsed?.sessionId;
    const cost =
      typeof parsed?.total_cost_usd === "number" ? ` · $${parsed.total_cost_usd.toFixed(2)}` : "";
    log(
      `${agentId}: finished in ${mins} min · exit ${code}${timedOut ? " (watchdog)" : ""}` +
        (session ? ` · session ${session}` : "") +
        cost,
    );
    const reason = errorReason(parsed, stderr);
    if (code !== 0 && reason) log(`${agentId}: reason: ${reason}`);

    // Verdict: a reply from THIS run. A reply from a previous run does not count.
    const after = (await getComment(commentId)) ?? comment;
    if (answeredSince(after, agentId, startedAt)) {
      log(`${agentId}: replied — ok`);
      return;
    }

    // Reply does not post on its own (the ceiling forbids it): its final
    // message IS the reply.
    const text = code === 0 && !timedOut ? resultText(parsed) : "";
    if (text) {
      await postReply(agentId, text);
      log(`${agentId}: final message posted by the runner`);
      return;
    }

    const touched = [...dirtyPaths()].filter((p) => !dirtyBefore.has(p));
    const why = timedOut
      ? "the run ran out of time and was interrupted"
      : `the run ended with an error (exit ${code})${reason ? `: ${reason}` : ""}`;
    const failure = touched.length
      ? `I stopped here: ${why}, and ${touched.length} file(s) had already been changed — ` +
        "I will not retry on my own, to avoid applying the same change twice. " +
        "Check `git status` before mentioning me again."
      : `I could not finish: ${why}. Nothing was changed in the code. ` +
        "Reply to me here again and I will try once more.";
    log(`${agentId}: no reply — posting the failure (${touched.length} file(s) touched)`);
    await postReply(agentId, failure);
  } finally {
    if (locked) releaseLock();
  }
}

// ── main ─────────────────────────────────────────────────────────────────────

async function main() {
  if (!commentId || agentIds.length === 0) {
    log("usage: node scripts/mention-run.mjs <commentId> <agentId[,agentId]>");
    process.exit(2);
  }
  // Read NOW, not at mention time, and again after every wait for the lock
  // (runOne): switching off a queued agent makes it skip. A run already in
  // progress is not interrupted.
  const roster = await getRoster();
  if (!roster) {
    log("could not read the Agents panel (GET /agent-settings) — nothing to do");
    return;
  }
  // One process per message, agents in mention order: "@Claude fix it and
  // @Grok check it" runs Grok after Claude's diff.
  for (const run of planRuns(agentIds, roster.settings, roster.runtime)) {
    if (run.skip) {
      log(`${run.agentId}: switched off in the Agents panel — skipping`);
      continue;
    }
    if (run.demoted) log(`${run.agentId}: another agent already edits in this message — going as Reply`);
    await runOne(run, roster);
  }
}

for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => {
    releaseLock();
    process.exit(1);
  });
}

main().catch((err) => {
  log(`unexpected error: ${err.stack || err.message}`);
  releaseLock();
  process.exit(1);
});
