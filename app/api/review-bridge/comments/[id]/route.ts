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
import { parseView, projectComment } from "../../_project";
import { canSeeComment, getBridgeSession, ownsRecord } from "../../_session";
import type {
  ReviewActor,
  ReviewComment,
} from "@/components/auis-review/types";
import {
  canonicalReviewAgentActor,
  canBridgeSessionWriteAsAgent,
  canReviewAgentSubmitForApproval,
  getReviewAgent,
} from "@/lib/auis-review/agents";
import { triggerMentionRun } from "../../_mention";
import { withBridgeErrors } from "../../_errors";

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

function hasValidSemanticTarget(value: Record<string, unknown>): boolean {
  const origin = value.origin;
  if (
    origin !== undefined &&
    origin !== "page" &&
    origin !== "ux-flow" &&
    origin !== "backlog"
  ) {
    return false;
  }
  if (origin !== "ux-flow") return true;
  const flowRef = value.flowRef;
  return (
    typeof flowRef === "object" &&
    flowRef !== null &&
    typeof (flowRef as Record<string, unknown>).flow === "string" &&
    ((flowRef as Record<string, unknown>).flow as string).length > 0
  );
}

async function handleGET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const view = parseView(request.nextUrl.searchParams.get("view"));
  const found = await getCommentAny(id);
  if (!found) return NextResponse.json({ error: "not_found" }, { status: 404 });
  // An "admins" comment does not exist for a reviewer session — 404, not 403
  // (never leak that the id exists).
  const session = await getBridgeSession(request);
  if (!canSeeComment(found.comment, session)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json({
    comment: projectComment(found.comment, view),
    location: found.location,
  });
}

async function handlePUT(
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

  const session = await getBridgeSession(request);
  const headerAgentId = request.headers.get("x-bridge-agent-id")?.trim();
  const headerAgent = headerAgentId ? getReviewAgent(headerAgentId) : undefined;
  if (headerAgentId && !headerAgent) {
    return NextResponse.json({ error: "unknown_agent_author" }, { status: 400 });
  }

  // Transition path: { transition, actor } takes precedence over the upsert.
  const transition = body.transition;
  if (typeof transition === "string") {
    // Changing status is an admin job (approve/reject/archive) or an agent's
    // (mark in_review when solving). A reviewer asks/comments — does not decide.
    if (session.role === "reviewer") {
      return NextResponse.json({ error: "forbidden_role" }, { status: 403 });
    }
    const actor = body.actor;
    if (transition === "in_review") {
      if (!isValidActor(actor)) return NextResponse.json({ error: "invalid_actor" }, { status: 400 });
      if (
        headerAgent &&
        (actor.kind !== "agent" || actor.id !== headerAgent.id)
      ) {
        return NextResponse.json({ error: "agent_identity_mismatch" }, { status: 400 });
      }
      let transitionActor = actor;
      if (actor.kind === "agent") {
        if (session.authEnabled && session.role !== "agent") {
          return NextResponse.json({ error: "agent_auth_required" }, { status: 403 });
        }
        const canonicalActor = canonicalReviewAgentActor(actor.id);
        if (!canonicalActor) {
          return NextResponse.json({ error: "unknown_executor" }, { status: 403 });
        }
        if (!canReviewAgentSubmitForApproval(actor.id)) {
          return NextResponse.json({ error: "agent_comment_only" }, { status: 403 });
        }
        transitionActor = canonicalActor;
      }
      const r = await transitionToInReview(id, transitionActor);
      if (!r) return NextResponse.json({ error: "not_found" }, { status: 404 });
      return NextResponse.json({ ok: true, comment: r.comment, location: r.location });
    }
    if (transition === "approve") {
      if (session.role === "agent") {
        return NextResponse.json({ error: "approval_requires_admin" }, { status: 403 });
      }
      if (!isValidActor(actor)) return NextResponse.json({ error: "invalid_actor" }, { status: 400 });
      if (actor.kind !== "user") {
        return NextResponse.json({ error: "approval_requires_admin" }, { status: 403 });
      }
      const r = await approve(id, { id: actor.id, name: actor.name });
      if (!r) return NextResponse.json({ error: "not_found" }, { status: 404 });
      return NextResponse.json({ ok: true, comment: r.comment, location: r.location });
    }
    if (transition === "reject") {
      if (session.role === "agent") {
        return NextResponse.json({ error: "moderation_requires_admin" }, { status: 403 });
      }
      if (!isValidActor(actor)) return NextResponse.json({ error: "invalid_actor" }, { status: 400 });
      if (actor.kind !== "user") {
        return NextResponse.json({ error: "moderation_requires_admin" }, { status: 403 });
      }
      const r = await reject(id);
      if (!r) return NextResponse.json({ error: "not_found" }, { status: 404 });
      return NextResponse.json({ ok: true, comment: r.comment, location: r.location });
    }
    if (transition === "resolve_direct") {
      if (session.role === "agent") {
        return NextResponse.json({ error: "moderation_requires_admin" }, { status: 403 });
      }
      if (!isValidActor(actor)) return NextResponse.json({ error: "invalid_actor" }, { status: 400 });
      if (actor.kind !== "user") {
        return NextResponse.json({ error: "moderation_requires_admin" }, { status: 403 });
      }
      const r = await archiveDirect(id, actor);
      if (!r) return NextResponse.json({ error: "not_found" }, { status: 404 });
      return NextResponse.json({ ok: true, comment: r.comment, location: r.location });
    }
    if (transition === "reopen_from_archive") {
      if (session.role === "agent") {
        return NextResponse.json({ error: "moderation_requires_admin" }, { status: 403 });
      }
      if (!isValidActor(actor)) return NextResponse.json({ error: "invalid_actor" }, { status: 400 });
      if (actor.kind !== "user") {
        return NextResponse.json({ error: "moderation_requires_admin" }, { status: 403 });
      }
      const r = await reopenFromArchive(id);
      if (!r) return NextResponse.json({ error: "not_found" }, { status: 404 });
      return NextResponse.json({ ok: true, comment: r.comment, location: r.location });
    }
    return NextResponse.json({ error: "unknown_transition" }, { status: 400 });
  }

  // Upsert (create/edit a whole comment).
  if (!isValidComment(body)) return NextResponse.json({ error: "invalid_comment" }, { status: 400 });
  if (!hasValidSemanticTarget(body)) {
    return NextResponse.json({ error: "invalid_comment_target" }, { status: 400 });
  }
  if (body.id !== id) return NextResponse.json({ error: "id_mismatch" }, { status: 400 });
  const incoming: ReviewComment = { ...(body as unknown as ReviewComment), schemaVersion: SCHEMA };

  const existing = (await getCommentAny(id))?.comment ?? null;
  const bodyAgent = getReviewAgent(incoming.authorId);
  const requestedAgent = headerAgent ?? bodyAgent;
  // An explicit attempt at agent authorship never falls back to the human
  // identity of the session. Behind an auth layer it requires the agent token;
  // locally without auth, the mention runner and the skills stay available.
  if (requestedAgent && !canBridgeSessionWriteAsAgent(session)) {
    return NextResponse.json({ error: "agent_auth_required" }, { status: 403 });
  }
  const writingAgent = requestedAgent;

  if (session.role === "agent" && !writingAgent) {
    return NextResponse.json({ error: "agent_author_required" }, { status: 400 });
  }
  if (existing && headerAgent && existing.authorId !== headerAgent.id) {
    return NextResponse.json({ error: "forbidden_agent_edit" }, { status: 403 });
  }

  if (!existing) {
    // CREATE — stamp the REAL authorship of the session (the client sends it
    // for display, but the server signs). Agents pass as they came (skills
    // sign with their own actor and have no session e-mail).
    if (!writingAgent && session.role !== "agent" && session.email) {
      incoming.authorEmail = session.email;
    }
    if (!writingAgent && session.role !== "agent") {
      incoming.authorRole = session.role === "admin" ? "admin" : "reviewer";
    }
    if (writingAgent) {
      incoming.authorKind = "agent";
      incoming.authorId = writingAgent.id;
      incoming.authorName = writingAgent.name;
      incoming.authorColorToken = writingAgent.accentVar;
      delete incoming.authorEmail;
      delete incoming.authorRole;
    } else {
      incoming.authorKind = "user";
    }
    // Only an admin creates a private comment; a reviewer's is always "team".
    if (session.role === "reviewer") delete incoming.visibility;
    if (incoming.visibility !== "admins") delete incoming.visibility;
    // A reviewer's comment is never born resolved/in review — only open or a future idea.
    if (session.role === "reviewer") {
      if (incoming.status !== "backlog") incoming.status = "open";
      delete incoming.resolution;
    }
    // Agents author observations and replies. Status changes always use the
    // explicit transition path.
    if (writingAgent) {
      incoming.status = "open";
      delete incoming.resolution;
    }
  } else {
    // EDIT — a reviewer only edits what is theirs; and nobody changes the
    // authorship or the birth of an existing record through PUT.
    if (session.role === "reviewer") {
      if (!ownsRecord(existing, session)) {
        return NextResponse.json({ error: "forbidden_not_owner" }, { status: 403 });
      }
    }
    if (session.role === "agent" && existing.authorId !== incoming.authorId) {
      return NextResponse.json({ error: "forbidden_agent_edit" }, { status: 403 });
    }
    incoming.authorId = existing.authorId;
    incoming.authorName = existing.authorName;
    incoming.authorColorToken = existing.authorColorToken;
    if (existing.authorKind) incoming.authorKind = existing.authorKind;
    else delete incoming.authorKind;
    incoming.createdAt = existing.createdAt;
    if (existing.authorEmail) incoming.authorEmail = existing.authorEmail;
    else delete incoming.authorEmail;
    if (existing.authorRole) incoming.authorRole = existing.authorRole;
    else delete incoming.authorRole;
    // Visibility: admin/agent decides; a reviewer inherits the existing one.
    if (session.role === "reviewer") {
      if (existing.visibility === "admins") incoming.visibility = "admins";
      else delete incoming.visibility;
      // Status through upsert: a reviewer only toggles open ↔ future idea on
      // what is theirs — resolve/approve is still a transition, and that is 403.
      const softStates = new Set(["open", "backlog"]);
      if (!softStates.has(existing.status) || !softStates.has(incoming.status)) {
        incoming.status = existing.status;
      }
      if (existing.resolution) incoming.resolution = existing.resolution;
      else delete incoming.resolution;
    } else if (session.role === "agent") {
      incoming.status = existing.status;
      if (existing.resolution) incoming.resolution = existing.resolution;
      else delete incoming.resolution;
      if (existing.visibility === "admins") incoming.visibility = "admins";
      else delete incoming.visibility;
    } else if (incoming.visibility !== "admins") {
      delete incoming.visibility;
    }
  }

  await upsertComment(incoming);
  // Mention trigger (gate 4): only CREATION fires. This PUT also edits, and
  // re-saving an old comment that already says "@Claude" must not wake the
  // agent again. Fire and forget — the browser's response does not wait for it.
  if (!existing) triggerMentionRun(id, incoming.text, incoming);
  return NextResponse.json({ ok: true });
}

async function handleDELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await getBridgeSession(request);
  if (session.role === "agent") {
    return NextResponse.json({ error: "moderation_requires_admin" }, { status: 403 });
  }
  if (session.role === "reviewer") {
    const found = await getCommentAny(id);
    if (!found) return NextResponse.json({ error: "not_found" }, { status: 404 });
    if (!ownsRecord(found.comment, session)) {
      return NextResponse.json({ error: "forbidden_not_owner" }, { status: 403 });
    }
  }
  const removed = await deleteComment(id);
  if (!removed) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export const GET = withBridgeErrors(handleGET);
export const PUT = withBridgeErrors(handlePUT);
export const DELETE = withBridgeErrors(handleDELETE);
