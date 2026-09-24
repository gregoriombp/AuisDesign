"use client"

// Reviewers = the HUMANS that can be @mentioned on the Review Bridge (distinct
// from ./agents, which are Claude/Codex/Grok). Source: the identities saved
// in the bridge store — see GET /api/review-bridge/reviewers, which derives the
// handle and returns the list ready to use.
//
// The handle derivation (isomorphic, no "use client") lives in ./reviewerHandle
// and is re-exported here so the existing importers (autocomplete, CommentText)
// do not need to know it moved. This module is ONLY the client side: a module
// cache + a hook to read the list without duplicating fetches (the "@"
// autocomplete and CommentText ask for the same thing at the same time).

import * as React from "react"

export {
  foldAscii,
  deriveReviewerHandleBase,
  deriveReviewerHandles,
} from "./reviewerHandle"

export interface ReviewerRef {
  id: string
  name: string
  email?: string
  /** Token typed after "@" (case-insensitive on parse, always lowercase here). */
  handle: string
}

// ── client fetch cache (single-flight, ~60s) ─────────────────────────────────

const ENDPOINT = "/api/review-bridge/reviewers"
const CACHE_TTL_MS = 60_000

let cache: { data: ReviewerRef[]; at: number } | null = null
let inflight: Promise<ReviewerRef[]> | null = null

/** Fetches the reviewer list, with a module cache (~60s) and single-flight —
 *  concurrent callers (autocomplete + CommentText mounting together) reuse the
 *  SAME promise instead of firing N identical requests. */
export async function fetchReviewers(): Promise<ReviewerRef[]> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.data
  if (inflight) return inflight

  inflight = (async () => {
    try {
      const res = await fetch(ENDPOINT)
      if (!res.ok) throw new Error(`reviewers_fetch_failed_${res.status}`)
      const data = (await res.json()) as { reviewers?: ReviewerRef[] }
      const list = Array.isArray(data.reviewers) ? data.reviewers : []
      cache = { data: list, at: Date.now() }
      return list
    } catch {
      // offline / route down — keep the previous cache (if any) and return an
      // empty list without breaking the autocomplete (@Claude/@Grok keep
      // working; only people disappear until the next successful fetch).
      return cache?.data ?? []
    } finally {
      inflight = null
    }
  })()

  return inflight
}

/** Current reviewer list for the client — fetched on mount (cache-aware) and
 *  reflected as soon as it lands. No polling; the list of people rarely
 *  changes (a new identity), unlike the comments. */
export function useReviewers(): ReviewerRef[] {
  const [reviewers, setReviewers] = React.useState<ReviewerRef[]>(
    () => cache?.data ?? [],
  )

  React.useEffect(() => {
    let cancelled = false
    void fetchReviewers().then((list) => {
      if (!cancelled) setReviewers(list)
    })
    return () => {
      cancelled = true
    }
  }, [])

  return reviewers
}
