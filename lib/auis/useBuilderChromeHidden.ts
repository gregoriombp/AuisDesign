"use client"

import { useSearchParams } from "next/navigation"

/**
 * `?chrome=0` hides the builder chrome (the Auis dot, the Review pill) for one
 * load of the screen — used by the State Mode matrix iframes (/auis/states) and
 * by the PDF generator, so a thumbnail shows ONLY the product. Opt-in by URL,
 * never automatic: the golden-eye flows keep opening screens in an iframe with
 * the chrome visible.
 *
 * Consumers must sit under <Suspense> (useSearchParams during prerender).
 */
export function useBuilderChromeHidden(): boolean {
  const searchParams = useSearchParams()
  return searchParams.get("chrome") === "0"
}
