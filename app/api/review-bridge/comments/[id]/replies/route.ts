import { NextRequest, NextResponse } from "next/server";
import { addReply } from "../../../_store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
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

  const { authorKind, authorId, authorName, authorColorToken, text, images } = body;
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

  const result = await addReply(id, {
    authorKind,
    authorId,
    authorName,
    authorColorToken: typeof authorColorToken === "string" ? authorColorToken : undefined,
    text: text.trim(),
    ...(imgs && imgs.length > 0 ? { images: imgs } : {}),
  });
  if (!result) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ reply: result.reply, location: result.location });
}
