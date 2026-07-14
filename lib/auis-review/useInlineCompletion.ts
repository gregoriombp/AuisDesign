"use client"

import * as React from "react"
import type { ReviewElementContext } from "@/lib/auis-review/elementContext"
import { fetchCompletion } from "@/lib/auis-review/commentAssist"

const MIN_CHARS = 6
const DEBOUNCE_MS = 450

/**
 * Cursor-style inline autocomplete: while the reviewer types, it fetches a short
 * continuation and exposes it as `ghost` (ghost text the card draws ahead of the
 * caret; Tab accepts it). Debounced, cancels in-flight requests, and switches
 * itself off when the OpenAI key isn't configured (503).
 *
 * `element` must have a stable identity (memoize it in the caller).
 */
export function useInlineCompletion(
  draft: string,
  element: ReviewElementContext | null,
  enabled: boolean
) {
  const [ghost, setGhost] = React.useState("")
  const disabledRef = React.useRef(false) // 503 → stop trying for this session
  const abortRef = React.useRef<AbortController | null>(null)

  const clear = React.useCallback(() => setGhost(""), [])

  React.useEffect(() => {
    if (!enabled || disabledRef.current) {
      setGhost("")
      return
    }
    if (draft.trim().length < MIN_CHARS) {
      setGhost("")
      return
    }
    // The text changed → the current ghost is stale.
    setGhost("")
    const timer = setTimeout(async () => {
      abortRef.current?.abort()
      const ctrl = new AbortController()
      abortRef.current = ctrl
      const r = await fetchCompletion({ draft, element, signal: ctrl.signal })
      if (r.status === 503) {
        disabledRef.current = true
        return
      }
      if (!r.ok || !r.text) return
      let g = r.text
      // Natural spacing when it lands right after the typed text.
      if (draft && !/\s$/.test(draft) && !/^[\s.,;:!?)\]]/.test(g)) {
        g = " " + g
      }
      setGhost(g)
    }, DEBOUNCE_MS)

    return () => clearTimeout(timer)
  }, [draft, element, enabled])

  return { ghost, clear }
}
