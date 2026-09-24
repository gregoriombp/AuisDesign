// Translation of "agent + ceiling + model" into a command line, plus the
// readers of what the CLI returns. Pure on purpose: the test
// (scripts/__tests__/mention-cli.test.mjs) covers every ceiling without opening a
// process. Reading the Agents panel and running is the runner's job
// (scripts/mention-run.mjs).

/**
 * Under no ceiling. Commit and push belong to the user; the others erase work
 * that is not the agent's — the checkout is shared with other sessions. Bare
 * form and with arguments, because the rule matches the command text.
 */
const GIT_DENIED_VERBS = [
  "commit",
  "push",
  "checkout",
  "stash",
  "reset",
  "restore",
  "clean",
  "rebase",
  "rm",
  "switch",
];
export const GIT_DENY = GIT_DENIED_VERBS.flatMap((verb) => [
  `Bash(git ${verb})`,
  `Bash(git ${verb} *)`,
]);

/**
 * Reply only reads. `dontAsk` alone is not enough: whatever the settings'
 * allow rules let through (node -e, npm run, git checkout…) would pass without
 * asking. With no Bash in the list there is no way to write or to post.
 */
const CLAUDE_REPLY_TOOLS = "Read,Glob,Grep";
const GROK_REPLY_TOOLS = "Read,Grep";

/**
 * Grok in Reply: the sandbox does not cut the network on macOS. Without curl it
 * cannot post or change status on its own — the runner posts the reply.
 */
export const GROK_REPLY_DENY = ["Bash(curl *)", ...GIT_DENY];

const EDIT_TOOLS = ["Edit", "Write", "NotebookEdit"];

/**
 * One run per agent, in mention order. One editor per message: "@Claude @Grok
 * fix it" with both in Edit would make two diffs in the same checkout — the
 * first one mentioned edits, the others drop to Reply for that message.
 */
export function planRuns(agentIds, settings, runtime) {
  let editor = null;
  return agentIds.map((agentId) => {
    const s = settings?.[agentId];
    const rt = runtime?.[agentId];
    if (!rt?.cli || !s?.enabled) return { agentId, skip: "off" };
    let permission = s.permission;
    let demoted = false;
    if (permission === "edit") {
      if (editor) {
        permission = "reply";
        demoted = true;
      } else {
        editor = agentId;
      }
    }
    return {
      agentId,
      cli: rt.cli,
      permission,
      demoted,
      model: s.model ?? rt.defaults?.model ?? null,
      effort: rt.effort?.[permission] ?? null,
      // Reply reads and answers: no need to wait for whoever writes to the checkout.
      needsLock: permission !== "reply",
    };
  });
}

// The variadic lists (--disallowedTools) always go LAST: whatever came after
// them would be swallowed as one more item.
export function claudeArgs({ prompt, permission, model, effort, maxBudgetUsd }) {
  const args = ["-p", prompt, "--output-format", "json", "--max-budget-usd", String(maxBudgetUsd)];
  if (model) args.push("--model", model);
  if (effort) args.push("--effort", effort);
  if (permission === "edit") {
    args.push("--permission-mode", "bypassPermissions", "--disallowedTools", ...GIT_DENY);
  } else {
    // Executor Reply: pure reading, no Bash (see CLAUDE_REPLY_TOOLS). The
    // runner posts the reply.
    args.push(
      "--tools",
      CLAUDE_REPLY_TOOLS,
      "--permission-mode",
      "dontAsk",
      "--disallowedTools",
      ...EDIT_TOOLS,
      ...GIT_DENY,
    );
  }
  return args;
}

export function grokArgs({ prompt, permission, model, effort, cwd }) {
  const args = [
    "-p",
    prompt,
    // In `json` Grok glues what it writes before each tool into the answer
    // ("…let me look at the component.The background…"). In streaming, the
    // last line is a `result` with only the final message — Claude's format.
    "--output-format",
    "streaming-messages-json",
    "--cwd",
    cwd,
    "--no-auto-update",
    // No pending approval: a headless run does not wait for anyone.
    "--always-approve",
  ];
  if (model) args.push("--model", model);
  if (effort) args.push("--effort", effort);
  // The sandbox covers the whole process: in read-only nothing writes outside
  // ~/.grok and temp, whatever the tool. In workspace, only inside the repo.
  args.push("--sandbox", permission === "edit" ? "workspace" : "read-only");
  if (permission !== "edit") args.push("--tools", GROK_REPLY_TOOLS);
  for (const rule of permission === "edit" ? GIT_DENY : GROK_REPLY_DENY) {
    args.push("--deny", rule);
  }
  return args;
}

/** The CLI's JSON. If a line came before it (a notice, an update), the last one counts. */
export function parseCliJson(stdout) {
  const text = String(stdout ?? "").trim();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    const last = text.split("\n").map((l) => l.trim()).filter(Boolean).pop();
    try {
      return JSON.parse(last);
    } catch {
      return null;
    }
  }
}

/** The agent's final text: `result` (Claude, and Grok in streaming); `text` in Grok's json. */
export function resultText(parsed) {
  const text =
    typeof parsed?.result === "string"
      ? parsed.result
      : typeof parsed?.text === "string"
        ? parsed.text
        : "";
  return text.trim();
}

/** First useful line of the error, for the log and the failure reply. */
export function errorReason(parsed, stderr) {
  const fromJson = parsed?.is_error ? resultText(parsed) : "";
  const line = `${fromJson}\n${stderr ?? ""}`
    .split("\n")
    .map((l) => l.trim())
    .find(Boolean);
  return line ? line.slice(0, 200) : "";
}

/** Verdict: the agent replied since THIS run started. */
export function answeredSince(comment, agentId, startedAt) {
  return (comment?.replies ?? []).some(
    (r) => r.authorKind === "agent" && r.authorId === agentId && (r.createdAt ?? 0) >= startedAt,
  );
}

/**
 * The agent's environment as an ALLOWLIST: the runner inherits the dev server's
 * .env.local (API keys, tokens, storage) and none of it belongs to the agent.
 * API keys stay out too so they never swap the paying account — each CLI uses
 * the account it is logged into. XAI_API_KEY goes only to Grok, which reads it
 * on purpose.
 */
const ENV_KEEP =
  /^(PATH|HOME|USER|LOGNAME|SHELL|TMPDIR|TERM|COLORTERM|LANG|LC_[A-Z_]+|TZ|XDG_[A-Z_]+|CLAUDE_CODE_[A-Z_]+|CLAUDE_CONFIG_DIR|NODE_EXTRA_CA_CERTS|SSL_CERT_FILE|HTTPS?_PROXY|NO_PROXY|__CF_USER_TEXT_ENCODING)$/;
const GROK_ENV_KEEP = /^(XAI_API_KEY|GROK_[A-Z_]+)$/;

export function agentEnv(parent, cli, base) {
  const env = {};
  for (const [key, value] of Object.entries(parent ?? {})) {
    if (value === undefined) continue;
    if (ENV_KEEP.test(key) || (cli === "grok" && GROK_ENV_KEEP.test(key))) env[key] = value;
  }
  env.BRIDGE_BASE = base;
  return env;
}

/**
 * The Agents panel re-read after waiting for the lock. Off skips (null). The
 * ceiling can only go DOWN: whoever did not take the lock (Reply, or demoted in
 * this message) does not become Edit halfway through.
 */
export function refreshRun(run, settings, runtime) {
  const [fresh] = planRuns([run.agentId], settings, runtime);
  if (fresh.skip) return null;
  const permission =
    run.demoted || run.permission === "reply" ? "reply" : fresh.permission;
  return {
    ...fresh,
    permission,
    demoted: run.demoted,
    effort: runtime?.[run.agentId]?.effort?.[permission] ?? null,
    needsLock: run.needsLock,
  };
}
