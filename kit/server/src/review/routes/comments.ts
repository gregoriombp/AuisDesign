import { listComments } from "../store";
import { parseView, projectComments } from "../project";
import { effectiveAuthorRole, filterCommentsForSession, getBridgeSession } from "../session";
import type {
  ReviewAuthorRole,
  ReviewCommentOrigin,
  ReviewCommentStatus,
} from "@auis/core/types";

// Touches the filesystem (review-bridge/data/*.json) — Node, never cached.

function parseStatus(v: string | null): ReviewCommentStatus | undefined {
  if (v === "open" || v === "in_review" || v === "resolved" || v === "backlog") return v;
  return undefined;
}

function parseAuthorRole(v: string | null): ReviewAuthorRole | undefined {
  if (v === "admin" || v === "reviewer") return v;
  return undefined;
}

function parseOrigin(v: string | null): ReviewCommentOrigin | undefined {
  if (v === "page" || v === "ux-flow" || v === "backlog") {
    return v;
  }
  return undefined;
}

async function handleGET(request: Request) {
  const url = new URL(request.url).searchParams.get("url") ?? undefined;
  const status = parseStatus(new URL(request.url).searchParams.get("status"));
  const origin = parseOrigin(new URL(request.url).searchParams.get("origin"));
  const flow = new URL(request.url).searchParams.get("flow") ?? undefined;
  // `?authorRole=admin|reviewer` — EFFECTIVE role of the author (stamp or
  // legacy default). Lets a skill triage "the admin's asks" vs "questions from
  // reviewers" without downloading and classifying everything on its side.
  const authorRole = parseAuthorRole(new URL(request.url).searchParams.get("authorRole"));
  // `?view=preview|lean` strips the anchor/geometry an agent never reads (~70-95%
  // smaller). Absent/`full` → whole records, which the Review Mode UI needs.
  const view = parseView(new URL(request.url).searchParams.get("view"));
  const session = await getBridgeSession(request);
  let comments = filterCommentsForSession(
    await listComments({
      url,
      status,
      origin,
      flow,
    }),
    session,
  );
  if (authorRole) {
    comments = comments.filter((c) => effectiveAuthorRole(c) === authorRole);
  }
  return Response.json({ comments: projectComments(comments, view) });
}

export const GET = handleGET;
