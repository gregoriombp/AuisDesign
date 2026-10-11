// The Review Bridge store on the disk driver, isolated in a temp folder: data,
// backups and cwd point at the temp dir before the import, because _store and
// _backup resolve their paths when the module loads.
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import type { ReviewComment } from "@auis/core/types";

const root = mkdtempSync(path.join(tmpdir(), "review-store-"));
process.env.REVIEW_BRIDGE_BACKUP_DIR = path.join(root, "backups");
process.chdir(root);

const dataDir = path.join(root, "review-bridge", "data");
mkdirSync(dataDir, { recursive: true });

function comment(id: string, overrides: Partial<ReviewComment> = {}): ReviewComment {
  return {
    id,
    schemaVersion: 3,
    authorKind: "user",
    authorId: "alex",
    authorName: "Alex",
    authorColorToken: "var(--fg-primary)",
    createdAt: 1000,
    updatedAt: 1000,
    url: "/dashboard",
    viewportWidth: 1440,
    viewportHeight: 900,
    scrollY: 0,
    documentHeight: 900,
    anchor: { kind: "pin", position: { x: 0, y: 0 } },
    text: `text of ${id}`,
    status: "open",
    ...overrides,
  } as ReviewComment;
}

writeFileSync(
  path.join(dataDir, "comments.json"),
  JSON.stringify({ schemaVersion: 3, comments: [comment("main-1")], identities: [], agentSettings: {} }),
);
writeFileSync(
  path.join(dataDir, "comments.archive.json"),
  JSON.stringify({ schemaVersion: 3, comments: [comment("arc-1", { status: "resolved" })] }),
);

const store = await import("../_store");

function readDocs() {
  const main = JSON.parse(readFileSync(path.join(dataDir, "comments.json"), "utf8"));
  const archive = JSON.parse(readFileSync(path.join(dataDir, "comments.archive.json"), "utf8"));
  const ids = (doc: { comments: ReviewComment[] }) => doc.comments.map((c) => c.id);
  return { main, archive, mainIds: ids(main), archiveIds: ids(archive) };
}

test("editing an archived comment updates the archive, with no copy in main", async () => {
  await store.upsertComment(comment("arc-1", { status: "resolved", text: "edited" }), "archive");
  const { mainIds, archiveIds, archive } = readDocs();
  assert.equal(mainIds.includes("arc-1"), false);
  assert.deepEqual(archiveIds, ["arc-1"]);
  assert.equal(archive.comments[0].text, "edited");
});

test("a stale location (main) does not duplicate a comment that lives in the archive", async () => {
  await store.upsertComment(comment("arc-1", { status: "resolved", text: "again" }), "main");
  const { mainIds, archiveIds, archive } = readDocs();
  assert.equal(mainIds.includes("arc-1"), false);
  assert.deepEqual(archiveIds, ["arc-1"]);
  assert.equal(archive.comments[0].text, "again");
});

test("editing in main replaces in place", async () => {
  await store.upsertComment(comment("main-1", { text: "changed" }), "main");
  const { main, mainIds } = readDocs();
  assert.equal(mainIds.filter((id: string) => id === "main-1").length, 1);
  assert.equal(main.comments.find((c: ReviewComment) => c.id === "main-1").text, "changed");
});

test("creation lands in main", async () => {
  await store.upsertComment(comment("new-1"), null);
  assert.ok(readDocs().mainIds.includes("new-1"));
});
