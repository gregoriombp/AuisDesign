"use client"

import * as React from "react"
import { useLiveLocation } from "./liveLocation"

/**
 * What the review chrome needs from the host's router: where the screen is, and
 * a way to go somewhere else. Each member is a React hook, called on every
 * render of the components that read it — so an adapter is fixed for the life of
 * the app (never swap one adapter for another while mounted).
 *
 * Kept as three hooks instead of one so a component that only needs the
 * pathname never reads the query: in Next, `useSearchParams` needs a Suspense
 * boundary during prerender and `usePathname` does not.
 */
export interface ReviewRouterAdapter {
  usePathname: () => string
  useSearchParams: () => URLSearchParams
  useNavigate: () => (href: string) => void
}

/**
 * The adapter with no framework behind it: the live window address (see
 * `useLiveLocation`, which also sees `pushState`/`replaceState`) and a full
 * page load to navigate. Hosts with a client router plug theirs in through
 * `ReviewRouterProvider` — `@auis/next/client` does it for Next.
 */
export const browserRouter: ReviewRouterAdapter = {
  usePathname: () => useLiveLocation().split("?")[0],
  useSearchParams: () => {
    const live = useLiveLocation()
    return React.useMemo(() => new URLSearchParams(live.split("?")[1] ?? ""), [live])
  },
  useNavigate: () => navigateByLoad,
}

function navigateByLoad(href: string) {
  window.location.assign(href)
}

const RouterContext = React.createContext<ReviewRouterAdapter>(browserRouter)

export function ReviewRouterProvider({
  adapter,
  children,
}: {
  adapter: ReviewRouterAdapter
  children: React.ReactNode
}) {
  // The first adapter wins: switching mid-life would change which hooks run.
  const [fixed] = React.useState(adapter)
  return <RouterContext.Provider value={fixed}>{children}</RouterContext.Provider>
}

export function useReviewPathname(): string {
  return React.useContext(RouterContext).usePathname()
}

export function useReviewSearchParams(): URLSearchParams {
  return React.useContext(RouterContext).useSearchParams()
}

export function useReviewNavigate(): (href: string) => void {
  return React.useContext(RouterContext).useNavigate()
}

/**
 * `?chrome=0` hides the review chrome for one load of the screen — used by the
 * State Mode matrix iframes and the PDF generator, so a thumbnail shows only the
 * product. Consumers must sit under <Suspense> (it reads the query).
 */
export function useChromeHidden(): boolean {
  return useReviewSearchParams().get("chrome") === "0"
}
