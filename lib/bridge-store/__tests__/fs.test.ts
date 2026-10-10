import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { createFsDocStore } from "../fs";

const dir = mkdtempSync(path.join(tmpdir(), "bridge-fs-"));
const store = createFsDocStore({
  namespace: `test-${process.pid}`,
  resolveFile: (key) => path.join(dir, `${key}.json`),
});
const init = () => ({ count: 0 });

test("a missing file starts from the initial state", async () => {
  const { data, rev } = await store.get("missing", init);
  assert.deepEqual(data, { count: 0 });
  assert.equal(rev, 0);
});

test("corrupt JSON fails loudly, is never overwritten and gets a copy", async () => {
  const file = path.join(dir, "broken.json");
  writeFileSync(file, '{"count": 7, "comm');
  await assert.rejects(
    store.update("broken", init, (d) => ({ data: { count: d.count + 1 }, result: true })),
    (err: Error) => err.name === "BridgeUnavailableError",
  );
  assert.equal(readFileSync(file, "utf8"), '{"count": 7, "comm');
  const copies = readdirSync(dir).filter((f) => f.startsWith("broken.json.corrupt-"));
  assert.equal(copies.length, 1);
  assert.equal(readFileSync(path.join(dir, copies[0]), "utf8"), '{"count": 7, "comm');
});

test("concurrent writes to the same document are not lost", async () => {
  await Promise.all(
    Array.from({ length: 25 }, () =>
      store.update("counter", init, (d) => ({ data: { count: d.count + 1 }, result: true })),
    ),
  );
  const { data } = await store.get("counter", init);
  assert.equal(data.count, 25);
  assert.equal(readdirSync(dir).some((f) => f.endsWith(".tmp")), false);
});
