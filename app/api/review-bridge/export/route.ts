import { NextRequest, NextResponse } from "next/server";
import { exportAll } from "../_store";
import { filterCommentsForSession, getBridgeSession } from "../_session";
import { withBridgeErrors } from "../_errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handleGET(request: NextRequest) {
  const session = await getBridgeSession(request);
  const payload = await exportAll();
  if (session.role !== "reviewer") return NextResponse.json(payload);
  // A reviewer exports only what they can see — "admins" comments never leak here.
  return NextResponse.json({
    ...payload,
    comments: filterCommentsForSession(payload.comments, session),
    archivedComments: filterCommentsForSession(payload.archivedComments ?? [], session),
  });
}

export const GET = withBridgeErrors(handleGET);
