import { NextRequest, NextResponse } from "next/server";
import { deleteIdentity, upsertIdentity } from "../../_store";
import { getBridgeSession } from "../../_session";
import type { ReviewIdentity } from "@/components/auis-review/types";
import { withBridgeErrors } from "../../_errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handlePUT(
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

// Team panel housekeeping: removes a member from the identities list (future
// mentions/authorship). Old comments signed by them stay.
async function handleDELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await getBridgeSession(request);
  if (session.role === "reviewer") {
    return NextResponse.json({ error: "forbidden_role" }, { status: 403 });
  }
  const removed = await deleteIdentity(id);
  if (!removed) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export const PUT = withBridgeErrors(handlePUT);
export const DELETE = withBridgeErrors(handleDELETE);
