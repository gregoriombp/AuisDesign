import path from "node:path";
import fs from "node:fs/promises";

import { reviewPaths } from "../config";
import { contentTypeFor, isSafeImageName } from "../images";

/**
 * Serves a content-addressed Review Mode attachment. The name is a sha256 +
 * extension (validated before touching the disk — no traversal) and the
 * content is immutable, hence the aggressive cache: the same URL never points
 * to different bytes.
 */
async function handleGET(
  _request: Request,
  params: { name: string },
) {
  const { name } = params;
  if (!isSafeImageName(name)) {
    return Response.json({ error: "invalid_name" }, { status: 400 });
  }
  try {
    const buf = await fs.readFile(path.join(reviewPaths().imagesDir, name));
    return new Response(new Uint8Array(buf), {
      status: 200,
      headers: {
        "Content-Type": contentTypeFor(name),
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return Response.json({ error: "not_found" }, { status: 404 });
  }
}

export const GET = handleGET;
