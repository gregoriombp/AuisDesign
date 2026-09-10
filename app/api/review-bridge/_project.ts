import type {
  ReviewComment,
  ReviewCommentContext,
  ReviewReply,
} from "@/components/auis-review/types";

/**
 * Read "views" for the review-bridge list/get endpoints (`?view=`).
 *
 * The stored ReviewComment carries everything the Review Mode UI needs to *draw*
 * a pin — absolute anchor geometry, reveal paths, viewport dims, color tokens —
 * but that an AGENT resolving the comment never reads. Those fat fields
 * (anchor + revealPath + context geometry) are ~60% of the payload. A projection
 * lets a reader ask for only what it needs:
 *
 *   preview → triage / rank / plan: id, url, status, text, counts. ~95% smaller.
 *   lean    → implement: preview + reply/target/resolution text, no geometry. ~70% smaller.
 *   full    → default; the whole record (the UI needs it to render pins/draws).
 *
 * Whitelist BY DESIGN: preview/lean list the fields explicitly, so a new heavy
 * field added to ReviewComment stays excluded until someone opts it in — the
 * projections can never silently regrow back to full size.
 */
export type ReviewView = "full" | "lean" | "preview";

export function parseView(v: string | null | undefined): ReviewView {
  return v === "lean" || v === "preview" ? v : "full";
}

export interface ReviewCommentPreview {
  id: string;
  url: string;
  status: ReviewComment["status"];
  origin?: ReviewComment["origin"];
  createdAt: number;
  updatedAt: number;
  authorKind?: ReviewComment["authorKind"];
  authorId: string;
  authorName: string;
  authorEmail?: string;
  /** Stamped author role — "reviewer" = a guest (asks, does not command);
   *  absent on older records (effectively admin). Lets the agent triage
   *  "resolve" × "answer" without downloading the whole record. */
  authorRole?: ReviewComment["authorRole"];
  visibility?: ReviewComment["visibility"];
  text: string;
  replyCount: number;
  hasImages: boolean;
  flowRef?: ReviewComment["flowRef"];
}

function toPreview(c: ReviewComment): ReviewCommentPreview {
  return {
    id: c.id,
    url: c.url,
    status: c.status,
    origin: c.origin,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    authorKind: c.authorKind,
    authorId: c.authorId,
    authorName: c.authorName,
    authorEmail: c.authorEmail,
    authorRole: c.authorRole,
    visibility: c.visibility,
    text: c.text,
    replyCount: c.replies?.length ?? 0,
    hasImages: (c.images?.length ?? 0) > 0,
    flowRef: c.flowRef,
  };
}

// Keep the *semantic* target (what/where in words) — drop rect, pointer,
// selector, capturedAt: pixel geometry the agent can't act on in code.
function leanContext(ctx: ReviewCommentContext | undefined) {
  if (!ctx) return undefined;
  const t = ctx.target;
  return {
    pageTitle: ctx.pageTitle,
    // Where (modal/tab/section) — cheap and crucial for the agent to find the target.
    location: ctx.location,
    nearbyText: ctx.nearbyText,
    target: t
      ? {
          tag: t.tag,
          role: t.role,
          label: t.label,
          text: t.text,
          fingerprint: t.fingerprint,
          attributes: t.attributes,
        }
      : undefined,
  };
}

// Drop authorColorToken (pure display). Reply images are externalized URL refs,
// so they stay small — keep them.
function leanReplies(replies: ReviewReply[] | undefined) {
  if (!replies?.length) return undefined;
  return replies.map((r) => ({
    id: r.id,
    authorKind: r.authorKind,
    authorId: r.authorId,
    authorName: r.authorName,
    authorEmail: r.authorEmail,
    authorRole: r.authorRole,
    text: r.text,
    images: r.images,
    createdAt: r.createdAt,
  }));
}

export interface ReviewCommentLean extends ReviewCommentPreview {
  images?: string[];
  resolution?: ReviewComment["resolution"];
  context?: ReturnType<typeof leanContext>;
  replies?: ReturnType<typeof leanReplies>;
}

function toLean(c: ReviewComment): ReviewCommentLean {
  return {
    ...toPreview(c),
    images: c.images,
    resolution: c.resolution,
    context: leanContext(c.context),
    replies: leanReplies(c.replies),
  };
}

/** Project a single record for `?view=`. `full` returns it untouched. */
export function projectComment(c: ReviewComment, view: ReviewView) {
  if (view === "preview") return toPreview(c);
  if (view === "lean") return toLean(c);
  return c;
}

/** Project a list for `?view=`. `full` returns the same array reference. */
export function projectComments(comments: ReviewComment[], view: ReviewView) {
  if (view === "full") return comments;
  const fn = view === "preview" ? toPreview : toLean;
  return comments.map(fn);
}
