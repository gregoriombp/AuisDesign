import path from "node:path";
import fs from "node:fs/promises";

import { reviewPaths } from "./config";

/**
 * "Never lose a comment" safety net. The review-bridge data lives in
 * review-bridge/data/*.json — GITIGNORED. A `git clean -fdx` (or an aggressive
 * "clear cache") wipes the comments along with any backup that sat INSIDE the
 * repo. So the snapshots go OUTSIDE the repo (the user's home), where they
 * survive a clean, an npm install and even a re-clone.
 *
 * Backup layout (REVIEW_BRIDGE_BACKUP_DIR or ~/.auis/review-bridge-backups):
 *   <root>/snapshots/<ISO>/comments.json + comments.archive.json   (text, rotated)
 *   <root>/images/<hash>.<ext>                                     (append-only pool)
 *
 * The JSONs are small (images already live on disk), so copying is cheap. The
 * image pool is content-addressed and incremental: only what is not there yet
 * gets copied.
 */


const KEEP_RECENT = 40; // the newest N snapshots, always
const KEEP_DAILY_DAYS = 60; // first snapshot of each day in this window; before it, first of each month
const MIN_INTERVAL_MS = 60_000; // at most one snapshot per minute in a burst

let lastSnapshot = 0;

async function readMaybe(file: string): Promise<string | null> {
  try {
    return await fs.readFile(file, "utf8");
  } catch {
    return null;
  }
}

function countComments(raw: string | null): number {
  if (!raw) return 0;
  try {
    const p = JSON.parse(raw) as { comments?: unknown[] };
    return Array.isArray(p.comments) ? p.comments.length : 0;
  } catch {
    return 0;
  }
}

/** Copies to the pool only the images that are not there yet (incremental). */
async function syncImagePool(): Promise<void> {
  let names: string[];
  try {
    names = await fs.readdir(reviewPaths().imagesDir);
  } catch {
    return; // no images folder yet
  }
  await fs.mkdir(reviewPaths().poolDir, { recursive: true });
  for (const name of names) {
    if (name.endsWith(".tmp")) continue;
    const dest = path.join(reviewPaths().poolDir, name);
    try {
      await fs.access(dest); // already in the pool (content-addressed) → skip
    } catch {
      try {
        await fs.copyFile(path.join(reviewPaths().imagesDir, name), dest);
      } catch {
        /* ignore a single failed file */
      }
    }
  }
}

/**
 * Which snapshots stay: the KEEP_RECENT newest, the first of each day over the
 * last KEEP_DAILY_DAYS days and the first of each month before that. The long
 * history survives, sparse, and the folder stops growing by one snapshot a day
 * forever.
 */
export function snapshotsToKeep(dirs: string[], now: number): Set<string> {
  const sorted = [...dirs].sort();
  const keep = new Set(sorted.slice(-KEEP_RECENT));
  const cutoff = new Date(now - KEEP_DAILY_DAYS * 86_400_000).toISOString().slice(0, 10);
  const seen = new Set<string>();
  for (const d of sorted) {
    const day = d.slice(0, 10);
    const bucket = day >= cutoff ? day : d.slice(0, 7);
    if (!seen.has(bucket)) {
      seen.add(bucket);
      keep.add(d);
    }
  }
  return keep;
}

async function rotate(): Promise<void> {
  let dirs: string[];
  try {
    dirs = (await fs.readdir(reviewPaths().snapshotsDir)).filter((d) => /^\d{4}-/.test(d)).sort();
  } catch {
    return;
  }
  const keep = snapshotsToKeep(dirs, Date.now());
  for (const d of dirs) {
    if (keep.has(d)) continue;
    await fs.rm(path.join(reviewPaths().snapshotsDir, d), { recursive: true, force: true });
  }
}

/**
 * Snapshot of the JSONs + incremental sync of the image pool. Throttled, except
 * with `force` (used before a write that may shrink/zero the data).
 */
export async function snapshot(opts?: { force?: boolean }): Promise<void> {
  try {
    const now = Date.now();
    if (!opts?.force && now - lastSnapshot < MIN_INTERVAL_MS) return;
    const [main, archive] = await Promise.all([
      readMaybe(reviewPaths().mainFile),
      readMaybe(reviewPaths().archiveFile),
    ]);
    if (main === null && archive === null) return; // nothing to save
    lastSnapshot = now;
    const stamp = new Date(now).toISOString().replace(/[:.]/g, "-");
    const dir = path.join(reviewPaths().snapshotsDir, stamp);
    await fs.mkdir(dir, { recursive: true });
    if (main !== null) await fs.writeFile(path.join(dir, "comments.json"), main);
    if (archive !== null)
      await fs.writeFile(path.join(dir, "comments.archive.json"), archive);
    await syncImagePool();
    await rotate();
  } catch (err) {
    // Backup is best-effort: it never takes a write down with it.
    console.warn("[review-bridge] snapshot failed:", err);
  }
}

async function latestSnapshotWithData(): Promise<string | null> {
  let dirs: string[];
  try {
    dirs = (await fs.readdir(reviewPaths().snapshotsDir)).filter((d) => /^\d{4}-/.test(d)).sort();
  } catch {
    return null;
  }
  for (let i = dirs.length - 1; i >= 0; i--) {
    const dir = path.join(reviewPaths().snapshotsDir, dirs[i]!);
    const main = await readMaybe(path.join(dir, "comments.json"));
    const archive = await readMaybe(path.join(dir, "comments.archive.json"));
    if (countComments(main) > 0 || countComments(archive) > 0) return dir;
  }
  return null;
}

/**
 * Self-heal: if comments.json is GONE (clean/reinstall) and a backup with
 * content exists, restore the JSON + the image pool. Only acts when the file is
 * ABSENT — it never overwrites an existing file (a legitimate reset stands).
 * Runs at most once per process.
 */
let restoreChecked: Promise<boolean> | null = null;
export function ensureRestored(): Promise<boolean> {
  if (!restoreChecked) restoreChecked = doRestore();
  return restoreChecked;
}

async function doRestore(): Promise<boolean> {
  try {
    const live = await readMaybe(reviewPaths().mainFile);
    if (live !== null) return false; // file present → leave it alone
    const dir = await latestSnapshotWithData();
    if (!dir) return false;
    await fs.mkdir(reviewPaths().dataDir, { recursive: true });
    const main = await readMaybe(path.join(dir, "comments.json"));
    const archive = await readMaybe(path.join(dir, "comments.archive.json"));
    if (main !== null) await fs.writeFile(reviewPaths().mainFile, main);
    if (archive !== null) await fs.writeFile(reviewPaths().archiveFile, archive);
    // Bring the pool's binaries back into the repo's images folder.
    try {
      const names = await fs.readdir(reviewPaths().poolDir);
      await fs.mkdir(reviewPaths().imagesDir, { recursive: true });
      for (const name of names) {
        const dest = path.join(reviewPaths().imagesDir, name);
        try {
          await fs.access(dest);
        } catch {
          await fs.copyFile(path.join(reviewPaths().poolDir, name), dest);
        }
      }
    } catch {
      /* the pool may not exist */
    }
    console.warn(
      `[review-bridge] comments.json was missing — RESTORED from backup ${dir}`,
    );
    return true;
  } catch (err) {
    console.warn("[review-bridge] restore failed:", err);
    return false;
  }
}
