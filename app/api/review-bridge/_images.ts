import path from "node:path";
import fs from "node:fs/promises";
import crypto from "node:crypto";

import type { ReviewComment } from "@/components/auis-review/types";

/**
 * Externalizes Review Mode image attachments. Each `data:...;base64,...` used
 * to live INLINE inside the comment — which bloated review-bridge/data/*.json
 * and made every write rewrite megabytes just to flip a status. Now the bytes
 * go to disk, content-addressed (sha256 = free dedup), and the JSON keeps only a
 * `/api/review-bridge/images/<hash>.<ext>` ref — which the client renders
 * straight into `<img src>` (see ReviewCommentCard/ThreadPopover).
 *
 * Everything is additive: already-externalized refs and legacy data URIs
 * coexist; reads never need to rehydrate anything.
 */

const DATA_DIR = path.join(process.cwd(), "review-bridge", "data");
export const IMAGES_DIR = path.join(DATA_DIR, "images");

const ROUTE_PREFIX = "/api/review-bridge/images/";

const MIME_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
  "image/svg+xml": "svg",
};

const DATA_URI_RE = /^data:([a-z0-9.+/-]+);base64,(.+)$/i;
// Only valid content-addressed names can be served/accepted (anti traversal).
const FILENAME_RE = /^[a-f0-9]{64}\.[a-z0-9]+$/;

/** Extracts the safe filename from a `/api/review-bridge/images/<name>` ref. */
export function refToFilename(ref: string): string | null {
  if (!ref.startsWith(ROUTE_PREFIX)) return null;
  const name = ref.slice(ROUTE_PREFIX.length);
  return FILENAME_RE.test(name) ? name : null;
}

/** Validates a filename coming from the route before touching the disk. */
export function isSafeImageName(name: string): boolean {
  return FILENAME_RE.test(name);
}

export function contentTypeFor(name: string): string {
  const ext = name.slice(name.lastIndexOf(".") + 1).toLowerCase();
  for (const [mime, e] of Object.entries(MIME_EXT)) if (e === ext) return mime;
  return "application/octet-stream";
}

/**
 * Persists a single data URI into the pool and returns its ref. Strings that
 * are not `data:...;base64,...` (already-externalized refs, http URLs) come
 * back untouched.
 */
async function persistDataUri(value: string): Promise<string> {
  const m = value.match(DATA_URI_RE);
  if (!m) return value;
  const mime = m[1].toLowerCase();
  let buf: Buffer;
  try {
    buf = Buffer.from(m[2], "base64");
  } catch {
    return value;
  }
  if (buf.length === 0) return value;
  const ext = MIME_EXT[mime] ?? "bin";
  const hash = crypto.createHash("sha256").update(buf).digest("hex");
  const filename = `${hash}.${ext}`;
  const dest = path.join(IMAGES_DIR, filename);
  await fs.mkdir(IMAGES_DIR, { recursive: true });
  try {
    await fs.access(dest); // already there → dedup, do not rewrite
  } catch {
    const tmp = `${dest}.tmp`;
    await fs.writeFile(tmp, buf);
    await fs.rename(tmp, dest); // atomic
  }
  return `${ROUTE_PREFIX}${filename}`;
}

/** Externalizes an image list (the `images` field), preserving order. */
export async function externalizeImageList(
  images?: string[],
): Promise<string[] | undefined> {
  if (!Array.isArray(images) || images.length === 0) return images;
  const out: string[] = [];
  for (const s of images) {
    out.push(typeof s === "string" ? await persistDataUri(s) : s);
  }
  return out;
}

/** Externalizes the images of a comment and of all its replies. */
export async function externalizeComment(
  comment: ReviewComment,
): Promise<ReviewComment> {
  const next: ReviewComment = { ...comment };
  if (next.images) next.images = await externalizeImageList(next.images);
  if (Array.isArray(next.replies)) {
    next.replies = await Promise.all(
      next.replies.map(async (r) =>
        r.images ? { ...r, images: await externalizeImageList(r.images) } : r,
      ),
    );
  }
  return next;
}
