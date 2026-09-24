import type { NextRequest } from "next/server";

import { isValidAgentToken } from "@/lib/auis-review/agentToken";
import type {
  ReviewAuthorRole,
  ReviewComment,
  ReviewReply,
} from "@/components/auis-review/types";

/**
 * Review Bridge hierarchy, resolved ON THE SERVER — the client never dictates
 * its own role (the authorEmail it sends is display; permission comes from
 * here).
 *
 *   admin    — the local dev server (Auis ships no auth provider, so every
 *              browser is an admin); or, behind an auth layer you add, the
 *              sessions you decide to promote.
 *   agent    — a request carrying a valid x-bridge-agent-token (skills and the
 *              mention runner, outside the browser). Sees everything and
 *              transitions status, but only executes admin commands (the gate
 *              lives in the mention trigger and the dispatch queue).
 *   reviewer — any other authenticated session once auth exists: comments and
 *              replies, but does not command agents, does not change status and
 *              does not see "admins-only" comments.
 *
 * This is the extension point for a product that puts Auis behind a login:
 * resolve `email`, `role` and `shared` from your session here and every route
 * inherits the hierarchy. The UI mirrors the answer through GET /session; the
 * real permission is re-checked on every write.
 */

export type BridgeRole = "admin" | "reviewer" | "agent";

export interface BridgeSession {
  role: BridgeRole;
  /** Authenticated e-mail of the session (null for agents / the local server). */
  email: string | null;
  /** true when the session's e-mail is an account shared by several people —
   *  the client then asks "who are you?" instead of adopting the session name. */
  shared: boolean;
  /** false without an auth layer — everything is admin. */
  authEnabled: boolean;
}

export async function getBridgeSession(req: NextRequest): Promise<BridgeSession> {
  if (isValidAgentToken(req)) {
    return { role: "agent", email: null, shared: false, authEnabled: false };
  }
  // Local dev server (and any deployment without an auth layer): full trust.
  return { role: "admin", email: null, shared: false, authEnabled: false };
}

// ── effective roles of records (older ones carry no stamp) ───────────────────

/**
 * Effective role of a comment/reply AUTHOR. New records carry a stamped
 * authorRole; older ones without it were written before the hierarchy existed
 * and count as admin.
 */
export function effectiveAuthorRole(author: {
  authorRole?: ReviewAuthorRole;
  authorEmail?: string;
}): ReviewAuthorRole {
  return author.authorRole ?? "admin";
}

/** Can this session's viewer SEE this comment? ("admins" visibility) */
export function canSeeComment(comment: ReviewComment, session: BridgeSession): boolean {
  if (comment.visibility !== "admins") return true;
  return session.role !== "reviewer";
}

export function filterCommentsForSession(
  comments: ReviewComment[],
  session: BridgeSession,
): ReviewComment[] {
  if (session.role !== "reviewer") return comments;
  return comments.filter((c) => c.visibility !== "admins");
}

/** A reviewer session only touches what is THEIRS (same authenticated e-mail). */
export function ownsRecord(
  record: { authorEmail?: string },
  session: BridgeSession,
): boolean {
  return (
    session.email !== null &&
    record.authorEmail?.toLowerCase() === session.email
  );
}

/** An agent reply on a thread? (written by the skills) */
export function isAgentReply(reply: ReviewReply): boolean {
  return reply.authorKind === "agent";
}
