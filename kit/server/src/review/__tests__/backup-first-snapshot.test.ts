// When a project has comments but no snapshot of its own yet — its first run,
// or the first since backups became per project — the first read backs it up
// instead of waiting for the next write. HOME is a temp folder.
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { ensureRestored } from "../backup";
import { reviewPaths } from "../config";

const root = realpathSync(mkdtempSync(path.join(tmpdir(), "review-backup-first-")));
process.env.HOME = path.join(root, "home");
delete process.env.REVIEW_BRIDGE_BACKUP_DIR;
const project = path.join(root, "project");
mkdirSync(path.join(project, "review-bridge", "data"), { recursive: true });

test("the first read snapshots a project that has no backup yet", async () => {
  process.chdir(project);
  writeFileSync(
    reviewPaths().mainFile,
    JSON.stringify({ schemaVersion: 3, comments: [{ id: "cmt-1", text: "first" }] }),
  );
  assert.equal(existsSync(reviewPaths().snapshotsDir), false);

  assert.equal(await ensureRestored(), false);
  assert.equal(readdirSync(reviewPaths().snapshotsDir).length, 1);
});
