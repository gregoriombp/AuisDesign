import crypto from "node:crypto";
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";

/**
 * Options for the Review Bridge server. Every one defaults to what the Auis app
 * has always used, so `createReviewHandler()` with no options behaves exactly
 * like the per-file routes it replaced.
 */
export interface ReviewServerOptions {
  /** URL prefix the handler answers under. Default `/api/review-bridge`. */
  basePath?: string;
  /** Folder holding comments.json, comments.archive.json and images/. Default `<cwd>/review-bridge/data`. */
  dataDir?: string;
  /**
   * Snapshot folder. Default `REVIEW_BRIDGE_BACKUP_DIR`, else this project's own
   * folder under `~/.auis/review-bridge-backups/` (see `projectBackupKey`). A
   * folder given here or in the env is used as is.
   */
  backupDir?: string;
  /**
   * Script the mention trigger spawns. Default: the `auis-mention-run` bin of
   * the @auis/server installed in the project (resolved from `<cwd>`).
   */
  mentionRunner?: string;
}

let configured: ReviewServerOptions = {};

/**
 * One Review Bridge per process: the store, the backups and the mention trigger
 * share these paths, and the last call wins.
 */
export function configureReviewServer(options: ReviewServerOptions): void {
  configured = { ...options };
}

/**
 * The folder name a project's backups live under in the shared
 * `~/.auis/review-bridge-backups`: the first 16 hex characters of the sha256 of
 * the project's working directory. Every Auis-based project on a machine backs
 * up there, and the bridge restores a missing comments.json from the newest
 * snapshot it finds — keyed by project, so it can only find its own. The same
 * key the Koru bridge uses.
 */
export function projectBackupKey(cwd: string = process.cwd()): string {
  return crypto.createHash("sha256").update(cwd).digest("hex").slice(0, 16);
}

/**
 * Resolved on every call, not when the module loads: the cwd and the env are
 * read at the moment of use, which is what lets a test (or a host) point the
 * bridge somewhere else before the first request.
 */
export function reviewPaths() {
  const dataDir = configured.dataDir
    ? path.resolve(configured.dataDir)
    : path.join(process.cwd(), "review-bridge", "data");
  const envBackup = process.env.REVIEW_BRIDGE_BACKUP_DIR;
  const backupDir = configured.backupDir
    ? path.resolve(configured.backupDir)
    : envBackup
      ? path.resolve(envBackup)
      : path.join(os.homedir(), ".auis", "review-bridge-backups", projectBackupKey());
  return {
    dataDir,
    mainFile: path.join(dataDir, "comments.json"),
    archiveFile: path.join(dataDir, "comments.archive.json"),
    imagesDir: path.join(dataDir, "images"),
    backupDir,
    snapshotsDir: path.join(backupDir, "snapshots"),
    poolDir: path.join(backupDir, "images"),
    mentionRunner: configured.mentionRunner
      ? path.resolve(configured.mentionRunner)
      : installedMentionRunner(),
  };
}

/**
 * The runner of the @auis/server the project installed, or null. Resolved from
 * the project's own package.json — not from this module's URL, which a bundler
 * (Next) moves somewhere unrelated to node_modules.
 */
function installedMentionRunner(): string | null {
  try {
    const require = createRequire(path.join(process.cwd(), "package.json"));
    const file = require.resolve("@auis/server/bin/mention-run.mjs");
    return fs.existsSync(file) ? file : null;
  } catch {
    return null;
  }
}
