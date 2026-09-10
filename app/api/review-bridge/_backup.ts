import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";

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

const DATA_DIR = path.join(process.cwd(), "review-bridge", "data");
const MAIN_FILE = path.join(DATA_DIR, "comments.json");
const ARCHIVE_FILE = path.join(DATA_DIR, "comments.archive.json");
const IMAGES_DIR = path.join(DATA_DIR, "images");

const BACKUP_ROOT = process.env.REVIEW_BRIDGE_BACKUP_DIR
  ? path.resolve(process.env.REVIEW_BRIDGE_BACKUP_DIR)
  : path.join(os.homedir(), ".auis", "review-bridge-backups");
const SNAP_DIR = path.join(BACKUP_ROOT, "snapshots");
const POOL_DIR = path.join(BACKUP_ROOT, "images");

const KEEP_RECENT = 40; // the newest N snapshots, always
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
    names = await fs.readdir(IMAGES_DIR);
  } catch {
    return; // no images folder yet
  }
  await fs.mkdir(POOL_DIR, { recursive: true });
  for (const name of names) {
    if (name.endsWith(".tmp")) continue;
    const dest = path.join(POOL_DIR, name);
    try {
      await fs.access(dest); // already in the pool (content-addressed) → skip
    } catch {
      try {
        await fs.copyFile(path.join(IMAGES_DIR, name), dest);
      } catch {
        /* ignore a single failed file */
      }
    }
  }
}

async function rotate(): Promise<void> {
  let dirs: string[];
  try {
    dirs = (await fs.readdir(SNAP_DIR)).filter((d) => /^\d{4}-/.test(d)).sort();
  } catch {
    return;
  }
  // Keep the KEEP_RECENT newest + the first snapshot of every day (long history).
  const keep = new Set(dirs.slice(-KEEP_RECENT));
  const seenDay = new Set<string>();
  for (const d of dirs) {
    const day = d.slice(0, 10);
    if (!seenDay.has(day)) {
      seenDay.add(day);
      keep.add(d);
    }
  }
  for (const d of dirs) {
    if (keep.has(d)) continue;
    await fs.rm(path.join(SNAP_DIR, d), { recursive: true, force: true });
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
      readMaybe(MAIN_FILE),
      readMaybe(ARCHIVE_FILE),
    ]);
    if (main === null && archive === null) return; // nothing to save
    lastSnapshot = now;
    const stamp = new Date(now).toISOString().replace(/[:.]/g, "-");
    const dir = path.join(SNAP_DIR, stamp);
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
    dirs = (await fs.readdir(SNAP_DIR)).filter((d) => /^\d{4}-/.test(d)).sort();
  } catch {
    return null;
  }
  for (let i = dirs.length - 1; i >= 0; i--) {
    const dir = path.join(SNAP_DIR, dirs[i]!);
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
    const live = await readMaybe(MAIN_FILE);
    if (live !== null) return false; // file present → leave it alone
    const dir = await latestSnapshotWithData();
    if (!dir) return false;
    await fs.mkdir(DATA_DIR, { recursive: true });
    const main = await readMaybe(path.join(dir, "comments.json"));
    const archive = await readMaybe(path.join(dir, "comments.archive.json"));
    if (main !== null) await fs.writeFile(MAIN_FILE, main);
    if (archive !== null) await fs.writeFile(ARCHIVE_FILE, archive);
    // Bring the pool's binaries back into the repo's images folder.
    try {
      const names = await fs.readdir(POOL_DIR);
      await fs.mkdir(IMAGES_DIR, { recursive: true });
      for (const name of names) {
        const dest = path.join(IMAGES_DIR, name);
        try {
          await fs.access(dest);
        } catch {
          await fs.copyFile(path.join(POOL_DIR, name), dest);
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
