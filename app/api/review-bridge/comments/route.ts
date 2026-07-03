import { NextRequest, NextResponse } from "next/server";
import { listComments } from "../_store";
import type { ReviewCommentStatus } from "@/components/auis-review/types";

// Toca o filesystem (review-bridge/data/*.json) — Node, nunca cacheado.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseStatus(v: string | null): ReviewCommentStatus | undefined {
  if (v === "open" || v === "in_review" || v === "resolved" || v === "backlog") return v;
  return undefined;
}

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url") ?? undefined;
  const status = parseStatus(request.nextUrl.searchParams.get("status"));
  const comments = await listComments({ url, status });
  return NextResponse.json({ comments });
}
