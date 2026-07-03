import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Compat com as skills de solve/germano (checam ok + schemaVersion==3 antes de
// rodar). Agora é o bridge serverless embutido — sem token, same-origin.
export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "auis-review-bridge",
    mode: "serverless",
    schemaVersion: 3,
    tokenRequired: false,
  });
}
