// Backups are kept per project. Every Auis-based project on a machine backs up
// under ~/.auis/review-bridge-backups, and a project with no comments.json
// restores the newest snapshot it finds there — it must only ever find its own.
// HOME points at a temp folder, so the real backups are never touched.
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { ensureRestored, snapshot } from "../backup";
import { projectBackupKey, reviewPaths } from "../config";

const root = realpathSync(mkdtempSync(path.join(tmpdir(), "review-backup-ns-")));
process.env.HOME = path.join(root, "home");
delete process.env.REVIEW_BRIDGE_BACKUP_DIR;

const projectA = path.join(root, "project-a");
const projectB = path.join(root, "project-b");
mkdirSync(path.join(projectA, "review-bridge", "data"), { recursive: true });
mkdirSync(projectB, { recursive: true });

test("each project gets its own folder under ~/.auis/review-bridge-backups", () => {
  assert.notEqual(projectBackupKey(projectA), projectBackupKey(projectB));
  assert.match(projectBackupKey(projectA), /^[0-9a-f]{16}$/);
  process.chdir(projectA);
  assert.equal(
    reviewPaths().backupDir,
    path.join(root, "home", ".auis", "review-bridge-backups", projectBackupKey(projectA)),
  );
});

test("an explicit backup folder is used as is", () => {
  process.env.REVIEW_BRIDGE_BACKUP_DIR = path.join(root, "chosen");
  assert.equal(reviewPaths().backupDir, path.join(root, "chosen"));
  delete process.env.REVIEW_BRIDGE_BACKUP_DIR;
});

test("a project with no comments.json never restores another project's snapshot", async () => {
  process.chdir(projectA);
  writeFileSync(
    reviewPaths().mainFile,
    JSON.stringify({ schemaVersion: 3, comments: [{ id: "cmt-a", text: "A's comment" }] }),
  );
  await snapshot({ force: true });
  assert.ok(existsSync(reviewPaths().snapshotsDir), "project A wrote its snapshot");

  process.chdir(projectB);
  assert.equal(await ensureRestored(), false);
  assert.equal(existsSync(reviewPaths().mainFile), false);
});
