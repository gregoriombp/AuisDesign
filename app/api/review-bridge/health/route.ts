import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Compat with the solve/germano skills (they check ok + schemaVersion==3 before
// running). The bridge is serverless and embedded — no token, same-origin.
export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "auis-review-bridge",
    mode: "serverless",
    schemaVersion: 3,
    tokenRequired: false,
  });
}
