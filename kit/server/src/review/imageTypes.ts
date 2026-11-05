/**
 * The type decision for Review Mode image attachments, with no storage in it,
 * so the tests import it on its own.
 *
 * Uploads accept raster only. An SVG is a document: opened straight from the
 * attachment URL, it runs script on the origin that serves it. The stored type
 * comes from this table, never from what the client declared.
 */

const UPLOAD_TYPES: Readonly<Record<string, { mime: string; ext: string }>> = {
  "image/png": { mime: "image/png", ext: "png" },
  "image/jpeg": { mime: "image/jpeg", ext: "jpg" },
  "image/jpg": { mime: "image/jpeg", ext: "jpg" },
  "image/gif": { mime: "image/gif", ext: "gif" },
  "image/webp": { mime: "image/webp", ext: "webp" },
  "image/avif": { mime: "image/avif", ext: "avif" },
};

/**
 * The served type, by extension. It keeps the legacy `.svg`: files already on
 * disk stay reachable, and the images route serves them with `nosniff` and
 * `Content-Security-Policy: sandbox`, so they are inert when opened directly.
 */
const SERVE_TYPES: Readonly<Record<string, string>> = {
  png: "image/png",
  jpg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  avif: "image/avif",
  svg: "image/svg+xml",
};

export const ACCEPTED_IMAGE_LABEL = "PNG, JPEG, GIF, WebP or AVIF";

export class UnsupportedImageTypeError extends Error {
  readonly declared: string;
  constructor(declared: string) {
    super(`Image format not accepted. Attach ${ACCEPTED_IMAGE_LABEL}.`);
    this.name = "UnsupportedImageTypeError";
    this.declared = declared;
  }
}

export type ImageValueDecision =
  /** Not a data URI: an already-externalized ref or a URL. Stays as it came. */
  | { kind: "passthrough" }
  /** An accepted raster, in base64. `mime` and `ext` come from the upload table. */
  | { kind: "raster"; mime: string; ext: string; base64: string }
  /** A data URI of another type, or without `;base64`. The upload answers 415. */
  | { kind: "rejected"; declared: string };

// `data:<type>[;param]*,<content>`. `[^]` covers line breaks in the base64.
const DATA_URI_RE = /^data:([^;,]*)((?:;[^;,]*)*),([^]*)$/i;

export function classifyImageValue(value: string): ImageValueDecision {
  const trimmed = value.trimStart();
  if (!/^data:/i.test(trimmed)) return { kind: "passthrough" };
  const match = trimmed.match(DATA_URI_RE);
  if (!match) return { kind: "rejected", declared: "" };
  const declared = match[1].trim().toLowerCase();
  const params = match[2]
    .split(";")
    .map((p) => p.trim().toLowerCase())
    .filter(Boolean);
  const type = UPLOAD_TYPES[declared];
  if (!type || params[params.length - 1] !== "base64") {
    return { kind: "rejected", declared };
  }
  return { kind: "raster", mime: type.mime, ext: type.ext, base64: match[3] };
}

export function contentTypeFor(name: string): string {
  const ext = name.slice(name.lastIndexOf(".") + 1).toLowerCase();
  return SERVE_TYPES[ext] ?? "application/octet-stream";
}
