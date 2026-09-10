import { NextRequest, NextResponse } from "next/server";
import {
  createSuggestion,
  listSuggestions,
  type FlowSuggestionStatus,
} from "./_store";
import { flowActorForSession } from "./_integrity";
import { getBridgeSession } from "../review-bridge/_session";

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
  const session = await getBridgeSession(request);
  if (session.role === "agent") {
    return NextResponse.json(
      { error: "Agents materialize existing proposals; they do not create one on behalf of a reviewer." },
      { status: 403 },
    );
  }
  let body: {
    flow?: unknown;
    description?: unknown;
    baseNodes?: unknown;
    baseEdges?: unknown;
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
  if (!Array.isArray(body.baseNodes) || !Array.isArray(body.baseEdges)) {
    return NextResponse.json(
      { error: "baseNodes and baseEdges are required to record the base revision." },
      { status: 400 },
    );
  }
  if (
    !Array.isArray(body.nodes) ||
    body.nodes.length === 0 ||
    /^\s*\[?ge(?::|\])/i.test(body.description)
  ) {
    return NextResponse.json(
      {
        error:
          "Golden-eye comments belong to the Review Bridge; flow-suggestions only accepts structural proposals with nodes.",
      },
      { status: 400 },
    );
  }
  const suggestion = await createSuggestion({
    flow: body.flow,
    description: body.description,
    authorName: flowActorForSession(session).name,
    baseNodes: body.baseNodes,
    baseEdges: body.baseEdges,
    nodes: Array.isArray(body.nodes) ? body.nodes : [],
    edges: Array.isArray(body.edges) ? body.edges : [],
  });
  return NextResponse.json({ suggestion }, { status: 201 });
}
