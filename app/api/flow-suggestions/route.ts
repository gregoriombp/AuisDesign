import { NextRequest, NextResponse } from "next/server";
import {
  createSuggestion,
  listSuggestions,
  type FlowSuggestionStatus,
} from "./_store";

// Touches the filesystem (flow-bridge/data/*.json) — must run on Node, never
// cached.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUSES: FlowSuggestionStatus[] = ["open", "in_review", "applied", "discarded"];

export async function GET(request: NextRequest) {
  const flow = request.nextUrl.searchParams.get("flow") ?? undefined;
  const statusParam = request.nextUrl.searchParams.get("status");
  const status = STATUSES.includes(statusParam as FlowSuggestionStatus)
    ? (statusParam as FlowSuggestionStatus)
    : undefined;
  const suggestions = await listSuggestions(flow, status);
  return NextResponse.json({ suggestions });
}

export async function POST(request: NextRequest) {
  let body: {
    flow?: unknown;
    description?: unknown;
    authorName?: unknown;
    nodes?: unknown;
    edges?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body." }, { status: 400 });
  }
  if (typeof body.flow !== "string" || typeof body.description !== "string") {
    return NextResponse.json(
      { error: "flow and description are required." },
      { status: 400 },
    );
  }
  const suggestion = await createSuggestion({
    flow: body.flow,
    description: body.description,
    authorName: typeof body.authorName === "string" ? body.authorName : undefined,
    nodes: Array.isArray(body.nodes) ? body.nodes : [],
    edges: Array.isArray(body.edges) ? body.edges : [],
  });
  return NextResponse.json({ suggestion }, { status: 201 });
}
