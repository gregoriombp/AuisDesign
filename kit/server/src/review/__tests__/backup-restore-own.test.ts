// The other half of per-project backups: a project that loses its comments.json
// still gets it back from its OWN snapshots. HOME is a temp folder.
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { ensureRestored, snapshot } from "../backup";
import { reviewPaths } from "../config";

const root = realpathSync(mkdtempSync(path.join(tmpdir(), "review-backup-own-")));
process.env.HOME = path.join(root, "home");
delete process.env.REVIEW_BRIDGE_BACKUP_DIR;
const project = path.join(root, "project");
mkdirSync(path.join(project, "review-bridge", "data"), { recursive: true });

test("a project restores its own snapshot when comments.json is gone", async () => {
  process.chdir(project);
  const data = JSON.stringify({ schemaVersion: 3, comments: [{ id: "cmt-1", text: "kept" }] });
  writeFileSync(reviewPaths().mainFile, data);
  await snapshot({ force: true });
  rmSync(reviewPaths().mainFile);

  assert.equal(await ensureRestored(), true);
  assert.equal(readFileSync(reviewPaths().mainFile, "utf8"), data);
});
