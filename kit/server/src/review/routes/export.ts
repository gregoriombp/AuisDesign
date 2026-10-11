import { exportAll } from "../store";
import { filterCommentsForSession, getBridgeSession } from "../session";

async function handleGET(request: Request) {
  const session = await getBridgeSession(request);
  const payload = await exportAll();
  if (session.role !== "reviewer") return Response.json(payload);
  // A reviewer exports only what they can see — "admins" comments never leak here.
  return Response.json({
    ...payload,
    comments: filterCommentsForSession(payload.comments, session),
    archivedComments: filterCommentsForSession(payload.archivedComments ?? [], session),
  });
}

export const GET = handleGET;
