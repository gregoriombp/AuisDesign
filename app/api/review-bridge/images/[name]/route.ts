import path from "node:path";
import fs from "node:fs/promises";
import { NextRequest, NextResponse } from "next/server";

import { IMAGES_DIR, contentTypeFor, isSafeImageName } from "../../_images";
import { withBridgeErrors } from "../../_errors";

export const runtime = "nodejs";

/**
 * Serves a content-addressed Review Mode attachment. The name is a sha256 +
 * extension (validated before touching the disk — no traversal) and the
 * content is immutable, hence the aggressive cache: the same URL never points
 * to different bytes.
 */
async function handleGET(
  _request: NextRequest,
  { params }: { params: Promise<{ name: string }> },
) {
  const { name } = await params;
  if (!isSafeImageName(name)) {
    return NextResponse.json({ error: "invalid_name" }, { status: 400 });
  }
  try {
    const buf = await fs.readFile(path.join(IMAGES_DIR, name));
    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        "Content-Type": contentTypeFor(name),
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
}

export const GET = withBridgeErrors(handleGET);
