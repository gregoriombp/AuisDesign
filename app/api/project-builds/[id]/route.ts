import { NextRequest, NextResponse } from "next/server";
import {
  deleteBuild,
  transitionBuild,
  type BuildActor,
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
  let body: { transition?: unknown; actor?: unknown; builtRoute?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corpo inválido." }, { status: 400 });
  }
  const transition = body.transition as Transition | undefined;
  if (!transition || !TRANSITIONS.includes(transition)) {
    return NextResponse.json({ error: "transition inválida." }, { status: 400 });
  }
  const actor = body.actor as BuildActor | undefined;
  const builtRoute = typeof body.builtRoute === "string" ? body.builtRoute : undefined;
  const build = await transitionBuild(id, transition, actor, builtRoute);
  if (!build) {
    return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
  }
  return NextResponse.json({ build });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ok = await deleteBuild(id);
  return NextResponse.json({ ok }, { status: ok ? 200 : 404 });
}
