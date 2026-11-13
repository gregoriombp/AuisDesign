import path from "node:path";
import fs from "node:fs/promises";
import crypto from "node:crypto";

import { reviewPaths } from "./config";
import { UnsupportedImageTypeError, classifyImageValue } from "./imageTypes";

import type { ReviewComment } from "@auis/core/types";

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


const ROUTE_PREFIX = "/api/review-bridge/images/";

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

export { contentTypeFor } from "./imageTypes";

/**
 * Persists a single data URI into the pool and returns its ref. Strings that
 * are not a data URI (already-externalized refs, http URLs) come back
 * untouched. A data URI outside the accepted raster types throws
 * `UnsupportedImageTypeError`, which the route answers with 415 (`errors.ts`).
 */
async function persistDataUri(value: string): Promise<string> {
  const decision = classifyImageValue(value);
  if (decision.kind === "passthrough") return value;
  if (decision.kind === "rejected") throw new UnsupportedImageTypeError(decision.declared);
  let buf: Buffer;
  try {
    buf = Buffer.from(decision.base64, "base64");
  } catch {
    return value;
  }
  if (buf.length === 0) return value;
  const { ext } = decision;
  const hash = crypto.createHash("sha256").update(buf).digest("hex");
  const filename = `${hash}.${ext}`;
  const dest = path.join(/* turbopackIgnore: true */ reviewPaths().imagesDir, filename);
  await fs.mkdir(reviewPaths().imagesDir, { recursive: true });
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
