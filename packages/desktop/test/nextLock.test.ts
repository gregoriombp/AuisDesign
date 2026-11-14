import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import path from "node:path";
import { test } from "node:test";
import { devLockFile, liveDevServer, parseDevLock, pidAlive, readDevLock } from "../src/main/nextLock.ts";
import { tempDir, writeJson } from "./helpers.ts";

const LOCK = { pid: 4242, port: 3001, hostname: "127.0.0.1", appUrl: "http://127.0.0.1:3001", startedAt: 1794644630213 };

/** The pid of a process that has already exited. */
async function deadPid(): Promise<number> {
  const child = spawn(process.execPath, ["-e", "0"], { stdio: "ignore" });
  await once(child, "exit");
  return child.pid as number;
}

test("reads the lock Next 16 writes", () => {
  assert.deepEqual(parseDevLock(JSON.stringify(LOCK)), LOCK);
});

test("the address to load is the lock's origin, without a path", () => {
  const info = parseDevLock(JSON.stringify({ ...LOCK, appUrl: "http://localhost:3001/some/path?x=1" }));
  assert.equal(info?.appUrl, "http://localhost:3001");
});

test("a missing hostname is taken from the address", () => {
  const withoutHostname = { pid: LOCK.pid, port: LOCK.port, appUrl: LOCK.appUrl, startedAt: LOCK.startedAt };
  assert.equal(parseDevLock(JSON.stringify(withoutHostname))?.hostname, "127.0.0.1");
});

test("anything that is not that lock is rejected", () => {
  for (const raw of [
    "",
    "not json",
    "null",
    "[]",
    JSON.stringify({ ...LOCK, pid: "4242" }),
    JSON.stringify({ ...LOCK, port: undefined }),
    JSON.stringify({ ...LOCK, startedAt: "yesterday" }),
    JSON.stringify({ ...LOCK, appUrl: "not a url" }),
    JSON.stringify({ ...LOCK, appUrl: "file:///etc/passwd" }),
  ]) {
    assert.equal(parseDevLock(raw), null, raw);
  }
});

test("the lock lives under the build folder, which NEXT_DIST_DIR can move", () => {
  assert.equal(devLockFile("/p"), path.join("/p", ".next", "dev", "lock"));
  assert.equal(devLockFile("/p", { NEXT_DIST_DIR: ".next-greg" }), path.join("/p", ".next-greg", "dev", "lock"));
});

test("a folder with no lock has no dev server", () => {
  const root = tempDir("lock");
  assert.equal(readDevLock(root), null);
  assert.equal(liveDevServer(root), null);
});

test("a process that exists is alive, one that exited is not", async () => {
  assert.equal(pidAlive(process.pid), true);
  assert.equal(pidAlive(await deadPid()), false);
});

test("a lock left behind by a killed server is not a running server", async () => {
  const root = tempDir("lock");
  writeJson(devLockFile(root), { ...LOCK, pid: await deadPid() });
  assert.notEqual(readDevLock(root), null);
  assert.equal(liveDevServer(root), null);
});

test("a lock whose process is alive is a running server", () => {
  const root = tempDir("lock");
  writeJson(devLockFile(root, { NEXT_DIST_DIR: "build" }), { ...LOCK, pid: process.pid });
  assert.equal(liveDevServer(root), null, "the default build folder has no lock");
  assert.equal(liveDevServer(root, { NEXT_DIST_DIR: "build" })?.port, 3001);
});
