"use client"

import * as React from "react"
import { usePathname } from "next/navigation"
import { useGlobalHotkey } from "@/lib/hooks/useGlobalHotkey"
import { useReviewStore } from "@/lib/auis-review/store"
import { resolveAnchoredElement } from "@/lib/auis-review/elementAnchor"
import {
  revealAnchor,
  startRevealTrail,
  resetRevealTrail,
} from "@/lib/auis-review/revealTrail"
import { OVERLAY_DATA_ATTR } from "./constants"
import { ReviewCanvas } from "./ReviewCanvas"
import { ReviewMagicCursor } from "./ReviewMagicCursor"
import { ReviewCommentPopover } from "./ReviewCommentPopover"
import { ReviewCommentSheet } from "./ReviewCommentSheet"
import { ReviewExportModal } from "./ReviewExportModal"
import { ReviewIdentityModal } from "./ReviewIdentityModal"
import { ReviewThreadPopover } from "./ReviewThreadPopover"
import { ReviewToolbar } from "./ReviewToolbar"

export function ReviewModeProvider() {
  const hydrateIdentity = useReviewStore((s) => s.hydrateIdentity)
  const hydrateSession = useReviewStore((s) => s.hydrateSession)
  const refreshFromStorage = useReviewStore((s) => s.refreshFromStorage)
  const storage = useReviewStore((s) => s.storage)

  const active = useReviewStore((s) => s.active)
  const toggleActive = useReviewStore((s) => s.toggleActive)
  const cycleMode = useReviewStore((s) => s.cycleMode)
  const setMode = useReviewStore((s) => s.setMode)
  const cancelPending = useReviewStore((s) => s.cancelPending)
  const setSheetOpen = useReviewStore((s) => s.setSheetOpen)
  const openThread = useReviewStore((s) => s.openThread)
  const closeThread = useReviewStore((s) => s.closeThread)
  const setActive = useReviewStore((s) => s.setActive)
  const selectComment = useReviewStore((s) => s.selectComment)
  const comments = useReviewStore((s) => s.comments)
  const sheetOpen = useReviewStore((s) => s.sheetOpen)
  const permalinkHandledRef = React.useRef<string | null>(null)
  // Separate from "already handled": marking before the async work blocked the
  // second attempt, and the effect re-runs on every store poll (4s).
  const permalinkRunningRef = React.useRef<string | null>(null)
  const pathname = usePathname()

  // Record the reveal trail (clicks on triggers: buttons that open modals,
  // wizard options, tabs) all the time — review active or not — so a comment
  // dropped inside an overlay knows how to reopen it on focus. Always mounted
  // together with the provider (see layout.tsx).
  React.useEffect(() => startRevealTrail(), [])

  // Every new screen can carry its own ?reviewCommentId — release the permalink
  // so it gets reprocessed when the pathname changes (client-side navigation).
  // Also reset the trail: on a route change the overlays reset, so the previous
  // screen's trail no longer applies.
  React.useEffect(() => {
    permalinkHandledRef.current = null
    permalinkRunningRef.current = null
    resetRevealTrail()
  }, [pathname])

  React.useEffect(() => {
    void hydrateIdentity()
    void hydrateSession()
    void refreshFromStorage()
    const unsubscribe = storage.subscribe?.(() => {
      void refreshFromStorage()
    })
    return unsubscribe
  }, [hydrateIdentity, hydrateSession, refreshFromStorage, storage])

  // Permalink: open the review overlay and focus the pin when ?reviewCommentId=…
  // is present. If the pin lives inside a closed overlay (modal/drawer/tab), we
  // first REPLAY the comment's recorded reveal path to re-open it, so clicking a
  // comment lands you exactly where the pin is instead of on a bare screen with
  // a hidden pin you can't find.
  React.useEffect(() => {
    if (typeof window === "undefined") return
    const params = new URLSearchParams(window.location.search)
    const id = params.get("reviewCommentId")
    if (!id) return
    if (permalinkHandledRef.current === id) return
    if (permalinkRunningRef.current === id) return
    if (comments.length === 0) return
    const match = comments.find((c) => c.id === id)
    if (!match) return
    permalinkRunningRef.current = id
    setActive(true)
    selectComment(id)

    const controller = new AbortController()
    const focus = async () => {
      // Re-open the overlay holding the pin (no-op if it's plain page content
      // or there's no recorded path). Pins re-resolve once the overlay mounts
      // (useLayoutVersion observes the portal), so the marker then paints.
      await revealAnchor(match.anchor, match.revealPath, controller.signal)
      if (controller.signal.aborted) return
      const el = resolveAnchoredElement(match.anchor)
      if (el) {
        // Arrived: open the bubble anchored on the pin, the same as clicking
        // it. The drawer did its job of bringing you here — leaving it open
        // forced you to hunt which of the screen's pins was this one.
        openThread(id)
        // Prefer the live element — survives layout shifts and scrolls inside
        // a modal's own scroll container.
        el.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" })
        // Only here has the trip really finished. Marking before this (or at
        // the start of the effect) made a slow reveal lose its only chance.
        permalinkHandledRef.current = id
        return
      }
      // No pin drawn, nowhere to anchor the bubble: the drawer stays, and it is
      // the drawer that shows the comment.
      setSheetOpen(true)
      // Did not resolve. We used to scroll to the saved Y — but the canvas hides
      // the pin exactly in this case, so the scroll led somewhere nothing would
      // be drawn, which from the outside looks like "the pin showed up in the
      // wrong place". Better not to touch the screen: the drawer stays open
      // with the comment highlighted, and the card says where the pin was.
      permalinkHandledRef.current = id
    }
    void focus().finally(() => {
      if (permalinkRunningRef.current === id) permalinkRunningRef.current = null
    })
    return () => {
      controller.abort()
    }
  }, [comments, pathname, setActive, setSheetOpen, openThread, selectComment])

  // A Radix Dialog (AuModal/AuSheet) with `modal` keeps a focus trap that pulls
  // focus back inside itself whenever something outside gains focus. That would
  // make it impossible to type in the comment popover while reviewing a modal.
  // We intercept focusin/focusout in the CAPTURE PHASE: when the target (or the
  // related target) is a review surface, we stop the event before Radix's bubble
  // handler sees it — focus itself is untouched, only the "pull back".
  React.useEffect(() => {
    if (!active || typeof document === "undefined") return
    const within = (n: EventTarget | null) =>
      n instanceof Element && !!n.closest(`[${OVERLAY_DATA_ATTR}]`)
    const onFocusIn = (e: FocusEvent) => {
      if (within(e.target)) e.stopImmediatePropagation()
    }
    const onFocusOut = (e: FocusEvent) => {
      if (within(e.relatedTarget)) e.stopImmediatePropagation()
    }
    document.addEventListener("focusin", onFocusIn, true)
    document.addEventListener("focusout", onFocusOut, true)
    return () => {
      document.removeEventListener("focusin", onFocusIn, true)
      document.removeEventListener("focusout", onFocusOut, true)
    }
  }, [active])

  useGlobalHotkey({ key: "y", meta: true, shift: true }, () => toggleActive())

  useGlobalHotkey({ key: "k", meta: true, shift: true }, () => {
    if (!useReviewStore.getState().active) return
    cycleMode()
  })

  React.useEffect(() => {
    if (!active) return
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return
      const state = useReviewStore.getState()
      if (state.pendingAnchor) {
        cancelPending()
        return
      }
      if (state.mode !== "cursor") {
        setMode("cursor")
        return
      }
      if (state.threadCommentId) {
        closeThread()
        return
      }
      if (sheetOpen) {
        setSheetOpen(false)
        return
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [active, cancelPending, setMode, setSheetOpen, closeThread, sheetOpen])

  return (
    <React.Suspense fallback={null}>
      <ReviewCanvas />
      <ReviewMagicCursor />
      <ReviewCommentPopover />
      <ReviewThreadPopover />
      <ReviewToolbar />
      <ReviewCommentSheet />
      <ReviewIdentityModal />
      <ReviewExportModal />
    </React.Suspense>
  )
}
