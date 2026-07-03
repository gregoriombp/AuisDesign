import { NextRequest, NextResponse } from "next/server";
import { createSearch, listSearches } from "../../_mobbin";
import type { MobbinSearch, MobbinSearchStatus } from "@/components/auis-review/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseStatus(v: string | null): MobbinSearchStatus | undefined {
  if (v === "pending" || v === "done" || v === "error") return v;
  return undefined;
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown> | null;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_query" }, { status: 400 });
  }
  const query = typeof body?.query === "string" ? body.query.trim() : "";
  if (!query) return NextResponse.json({ error: "invalid_query" }, { status: 400 });
  const platform = body?.platform === "ios" ? "ios" : "web";
  const page = typeof body?.page === "string" ? body.page : "";
  const element =
    body?.element && typeof body.element === "object"
      ? (body.element as MobbinSearch["element"])
      : undefined;
  const search = createSearch({ query, platform, page, element });
  return NextResponse.json({ search });
}

export async function GET(request: NextRequest) {
  const status = parseStatus(request.nextUrl.searchParams.get("status"));
  return NextResponse.json({ searches: listSearches(status ? { status } : undefined) });
}
