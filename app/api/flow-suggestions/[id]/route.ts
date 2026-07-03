import { NextRequest, NextResponse } from "next/server";
import {
  deleteSuggestion,
  transitionSuggestion,
  type FlowActor,
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
  let body: { transition?: unknown; actor?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corpo inválido." }, { status: 400 });
  }
  const transition = body.transition as Transition | undefined;
  if (!transition || !TRANSITIONS.includes(transition)) {
    return NextResponse.json({ error: "transition inválida." }, { status: 400 });
  }
  const actor = body.actor as FlowActor | undefined;
  const suggestion = await transitionSuggestion(id, transition, actor);
  if (!suggestion) {
    return NextResponse.json({ error: "Sugestão não encontrada." }, { status: 404 });
  }
  return NextResponse.json({ suggestion });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ok = await deleteSuggestion(id);
  return NextResponse.json({ ok }, { status: ok ? 200 : 404 });
}
