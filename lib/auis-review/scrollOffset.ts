import * as React from "react"
import { OVERLAY_DATA_ATTR } from "@/components/auis-review/constants"

// In SPAs the real scroll usually lives in an inner container (overflow-y
// auto/scroll), not on `window`. So that review-mode pins/strokes stay anchored
// to the CONTENT — not to the viewport — we add the `window` scroll plus the
// `scrollTop`/`scrollLeft` of every scrollable ancestor of the reference
// element.

function isScrollable(el: HTMLElement): boolean {
  const style = window.getComputedStyle(el)
  return (
    style.overflowY === "auto" ||
    style.overflowY === "scroll" ||
    style.overflowX === "auto" ||
    style.overflowX === "scroll"
  )
}

export function cumulativeScrollFromElement(
  start: Element | null,
): { x: number; y: number } {
  let x = typeof window !== "undefined" ? window.scrollX : 0
  let y = typeof window !== "undefined" ? window.scrollY : 0
  if (typeof window === "undefined") return { x, y }
  let el: Element | null = start
  while (el && el !== document.body && el !== document.documentElement) {
    if (el instanceof HTMLElement && isScrollable(el)) {
      y += el.scrollTop
      x += el.scrollLeft
    }
    el = el.parentElement
  }
  return { x, y }
}

// Get the element under the point, skipping the review overlay's own elements
// (pin, popover, toolbar) — otherwise the "target" would be the canvas SVG and
// the ancestor chain would never pass through the real scrollable container.
export function elementBelowOverlayAt(
  clientX: number,
  clientY: number,
): Element | null {
  if (typeof document === "undefined") return null
  const stack = document.elementsFromPoint(clientX, clientY)
  for (const el of stack) {
    if (el.closest(`[${OVERLAY_DATA_ATTR}]`)) continue
    return el
  }
  return null
}

// The scroll that anchors the whole overlay comes from the PRIMARY content
// container (the page's largest scrollable), not from a single-point probe at
// the center of the viewport. The point probe was fragile: when a fixed
// modal/drawer covers the center, it "switches" to the modal's scroll chain
// (typically 0) while the content behind stays scrolled — then capture
// (per-element) and render (probe) diverge and the pin/popover land in the wrong
// place. The primary container is immune to that because the modal is smaller
// than the content.
let primaryCache: HTMLElement | null = null

function qualifiesAsPrimary(el: HTMLElement | null): el is HTMLElement {
  return (
    !!el &&
    el.isConnected &&
    isScrollable(el) &&
    (el.scrollHeight > el.clientHeight || el.scrollWidth > el.clientWidth)
  )
}

function primaryScrollContainer(): HTMLElement | null {
  if (qualifiesAsPrimary(primaryCache)) return primaryCache
  primaryCache = findPrimaryScrollContainer()
  return primaryCache
}

/** Invalidate the primary-container cache (route change, large reflow). */
export function invalidatePrimaryScrollCache(): void {
  primaryCache = null
}

/** Cumulative scroll (window + primary content container). The single, stable
 *  basis used by both capture and render, so the two agree. */
export function getContentScroll(): { x: number; y: number } {
  if (typeof window === "undefined") return { x: 0, y: 0 }
  let x = window.scrollX
  let y = window.scrollY
  const el = primaryScrollContainer()
  if (el) {
    x += el.scrollLeft
    y += el.scrollTop
  }
  return { x, y }
}

export function getViewportProbeScroll(): { x: number; y: number } {
  return getContentScroll()
}

export function useCumulativeScrollOffset() {
  const [offset, setOffset] = React.useState({ x: 0, y: 0 })
  React.useEffect(() => {
    let raf: number | null = null
    const update = () => {
      raf = null
      setOffset(getViewportProbeScroll())
    }
    update()
    const onScroll = () => {
      if (raf === null) raf = requestAnimationFrame(update)
    }
    document.addEventListener("scroll", onScroll, {
      capture: true,
      passive: true,
    })
    window.addEventListener("resize", onScroll)
    return () => {
      document.removeEventListener("scroll", onScroll, true)
      window.removeEventListener("resize", onScroll)
      if (raf !== null) cancelAnimationFrame(raf)
    }
  }, [])
  return offset
}

// Re-renders when the layout reflows WITHOUT a scroll or a window resize — e.g.
// a side panel that changes the primary container's width via flex.
// `useCumulativeScrollOffset` only listens to scroll/resize, so element-anchored
// pins would never re-resolve. A ResizeObserver on the primary container
// (+ body) covers that case.
export function useLayoutVersion(): number {
  const [version, setVersion] = React.useState(0)
  React.useEffect(() => {
    if (typeof window === "undefined" || typeof ResizeObserver === "undefined")
      return
    let raf: number | null = null
    const bump = () => {
      if (raf !== null) return
      raf = requestAnimationFrame(() => {
        raf = null
        // The reflow may have swapped the content container (e.g. navigating to
        // /settings, where the scroll moves from <main> to an inner div) —
        // re-resolve it on the next scroll read.
        invalidatePrimaryScrollCache()
        setVersion((n) => n + 1)
      })
    }
    const ro = new ResizeObserver(bump)
    const primary = findPrimaryScrollContainer()
    if (primary) ro.observe(primary)
    ro.observe(document.body)
    return () => {
      ro.disconnect()
      if (raf !== null) cancelAnimationFrame(raf)
    }
  }, [])
  return version
}

// Finds the scrollable container covering the largest viewport area — used for
// programmatic scrolling (navigating to a comment).
export function findPrimaryScrollContainer(): HTMLElement | null {
  if (typeof document === "undefined") return null
  let bestEl: HTMLElement | null = null
  let bestArea = 0
  document.querySelectorAll<HTMLElement>("*").forEach((el) => {
    if (!isScrollable(el)) return
    if (el.scrollHeight <= el.clientHeight && el.scrollWidth <= el.clientWidth)
      return
    const rect = el.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) return
    const area = rect.width * rect.height
    if (area > bestArea) {
      bestEl = el
      bestArea = area
    }
  })
  return bestEl
}
