import { test } from "node:test";
import assert from "node:assert/strict";
import {
  devLockFile,
  liveDevServer,
  parseDevLock,
  pidAlive,
} from "../src/main/nextLock.ts";
import { temp, write } from "./helpers.ts";
const valid = {
  pid: process.pid,
  port: 3001,
  hostname: "127.0.0.1",
  appUrl: "http://127.0.0.1:3001",
  startedAt: Date.now(),
};
test("lock parsing only accepts usable local server identities", () => {
  assert.deepEqual(parseDevLock(JSON.stringify(valid)), valid);
  for (const change of [
    { pid: 0 },
    { pid: -1 },
    { pid: 1.5 },
    { port: 0 },
    { port: 65536 },
    { port: 3000 },
    { startedAt: -1 },
    { appUrl: "https://example.org:3001" },
    { appUrl: "file:///tmp/a" },
    { appUrl: "http://user@localhost:3001" },
  ])
    assert.equal(
      parseDevLock(JSON.stringify({ ...valid, ...change })),
      null,
      JSON.stringify(change),
    );
  assert.equal(parseDevLock("bad"), null);
  assert.equal(pidAlive(0), false);
  assert.equal(pidAlive(-1), false);
});
test("a live PID is required and NEXT_DIST_DIR is respected", (t) => {
  const root = temp(t);
  write(root, ".custom/dev/lock", valid);
  assert.equal(
    devLockFile(root, { NEXT_DIST_DIR: ".custom" }),
    root + "/.custom/dev/lock",
  );
  assert.equal(liveDevServer(root), null);
  assert.equal(
    liveDevServer(root, { NEXT_DIST_DIR: ".custom" })?.pid,
    process.pid,
  );
  write(root, ".custom/dev/lock", { ...valid, pid: 2147483647 });
  assert.equal(liveDevServer(root, { NEXT_DIST_DIR: ".custom" }), null);
});
