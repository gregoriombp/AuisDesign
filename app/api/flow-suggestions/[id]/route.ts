import { NextRequest, NextResponse } from "next/server";
import {
  deleteSuggestion,
  FlowTransitionError,
  transitionSuggestion,
  type Transition,
} from "../_store";
import {
  flowActorForSession,
  parseFlowMaterializationReceipt,
} from "../_integrity";
import { getBridgeSession } from "../../review-bridge/_session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TRANSITIONS: Transition[] = ["in_review", "apply", "discard", "reject"];

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getBridgeSession(request);
  const { id } = await params;
  let body: { transition?: unknown; receipt?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body." }, { status: 400 });
  }
  const transition = body.transition as Transition | undefined;
  if (!transition || !TRANSITIONS.includes(transition)) {
    return NextResponse.json({ error: "Invalid transition." }, { status: 400 });
  }
  if (transition === "in_review" && session.role === "reviewer") {
    return NextResponse.json(
      { error: "Only a materializing agent or an admin can send a proposal to review." },
      { status: 403 },
    );
  }
  if (transition !== "in_review" && session.role !== "admin") {
    return NextResponse.json(
      { error: "Only an admin can accept, reopen or discard proposals." },
      { status: 403 },
    );
  }
  const actor = flowActorForSession(session);
  const parsedReceipt =
    body.receipt === undefined
      ? undefined
      : parseFlowMaterializationReceipt(body.receipt);
  if (body.receipt !== undefined && !parsedReceipt) {
    return NextResponse.json(
      { error: "Invalid receipt. Provide the base revision, files, validations and a summary." },
      { status: 400 },
    );
  }
  const receipt = parsedReceipt ?? undefined;
  let suggestion;
  try {
    suggestion = await transitionSuggestion(id, transition, actor, receipt);
  } catch (error) {
    if (error instanceof FlowTransitionError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    throw error;
  }
  if (!suggestion) {
    return NextResponse.json({ error: "Suggestion not found." }, { status: 404 });
  }
  return NextResponse.json({ suggestion });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getBridgeSession(request);
  if (session.role !== "admin") {
    return NextResponse.json({ error: "Only an admin can delete proposals." }, { status: 403 });
  }
  const { id } = await params;
  const ok = await deleteSuggestion(id);
  return NextResponse.json({ ok }, { status: ok ? 200 : 404 });
}
