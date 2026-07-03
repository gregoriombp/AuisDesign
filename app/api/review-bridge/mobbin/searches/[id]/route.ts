import { NextRequest, NextResponse } from "next/server";
import { getSearch } from "../../../_mobbin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const search = getSearch(id);
  if (!search) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ search });
}
