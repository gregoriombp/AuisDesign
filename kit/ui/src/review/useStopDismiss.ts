import * as React from "react"

/**
 * Returns a callback ref that attaches a NATIVE bubble-phase `pointerdown`
 * listener (stopping propagation) to the element it's set on — so interacting
 * with a review surface (toolbar, compose popover, …) never reaches a Radix
 * dialog's document-level "outside" listener, which would otherwise dismiss the
 * modal the moment you touch the toolbar or composer.
 *
 * Why native (not React's `onPointerDown` + `stopPropagation`): React 19 / Next
 * App Router delegate events from `document` — the SAME node Radix listens on —
 * so a synthetic `stopPropagation`/`stopImmediatePropagation` runs too late to
 * stop Radix. A real listener on the element fires during the element's own
 * bubble step, before the event ever reaches `document`. The listener dies with
 * the node, so there's nothing to clean up.
 */
export function useStopDismiss<T extends HTMLElement>() {
  return React.useCallback((node: T | null) => {
    if (!node) return
    node.addEventListener("pointerdown", (e) => e.stopPropagation())
  }, [])
}
