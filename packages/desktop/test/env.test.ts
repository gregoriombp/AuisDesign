import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import {
  findOnPath,
  locateTool,
  parseEnvOutput,
  parseVersion,
  probeTools,
  resolveShellEnv,
  scrubEnv,
} from "../src/main/env.ts";
import { tempDir } from "./helpers.ts";

const M = "__MARK__";

/** An executable file. As a stand-in shell it is called as: <flags> <script> <name> <cwd> <marker>. */
function executable(dir: string, name: string, body: string): string {
  const file = path.join(dir, name);
  fs.writeFileSync(file, `#!/bin/sh\n${body}\n`, { mode: 0o755 });
  return file;
}

// A shell whose startup files print a banner, then the answer, then more noise.
const ANSWERING = [
  `printf 'Welcome back\\n'`,
  `printf '%s' "$5"`,
  `printf 'FOO=bar\\0MULTI=line one\\nline two\\0PATH=/fake/bin\\0npm_config_prefix=/somewhere\\0'`,
  `printf '%s' "$5"`,
  `printf '\\nbye\\n'`,
].join("\n");

test("reads the environment between the markers", () => {
  const output = `banner\n${M}A=1\0B=two words\0${M}\ntrailing`;
  assert.deepEqual(parseEnvOutput(output, M), { A: "1", B: "two words" });
});

test("keeps multi-line values and values with an equals sign whole", () => {
  const output = `${M}KEY=-----BEGIN-----\nabc\n-----END-----\0URL=https://x.test/?a=b\0${M}`;
  assert.deepEqual(parseEnvOutput(output, M), {
    KEY: "-----BEGIN-----\nabc\n-----END-----",
    URL: "https://x.test/?a=b",
  });
});

test("an answer without both markers is no answer", () => {
  assert.equal(parseEnvOutput("no markers at all", M), null);
  assert.equal(parseEnvOutput(`${M}A=1\0`, M), null);
  assert.equal(parseEnvOutput(`${M}${M}`, M), null);
});

test("drops what describes the launcher, not the user's terminal", () => {
  const env = scrubEnv({
    PATH: "/bin",
    HOME: "/Users/ana",
    npm_config_prefix: "/app",
    npm_lifecycle_event: "start",
    ELECTRON_RUN_AS_NODE: "1",
    INIT_CWD: "/somewhere",
    INIT_CWD_NOT: "kept",
    GONE: undefined,
  });
  assert.deepEqual(env, { PATH: "/bin", HOME: "/Users/ana", INIT_CWD_NOT: "kept" });
});

test("asks the interactive login shell first", async () => {
  const shell = executable(tempDir("env"), "shell", ANSWERING);
  const { env, source } = await resolveShellEnv({ cwd: "/", base: { SHELL: shell, PATH: "/usr/bin:/bin" } });
  assert.equal(source, "interactive");
  assert.equal(env.FOO, "bar");
  assert.equal(env.MULTI, "line one\nline two");
  assert.equal(env.PATH, "/fake/bin");
  assert.equal(env.npm_config_prefix, undefined, "launcher-only variables are scrubbed from the answer too");
});

test("falls back to a plain login shell when the interactive one fails", async () => {
  const shell = executable(tempDir("env"), "shell", `[ "$1" = "-ilc" ] && exit 1\n${ANSWERING}`);
  const { env, source } = await resolveShellEnv({ cwd: "/", base: { SHELL: shell, PATH: "/usr/bin:/bin" } });
  assert.equal(source, "login");
  assert.equal(env.FOO, "bar");
});

test("falls back to the launch environment plus the usual tool folders", async () => {
  const shell = executable(tempDir("env"), "shell", "exit 1");
  const { env, source } = await resolveShellEnv({
    cwd: "/",
    base: { SHELL: shell, PATH: "/custom/bin:/usr/bin", KEEP: "yes", npm_config_prefix: "/app" },
  });
  assert.equal(source, "fallback");
  assert.equal(env.KEEP, "yes");
  assert.equal(env.npm_config_prefix, undefined);
  const dirs = env.PATH.split(":");
  assert.deepEqual(dirs.slice(0, 2), ["/custom/bin", "/usr/bin"], "what was there stays first");
  assert.ok(dirs.includes("/opt/homebrew/bin") && dirs.includes("/usr/local/bin"));
  assert.equal(dirs.filter((dir) => dir === "/usr/bin").length, 1, "nothing is listed twice");
});

test("a shell that does not exist is a fallback, not a crash", async () => {
  const { source } = await resolveShellEnv({
    cwd: "/",
    base: { SHELL: path.join(tempDir("env"), "no-such-shell"), PATH: "/usr/bin:/bin" },
  });
  assert.equal(source, "fallback");
});

test("a shell that hangs is given up on", async () => {
  const shell = executable(tempDir("env"), "shell", "exec sleep 30");
  const started = Date.now();
  const { source } = await resolveShellEnv({
    cwd: "/",
    timeoutMs: 150,
    base: { SHELL: shell, PATH: "/usr/bin:/bin" },
  });
  assert.equal(source, "fallback");
  assert.ok(Date.now() - started < 5000, "two short attempts, not thirty seconds");
});

test("the answer is taken as soon as it is complete, whatever the shell does next", async () => {
  // A startup file that leaves something running keeps the pipe open.
  const shell = executable(tempDir("env"), "shell", `${ANSWERING}\nexec sleep 30`);
  const started = Date.now();
  const { env, source } = await resolveShellEnv({ cwd: "/", base: { SHELL: shell, PATH: "/usr/bin:/bin" } });
  assert.equal(source, "interactive");
  assert.equal(env.FOO, "bar");
  assert.ok(Date.now() - started < 5000);
});

test("the project folder is handed to the shell, which answers from inside it", async () => {
  const dir = tempDir("env");
  const shell = executable(dir, "shell", `printf '%s' "$5"; printf 'ASKED_FROM=%s\\0' "$4"; printf '%s' "$5"`);
  const { env } = await resolveShellEnv({ cwd: dir, base: { SHELL: shell, PATH: "/usr/bin:/bin" } });
  assert.equal(env.ASKED_FROM, dir);
});

test("finds a tool the way a shell would", () => {
  const first = tempDir("path");
  const second = tempDir("path");
  fs.writeFileSync(path.join(first, "tool"), "not executable", { mode: 0o644 });
  fs.mkdirSync(path.join(first, "folder"));
  const real = executable(second, "tool", "exit 0");

  const env = { PATH: `${first}::${second}` };
  assert.equal(findOnPath("tool", env), real, "a file that cannot run is skipped");
  assert.equal(findOnPath("folder", env), null, "a folder is not a tool");
  assert.equal(findOnPath("missing", env), null);
  assert.equal(findOnPath("tool", {}), null);
});

test("reads the number out of what --version prints", () => {
  assert.equal(parseVersion("v24.12.0\n"), "24.12.0");
  assert.equal(parseVersion("git version 2.50.1 (Apple Git-155)"), "2.50.1");
  assert.equal(parseVersion("2.1.322 (Claude Code)"), "2.1.322");
  assert.equal(parseVersion("codex-cli 0.167"), "0.167");
  assert.equal(parseVersion("no digits here"), null);
});

test("says where a tool is and which version it reports", async () => {
  const dir = tempDir("tools");
  const node = executable(dir, "node", "echo v22.6.0");
  executable(dir, "git", "exit 3");
  const env = { PATH: dir };

  assert.deepEqual(await locateTool("node", env), { path: node, version: "22.6.0" });
  assert.deepEqual(await locateTool("git", env), { path: path.join(dir, "git"), version: null });
  assert.equal(await locateTool("npm", env), null);
});

test("a tool that is there but will not say its version still counts as there", async () => {
  const dir = tempDir("tools");
  executable(dir, "node", "echo v22.6.0");
  executable(dir, "git", "exit 3");
  const tools = await probeTools({ PATH: dir });
  assert.deepEqual(tools, [
    { name: "node", version: "22.6.0" },
    { name: "npm", version: null },
    { name: "git", version: "found" },
    { name: "claude", version: null },
    { name: "codex", version: null },
  ]);
});
