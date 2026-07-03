"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { AuMentionMenu } from "@/components/ui/AuMentionMenu"
import type { ReviewCommandAutocomplete } from "@/lib/auis-review/useReviewCommandAutocomplete"
import { OVERLAY_DATA_ATTR, REVIEW_Z } from "./constants"

const MENU_WIDTH = 256 // w-64
const GAP = 6

/**
 * Fixed-positioned shell that drops the shared AuMentionMenu at the caret of a
 * Review Bridge composer's <textarea>. Driven entirely by the
 * useReviewCommandAutocomplete hook — prefers below the caret, flips above when
 * it would overflow the viewport, and clamps to the horizontal edges.
 *
 * Portaled to <body>: the composer popovers use `transform`, which would make a
 * nested `position: fixed` resolve against the transformed ancestor instead of
 * the viewport. The portal keeps the menu in viewport space. It still carries
 * the review overlay marker so the composer's outside-click guards treat it as
 * part of the review surface.
 */
export function ReviewCommandMenu({ ac }: { ac: ReviewCommandAutocomplete }) {
  const ref = React.useRef<HTMLDivElement>(null)
  const [placement, setPlacement] = React.useState<{
    top: number
    left: number
  } | null>(null)

  const anchor = ac.anchor
  const open = ac.open

  React.useLayoutEffect(() => {
    if (!open || !anchor) {
      setPlacement(null)
      return
    }
    const h = ref.current?.offsetHeight ?? 0
    const vw = window.innerWidth
    const vh = window.innerHeight
    const left = Math.max(8, Math.min(anchor.left, vw - MENU_WIDTH - 8))
    let top = anchor.bottom + GAP
    if (h && top + h > vh - 8) top = anchor.top - GAP - h
    if (top < 8) top = 8
    setPlacement({ top, left })
  }, [open, anchor])

  if (!open || !anchor || typeof document === "undefined") return null

  return createPortal(
    <div
      ref={ref}
      role="presentation"
      {...{ [OVERLAY_DATA_ATTR]: "" }}
      style={{
        position: "fixed",
        top: placement?.top ?? -9999,
        left: placement?.left ?? -9999,
        zIndex: REVIEW_Z.mention,
        width: MENU_WIDTH,
        pointerEvents: "auto",
        // Hidden until measured/placed so it never flashes at the wrong spot.
        visibility: placement ? "visible" : "hidden",
      }}
    >
      <AuMentionMenu
        aria-label={ac.ariaLabel}
        className="w-full"
        sections={ac.sections}
        activeKey={ac.activeKey}
        onHover={ac.setActiveByKey}
        onPick={ac.pickByKey}
      />
    </div>,
    document.body,
  )
}
