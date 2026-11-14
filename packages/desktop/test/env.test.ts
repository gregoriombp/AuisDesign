import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  findOnPath,
  parseEnvOutput,
  parseVersion,
  resolveShellEnv,
  scrubEnv,
} from "../src/main/env.ts";
import { temp, write } from "./helpers.ts";
test("shell output preserves multiline values while ignoring banners", () => {
  assert.deepEqual(
    parseEnvOutput(
      "bannerMARKPATH=/bin\0VALUE=a=b\nsecond line\0MARKbye",
      "MARK",
    ),
    { PATH: "/bin", VALUE: "a=b\nsecond line" },
  );
  assert.equal(parseEnvOutput("banner"), null);
  assert.equal(parseEnvOutput("MARKMARK", "MARK"), null);
});
test("npm prefix and Electron launch flags never leak into a project's environment", () => {
  assert.deepEqual(
    scrubEnv({
      PATH: "/bin",
      npm_config_prefix: "/wrong",
      npm_lifecycle_script: "electron .",
      ELECTRON_RUN_AS_NODE: "1",
      INIT_CWD: "/wrong",
      DISABLE_AUTO_UPDATE: "1",
      TOKEN: "a=b",
      PORT: "3010",
      missing: undefined,
    }),
    { PATH: "/bin", TOKEN: "a=b", PORT: "3010" },
  );
});
test("shell lookup starts in the project folder and paths with quotes remain literal", async (t) => {
  const root = temp(t);
  const cwd = root + "/a ' quoted $(nothing)";
  fs.mkdirSync(cwd);
  const result = await resolveShellEnv({
    cwd,
    base: { SHELL: "/bin/sh", PATH: "/usr/bin:/bin" },
    timeoutMs: 1000,
  });
  assert.equal(result.source, "interactive");
  assert.equal(result.env.PWD, cwd);
});
test("a failed shell falls back to known tool folders and scrubs launch-only keys", async (t) => {
  const result = await resolveShellEnv({
    cwd: temp(t),
    base: {
      SHELL: "/missing/shell",
      PATH: "/custom",
      npm_config_prefix: "wrong",
    },
    timeoutMs: 50,
  });
  assert.equal(result.source, "fallback");
  assert.ok(result.env.PATH.includes("/opt/homebrew/bin"));
  assert.equal(result.env.npm_config_prefix, undefined);
});
test("login shell is tried if the interactive shell does not return an environment", async (t) => {
  const root = temp(t);
  write(
    root,
    "shell",
    '#!/bin/sh\nif [ "$1" = "-ilc" ]; then exit 1; fi\nexec /bin/sh "$@"\n',
  );
  fs.chmodSync(root + "/shell", 0o755);
  const result = await resolveShellEnv({
    cwd: root,
    base: { SHELL: root + "/shell", PATH: "/usr/bin:/bin" },
    timeoutMs: 1000,
  });
  assert.equal(result.source, "login");
});
test("PATH lookup requires executable files, and versions can have a tool prefix", (t) => {
  const root = temp(t);
  write(root, "node", "text");
  assert.equal(findOnPath("node", { PATH: root }), null);
  fs.chmodSync(root + "/node", 0o755);
  assert.equal(findOnPath("node", { PATH: root }), root + "/node");
  assert.equal(parseVersion("git version 2.50.1 (Apple Git-155)"), "2.50.1");
});

test("a hung shell startup is bounded even when its child keeps stdout open", async (t) => {
  const root = temp(t);
  write(root, "shell", '#!/bin/sh\nsleep 30 &\necho $! >> "$AUIS_TEST_PIDS"\nwait\n');
  fs.chmodSync(root + "/shell", 0o755);
  const started = Date.now();
  const result = await resolveShellEnv({
    cwd: root,
    base: { SHELL: root + "/shell", PATH: "/usr/bin:/bin", AUIS_TEST_PIDS: root + "/pids" },
    timeoutMs: 100,
  });
  assert.equal(result.source, "fallback");
  assert.ok(Date.now() - started < 2000);
  const { pidAlive } = await import("../src/main/nextLock.ts");
  const { until } = await import("./helpers.ts");
  for (const pid of fs.readFileSync(root + "/pids", "utf8").trim().split("\n").map(Number)) {
    await until(() => !pidAlive(pid));
  }
});
