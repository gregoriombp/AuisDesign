import { NextRequest, NextResponse } from "next/server";
import { listArchive } from "../../_store";
import { filterCommentsForSession, getBridgeSession } from "../../_session";
import { withBridgeErrors } from "../../_errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handleGET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const url = params.get("url") ?? undefined;
  const beforeRaw = params.get("before");
  const limitRaw = params.get("limit");
  const before = beforeRaw && Number.isFinite(Number(beforeRaw)) ? Number(beforeRaw) : undefined;
  const limit = limitRaw && Number.isFinite(Number(limitRaw)) ? Number(limitRaw) : undefined;
  const session = await getBridgeSession(request);
  const page = await listArchive({ url, before, limit });
  // Post-pagination filter: a page may come shorter for a reviewer, but the
  // cursor (updatedAt of the last raw item) stays correct for the next one.
  return NextResponse.json({
    ...page,
    comments: filterCommentsForSession(page.comments, session),
  });
}

export const GET = withBridgeErrors(handleGET);
