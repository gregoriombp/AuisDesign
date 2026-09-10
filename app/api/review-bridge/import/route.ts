import { NextRequest, NextResponse } from "next/server";
import { importMerge } from "../_store";
import { getBridgeSession } from "../_session";
import type { ReviewExportPayload } from "@/components/auis-review/types";
import { withBridgeErrors } from "../_errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handlePOST(request: NextRequest) {
  // Importing touches the whole database — admin/agent only.
  const session = await getBridgeSession(request);
  if (session.role === "reviewer") {
    return NextResponse.json({ error: "forbidden_role" }, { status: 403 });
  }
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

export const POST = withBridgeErrors(handlePOST);
