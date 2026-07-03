"use client"

// Inline "@ / / / #" autocomplete for the Review Bridge composers. Detects a
// trigger token immediately before the caret in a <textarea>, surfaces the
// matching agents / skills / directives, and inserts the canonical token on
// pick. Presentation is the shared AuMentionMenu (see ReviewCommandMenu);
// keyboard UX mirrors the Agent Studio editor (↑↓ cycle, Enter/Tab select,
// Esc close).
//
// Reads value + caret straight from the DOM element (not React state) so it
// never lags a keystroke. The composer keeps owning the text; this hook only
// proposes insertions.

import * as React from "react"
import type { AuMentionMenuSection } from "@/components/ui/AuMentionMenu"
import { REVIEW_AGENTS } from "./agents"
import { REVIEW_SKILLS } from "./skills"
import { getCaretCoordinates } from "./textareaCaret"

type Sigil = "@" | "/" | "#"

interface TriggerState {
  sigil: Sigil
  query: string
  /** Index of the sigil character in the textarea value. */
  start: number
  /** Caret index (end of the partial token). */
  caret: number
}

interface ResolvedItem {
  key: string
  /** Canonical text inserted on pick (without the trailing space). */
  token: string
}

export interface ReviewCommandAnchor {
  left: number
  /** Top of the caret line, in viewport coords. */
  top: number
  /** Bottom of the caret line, in viewport coords. */
  bottom: number
}

export interface ReviewCommandAutocomplete {
  open: boolean
  sections: AuMentionMenuSection[]
  activeKey: string | undefined
  anchor: ReviewCommandAnchor | null
  ariaLabel: string
  /** Intercepts ↑/↓/Enter/Tab/Esc while open. Returns true when it handled the key. */
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => boolean
  /** Re-read the textarea (value + caret) and recompute. Call on input/select/click/keyup. */
  sync: () => void
  /** Force-close (e.g. on blur). */
  close: () => void
  /** Hover a row → make it active. */
  setActiveByKey: (key: string) => void
  /** Click / Enter a row → insert it. */
  pickByKey: (key: string) => void
}

// A sigil at start-or-after-whitespace, then word chars up to the caret. The
// leading boundary keeps emails (joao@x) and paths (a/b) from triggering.
const TRIGGER_RE = /(^|\s)([@/#])([\w-]*)$/

export function useReviewCommandAutocomplete({
  textareaRef,
  value,
  setValue,
  enabled = true,
}: {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>
  /** The composer's current text — used to re-sync on any external change
   *  (reset, voice, rewrite, pick) and to auto-close when it empties. */
  value: string
  setValue: (next: string) => void
  enabled?: boolean
}): ReviewCommandAutocomplete {
  const [trigger, setTrigger] = React.useState<TriggerState | null>(null)
  const [activeIndex, setActiveIndex] = React.useState(0)
  const [anchor, setAnchor] = React.useState<ReviewCommandAnchor | null>(null)
  // Set right before a pick rewrites the value. On a controlled <textarea>,
  // React RESTORES the previous (now stale) caret across the re-render, so the
  // value-effect would re-sync with new text + old caret, re-match the token we
  // just inserted, and reopen the menu. This flag makes that one re-sync a noop.
  const justPickedRef = React.useRef(false)

  const sync = React.useCallback(() => {
    const ta = textareaRef.current
    if (!ta || !enabled) {
      setTrigger(null)
      return
    }
    const caret = ta.selectionStart ?? 0
    // Only a collapsed caret (no selection range) opens the menu.
    if (ta.selectionEnd !== caret) {
      setTrigger(null)
      return
    }
    const m = TRIGGER_RE.exec(ta.value.slice(0, caret))
    if (!m) {
      setTrigger(null)
      return
    }
    const sigil = m[2] as Sigil
    const query = m[3]
    const start = caret - (1 + query.length) // 1 = sigil length
    setTrigger({ sigil, query, start, caret })

    const coords = getCaretCoordinates(ta, start)
    const rect = ta.getBoundingClientRect()
    setAnchor({
      left: rect.left + coords.left,
      top: rect.top + coords.top,
      bottom: rect.top + coords.top + coords.height,
    })
  }, [textareaRef, enabled])

  // Re-sync after any text change — typing, but also external rewrites (reset,
  // voice, magic wand). Reading the DOM post-render gives the correct caret; an
  // emptied/space-terminated value naturally closes the menu. The one exception
  // is our own pick: skip that re-sync (the caret is still stale until rAF).
  React.useEffect(() => {
    if (justPickedRef.current) {
      justPickedRef.current = false
      return
    }
    sync()
  }, [value, sync])

  const { items, sections, ariaLabel } = React.useMemo<{
    items: ResolvedItem[]
    sections: AuMentionMenuSection[]
    ariaLabel: string
  }>(() => {
    if (!trigger) return { items: [], sections: [], ariaLabel: "" }
    const q = trigger.query.toLowerCase()

    if (trigger.sigil === "@") {
      const agents = REVIEW_AGENTS.filter(
        (a) =>
          a.handle.toLowerCase().startsWith(q) ||
          a.name.toLowerCase().includes(q),
      )
      return {
        items: agents.map((a) => ({ key: a.id, token: `@${a.handle}` })),
        sections: [
          {
            label: "Agentes",
            entries: agents.map((a) => ({
              key: a.id,
              label: a.name,
              icon: a.icon,
            })),
          },
        ],
        ariaLabel: "Sugestões de agentes",
      }
    }

    if (trigger.sigil === "/") {
      const skills = REVIEW_SKILLS.filter(
        (s) =>
          s.slug.toLowerCase().includes(q) ||
          s.label.toLowerCase().includes(q),
      )
      return {
        items: skills.map((s) => ({ key: s.slug, token: `/${s.slug}` })),
        sections: [
          {
            label: "Skills",
            entries: skills.map((s) => ({
              key: s.slug,
              label: s.label,
              icon: s.icon,
            })),
          },
        ],
        ariaLabel: "Sugestões de skills",
      }
    }

    // "#": only the action directive.
    const showNow = "now".startsWith(q)
    return {
      items: showNow ? [{ key: "now", token: "#now" }] : [],
      sections: showNow
        ? [
            {
              label: "Ação",
              entries: [
                {
                  key: "now",
                  label: "now — libera a execução",
                  icon: "bolt",
                  accent: "purple" as const,
                },
              ],
            },
          ]
        : [],
      ariaLabel: "Ação do comentário",
    }
  }, [trigger])

  // Reset the active row whenever the typed token changes.
  const tokenSig = trigger ? `${trigger.sigil}${trigger.query}` : ""
  React.useEffect(() => {
    setActiveIndex(0)
  }, [tokenSig])

  const open = trigger !== null && items.length > 0 && anchor !== null
  const clamped = items.length
    ? ((activeIndex % items.length) + items.length) % items.length
    : 0
  const activeKey = items[clamped]?.key

  const close = React.useCallback(() => setTrigger(null), [])

  const pickByKey = React.useCallback(
    (key: string) => {
      const ta = textareaRef.current
      const item = items.find((it) => it.key === key)
      if (!ta || !trigger || !item) return
      const before = ta.value.slice(0, trigger.start)
      const after = ta.value.slice(trigger.caret)
      const insert = `${item.token} `
      const caretPos = before.length + insert.length
      justPickedRef.current = true
      setValue(`${before}${insert}${after}`)
      setTrigger(null)
      requestAnimationFrame(() => {
        const el = textareaRef.current
        if (!el) return
        el.focus()
        el.setSelectionRange(caretPos, caretPos)
      })
    },
    [items, trigger, textareaRef, setValue],
  )

  const onKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (!open) return false
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault()
          setActiveIndex((i) => i + 1)
          return true
        case "ArrowUp":
          e.preventDefault()
          setActiveIndex((i) => i - 1)
          return true
        case "Enter":
        case "Tab":
          e.preventDefault()
          if (activeKey) pickByKey(activeKey)
          return true
        case "Escape":
          e.preventDefault()
          setTrigger(null)
          return true
        default:
          return false
      }
    },
    [open, activeKey, pickByKey],
  )

  const setActiveByKey = React.useCallback(
    (key: string) => {
      const i = items.findIndex((it) => it.key === key)
      if (i >= 0) setActiveIndex(i)
    },
    [items],
  )

  return {
    open,
    sections,
    activeKey,
    anchor,
    ariaLabel,
    onKeyDown,
    sync,
    close,
    setActiveByKey,
    pickByKey,
  }
}
