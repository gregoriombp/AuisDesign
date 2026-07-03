"use client"

import * as React from "react"
import { usePathname, useSearchParams } from "next/navigation"
import type { ReviewComment } from "@/components/auis-review/types"
import { useReviewStore } from "./store"

export function useCurrentUrl(): string {
  const pathname = usePathname() ?? ""
  const searchParams = useSearchParams()
  const params = new URLSearchParams(searchParams?.toString() ?? "")
  params.delete("reviewCommentId")
  const search = params.toString()
  return search ? `${pathname}?${search}` : pathname
}

export function useCommentsForUrl(url: string): ReviewComment[] {
  const all = useReviewStore((s) => s.comments)
  return React.useMemo(
    () => all.filter((c) => c.url === url),
    [all, url]
  )
}
