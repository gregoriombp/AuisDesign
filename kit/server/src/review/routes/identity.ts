import { deleteIdentity, upsertIdentity } from "../store";
import { getBridgeSession } from "../session";
import type { ReviewIdentity } from "@auis/core/types";

async function handlePUT(
  request: Request,
  params: { id: string },
) {
  const { id } = params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_identity" }, { status: 400 });
  }
  if (
    !body ||
    typeof body !== "object" ||
    typeof (body as ReviewIdentity).id !== "string" ||
    typeof (body as ReviewIdentity).name !== "string" ||
    typeof (body as ReviewIdentity).colorToken !== "string"
  ) {
    return Response.json({ error: "invalid_identity" }, { status: 400 });
  }
  const identity = body as ReviewIdentity;
  if (identity.id !== id) return Response.json({ error: "id_mismatch" }, { status: 400 });
  await upsertIdentity(identity);
  return Response.json({ ok: true });
}

// Team panel housekeeping: removes a member from the identities list (future
// mentions/authorship). Old comments signed by them stay.
async function handleDELETE(
  request: Request,
  params: { id: string },
) {
  const { id } = params;
  const session = await getBridgeSession(request);
  if (session.role === "reviewer") {
    return Response.json({ error: "forbidden_role" }, { status: 403 });
  }
  const removed = await deleteIdentity(id);
  if (!removed) return Response.json({ error: "not_found" }, { status: 404 });
  return Response.json({ ok: true });
}

export const PUT = handlePUT;
export const DELETE = handleDELETE;
