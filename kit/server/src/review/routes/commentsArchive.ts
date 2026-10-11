import { listArchive } from "../store";
import { filterCommentsForSession, getBridgeSession } from "../session";

async function handleGET(request: Request) {
  const params = new URL(request.url).searchParams;
  const url = params.get("url") ?? undefined;
  const beforeRaw = params.get("before");
  const limitRaw = params.get("limit");
  const before = beforeRaw && Number.isFinite(Number(beforeRaw)) ? Number(beforeRaw) : undefined;
  const limit = limitRaw && Number.isFinite(Number(limitRaw)) ? Number(limitRaw) : undefined;
  const session = await getBridgeSession(request);
  const page = await listArchive({ url, before, limit });
  // Post-pagination filter: a page may come shorter for a reviewer, but the
  // cursor (updatedAt of the last raw item) stays correct for the next one.
  return Response.json({
    ...page,
    comments: filterCommentsForSession(page.comments, session),
  });
}

export const GET = handleGET;
