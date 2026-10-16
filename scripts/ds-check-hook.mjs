#!/usr/bin/env node
/**
 * Auis — ds:check as a Claude Code hook, so the agent hears about design-system
 * breaks while it works instead of after.
 *
 *   post   PostToolUse on Edit/Write: checks ONLY the edited file, ONLY the
 *          objective rules (tier "edit": hardcoded color, arbitrary values, raw
 *          <svg>, hand-rolled overlay, raw primitive import). Asking for
 *          everything on every edit makes the model play it safe; this asks for
 *          what is plainly broken.
 *   stop   Stop: runs every rule on the files touched this session and reports
 *          only what the agent has not been told yet. Skips when the agent is
 *          already continuing because of a stop hook, so it can never trap a turn.
 *
 *   on | off | status   install / remove / show the hooks in
 *          .claude/settings.local.json (personal, gitignored — never the shared
 *          settings.json). Runtime kill switch: AUIS_DS_CHECK_HOOK=0.
 *
 * Findings → exit 2 with the message on stderr (Claude Code feeds it to the
 * agent). Clean → exit 0, silent. The hook crashing → exit 0: a broken checker
 * must never block the agent. Exceptions come from the same .auis/ds-check.json
 * and inline `ds-check-disable` comments the CLI reads.
 */

import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { check, loadConfig } from "./ds-check.mjs";

const MARKER = "ds-check-hook.mjs";
const SCRIPT_REL = "scripts/ds-check-hook.mjs";
const HOOKED_EXT_RE = /\.(tsx?|css)$/;
const MAX_LISTED = 15;

const projectRoot = (input) => resolve(process.env.CLAUDE_PROJECT_DIR || input?.cwd || process.cwd());

// ── session state (outside the repo: os tmpdir, one file per session) ───────

function statePath(sessionId) {
  const dir = process.env.AUIS_DS_CHECK_STATE_DIR || join(tmpdir(), "auis-ds-check");
  const safe = String(sessionId || "no-session").replace(/[^\w.-]/g, "_");
  return join(dir, `${safe}.json`);
}

function readState(sessionId) {
  try {
    const s = JSON.parse(readFileSync(statePath(sessionId), "utf8"));
    return { touched: s.touched ?? [], reported: s.reported ?? [] };
  } catch {
    return { touched: [], reported: [] };
  }
}

function writeState(sessionId, state) {
  const p = statePath(sessionId);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(state));
}

/** Line numbers shift between edits, so a finding is known by rule + file + text. */
const fingerprint = (f) => `${f.rule}|${f.file}|${f.text}`;

function format(findings, intro) {
  const lines = [intro];
  for (const f of findings.slice(0, MAX_LISTED)) {
    lines.push(`  ${f.file}:${f.line}  [${f.rule}]  ${f.text}`);
    lines.push(`    → ${f.hint}`);
  }
  if (findings.length > MAX_LISTED) lines.push(`  … +${findings.length - MAX_LISTED} more (npm run ds:check -- --json)`);
  lines.push(
    "Fix it with tokens / Au* components. If it is deliberate, say why where it lives:",
    "  `// ds-check-disable-next-line <rule> -- <reason>` (or `{/* … */}` in JSX), or an entry in .auis/ds-check.json.",
  );
  return lines.join("\n");
}

// ── events ──────────────────────────────────────────────────────────────────

function onPost(input) {
  const filePath = input?.tool_input?.file_path;
  if (!filePath || !HOOKED_EXT_RE.test(filePath)) return 0;
  const root = projectRoot(input);
  const abs = resolve(root, filePath);
  const rel = relative(root, abs);
  if (rel.startsWith("..") || isAbsolute(rel) || !existsSync(abs)) return 0;

  const state = readState(input.session_id);
  const relPosix = rel.split("\\").join("/");
  if (!state.touched.includes(relPosix)) state.touched.push(relPosix);

  const { findings } = check({ root, targets: [abs], tier: "edit", config: loadConfig(root) });
  const primary = findings.filter((f) => f.primary);
  for (const f of primary) {
    const fp = fingerprint(f);
    if (!state.reported.includes(fp)) state.reported.push(fp);
  }
  writeState(input.session_id, state);
  if (!primary.length) return 0;

  process.stderr.write(
    format(primary, `ds:check — ${primary.length} design-system break(s) in ${relPosix} after this edit:`) + "\n",
  );
  return 2;
}

function onStop(input) {
  if (input?.stop_hook_active) return 0;
  const root = projectRoot(input);
  const state = readState(input?.session_id);
  const targets = state.touched.filter((f) => existsSync(join(root, f)));
  if (!targets.length) return 0;

  const { findings } = check({ root, targets, tier: "all", config: loadConfig(root) });
  const fresh = findings.filter((f) => f.primary && !state.reported.includes(fingerprint(f)));
  if (!fresh.length) return 0;

  for (const f of fresh) state.reported.push(fingerprint(f));
  writeState(input.session_id, state);
  process.stderr.write(
    format(fresh, `ds:check — end-of-turn pass over the ${targets.length} file(s) you touched found ${fresh.length} new finding(s):`) + "\n",
  );
  return 2;
}

// ── install / remove ────────────────────────────────────────────────────────

const settingsPath = (root) => join(root, ".claude", "settings.local.json");
const command = (event) => `node "$CLAUDE_PROJECT_DIR/${SCRIPT_REL}" ${event}`;
const isOurs = (h) => typeof h?.command === "string" && h.command.includes(MARKER);

function readSettings(root) {
  const p = settingsPath(root);
  if (!existsSync(p)) return {};
  try {
    return JSON.parse(readFileSync(p, "utf8"));
  } catch (err) {
    throw new Error(`${p} is not valid JSON (${err.message}) — fix it by hand; nothing was changed.`);
  }
}

/** Removes only the entries this script installed; drops groups and events left empty. */
function strip(settings) {
  const hooks = settings.hooks;
  if (!hooks || typeof hooks !== "object") return settings;
  for (const event of Object.keys(hooks)) {
    if (!Array.isArray(hooks[event])) continue;
    hooks[event] = hooks[event]
      .map((g) => (Array.isArray(g?.hooks) ? { ...g, hooks: g.hooks.filter((h) => !isOurs(h)) } : g))
      .filter((g) => !Array.isArray(g?.hooks) || g.hooks.length > 0);
    if (!hooks[event].length) delete hooks[event];
  }
  if (!Object.keys(hooks).length) delete settings.hooks;
  return settings;
}

export function install(root) {
  const settings = strip(readSettings(root));
  settings.hooks ??= {};
  (settings.hooks.PostToolUse ??= []).push({
    matcher: "Edit|Write|MultiEdit",
    hooks: [{ type: "command", command: command("post"), timeout: 30 }],
  });
  (settings.hooks.Stop ??= []).push({
    hooks: [{ type: "command", command: command("stop"), timeout: 60 }],
  });
  mkdirSync(join(root, ".claude"), { recursive: true });
  writeFileSync(settingsPath(root), JSON.stringify(settings, null, 2) + "\n");
}

export function uninstall(root) {
  if (!existsSync(settingsPath(root))) return;
  writeFileSync(settingsPath(root), JSON.stringify(strip(readSettings(root)), null, 2) + "\n");
}

export function isInstalled(root) {
  const hooks = readSettings(root).hooks ?? {};
  return Object.values(hooks).some((groups) =>
    Array.isArray(groups) && groups.some((g) => Array.isArray(g?.hooks) && g.hooks.some(isOurs)));
}

// ── entry ───────────────────────────────────────────────────────────────────

function readStdin() {
  try {
    const raw = readFileSync(0, "utf8");
    return raw.trim() ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function main(argv) {
  const cmd = argv[0];
  if (cmd === "post" || cmd === "stop") {
    if (process.env.AUIS_DS_CHECK_HOOK === "0") return 0;
    try {
      const input = readStdin();
      return cmd === "post" ? onPost(input) : onStop(input);
    } catch (err) {
      // Never block the agent because the checker broke — say so and step aside.
      process.stderr.write(`ds:check hook skipped: ${err.message}\n`);
      return 0;
    }
  }

  const root = resolve(process.env.CLAUDE_PROJECT_DIR || process.cwd());
  const where = relative(root, settingsPath(root));
  try {
    if (cmd === "on" || cmd === "install") {
      install(root);
      console.log(`ds:check hook on — PostToolUse (Edit|Write) + Stop in ${where}.`);
      console.log("Claude Code normally picks it up live; if not, check /hooks or restart the session.");
      return 0;
    }
    if (cmd === "off" || cmd === "uninstall") {
      uninstall(root);
      console.log(`ds:check hook off — removed from ${where}.`);
      return 0;
    }
    if (cmd === "status") {
      console.log(`ds:check hook is ${isInstalled(root) ? "on" : "off"} (${where}).`);
      return 0;
    }
  } catch (err) {
    console.error(err.message);
    return 1;
  }
  console.error("usage: ds-check-hook.mjs on | off | status   (post | stop are called by Claude Code)");
  return 1;
}

if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  process.exitCode = main(process.argv.slice(2));
}
