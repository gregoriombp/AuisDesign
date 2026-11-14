// These tests run real processes: a project whose `dev` script is a stand-in
// for `next dev` (fixtures/dev-server.mjs), started through the real package
// manager. Process groups, signals and lock files are the whole point of the
// module, and a fake of them would only test the fake.

import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { afterEach, test } from "node:test";
import { fileURLToPath } from "node:url";
import { scrubEnv, type Env } from "../src/main/env.ts";
import { devLockFile, pidAlive, readDevLock } from "../src/main/nextLock.ts";
import { createProjectServer, type ProjectServer, type ProjectServerOptions } from "../src/main/server.ts";
import type { ServerState } from "../src/shared/ipc.ts";
import { tempDir, until, writeJson } from "./helpers.ts";

const FIXTURE = fileURLToPath(new URL("./fixtures/dev-server.mjs", import.meta.url));

/** What the tests' own shell has, without what npm adds for its own scripts. */
const ENV: Env = {
  ...scrubEnv(process.env),
  npm_config_audit: "false",
  npm_config_fund: "false",
  npm_config_update_notifier: "false",
};

const FAST: ProjectServerOptions = {
  resolveEnv: async () => ENV,
  readyTimeoutMs: 20_000,
  httpTimeoutMs: 5_000,
  stopGraceMs: 3_000,
  watchIntervalMs: 40,
};

const devScript = (mode: string) => `${JSON.stringify(process.execPath)} ${JSON.stringify(FIXTURE)} ${mode}`;

interface ProjectOptions {
  installed?: boolean;
  manifest?: Record<string, unknown>;
}

/** A throwaway project whose dev script is the fixture in `mode`. */
function project(mode: string, { installed = true, manifest = {} }: ProjectOptions = {}): string {
  const root = tempDir("server");
  writeJson(path.join(root, "package.json"), {
    name: "fixture",
    private: true,
    scripts: { dev: devScript(mode) },
    ...manifest,
  });
  if (installed) fs.mkdirSync(path.join(root, "node_modules"));
  return root;
}

const opened: ProjectServer[] = [];

/**
 * A server for the test, stopped when the test ends whether it passed or not.
 * A test that fails with its server still up would otherwise leave a process
 * behind, and that process would keep this file's own process from exiting.
 */
function serverFor(root: string, options: ProjectServerOptions): ProjectServer {
  const server = createProjectServer(root, options);
  opened.push(server);
  return server;
}

/** Processes a test started outside the server, ended the same way. */
const strays: ChildProcess[] = [];

afterEach(async () => {
  for (const server of opened.splice(0)) await server.stop();
  for (const child of strays.splice(0)) child.kill("SIGKILL");
});

function watch(server: ProjectServer): ServerState[] {
  const states: ServerState[] = [];
  server.onState((state) => states.push(state));
  return states;
}

const statuses = (states: ServerState[]) =>
  states.map((state) => (state.status === "starting" ? `starting:${state.phase}` : state.status));

function fixturePid(root: string): number | null {
  try {
    return Number(fs.readFileSync(path.join(root, "fixture.pid"), "utf8"));
  } catch {
    return null;
  }
}

/** The fixture run directly, the way a terminal's `npm run dev` would hold a folder. */
async function external(root: string): Promise<ChildProcess> {
  const child = spawn(process.execPath, [FIXTURE, "ok"], { cwd: root, stdio: "ignore" });
  strays.push(child);
  await until("the external server's lock", () => readDevLock(root));
  return child;
}

async function gone(pid: number | null | undefined) {
  if (pid) await until(`pid ${pid} to exit`, () => !pidAlive(pid));
}

function expectError(server: ProjectServer, expected: RegExp | string, action: "retry" | "install" = "retry") {
  const state = server.state();
  assert.equal(state.status, "error");
  if (state.status !== "error") return;
  if (typeof expected === "string") assert.equal(state.message, expected);
  else assert.match(state.message, expected);
  assert.equal(state.action, action);
}

test("starts the project's dev script and says where it is", async () => {
  const root = project("ok");
  const server = serverFor(root, FAST);
  const states = watch(server);
  try {
    await server.start();

    const state = server.state();
    assert.equal(state.status, "running");
    if (state.status !== "running") return;
    const lock = readDevLock(root);
    assert.equal(state.url, lock?.appUrl);
    assert.equal(state.port, lock?.port);
    assert.equal(state.owned, true);
    assert.equal(server.owns(), true);
    assert.deepEqual(statuses(states), ["starting:environment", "starting:server", "starting:response", "running"]);
    assert.equal(await (await fetch(state.url)).text(), "fixture");
    assert.ok(
      server.logs().some((line) => line === `✓ Ready on ${state.url}`),
      "the log has the server's output, without colour codes",
    );
  } finally {
    await server.stop();
  }
});

test("stopping ends what it started and leaves the folder clean", async () => {
  const root = project("ok");
  const server = serverFor(root, FAST);
  await server.start();
  const pid = readDevLock(root)?.pid;
  assert.ok(pid && pidAlive(pid));

  await server.stop();
  assert.equal(server.state().status, "idle");
  assert.equal(server.owns(), false);
  assert.equal(pidAlive(pid), false);
  assert.equal(fs.existsSync(devLockFile(root)), false, "asked first, so the server removed its own lock");
});

test("a second start while one is under way does nothing", async () => {
  const root = project("ok");
  const server = serverFor(root, FAST);
  const states = watch(server);
  try {
    await Promise.all([server.start(), server.start()]);
    await server.start();
    assert.equal(statuses(states).filter((status) => status === "running").length, 1);
    assert.equal(statuses(states).filter((status) => status === "starting:server").length, 1);
  } finally {
    await server.stop();
  }
});

test("attaches to a server already running in the folder, and leaves it running", async () => {
  const root = project("ok");
  const other = await external(root);
  const server = serverFor(root, FAST);
  const states = watch(server);
  try {
    await server.start();
    const state = server.state();
    assert.equal(state.status, "running");
    if (state.status !== "running") return;
    assert.equal(state.owned, false);
    assert.equal(server.owns(), false);
    assert.equal(state.port, readDevLock(root)?.port);
    assert.ok(!statuses(states).includes("starting:server"), "no second server was started");
    assert.ok(server.logs().some((line) => line.startsWith("Attached to the dev server")));

    await server.stop();
    assert.equal(server.state().status, "idle");
    assert.ok(other.pid && pidAlive(other.pid), "it was not ours to stop");
    assert.ok(fs.existsSync(devLockFile(root)));
  } finally {
    other.kill("SIGTERM");
    await gone(other.pid);
  }
});

test("notices when the server it attached to goes away", async () => {
  const root = project("ok");
  const other = await external(root);
  const server = serverFor(root, FAST);
  try {
    await server.start();
    assert.equal(server.state().status, "running");

    other.kill("SIGTERM");
    await until("the stopped state", () => server.state().status === "stopped");
    assert.deepEqual(server.state(), { status: "stopped", code: null });
  } finally {
    await server.stop();
    await gone(other.pid);
  }
});

test("notices when the server it started dies on its own", async () => {
  const root = project("ok");
  const server = serverFor(root, FAST);
  try {
    await server.start();
    const pid = readDevLock(root)?.pid;
    assert.ok(pid);
    process.kill(pid, "SIGKILL");
    await until("the stopped state", () => server.state().status === "stopped");
    assert.equal(server.owns(), false);
  } finally {
    await server.stop();
  }
});

test("a dev script that fails is an error, with what it printed in the log", async () => {
  const root = project("fail");
  const server = serverFor(root, FAST);
  await server.start();
  expectError(server, /exited with code 1 before it was ready/);
  assert.ok(server.logs().includes("Error: DATABASE_URL is not set"));
  assert.equal(server.owns(), false);
});

test("a dev script that never becomes ready is given up on, and ended", async () => {
  const root = project("silent");
  const server = serverFor(root, { ...FAST, readyTimeoutMs: 1500 });
  await server.start();
  expectError(server, /was not ready after 2 seconds/);
  assert.equal(server.owns(), false);
  await gone(fixturePid(root));
});

test("a server that takes the lock and never answers is an error, and ended", async () => {
  const root = project("deaf");
  const server = serverFor(root, { ...FAST, httpTimeoutMs: 600 });
  await server.start();
  expectError(server, /did not answer/);
  await gone(fixturePid(root));
});

test("a lock left behind by a killed server does not pass for a running one", async () => {
  const root = project("ok");
  const dead = spawn(process.execPath, ["-e", "0"], { stdio: "ignore" });
  await new Promise((resolve) => dead.once("exit", resolve));
  writeJson(devLockFile(root), {
    pid: dead.pid,
    port: 1,
    hostname: "127.0.0.1",
    appUrl: "http://127.0.0.1:1",
    startedAt: 1,
  });

  const server = serverFor(root, FAST);
  try {
    await server.start();
    const state = server.state();
    assert.equal(state.status, "running");
    if (state.status !== "running") return;
    assert.equal(state.owned, true);
    assert.notEqual(state.port, 1);
  } finally {
    await server.stop();
  }
});

test("when Next reports another server in the folder, attaches to that one", async () => {
  const root = project("duplicate");
  const server = serverFor(root, FAST);
  let holder: number | undefined;
  try {
    await server.start();
    holder = readDevLock(root)?.pid;
    const state = server.state();
    assert.equal(state.status, "running");
    if (state.status !== "running") return;
    assert.equal(state.owned, false);
    assert.equal(server.owns(), false);
    assert.equal(state.port, readDevLock(root)?.port);
    assert.ok(server.logs().some((line) => line.includes("Another next dev server is already running")));
  } finally {
    await server.stop();
    if (holder) process.kill(holder, "SIGTERM");
    await gone(holder);
  }
});

test("a server that ignores the request to stop is ended anyway", async () => {
  const root = project("stubborn");
  const server = serverFor(root, { ...FAST, stopGraceMs: 300 });
  await server.start();
  const pid = readDevLock(root)?.pid;
  assert.ok(pid && pidAlive(pid));

  await server.stop();
  assert.equal(pidAlive(pid), false);
  assert.equal(server.state().status, "idle");
});

test("stopping while it is still starting cancels the start", async () => {
  const root = project("silent");
  const server = serverFor(root, FAST);
  const states = watch(server);
  const starting = server.start();
  const pid = await until("the dev script to be running", () => fixturePid(root));

  await server.stop();
  await starting;
  assert.equal(server.state().status, "idle");
  assert.ok(!statuses(states).includes("error"), "a cancelled start is not a failure");
  await gone(pid);
});

test("restart ends the old server and starts a new one", async () => {
  const root = project("ok");
  const server = serverFor(root, FAST);
  try {
    await server.start();
    const first = readDevLock(root)?.pid;
    assert.ok(first);

    await server.restart();
    const second = readDevLock(root)?.pid;
    assert.equal(server.state().status, "running");
    assert.ok(second && second !== first);
    assert.equal(pidAlive(first), false);
    assert.equal(pidAlive(second), true);
  } finally {
    await server.stop();
  }
});

test("missing dependencies are an error that offers to install them", async () => {
  const root = project("ok", { installed: false });
  const server = serverFor(root, FAST);
  await server.start();
  expectError(server, "Dependencies are not installed.", "install");
  assert.equal(fixturePid(root), null, "the dev script was not run");
});

test("install runs the package manager, then starts the project", async () => {
  const root = project("ok", {
    installed: false,
    manifest: { dependencies: { "local-dep": "file:./local-dep" } },
  });
  writeJson(path.join(root, "local-dep", "package.json"), { name: "local-dep", version: "1.0.0" });
  const server = serverFor(root, FAST);
  const states = watch(server);
  try {
    await server.install();
    assert.equal(server.state().status, "running");
    assert.deepEqual(states.find((state) => state.status === "installing"), {
      status: "installing",
      command: "npm install",
    });
    assert.ok(fs.existsSync(path.join(root, "node_modules", "local-dep")));
    assert.equal(server.logs()[0], "$ npm install");
  } finally {
    await server.stop();
  }
});

test("an install that fails says so, and offers to install again", async () => {
  // A lifecycle script that fails is an install failure that needs no network.
  const root = project("ok", {
    installed: false,
    manifest: { scripts: { dev: devScript("ok"), preinstall: "echo the registry is unreachable >&2; exit 1" } },
  });
  const server = serverFor(root, FAST);
  await server.install();
  expectError(server, /^npm install failed with code \d+\. The log has the details\.$/, "install");
  assert.ok(server.logs().some((line) => line.includes("the registry is unreachable")));
  assert.equal(fixturePid(root), null, "the dev script was not run");
});

test("a folder that is not a project says why", async () => {
  const none = serverFor(path.join(tempDir("server"), "nowhere"), FAST);
  await none.start();
  expectError(none, /no longer exists/);

  const empty = serverFor(tempDir("server"), FAST);
  await empty.start();
  expectError(empty, /no package\.json/);

  const noDev = tempDir("server");
  writeJson(path.join(noDev, "package.json"), { scripts: { build: "next build" } });
  const scriptless = serverFor(noDev, FAST);
  await scriptless.start();
  expectError(scriptless, /no dev script/);
});

test("a missing package manager or Node is named, before anything is run", async () => {
  const bin = tempDir("bin");
  const tool = (name: string, body: string) =>
    fs.writeFileSync(path.join(bin, name), `#!/bin/sh\n${body}\n`, { mode: 0o755 });
  const options = { ...FAST, resolveEnv: async () => ({ PATH: bin }) };
  const root = project("ok", { manifest: { engines: { node: ">=20.9" } } });
  const server = serverFor(root, options);

  await server.start();
  expectError(server, /^npm was not found on your PATH/);

  tool("npm", "exit 0");
  await server.start();
  expectError(server, /^Node was not found on your PATH/);

  tool("node", "echo v18.20.4");
  await server.start();
  expectError(
    server,
    `This project asks for Node >=20.9, and your shell has Node 18.20.4 (${path.join(bin, "node")}). Switch versions, then try again.`,
  );

  assert.equal(fixturePid(root), null, "the dev script was never run");
});

test("stop during restart awaits pending cleanup and cancels the replacement", async () => {
  const root = project("stubborn");
  const server = serverFor(root, { ...FAST, stopGraceMs: 200 });
  await server.start();
  const pid = fixturePid(root);
  const restart = server.restart();
  await server.stop();
  assert.equal(pidAlive(pid!), false, "stop must await the earlier stop's process group");
  await restart;
  assert.equal(server.state().status, "idle");
  assert.equal(fixturePid(root), pid, "no replacement process should be started");
});
