import type { ReviewComment } from "@/components/auis-review/types";

/** States the edit PUT toggles between. Every other change is a transition. */
const SOFT_STATES = new Set<ReviewComment["status"]>(["open", "backlog"]);

export interface CommentEditPolicy {
  /** The session decides an "admins only" visibility (today: an admin). */
  canSetVisibility: boolean;
  /** Agent session (agent token, or the local mention runner). */
  isAgent: boolean;
}

/**
 * Edit of an existing comment through the PUT. The client sends the whole
 * record from its polling cache, which can be up to 4 s behind. From the
 * client only the editable fields count (text, images, anchor, context). From
 * the stored record come authorship and creation; the replies, which have
 * their own route (/replies); the resolution, which comes from transitions;
 * and the status, except the open ↔ future-idea toggle by a non-agent.
 * Without this, an agent reply that arrived after the last poll vanished on a
 * text edit, the thread accepted a forged reply, and an admin's stale cache
 * undid an agent's in_review.
 */
export function mergeCommentEdit(
  existing: ReviewComment,
  incoming: ReviewComment,
  policy: CommentEditPolicy,
): ReviewComment {
  const merged: ReviewComment = { ...incoming };
  merged.authorId = existing.authorId;
  merged.authorName = existing.authorName;
  merged.authorColorToken = existing.authorColorToken;
  merged.createdAt = existing.createdAt;
  keepFromExisting(merged, existing, "authorKind");
  keepFromExisting(merged, existing, "authorEmail");
  keepFromExisting(merged, existing, "authorRole");
  keepFromExisting(merged, existing, "replies");
  keepFromExisting(merged, existing, "resolution");

  const togglesSoftState =
    !policy.isAgent && SOFT_STATES.has(existing.status) && SOFT_STATES.has(merged.status);
  if (!togglesSoftState) merged.status = existing.status;

  if (policy.isAgent || !policy.canSetVisibility) {
    if (existing.visibility === "admins") merged.visibility = "admins";
    else delete merged.visibility;
  } else if (merged.visibility !== "admins") {
    delete merged.visibility;
  }
  return merged;
}

type ServerOwnedField = "authorKind" | "authorEmail" | "authorRole" | "replies" | "resolution";

function keepFromExisting<K extends ServerOwnedField>(
  target: ReviewComment,
  source: ReviewComment,
  key: K,
) {
  if (source[key] !== undefined) target[key] = source[key];
  else delete target[key];
}
