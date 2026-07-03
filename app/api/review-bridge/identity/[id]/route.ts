import { NextRequest, NextResponse } from "next/server";
import { upsertIdentity } from "../../_store";
import type { ReviewIdentity } from "@/components/auis-review/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_identity" }, { status: 400 });
  }
  if (
    !body ||
    typeof body !== "object" ||
    typeof (body as ReviewIdentity).id !== "string" ||
    typeof (body as ReviewIdentity).name !== "string" ||
    typeof (body as ReviewIdentity).colorToken !== "string"
  ) {
    return NextResponse.json({ error: "invalid_identity" }, { status: 400 });
  }
  const identity = body as ReviewIdentity;
  if (identity.id !== id) return NextResponse.json({ error: "id_mismatch" }, { status: 400 });
  await upsertIdentity(identity);
  return NextResponse.json({ ok: true });
}
