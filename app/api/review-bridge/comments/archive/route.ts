import { NextRequest, NextResponse } from "next/server";
import { listArchive } from "../../_store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const url = params.get("url") ?? undefined;
  const beforeRaw = params.get("before");
  const limitRaw = params.get("limit");
  const before = beforeRaw && Number.isFinite(Number(beforeRaw)) ? Number(beforeRaw) : undefined;
  const limit = limitRaw && Number.isFinite(Number(limitRaw)) ? Number(limitRaw) : undefined;
  const page = await listArchive({ url, before, limit });
  return NextResponse.json(page);
}
