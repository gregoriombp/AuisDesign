"use client"

import * as React from "react"
import {
  findPrimaryScrollContainer,
  getViewportProbeScroll,
  invalidatePrimaryScrollCache,
} from "@auis/core/scrollOffset"

// The React side of @auis/core/scrollOffset: re-render the overlay when the
// content scrolls or reflows.

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

// Re-renders when the layout reflows WITHOUT a scroll or a window resize — two
// cases:
//   1. Side panels that change the primary container's width via flex
//      (a ResizeObserver on the primary container + body covers it).
//   2. An overlay (modal/drawer/popover/dropdown) that MOUNTS or UNMOUNTS its
//      portal as a child of `<body>` — the body's size does not change, so the
//      ResizeObserver never fires, but a pin anchored INSIDE it just
//      appeared/disappeared. A MutationObserver on the body's childList covers
//      that, and it is what makes a modal comment's pin paint the instant the
//      modal opens (manually or through the reveal trail replay).
// `useCumulativeScrollOffset` only listens to scroll/resize, hence these two
// observers.
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
        // a settings area where the scroll moves from <main> to an inner div) —
        // re-resolve it on the next scroll read.
        invalidatePrimaryScrollCache()
        setVersion((n) => n + 1)
      })
    }
    const ro = new ResizeObserver(bump)
    const primary = findPrimaryScrollContainer()
    if (primary) ro.observe(primary)
    ro.observe(document.body)
    // Overlays mount/unmount as direct children of body (Radix portals).
    const mo =
      typeof MutationObserver !== "undefined"
        ? new MutationObserver(bump)
        : null
    mo?.observe(document.body, { childList: true })
    return () => {
      ro.disconnect()
      mo?.disconnect()
      if (raf !== null) cancelAnimationFrame(raf)
    }
  }, [])
  return version
}
