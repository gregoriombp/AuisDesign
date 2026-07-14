import { NextRequest, NextResponse } from "next/server";
import {
  createOrUpdateOp,
  listOps,
  type PageEditAnchor,
  type PageEditOpType,
  type PageEditPayload,
  type PageEditStatus,
} from "./_store";

// Touches the filesystem (page-editor/data/*.json) — must run on Node, never
// cached.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUSES: PageEditStatus[] = ["open", "in_review", "applied", "discarded"];
const TYPES: PageEditOpType[] = [
  "text",
  "style",
  "hide",
  "variant",
  "icon",
  "iconStyle",
  "token",
  "class",
  "move",
];

export async function GET(request: NextRequest) {
  const route = request.nextUrl.searchParams.get("route");
  if (!route) {
    return NextResponse.json({ error: "route is required." }, { status: 400 });
  }
  const statusParam = request.nextUrl.searchParams.get("status");
  const status = STATUSES.includes(statusParam as PageEditStatus)
    ? (statusParam as PageEditStatus)
    : undefined;
  const ops = await listOps(route, status);
  return NextResponse.json({ ops });
}

export async function POST(request: NextRequest) {
  let body: {
    route?: unknown;
    type?: unknown;
    anchor?: unknown;
    payload?: unknown;
    authorName?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body." }, { status: 400 });
  }

  if (typeof body.route !== "string") {
    return NextResponse.json({ error: "route is required." }, { status: 400 });
  }
  if (!TYPES.includes(body.type as PageEditOpType)) {
    return NextResponse.json({ error: "Invalid type." }, { status: 400 });
  }
  const anchor = body.anchor as PageEditAnchor | undefined;
  if (!anchor || typeof anchor.selector !== "string") {
    return NextResponse.json(
      { error: "anchor.selector is required." },
      { status: 400 },
    );
  }
  if (!body.payload || typeof body.payload !== "object") {
    return NextResponse.json({ error: "payload is required." }, { status: 400 });
  }

  const op = await createOrUpdateOp({
    route: body.route,
    type: body.type as PageEditOpType,
    anchor,
    payload: body.payload as PageEditPayload,
    authorName: typeof body.authorName === "string" ? body.authorName : undefined,
  });
  return NextResponse.json({ op }, { status: 201 });
}
