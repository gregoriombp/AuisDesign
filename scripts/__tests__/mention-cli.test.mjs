import assert from "node:assert/strict";
import test from "node:test";

import {
  GIT_DENY,
  agentEnv,
  answeredSince,
  claudeArgs,
  errorReason,
  grokArgs,
  parseCliJson,
  planRuns,
  refreshRun,
  resultText,
} from "../mention-cli.mjs";

const runtime = {
  claude: { cli: "claude", effort: { edit: "high" }, defaults: { model: "claude-opus-5-5" } },
  grok: { cli: "grok", effort: {}, defaults: { model: "grok-4.7" } },
  codex: { cli: null, effort: {}, defaults: { model: null } },
};
const on = (permission, model) => ({ enabled: true, permission, model });
const flagValue = (args, flag) => args[args.indexOf(flag) + 1];
const after = (args, flag) => args.slice(args.indexOf(flag) + 1);

test("one editor per message: the second executor drops to Reply", () => {
  const [claude, grok] = planRuns(
    ["claude", "grok"],
    { claude: on("edit", "claude-opus-5-5"), grok: on("edit", "grok-4.7") },
    runtime,
  );
  assert.equal(claude.permission, "edit");
  assert.equal(grok.permission, "reply");
  assert.equal(grok.demoted, true);
});

test("off and without an engine become skips", () => {
  const runs = planRuns(
    ["claude", "codex"],
    { claude: { ...on("reply", "claude-opus-5-5"), enabled: false }, codex: on("reply", null) },
    runtime,
  );
  assert.deepEqual(runs.map((r) => r.skip), ["off", "off"]);
});

test("only Reply runs outside the lock queue; the effort comes from the ceiling", () => {
  const [reply] = planRuns(["claude"], { claude: on("reply", "claude-opus-5-5") }, runtime);
  const [edit] = planRuns(["claude"], { claude: on("edit", "claude-opus-5-5") }, runtime);
  assert.equal(reply.needsLock, false);
  assert.equal(reply.effort, null);
  assert.equal(edit.needsLock, true);
  assert.equal(edit.effort, "high");
});

test("an agent outside the runtime becomes a skip", () => {
  const [stranger] = planRuns(["stranger"], { stranger: on("reply", "claude-opus-5-5") }, runtime);
  assert.equal(stranger.skip, "off");
});

test("Claude Reply: pure reading, no --effort", () => {
  const args = claudeArgs({
    prompt: "p",
    permission: "reply",
    model: "claude-opus-5-5",
    effort: null,
    maxBudgetUsd: "5",
  });
  assert.equal(flagValue(args, "--permission-mode"), "dontAsk");
  assert.deepEqual(after(args, "--disallowedTools"), ["Edit", "Write", "NotebookEdit", ...GIT_DENY]);
  assert.equal(flagValue(args, "--model"), "claude-opus-5-5");
  assert.equal(args.includes("--effort"), false);
});

test("Claude Edit: bypass, high, and git stays blocked", () => {
  const args = claudeArgs({
    prompt: "p",
    permission: "edit",
    model: "claude-opus-5-5",
    effort: "high",
    maxBudgetUsd: "5",
  });
  assert.equal(flagValue(args, "--permission-mode"), "bypassPermissions");
  assert.equal(flagValue(args, "--effort"), "high");
  assert.deepEqual(after(args, "--disallowedTools"), GIT_DENY);
});

test("Grok: Reply in read-only and without curl; Edit in workspace", () => {
  const reply = grokArgs({ prompt: "p", permission: "reply", model: "grok-4.7", effort: null, cwd: "/repo" });
  const edit = grokArgs({ prompt: "p", permission: "edit", model: "grok-4.7", effort: null, cwd: "/repo" });
  assert.equal(flagValue(reply, "--sandbox"), "read-only");
  assert.ok(reply.includes("Bash(curl *)"));
  assert.equal(flagValue(edit, "--sandbox"), "workspace");
  assert.equal(edit.includes("Bash(curl *)"), false);
  assert.ok(edit.includes("Bash(git commit *)"));
  assert.equal(flagValue(edit, "--cwd"), "/repo");
});

test("parseCliJson survives a notice line before the JSON", () => {
  assert.deepEqual(parseCliJson('{"result":"ok"}'), { result: "ok" });
  assert.deepEqual(parseCliJson('update notice\n{"text":"ok"}\n'), { text: "ok" });
  assert.equal(parseCliJson(""), null);
});

test("resultText reads result (Claude) and text (Grok)", () => {
  assert.equal(resultText({ result: " hi " }), "hi");
  assert.equal(resultText({ text: "hi" }), "hi");
  assert.equal(resultText(null), "");
});

test("errorReason returns the first useful line of the error", () => {
  assert.equal(
    errorReason({ is_error: true, result: "\nClaude AI usage limit reached\nmore" }, ""),
    "Claude AI usage limit reached",
  );
  assert.equal(errorReason(null, "spawn /nonexistent ENOENT\n"), "spawn /nonexistent ENOENT");
  assert.equal(errorReason({ is_error: false, result: "ok" }, ""), "");
});

test("a reply from a previous run does not count as this run's success", () => {
  const comment = { replies: [{ authorKind: "agent", authorId: "claude", createdAt: 100 }] };
  assert.equal(answeredSince(comment, "claude", 200), false);
  assert.equal(answeredSince(comment, "claude", 100), true);
  assert.equal(answeredSince(comment, "grok", 50), false);
});

test("Reply has no Bash: allow rules in the settings cannot pierce the ceiling", () => {
  const claude = claudeArgs({
    prompt: "p",
    permission: "reply",
    model: "claude-opus-5-5",
    effort: null,
    maxBudgetUsd: "5",
  });
  assert.equal(flagValue(claude, "--tools"), "Read,Glob,Grep");
  const grok = grokArgs({ prompt: "p", permission: "reply", model: "grok-4.7", effort: null, cwd: "/repo" });
  assert.equal(flagValue(grok, "--tools"), "Read,Grep");
  const edit = claudeArgs({
    prompt: "p",
    permission: "edit",
    model: "claude-opus-5-5",
    effort: "high",
    maxBudgetUsd: "5",
  });
  assert.equal(edit.includes("--tools"), false);
});

test("git that destroys someone else's work is blocked, bare and with arguments", () => {
  for (const verb of ["commit", "push", "checkout", "stash", "reset", "restore", "clean", "rebase", "rm", "switch"]) {
    assert.ok(GIT_DENY.includes(`Bash(git ${verb})`), `bare git ${verb}`);
    assert.ok(GIT_DENY.includes(`Bash(git ${verb} *)`), `git ${verb} *`);
  }
});

test("the agent's environment is an allowlist: app secrets do not pass", () => {
  const parent = {
    PATH: "/bin",
    HOME: "/h",
    LANG: "en_US.UTF-8",
    DATABASE_URL: "postgres://x",
    OPENAI_API_KEY: "o",
    ANTHROPIC_API_KEY: "a",
    BRIDGE_AGENT_TOKEN: "b",
    BRIDGE_BASE: "https://a-deployment",
    REVIEW_BRIDGE_BACKUP_DIR: "/somewhere",
    NEXT_PUBLIC_AUIS_DOT_DISABLED: "true",
    XAI_API_KEY: "x",
  };
  const claude = agentEnv(parent, "claude", "http://127.0.0.1:3000");
  assert.equal(claude.PATH, "/bin");
  assert.equal(claude.HOME, "/h");
  assert.equal(claude.LANG, "en_US.UTF-8");
  assert.equal(claude.BRIDGE_BASE, "http://127.0.0.1:3000");
  for (const key of [
    "DATABASE_URL",
    "OPENAI_API_KEY",
    "ANTHROPIC_API_KEY",
    "BRIDGE_AGENT_TOKEN",
    "REVIEW_BRIDGE_BACKUP_DIR",
    "NEXT_PUBLIC_AUIS_DOT_DISABLED",
    "XAI_API_KEY",
  ]) {
    assert.equal(key in claude, false, key);
  }
  assert.equal(agentEnv(parent, "grok", "http://127.0.0.1:3000").XAI_API_KEY, "x");
});

test("re-read after the lock: off skips, only demotes, never promotes", () => {
  const [edit] = planRuns(["claude"], { claude: on("edit", "claude-opus-5-5") }, runtime);
  assert.equal(
    refreshRun(edit, { claude: { ...on("edit", "claude-opus-5-5"), enabled: false } }, runtime),
    null,
  );
  const downgraded = refreshRun(edit, { claude: on("reply", "claude-sonnet-5") }, runtime);
  assert.equal(downgraded.permission, "reply");
  assert.equal(downgraded.model, "claude-sonnet-5");
  assert.equal(downgraded.effort, null);

  const [, demoted] = planRuns(
    ["claude", "grok"],
    { claude: on("edit", "claude-opus-5-5"), grok: on("edit", "grok-4.7") },
    runtime,
  );
  assert.equal(refreshRun(demoted, { grok: on("edit", "grok-4.7") }, runtime).permission, "reply");

  const [reply] = planRuns(["claude"], { claude: on("reply", "claude-opus-5-5") }, runtime);
  assert.equal(refreshRun(reply, { claude: on("edit", "claude-opus-5-5") }, runtime).permission, "reply");
});

test("Grok streams streaming-messages-json: the answer is only the final message", () => {
  const args = grokArgs({ prompt: "p", permission: "reply", model: "grok-4.7", effort: null, cwd: "/repo" });
  assert.equal(flagValue(args, "--output-format"), "streaming-messages-json");
  const ndjson = [
    '{"type":"system","subtype":"init","session_id":"s1"}',
    '{"type":"assistant","message":{"role":"assistant","content":[{"type":"text","text":"Let me read the file."},{"type":"tool_use","name":"read_file"}]},"session_id":"s1"}',
    '{"type":"user","message":{"role":"user","content":[{"type":"tool_result"}]},"session_id":"s1"}',
    '{"type":"assistant","message":{"role":"assistant","content":[{"type":"text","text":"The file says changed."}]},"session_id":"s1"}',
    '{"type":"result","subtype":"success","is_error":false,"result":"The file says changed.","total_cost_usd":0.018,"session_id":"s1"}',
  ].join("\n");
  const parsed = parseCliJson(ndjson);
  assert.equal(resultText(parsed), "The file says changed.");
  assert.equal(parsed.session_id, "s1");
});
