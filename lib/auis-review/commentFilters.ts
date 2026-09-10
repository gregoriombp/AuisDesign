// Filter + ordering of the Review Bridge comment lists — PURE logic shared by
// the drawer (ReviewCommentSheet) and the pending-work page (CommentsPanel), so
// both offer exactly the same cut: multi-select authors and screens, period
// (presets + custom range) and chronological order. The UI lives in
// ReviewFilterBar (the mega menu behind the filter icon).

import type { ReviewComment } from "@/components/auis-review/types"

export type ReviewPeriod = "all" | "today" | "7d" | "30d" | "custom"
export type ReviewOrder = "desc" | "asc"

export interface ReviewListFilters {
  /** Selected authorIds; empty = every author. */
  authorIds: string[]
  /** Selected screen URLs; empty = every screen. */
  pages: string[]
  period: ReviewPeriod
  /** Custom range (ms, inclusive) — only when period === "custom". */
  customFrom?: number
  customTo?: number
  /** desc = newest first (default); asc = chronological order. */
  order: ReviewOrder
}

export const DEFAULT_REVIEW_FILTERS: ReviewListFilters = {
  authorIds: [],
  pages: [],
  period: "all",
  order: "desc",
}

export const PERIOD_LABEL: Record<Exclude<ReviewPeriod, "custom">, string> = {
  all: "Any date",
  today: "Today",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
}

export function hasActiveFilters(f: ReviewListFilters): boolean {
  return f.authorIds.length > 0 || f.pages.length > 0 || f.period !== "all"
}

/** How many filter GROUPS are active (the badge on the filter icon). */
export function activeFilterCount(f: ReviewListFilters): number {
  return (
    (f.authorIds.length > 0 ? 1 : 0) +
    (f.pages.length > 0 ? 1 : 0) +
    (f.period !== "all" ? 1 : 0)
  )
}

/** "12 Jun" — short date summary for the custom range label. */
export function formatDayShort(ms: number): string {
  return new Date(ms)
    .toLocaleDateString("en-GB", { day: "numeric", month: "short" })
    .replace(".", "")
}

export interface ReviewAuthorOption {
  id: string
  name: string
}

/** Distinct authors present in the list (agents that pinned included), for the
 *  filter menu. A raw-email name becomes its local part. */
export function collectAuthorOptions(
  comments: readonly ReviewComment[],
): ReviewAuthorOption[] {
  const map = new Map<string, string>()
  for (const c of comments) {
    if (!map.has(c.authorId)) {
      const raw = c.authorName?.trim() || "Reviewer"
      const name =
        raw.includes("@") && !raw.includes(" ") ? raw.split("@")[0] : raw
      map.set(c.authorId, name)
    }
  }
  return Array.from(map, ([id, name]) => ({ id, name })).sort((a, b) =>
    a.name.localeCompare(b.name),
  )
}

/** Distinct screens with comments, for the filter menu. */
export function collectPageOptions(comments: readonly ReviewComment[]): string[] {
  const set = new Set<string>()
  for (const c of comments) set.add(c.url)
  return Array.from(set).sort((a, b) => a.localeCompare(b))
}

const DAY_MS = 86_400_000

function periodBounds(
  f: ReviewListFilters,
  now: number,
): { start: number | null; end: number | null } {
  if (f.period === "all") return { start: null, end: null }
  if (f.period === "today") {
    const d = new Date(now)
    d.setHours(0, 0, 0, 0)
    return { start: d.getTime(), end: null }
  }
  if (f.period === "custom") {
    const start = f.customFrom ?? null
    // `customTo` marks the LAST day — extend it to 23:59:59.999 of that day.
    const end =
      f.customTo !== undefined
        ? (() => {
            const d = new Date(f.customTo)
            d.setHours(23, 59, 59, 999)
            return d.getTime()
          })()
        : null
    return { start, end }
  }
  const days = f.period === "7d" ? 7 : 30
  return { start: now - days * DAY_MS, end: null }
}

export function applyReviewFilters(
  comments: readonly ReviewComment[],
  f: ReviewListFilters,
  now: number = Date.now(),
): ReviewComment[] {
  const { start, end } = periodBounds(f, now)
  const authorSet = f.authorIds.length > 0 ? new Set(f.authorIds) : null
  const pageSet = f.pages.length > 0 ? new Set(f.pages) : null
  const filtered = comments.filter((c) => {
    if (authorSet && !authorSet.has(c.authorId)) return false
    if (pageSet && !pageSet.has(c.url)) return false
    if (start !== null && c.createdAt < start) return false
    if (end !== null && c.createdAt > end) return false
    return true
  })
  return filtered.sort((a, b) =>
    f.order === "desc" ? b.createdAt - a.createdAt : a.createdAt - b.createdAt,
  )
}
