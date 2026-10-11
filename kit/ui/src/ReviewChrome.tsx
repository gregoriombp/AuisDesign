"use client"

import * as React from "react"
import { ChromeScope } from "./ChromeScope"
import { ToastProvider } from "./primitives/Toast"
import { ReviewModeProvider } from "./review/ReviewModeProvider"
import type { ReviewModeLink } from "./review/ReviewToolbar"

// The chrome's type and icons. Loaded only when the page has no stylesheet for
// the family yet (Auis's own layout already links both).
const FONTS = [
  {
    family: "Geist",
    href: "https://fonts.googleapis.com/css2?family=Geist:wght@300..700&family=Geist+Mono:wght@400..700&display=swap",
  },
  {
    family: "Material+Symbols+Rounded",
    href: "https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-25..200&display=block",
  },
]

function ensureFonts() {
  const linked = Array.from(
    document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]'),
    (link) => link.href,
  )
  for (const font of FONTS) {
    if (linked.some((href) => href.includes(`family=${font.family}`))) continue
    const link = document.createElement("link")
    link.rel = "stylesheet"
    link.href = font.href
    link.setAttribute("data-auis-font", "")
    document.head.appendChild(link)
  }
}

/**
 * The whole review chrome — the toolbar and everything Review Mode draws — in
 * one element for the host's root layout. It brings its own styles (scoped, see
 * ChromeScope), fonts and toast stack, so it needs nothing from the host.
 *
 * `modes` puts other modes on the toolbar's left edge (Auis passes Edit and
 * States). `loadFonts={false}` skips the font stylesheets when the host already
 * serves Geist and Material Symbols Rounded some other way.
 */
export function ReviewChrome({
  modes,
  loadFonts = true,
}: {
  modes?: ReviewModeLink[]
  loadFonts?: boolean
}) {
  React.useEffect(() => {
    if (loadFonts) ensureFonts()
  }, [loadFonts])

  return (
    <ChromeScope>
      <ToastProvider>
        <ReviewModeProvider modes={modes} />
      </ToastProvider>
    </ChromeScope>
  )
}
