// A comment's permalink: the screen URL plus `?reviewCommentId=`, which is what
// makes Review Mode turn on, select the pin and replay the reveal trail on the
// way back. One implementation for every surface (drawer card, thread popover,
// inbox, pending-work page) — the copies used to diverge.

import type { ReviewComment } from "@/components/auis-review/types"

/** Relative path carrying the comment's permalink. */
export function permalinkPath(comment: ReviewComment): string {
  const [pathname = "", rawQuery = ""] = comment.url.split("?", 2)
  const params = new URLSearchParams(rawQuery)
  params.set("reviewCommentId", comment.id)
  return `${pathname}?${params.toString()}`
}

/** Same thing, absolute — to copy and paste somewhere else. */
export function permalinkHref(comment: ReviewComment): string {
  const base = typeof window === "undefined" ? "" : window.location.origin
  return `${base}${permalinkPath(comment)}`
}
