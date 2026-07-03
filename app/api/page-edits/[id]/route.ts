import { NextRequest, NextResponse } from "next/server";
import {
  deleteOp,
  transitionOp,
  type PageEditActor,
  type Transition,
} from "../_store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TRANSITIONS: Transition[] = ["in_review", "apply", "discard", "reject"];

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  let body: { route?: unknown; transition?: unknown; actor?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corpo inválido." }, { status: 400 });
  }
  if (typeof body.route !== "string") {
    return NextResponse.json({ error: "route é obrigatório." }, { status: 400 });
  }
  const transition = body.transition as Transition | undefined;
  if (!transition || !TRANSITIONS.includes(transition)) {
    return NextResponse.json({ error: "transition inválida." }, { status: 400 });
  }
  const actor = body.actor as PageEditActor | undefined;
  const op = await transitionOp(body.route, id, transition, actor);
  if (!op) {
    return NextResponse.json({ error: "Op não encontrada." }, { status: 404 });
  }
  return NextResponse.json({ op });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const route = request.nextUrl.searchParams.get("route");
  if (!route) {
    return NextResponse.json({ error: "route é obrigatório." }, { status: 400 });
  }
  const ok = await deleteOp(route, id);
  return NextResponse.json({ ok }, { status: ok ? 200 : 404 });
}
