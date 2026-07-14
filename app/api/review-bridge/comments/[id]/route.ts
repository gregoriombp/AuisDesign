import { NextRequest, NextResponse } from "next/server";
import {
  approve,
  archiveDirect,
  deleteComment,
  getCommentAny,
  reject,
  reopenFromArchive,
  transitionToInReview,
  upsertComment,
} from "../../_store";
import type { ReviewActor, ReviewComment } from "@/components/auis-review/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SCHEMA = 3;

function isValidActor(value: unknown): value is ReviewActor {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    (v.kind === "agent" || v.kind === "user") &&
    typeof v.id === "string" &&
    typeof v.name === "string" &&
    v.name.length > 0
  );
}

function isValidComment(value: unknown): value is ReviewComment {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === "string" &&
    (v.schemaVersion === SCHEMA || v.schemaVersion === 2) &&
    typeof v.authorId === "string" &&
    typeof v.text === "string" &&
    typeof v.url === "string" &&
    !!v.anchor &&
    typeof v.anchor === "object"
  );
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const found = await getCommentAny(id);
  if (!found) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json(found);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  let body: Record<string, unknown> | null;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }
  if (!body) return NextResponse.json({ error: "invalid_payload" }, { status: 400 });

  // Transition path: { transition, actor } takes precedence over the upsert.
  const transition = body.transition;
  if (typeof transition === "string") {
    const actor = body.actor;
    if (transition === "in_review") {
      if (!isValidActor(actor)) return NextResponse.json({ error: "invalid_actor" }, { status: 400 });
      const r = await transitionToInReview(id, actor);
      if (!r) return NextResponse.json({ error: "not_found" }, { status: 404 });
      return NextResponse.json({ ok: true, comment: r.comment, location: r.location });
    }
    if (transition === "approve") {
      if (!isValidActor(actor)) return NextResponse.json({ error: "invalid_actor" }, { status: 400 });
      const r = await approve(id, { id: actor.id, name: actor.name });
      if (!r) return NextResponse.json({ error: "not_found" }, { status: 404 });
      return NextResponse.json({ ok: true, comment: r.comment, location: r.location });
    }
    if (transition === "reject") {
      const r = await reject(id);
      if (!r) return NextResponse.json({ error: "not_found" }, { status: 404 });
      return NextResponse.json({ ok: true, comment: r.comment, location: r.location });
    }
    if (transition === "resolve_direct") {
      if (!isValidActor(actor)) return NextResponse.json({ error: "invalid_actor" }, { status: 400 });
      const r = await archiveDirect(id, actor);
      if (!r) return NextResponse.json({ error: "not_found" }, { status: 404 });
      return NextResponse.json({ ok: true, comment: r.comment, location: r.location });
    }
    if (transition === "reopen_from_archive") {
      const r = await reopenFromArchive(id);
      if (!r) return NextResponse.json({ error: "not_found" }, { status: 404 });
      return NextResponse.json({ ok: true, comment: r.comment, location: r.location });
    }
    return NextResponse.json({ error: "unknown_transition" }, { status: 400 });
  }

  // Upsert (create/replace the whole comment).
  if (!isValidComment(body)) return NextResponse.json({ error: "invalid_comment" }, { status: 400 });
  if (body.id !== id) return NextResponse.json({ error: "id_mismatch" }, { status: 400 });
  const comment: ReviewComment = { ...(body as unknown as ReviewComment), schemaVersion: SCHEMA };
  await upsertComment(comment);
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const removed = await deleteComment(id);
  if (!removed) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
