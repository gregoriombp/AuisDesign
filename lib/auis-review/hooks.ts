"use client"

import * as React from "react"
import { useReviewPathname } from "@auis/ui/router"
import type { ReviewComment } from "@auis/core/types"
import { useReviewStore } from "./store"
import { useLiveLocation } from "@auis/ui/liveLocation"
import { canonicalizeReviewUrl, matchesCurrentReviewUrl } from "./urlMatch"

/**
 * The current screen in canonical form — the same form comments are compared in.
 *
 * Reads the live address, not the router snapshot: screens that mirror their
 * step with `replaceState` (see `useLiveLocation`) change address without
 * navigating, and that is the address `saveComment` stamps on the pin. On the
 * server only the pathname is left.
 */
export function useCurrentUrl(): string {
  const pathname = useReviewPathname()
  const live = useLiveLocation()
  return canonicalizeReviewUrl(live || pathname)
}

export function useCommentsForUrl(url: string): ReviewComment[] {
  const all = useReviewStore((s) => s.comments)
  return React.useMemo(
    () => all.filter((c) => matchesCurrentReviewUrl(c.url, url)),
    [all, url]
  )
}
