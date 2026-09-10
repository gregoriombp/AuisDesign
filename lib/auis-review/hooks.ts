"use client"

import * as React from "react"
import { usePathname, useSearchParams } from "next/navigation"
import type { ReviewComment } from "@/components/auis-review/types"
import { useReviewStore } from "./store"
import { canonicalizeReviewUrl } from "./urlMatch"

/** The current screen in canonical form — the same form comments are compared in. */
export function useCurrentUrl(): string {
  const pathname = usePathname() ?? ""
  const searchParams = useSearchParams()
  const search = searchParams?.toString() ?? ""
  return canonicalizeReviewUrl(search ? `${pathname}?${search}` : pathname)
}

export function useCommentsForUrl(url: string): ReviewComment[] {
  const all = useReviewStore((s) => s.comments)
  return React.useMemo(
    () => all.filter((c) => canonicalizeReviewUrl(c.url) === url),
    [all, url]
  )
}
