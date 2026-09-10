"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useStatesStore } from "@/lib/auis-states/store"
import { useReviewStore } from "@/lib/auis-review/store"
import { useEditStore } from "@/lib/auis-edit/store"
import { useGlobalHotkey } from "@/lib/hooks/useGlobalHotkey"
import { matchScreenStates } from "@/lib/auis-states/registry"
import { StatesToolbar } from "./StatesToolbar"

/**
 * State Mode. Always mounted: self-gated on `active` of useStatesStore, toggled
 * by the dot or ⌘⇧S. Turns on a floating switcher that flips the registered
 * scenarios of the current screen (lib/auis-states/registry.ts) by writing
 * query params — the URL is the only source of truth. Mutually exclusive with
 * Review and Edit.
 */
export function StatesModeProvider() {
  const active = useStatesStore((s) => s.active)
  const exitRequested = useStatesStore((s) => s.exitRequested)
  const router = useRouter()

  // Mutual exclusion (reverse direction): Review or Edit turning on turns this
  // mode off — SILENTLY, without clearing the URL: pinning a scenario and
  // switching to Review to comment on it is a supported workflow.
  React.useEffect(() => {
    const offReview = useReviewStore.subscribe((s) => {
      if (s.active && useStatesStore.getState().active) {
        useStatesStore.getState().setActive(false)
      }
    })
    const offEdit = useEditStore.subscribe((s) => {
      if (s.active && useStatesStore.getState().active) {
        useStatesStore.getState().setActive(false)
      }
    })
    return () => {
      offReview()
      offEdit()
    }
  }, [])

  useGlobalHotkey({ key: "s", meta: true, shift: true }, () =>
    useStatesStore.getState().toggleActive(),
  )

  // EXPLICIT exit (X, ⌘⇧S, dot, Escape): clears the state params of the
  // current route — the screen goes back to its real default — and turns off.
  // window.location is read inside the effect (client-only), so the provider
  // itself needs no useSearchParams (which would require Suspense around it).
  React.useEffect(() => {
    if (!exitRequested) return
    const entry = matchScreenStates(window.location.pathname)
    if (entry) {
      const params = new URLSearchParams(window.location.search)
      let touched = false
      for (const axis of entry.axes) {
        if (params.has(axis.param)) {
          params.delete(axis.param)
          touched = true
        }
      }
      if (touched) {
        const qs = params.toString()
        router.replace(
          qs ? `${window.location.pathname}?${qs}` : window.location.pathname,
          { scroll: false },
        )
      }
    }
    useStatesStore.getState().setActive(false)
  }, [exitRequested, router])

  if (!active) return null

  return (
    <React.Suspense fallback={null}>
      <StatesToolbar />
    </React.Suspense>
  )
}
