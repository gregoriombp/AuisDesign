import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Compatibility with the solve/germano skills (they check ok + schemaVersion==3
// before running). This is now the embedded serverless bridge — no token,
// same-origin.
export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "auis-review-bridge",
    mode: "serverless",
    schemaVersion: 3,
    tokenRequired: false,
  });
}
