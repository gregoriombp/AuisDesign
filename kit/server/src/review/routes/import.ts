import { importMerge } from "../store";
import { getBridgeSession } from "../session";
import type { ReviewExportPayload } from "@auis/core/types";

async function handlePOST(request: Request) {
  // Importing touches the whole database — admin/agent only.
  const session = await getBridgeSession(request);
  if (session.role === "reviewer") {
    return Response.json({ error: "forbidden_role" }, { status: 403 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_payload" }, { status: 400 });
  }
  if (!body || typeof body !== "object" || !Array.isArray((body as { comments?: unknown[] }).comments)) {
    return Response.json({ error: "invalid_payload" }, { status: 400 });
  }
  const result = await importMerge(body as ReviewExportPayload);
  return Response.json(result);
}

export const POST = handlePOST;
