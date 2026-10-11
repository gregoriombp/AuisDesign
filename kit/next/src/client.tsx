"use client"

// @auis/next/client — the browser half of the Next adapter: the review chrome
// (@auis/ui) reads the screen and navigates through Next's router instead of
// the window. In the host it wraps the root layout's body once:
//
//   import { NextReviewRouter } from "@auis/next/client"
//   <NextReviewRouter>{children}…</NextReviewRouter>
//
// It lives at layout level, not inside the chrome, so review pieces a page
// renders on its own (an inbox, a flow canvas) navigate the same way.
import * as React from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { ReviewRouterProvider, type ReviewRouterAdapter } from "@auis/ui/router"

export const nextRouter: ReviewRouterAdapter = {
  usePathname: () => usePathname() ?? "",
  useSearchParams: () => {
    const params = useSearchParams()
    return React.useMemo(() => new URLSearchParams(params?.toString() ?? ""), [params])
  },
  useNavigate: () => useRouter().push,
}

export function NextReviewRouter({ children }: { children: React.ReactNode }) {
  return <ReviewRouterProvider adapter={nextRouter}>{children}</ReviewRouterProvider>
}
