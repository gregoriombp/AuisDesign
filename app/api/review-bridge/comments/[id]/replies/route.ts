import { NextRequest, NextResponse } from "next/server";
import { addReply, getCommentAny } from "../../../_store";
import { canSeeComment, getBridgeSession } from "../../../_session";
import { withBridgeErrors } from "../../../_errors";
import {
  canBridgeSessionWriteAsAgent,
  getReviewAgent,
} from "@/lib/auis-review/agents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handlePOST(
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

  const { authorKind, authorId, authorName, authorColorToken, authorEmail, text, images } = body;
  if (
    (authorKind !== "agent" && authorKind !== "user") ||
    typeof authorId !== "string" ||
    typeof authorName !== "string" ||
    typeof text !== "string" ||
    text.trim().length === 0
  ) {
    return NextResponse.json({ error: "invalid_reply" }, { status: 400 });
  }
  const imgs = Array.isArray(images) ? images.filter((s): s is string => typeof s === "string") : undefined;

  const session = await getBridgeSession(request);
  const headerAgentId = request.headers.get("x-bridge-agent-id")?.trim();
  const headerAgent = headerAgentId ? getReviewAgent(headerAgentId) : undefined;
  if (headerAgentId && !headerAgent) {
    return NextResponse.json({ error: "unknown_agent_author" }, { status: 400 });
  }
  // A reviewer does not reply on a comment they should not even see.
  if (session.role === "reviewer") {
    const found = await getCommentAny(id);
    if (!found || !canSeeComment(found.comment, session)) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
  }

  const bodyAgent = authorKind === "agent" ? getReviewAgent(authorId) : undefined;
  if (authorKind === "agent" && !bodyAgent) {
    return NextResponse.json({ error: "unknown_agent_author" }, { status: 400 });
  }
  const requestedAgent = headerAgent ?? bodyAgent;
  // An explicit attempt at agent authorship never falls back to the human
  // identity of the session. Behind an auth layer it requires the agent token;
  // locally without auth, the dispatcher stays available.
  if (requestedAgent && !canBridgeSessionWriteAsAgent(session)) {
    return NextResponse.json({ error: "agent_auth_required" }, { status: 403 });
  }
  const writingAgent = requestedAgent;
  if (session.role === "agent" && !writingAgent) {
    return NextResponse.json({ error: "agent_author_required" }, { status: 400 });
  }

  // The header is authoritative for dispatcher writes. Even if a stale caller
  // accidentally sends a user payload, it cannot be persisted as a person.
  const kind = writingAgent ? ("agent" as const) : ("user" as const);
  const stampedEmail =
    !writingAgent && session.role !== "agent" && session.email
      ? session.email
      : !writingAgent && typeof authorEmail === "string" && authorEmail
        ? authorEmail
        : undefined;

  const result = await addReply(id, {
    authorKind: kind,
    authorId: writingAgent?.id ?? authorId,
    authorName: writingAgent?.name ?? authorName,
    authorColorToken:
      writingAgent?.accentVar ??
      (typeof authorColorToken === "string" ? authorColorToken : undefined),
    ...(stampedEmail ? { authorEmail: stampedEmail } : {}),
    ...(session.role !== "agent" && kind === "user"
      ? { authorRole: session.role === "admin" ? ("admin" as const) : ("reviewer" as const) }
      : {}),
    text: text.trim(),
    ...(imgs && imgs.length > 0 ? { images: imgs } : {}),
  });
  if (!result) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ reply: result.reply, location: result.location });
}

export const POST = withBridgeErrors(handlePOST);
