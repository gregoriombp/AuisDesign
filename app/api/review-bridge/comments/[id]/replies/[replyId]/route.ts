import { NextRequest, NextResponse } from "next/server";
import { editReply, getCommentAny } from "../../../../_store";
import { getBridgeSession, ownsRecord } from "../../../../_session";
import { withBridgeErrors } from "../../../../_errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Edit the text/images of an existing reply. PATCH so it does not collide with
// the parent route's POST (create reply). Preserves authorship/createdAt and
// stamps editedAt.
async function handlePATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; replyId: string }> },
) {
  const { id, replyId } = await params;
  let body: Record<string, unknown> | null;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }
  if (!body) return NextResponse.json({ error: "invalid_payload" }, { status: 400 });

  // A reviewer only edits THEIR OWN reply (same session e-mail).
  const session = await getBridgeSession(request);
  if (session.role === "reviewer") {
    const found = await getCommentAny(id);
    const target = found?.comment.replies?.find((r) => r.id === replyId);
    if (!found || !target) return NextResponse.json({ error: "not_found" }, { status: 404 });
    if (!ownsRecord(target, session)) {
      return NextResponse.json({ error: "forbidden_not_owner" }, { status: 403 });
    }
  }

  const { text, images } = body;
  if (typeof text !== "string" || text.trim().length === 0) {
    return NextResponse.json({ error: "invalid_reply" }, { status: 400 });
  }
  const imgs = Array.isArray(images)
    ? images.filter((s): s is string => typeof s === "string")
    : undefined;

  const result = await editReply(id, replyId, {
    text: text.trim(),
    ...(images === undefined ? {} : { images: imgs ?? [] }),
  });
  if (!result) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ reply: result.reply, location: result.location });
}

export const PATCH = withBridgeErrors(handlePATCH);
