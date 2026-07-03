import { NextRequest, NextResponse } from "next/server";
import { importMerge } from "../_store";
import type { ReviewExportPayload } from "@/components/auis-review/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }
  if (!body || typeof body !== "object" || !Array.isArray((body as { comments?: unknown[] }).comments)) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }
  const result = await importMerge(body as ReviewExportPayload);
  return NextResponse.json(result);
}
