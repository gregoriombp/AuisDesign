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
  /** Snapshot folder. Default `REVIEW_BRIDGE_BACKUP_DIR`, else `~/.auis/review-bridge-backups`. */
  backupDir?: string;
  /** Script the mention trigger spawns. Default `<cwd>/scripts/mention-run.mjs`. */
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
      : path.join(os.homedir(), ".auis", "review-bridge-backups");
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
      : path.join(process.cwd(), "scripts", "mention-run.mjs"),
  };
}
