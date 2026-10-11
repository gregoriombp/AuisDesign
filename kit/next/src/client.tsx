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
import { ReviewChrome } from "@auis/ui/ReviewChrome"
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

/**
 * Everything a host's root layout needs, in one element: the router above and
 * the review chrome (@auis/ui) with its styles, fonts and toasts. `auis init`
 * places it before `</body>`:
 *
 *   import { AuisReview } from "@auis/next/client"
 *   <AuisReview />
 *
 * The Suspense boundary is its own: the router reads `useSearchParams`, and
 * without one Next refuses to prerender a static page of the host.
 */
export function AuisReview({ loadFonts }: { loadFonts?: boolean } = {}) {
  return (
    <React.Suspense fallback={null}>
      <NextReviewRouter>
        <ReviewChrome loadFonts={loadFonts} />
      </NextReviewRouter>
    </React.Suspense>
  )
}
