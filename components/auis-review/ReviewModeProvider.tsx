"use client"

import * as React from "react"
import { usePathname } from "next/navigation"
import { useGlobalHotkey } from "@/lib/hooks/useGlobalHotkey"
import { useReviewStore } from "@/lib/auis-review/store"
import { findPrimaryScrollContainer } from "@/lib/auis-review/scrollOffset"
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
  const refreshFromStorage = useReviewStore((s) => s.refreshFromStorage)
  const storage = useReviewStore((s) => s.storage)

  const active = useReviewStore((s) => s.active)
  const toggleActive = useReviewStore((s) => s.toggleActive)
  const cycleMode = useReviewStore((s) => s.cycleMode)
  const setMode = useReviewStore((s) => s.setMode)
  const cancelPending = useReviewStore((s) => s.cancelPending)
  const setSheetOpen = useReviewStore((s) => s.setSheetOpen)
  const closeThread = useReviewStore((s) => s.closeThread)
  const setActive = useReviewStore((s) => s.setActive)
  const selectComment = useReviewStore((s) => s.selectComment)
  const comments = useReviewStore((s) => s.comments)
  const sheetOpen = useReviewStore((s) => s.sheetOpen)
  const permalinkHandledRef = React.useRef<string | null>(null)
  const pathname = usePathname()

  // Cada nova tela pode ter seu próprio ?reviewCommentId — libera o permalink
  // pra ser reprocessado quando o pathname muda (navegação client-side).
  React.useEffect(() => {
    permalinkHandledRef.current = null
  }, [pathname])

  React.useEffect(() => {
    void hydrateIdentity()
    void refreshFromStorage()
    const unsubscribe = storage.subscribe?.(() => {
      void refreshFromStorage()
    })
    return unsubscribe
  }, [hydrateIdentity, refreshFromStorage, storage])

  // Permalink: open the review overlay and focus the pin when ?reviewCommentId=… is present.
  React.useEffect(() => {
    if (typeof window === "undefined") return
    const params = new URLSearchParams(window.location.search)
    const id = params.get("reviewCommentId")
    if (!id) return
    if (permalinkHandledRef.current === id) return
    if (comments.length === 0) return
    const match = comments.find((c) => c.id === id)
    if (!match) return
    permalinkHandledRef.current = id
    setActive(true)
    setSheetOpen(true)
    selectComment(id)
    const anchorY =
      match.anchor.kind === "pin"
        ? match.anchor.position.y
        : match.anchor.centroid.y
    const targetY = Math.max(0, anchorY - 120)
    const scroll = () => {
      const container = findPrimaryScrollContainer()
      if (container) {
        container.scrollTo({ top: targetY, behavior: "smooth" })
      } else {
        window.scrollTo({ top: targetY, behavior: "smooth" })
      }
    }
    // Defer scroll until after the overlay mounts.
    requestAnimationFrame(scroll)
  }, [comments, pathname, setActive, setSheetOpen, selectComment])

  // A Radix Dialog (AuModal/AuSheet) com `modal` mantém um focus trap que puxa
  // o foco de volta pra dentro dele sempre que algo de fora ganha foco. Isso
  // impediria digitar no popover de comentário enquanto se revisa um modal.
  // Interceptamos focusin/focusout na FASE DE CAPTURA: quando o alvo (ou o
  // related) é uma superfície do review, paramos o evento antes que o handler
  // de bubble do Radix o veja — o foco em si não é afetado, só a "puxada".
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
