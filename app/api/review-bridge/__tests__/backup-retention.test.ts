import assert from "node:assert/strict";
import test from "node:test";

import { snapshotsToKeep } from "../_backup";

const DAY = 86_400_000;
const now = Date.parse("2026-10-08T12:00:00Z");
const stamp = (ms: number) => new Date(ms).toISOString().replace(/[:.]/g, "-");

// Three snapshots a day, from 150 days ago until today.
const dirs: string[] = [];
for (let d = 150; d >= 0; d--) {
  for (const h of [9, 14, 20]) dirs.push(stamp(now - d * DAY + (h - 12) * 3_600_000));
}
const keep = snapshotsToKeep(dirs, now);
const sorted = [...dirs].sort();

test("the 40 newest always stay", () => {
  for (const d of sorted.slice(-40)) assert.ok(keep.has(d), d);
});

test("over the last 60 days, the first of each day stays", () => {
  const cutoff = new Date(now - 60 * DAY).toISOString().slice(0, 10);
  const days = new Set(sorted.filter((d) => d.slice(0, 10) >= cutoff).map((d) => d.slice(0, 10)));
  for (const day of days) {
    const first = sorted.find((d) => d.startsWith(day));
    assert.ok(first && keep.has(first), day);
  }
});

test("before that, only the first of each month stays", () => {
  const cutoff = new Date(now - 60 * DAY).toISOString().slice(0, 10);
  const old = sorted.filter((d) => d.slice(0, 10) < cutoff && !sorted.slice(-40).includes(d));
  const kept = old.filter((d) => keep.has(d));
  const months = new Set(old.map((d) => d.slice(0, 7)));
  assert.equal(kept.length, months.size);
  for (const d of kept) assert.equal(d, old.find((o) => o.slice(0, 7) === d.slice(0, 7)));
});
