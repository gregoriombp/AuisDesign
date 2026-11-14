import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { createProjectServer, type ServerOptions } from "../src/main/server.ts";
import { liveDevServer, pidAlive } from "../src/main/nextLock.ts";
import {
  environment,
  installed,
  project,
  temp,
  until,
  write,
} from "./helpers.ts";

function fixture(
  t: TestContext,
  config: Record<string, unknown> = {},
  options: ServerOptions = {},
) {
  const root = temp(t);
  project(root);
  if (!config.missing) installed(root);
  write(root, "fixture.json", config);
  const manager = fileURLToPath(
    new URL("./fixtures/manager.mjs", import.meta.url),
  );
  write(
    root,
    "bin/npm",
    `#!${process.execPath}\nimport(${JSON.stringify(manager)});\n`,
  );
  fs.chmodSync(root + "/bin/npm", 0o755);
  const env = environment(root);
  const server = createProjectServer(root, {
    resolveEnv: async () => ({ env, source: "fallback" }),
    readyTimeoutMs: 3000,
    httpTimeoutMs: 1500,
    stopGraceMs: 200,
    pollMs: 30,
    ...options,
  });
  t.after(() => server.stop());
  const childPid = () => Number(fs.readFileSync(root + "/server.pid", "utf8"));
  return { root, server, env, childPid };
}

test("owned start, concurrent start, logs, restart, and stop clean up the complete process group", async (t) => {
  const { root, server, childPid } = fixture(t);
  const a = server.start();
  const b = server.start();
  assert.equal(a, b);
  await a;
  const state = server.state();
  assert.equal(state.status, "running");
  if (state.status !== "running") assert.fail(JSON.stringify(state));
  assert.ok(state.owned);
  assert.ok(server.owns());
  assert.ok(server.logs().includes("fixture: starting"));
  const first = childPid();
  await Promise.all([server.restart(), server.restart()]);
  assert.equal(server.state().status, "running");
  assert.notEqual(childPid(), first);
  assert.equal(pidAlive(first), false);
  assert.equal(
    fs
      .readFileSync(root + "/starts", "utf8")
      .trim()
      .split("\n").length,
    2,
  );
  const second = childPid();
  await Promise.all([server.stop(), server.stop()]);
  assert.equal(pidAlive(second), false);
  assert.equal(fs.existsSync(root + "/.next/dev/lock"), false);
  assert.equal(server.owns(), false);
});

test("attach and restart leave an externally started server alone, even with missing dependencies", async (t) => {
  const { root, server, env } = fixture(t, { missing: true });
  const child = spawn(
    process.execPath,
    [fileURLToPath(new URL("./fixtures/server.mjs", import.meta.url))],
    { cwd: root, env, stdio: "ignore" },
  );
  t.after(() => {
    child.kill("SIGTERM");
  });
  await until(() => liveDevServer(root) !== null);
  await server.start();
  let state = server.state();
  assert.equal(state.status, "running");
  if (state.status !== "running") assert.fail(JSON.stringify(state));
  assert.equal(state.owned, false);
  await server.restart();
  state = server.state();
  assert.equal(state.status, "running");
  await server.stop();
  assert.ok(pidAlive(child.pid!));
  assert.ok(liveDevServer(root));
  assert.equal(fs.existsSync(root + "/starts"), false);
  child.kill("SIGTERM");
  await until(() => !pidAlive(child.pid!));
});

test("Install is explicit, uses this project's manager and starts only after completion", async (t) => {
  const { root, server } = fixture(t, { missing: true });
  await server.install();
  assert.equal(server.state().status, "idle");
  await server.start();
  assert.equal(server.state().status, "deps-missing");
  assert.equal(fs.existsSync(root + "/manager.pid"), false);
  const states: string[] = [];
  server.onState((s) => states.push(s.status));
  await Promise.all([server.install(), server.install()]);
  assert.equal(server.state().status, "running");
  assert.ok(states.includes("installing"));
  assert.ok(server.logs().includes("fixture: installing"));
});

test("failed install is reported and a later retry is possible", async (t) => {
  const { root, server } = fixture(t, { missing: true, installFail: true });
  await server.start();
  await server.install();
  assert.match(JSON.stringify(server.state()), /install exited with code 9/);
  assert.equal(server.owns(), false);
  write(root, "fixture.json", { missing: true });
  await server.restart();
  assert.equal(server.state().status, "deps-missing");
  await server.install();
  assert.equal(server.state().status, "running");
});

test("Node requirement fails before running a dev or install script", async (t) => {
  const { root, server } = fixture(t);
  project(root, { engines: { node: ">=999" } });
  await server.start();
  assert.match(JSON.stringify(server.state()), /Found.*at/);
  assert.equal(fs.existsSync(root + "/starts"), false);
});

test("early process failure reports the exit code without retaining ownership", async (t) => {
  const { server } = fixture(t, { crash: true });
  await server.start();
  assert.match(JSON.stringify(server.state()), /code 7/);
  assert.equal(server.owns(), false);
});

test("readiness timeout cleans a server that never publishes a lock", async (t) => {
  const { server, childPid } = fixture(
    t,
    { noLock: true },
    { readyTimeoutMs: 300 },
  );
  await server.start();
  assert.match(JSON.stringify(server.state()), /not ready/);
  assert.equal(pidAlive(childPid()), false);
  assert.equal(server.owns(), false);
});

test("a hanging HTTP response is bounded and its owned process is stopped", async (t) => {
  const { server, childPid } = fixture(
    t,
    { hangHttp: true },
    { httpTimeoutMs: 150 },
  );
  await server.start();
  assert.match(JSON.stringify(server.state()), /did not answer/);
  assert.equal(pidAlive(childPid()), false);
});

test("quit during environment resolution prevents a late process start", async (t) => {
  let release!: () => void;
  const ready = new Promise<void>((resolve) => {
    release = resolve;
  });
  const { root, server } = fixture(
    t,
    {},
    {
      resolveEnv: async () => {
        await ready;
        return { env: environment(root), source: "fallback" };
      },
    },
  );
  const start = server.start();
  await server.stop();
  release();
  await start;
  assert.equal(server.state().status, "idle");
  assert.equal(fs.existsSync(root + "/starts"), false);
});

test("closing during a queued restart cancels the replacement server", async (t) => {
  let release!: () => void;
  const ready = new Promise<void>((resolve) => {
    release = resolve;
  });
  const { root, server } = fixture(
    t,
    {},
    {
      resolveEnv: async () => {
        await ready;
        return { env: environment(root), source: "fallback" };
      },
    },
  );
  const start = server.start();
  const restart = server.restart();
  await server.stop();
  release();
  await Promise.all([start, restart]);
  assert.equal(server.state().status, "idle");
  assert.equal(fs.existsSync(root + "/starts"), false);
});

test("unresponsive owned processes receive SIGKILL after the grace period", async (t) => {
  const { server, childPid } = fixture(t, { ignoreTerm: true });
  await server.start();
  const pid = childPid();
  await server.stop();
  await until(() => !pidAlive(pid));
  assert.equal(server.owns(), false);
});

for (const phase of ["readiness", "response", "install"] as const) {
  test(`quit during ${phase} cancels pending work and leaves no owned process`, async (t) => {
    const config =
      phase === "readiness"
        ? { noLock: true }
        : phase === "response"
          ? { hangHttp: true }
          : { missing: true, installHang: true };
    const { root, server } = fixture(t, config);
    let pending = server.start();
    if (phase === "install") {
      await pending;
      pending = server.install();
    }
    await until(() =>
      fs.existsSync(
        root + (phase === "install" ? "/manager.pid" : "/server.pid"),
      ),
    );
    if (phase === "response")
      await until(() => {
        const s = server.state();
        return s.status === "starting" && s.phase === "response";
      });
    await server.stop();
    await pending;
    const pid = Number(
      fs.readFileSync(
        root + (phase === "install" ? "/manager.pid" : "/server.pid"),
        "utf8",
      ),
    );
    assert.equal(pidAlive(pid), false);
    assert.equal(server.state().status, "idle");
  });
}

test("a server that dies after readiness moves to Stopped with no automatic restart", async (t) => {
  const { root, server, childPid } = fixture(t);
  await server.start();
  process.kill(childPid(), "SIGTERM");
  await until(() => server.state().status === "stopped");
  assert.equal(server.owns(), false);
  assert.equal(fs.readFileSync(root + "/starts", "utf8"), "start\n");
});

test("a child outliving its package manager is stopped after an early exit", async (t) => {
  const { server, childPid } = fixture(t, { parentExit: true, noLock: true });
  await server.start();
  assert.equal(server.state().status, "error");
  await until(() => !pidAlive(childPid()));
});

test("a fresh lock belonging to a different process is never claimed as owned", async (t) => {
  const { root, server, env } = fixture(
    t,
    { noLock: true },
    { readyTimeoutMs: 450 },
  );
  const start = server.start();
  await until(() => fs.existsSync(root + "/server.pid"));
  const other = root + "/other";
  fs.mkdirSync(other);
  write(other, "fixture.json", {});
  const child = spawn(
    process.execPath,
    [fileURLToPath(new URL("./fixtures/server.mjs", import.meta.url))],
    { cwd: other, env, stdio: "ignore" },
  );
  t.after(() => {
    child.kill("SIGTERM");
  });
  await until(() => liveDevServer(other) !== null);
  write(root, ".next/dev/lock", liveDevServer(other));
  await start;
  assert.equal(server.state().status, "error");
  assert.ok(pidAlive(child.pid!));
  child.kill("SIGTERM");
  await until(() => !pidAlive(child.pid!));
});
