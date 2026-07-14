"use client"

import * as React from "react"
import { usePathname } from "next/navigation"
import { Icon } from "@/components/ui/Icon"
import { useGlobalHotkey } from "@/lib/hooks/useGlobalHotkey"
import { useReviewStore } from "@/lib/auis-review/store"
import { useEditStore } from "@/lib/auis-edit/store"
import { OverlayApplier } from "@/lib/auis-edit/applier"
import {
  captureEditAnchor,
  findEditableTextLeaf,
  resolveEditElement,
} from "@/lib/auis-edit/anchor"
import {
  buildVariantPayload,
  detectComponent,
  type VariantAxis,
} from "@/lib/auis-edit/variant-registry"
import { buildIconVariation } from "@/lib/auis-edit/icon-style"
import {
  buildOrder,
  computeDrop,
  currentOrder,
  matchOrder,
  reorderDom,
  type Drop,
} from "@/lib/auis-edit/reorder"
import {
  elementBelowOverlayAt,
  useCumulativeScrollOffset,
  useLayoutVersion,
} from "@/lib/auis-review/scrollOffset"
import type { PageEditAnchor, PageEditOp } from "@/lib/auis-edit/types"
import { EDIT_OVERLAY_DATA_ATTR, EDIT_Z } from "./constants"
import { EditToolbar } from "./EditToolbar"
import { EditInspector } from "./EditInspector"
import { EditInbox } from "./EditInbox"

type Editing = {
  el: Element
  anchor: PageEditAnchor
  prevText: string
  cleanup: () => void
}

/**
 * Live Edit Mode. ALWAYS mounted: the apply half (OverlayApplier) re-applies
 * this route's saved ops on every load so edits survive reload during normal
 * viewing. The authoring half (selection, inspector, inline text) only turns on
 * when `active` — toggled from the Auis dot or Cmd+Shift+E. Mutually
 * exclusive with Review Mode.
 */
export function EditModeProvider() {
  const [applier] = React.useState(() => new OverlayApplier())
  const pathname = usePathname()
  const layoutVersion = useLayoutVersion()
  const scroll = useCumulativeScrollOffset()

  const active = useEditStore((s) => s.active)
  const ops = useEditStore((s) => s.ops)
  const selectedAnchor = useEditStore((s) => s.selectedAnchor)

  const [inboxOpen, setInboxOpen] = React.useState(false)
  const [hoverRect, setHoverRect] = React.useState<DOMRect | null>(null)
  const [selectedRect, setSelectedRect] = React.useState<DOMRect | null>(null)
  const [editingActive, setEditingActive] = React.useState(false)

  // Drag-to-reorder (sibling reorder only).
  const [dragging, setDragging] = React.useState(false)
  const [dropRect, setDropRect] = React.useState<Drop["rect"] | null>(null)
  const dragRef = React.useRef<{
    moved: HTMLElement
    parent: Element
    parentAnchor: PageEditAnchor
    baseline: string[]
    lastIndex: number
  } | null>(null)

  const editingRef = React.useRef<Editing | null>(null)
  const commitRef = React.useRef<() => void>(() => {})
  const cancelRef = React.useRef<() => void>(() => {})

  // ── Persistence wiring (runs regardless of `active`) ───────────────────────
  React.useEffect(() => {
    void useEditStore.getState().setRoute(pathname)
  }, [pathname])

  React.useEffect(() => {
    applier.setOps(ops)
    // Elements may not be in the DOM on the first pass — re-apply as they land.
    const raf = requestAnimationFrame(() => applier.reapplyAll())
    const t = setTimeout(() => applier.reapplyAll(), 250)
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(t)
    }
  }, [ops, applier])

  React.useEffect(() => {
    applier.reapplyAll()
  }, [layoutVersion, scroll, applier])

  React.useEffect(() => () => applier.destroy(), [applier])

  // ── Mutual exclusion with Review Mode ──────────────────────────────────────
  React.useEffect(() => {
    return useReviewStore.subscribe((s) => {
      if (s.active && useEditStore.getState().active) {
        useEditStore.getState().setActive(false)
      }
    })
  }, [])

  useGlobalHotkey({ key: "e", meta: true, shift: true }, () =>
    useEditStore.getState().toggleActive(),
  )

  // ── Inline text editing (contentEditable on a text leaf) ───────────────────
  const beginTextEdit = React.useCallback(
    (leaf: Element) => {
      const anchor = captureEditAnchor(leaf)
      if (!anchor) return
      const prevText = leaf.textContent ?? ""
      // Pause re-apply on this element so the observer doesn't rewrite the old
      // value while the user types.
      applier.suspend(anchor.selector)
      const host = leaf as HTMLElement
      host.setAttribute("contenteditable", "true")
      host.style.outline = "2px solid var(--accent-brand)"
      host.style.outlineOffset = "2px"
      const onKeyDown = (ev: KeyboardEvent) => {
        if (ev.key === "Enter" && !ev.shiftKey) {
          ev.preventDefault()
          commitRef.current()
        } else if (ev.key === "Escape") {
          ev.preventDefault()
          ev.stopPropagation()
          cancelRef.current()
        }
      }
      const onBlur = () => commitRef.current()
      leaf.addEventListener("keydown", onKeyDown as EventListener)
      leaf.addEventListener("blur", onBlur)
      editingRef.current = {
        el: leaf,
        anchor,
        prevText,
        cleanup: () => {
          leaf.removeEventListener("keydown", onKeyDown as EventListener)
          leaf.removeEventListener("blur", onBlur)
        },
      }
      useEditStore.getState().selectElement(anchor)
      setEditingActive(true)
      host.focus()
      const range = document.createRange()
      range.selectNodeContents(leaf)
      const sel = window.getSelection()
      sel?.removeAllRanges()
      sel?.addRange(range)
    },
    [applier],
  )

  const commitTextEdit = React.useCallback(() => {
    const editing = editingRef.current
    if (!editing) return
    editing.cleanup()
    const { el, anchor, prevText } = editing
    const host = el as HTMLElement
    host.removeAttribute("contenteditable")
    host.style.outline = ""
    host.style.outlineOffset = ""
    editingRef.current = null
    setEditingActive(false)
    const newText = (el.textContent ?? "").replace(/\u00a0/g, " ").trim()
    const prev = prevText.trim()
    if (newText && newText !== prev) {
      // Persist FIRST (element stays suspended, showing the typed text), then
      // resume — so the applier re-applies the NEW op, never a stale one over
      // what was just typed.
      void useEditStore
        .getState()
        .saveText(anchor, newText, prev)
        .finally(() => applier.resume(anchor.selector))
    } else {
      // No real change — undo any stray whitespace, then resume.
      if ((el.textContent ?? "") !== prevText) el.textContent = prevText
      applier.resume(anchor.selector)
    }
  }, [applier])

  const cancelTextEdit = React.useCallback(() => {
    const editing = editingRef.current
    if (!editing) return
    editing.cleanup()
    const { el, anchor, prevText } = editing
    const host = el as HTMLElement
    host.removeAttribute("contenteditable")
    host.style.outline = ""
    host.style.outlineOffset = ""
    el.textContent = prevText
    editingRef.current = null
    setEditingActive(false)
    applier.resume(anchor.selector)
  }, [applier])

  React.useEffect(() => {
    commitRef.current = commitTextEdit
    cancelRef.current = cancelTextEdit
  }, [commitTextEdit, cancelTextEdit])

  React.useEffect(() => {
    if (!active && editingRef.current) cancelTextEdit()
  }, [active, cancelTextEdit])

  // ── Selection + hover capture (active only) ────────────────────────────────
  React.useEffect(() => {
    if (!active) return
    const isOurs = (n: Element) => !!n.closest(`[${EDIT_OVERLAY_DATA_ATTR}]`)

    const onClick = (e: MouseEvent) => {
      const target = e.target
      if (!(target instanceof Element) || isOurs(target)) return
      if (editingRef.current) {
        if (!editingRef.current.el.contains(target)) {
          e.preventDefault()
          e.stopPropagation()
          commitTextEdit()
        }
        return
      }
      e.preventDefault()
      e.stopPropagation()
      const el = elementBelowOverlayAt(e.clientX, e.clientY)
      if (!el) return
      const anchor = captureEditAnchor(el)
      if (anchor) useEditStore.getState().selectElement(anchor)
    }

    const onDbl = (e: MouseEvent) => {
      const target = e.target
      if (!(target instanceof Element) || isOurs(target)) return
      e.preventDefault()
      e.stopPropagation()
      const el = elementBelowOverlayAt(e.clientX, e.clientY)
      if (!el) return
      const leaf = findEditableTextLeaf(el)
      if (leaf) beginTextEdit(leaf)
    }

    document.addEventListener("click", onClick, true)
    document.addEventListener("dblclick", onDbl, true)
    return () => {
      document.removeEventListener("click", onClick, true)
      document.removeEventListener("dblclick", onDbl, true)
    }
  }, [active, beginTextEdit, commitTextEdit])

  React.useEffect(() => {
    if (!active) {
      setHoverRect(null)
      return
    }
    let raf: number | null = null
    const onMove = (e: MouseEvent) => {
      if (editingRef.current) {
        setHoverRect(null)
        return
      }
      if (raf !== null) return
      raf = requestAnimationFrame(() => {
        raf = null
        const el = elementBelowOverlayAt(e.clientX, e.clientY)
        if (!el || el.closest(`[${EDIT_OVERLAY_DATA_ATTR}]`)) {
          setHoverRect(null)
          return
        }
        setHoverRect(el.getBoundingClientRect())
      })
    }
    document.addEventListener("mousemove", onMove)
    return () => {
      document.removeEventListener("mousemove", onMove)
      if (raf !== null) cancelAnimationFrame(raf)
    }
  }, [active])

  // Track the selected element's rect across scroll/resize/reflow.
  React.useEffect(() => {
    if (!active || !selectedAnchor) {
      setSelectedRect(null)
      return
    }
    const update = () => {
      const el = resolveEditElement(selectedAnchor)
      setSelectedRect(el ? el.getBoundingClientRect() : null)
    }
    update()
    let raf: number | null = null
    const onScroll = () => {
      if (raf === null)
        raf = requestAnimationFrame(() => {
          raf = null
          update()
        })
    }
    document.addEventListener("scroll", onScroll, { capture: true, passive: true })
    window.addEventListener("resize", onScroll)
    return () => {
      document.removeEventListener("scroll", onScroll, true)
      window.removeEventListener("resize", onScroll)
      if (raf !== null) cancelAnimationFrame(raf)
    }
  }, [active, selectedAnchor, layoutVersion])

  // ── Radix focus-trap interceptor (so typing inside our chrome works) ───────
  React.useEffect(() => {
    if (!active || typeof document === "undefined") return
    const within = (n: EventTarget | null) =>
      n instanceof Element && !!n.closest(`[${EDIT_OVERLAY_DATA_ATTR}]`)
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

  // Escape: drop selection, then exit (inline-edit Escape is handled at the leaf).
  React.useEffect(() => {
    if (!active) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || editingRef.current) return
      const st = useEditStore.getState()
      if (st.selectedAnchor) st.closeInspector()
      else st.setActive(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [active])

  // ── Inspector / inbox callbacks ────────────────────────────────────────────
  const onRequestText = React.useCallback(
    (anchor: PageEditAnchor) => {
      const el = resolveEditElement(anchor)
      if (!el) return
      const leaf = findEditableTextLeaf(el)
      if (leaf) beginTextEdit(leaf)
    },
    [beginTextEdit],
  )

  const onPickStyle = React.useCallback(
    (anchor: PageEditAnchor, prop: string, cssValue: string) => {
      const el = resolveEditElement(anchor)
      if (el) (el as HTMLElement).style.setProperty(prop, cssValue) // instant feedback
      // Off-spec: styling a component ROOT directly diverges from its variants —
      // flag it so the inbox and the materialization skill see the divergence.
      const comp = el ? detectComponent(el) : null
      const offSpec = !!(comp && comp.rootEl === el)
      void useEditStore
        .getState()
        .saveStyle(
          anchor,
          prop,
          cssValue,
          offSpec
            ? { offSpec: true, offSpecComponent: comp!.spec.label }
            : undefined,
        )
    },
    [],
  )

  const onClearStyle = React.useCallback(
    (anchor: PageEditAnchor, prop: string) => {
      const match = useEditStore
        .getState()
        .ops.find(
          (o) =>
            o.status === "open" &&
            o.payload.kind === "style" &&
            o.anchor.selector === anchor.selector &&
            o.payload.prop === prop,
        )
      const el = resolveEditElement(anchor)
      if (el) (el as HTMLElement).style.removeProperty(prop)
      if (match) void useEditStore.getState().removeOp(match.id)
    },
    [],
  )

  const onHide = React.useCallback(
    (anchor: PageEditAnchor, mode: "hide" | "remove") => {
      const el = resolveEditElement(anchor)
      if (el) (el as HTMLElement).style.setProperty("display", "none", "important")
      void useEditStore.getState().saveHide(anchor, mode)
      useEditStore.getState().closeInspector()
    },
    [],
  )

  const onPickVariant = React.useCallback(
    (rootAnchor: PageEditAnchor, axis: VariantAxis, value: string) => {
      const payload = buildVariantPayload(axis, value)
      const el = resolveEditElement(rootAnchor)
      if (el) {
        const cl = (el as HTMLElement).classList
        for (const c of payload.remove) cl.remove(c)
        if (payload.add) cl.add(payload.add)
      }
      void useEditStore.getState().saveVariant(rootAnchor, payload)
    },
    [],
  )

  const onPickClass = React.useCallback(
    (
      anchor: PageEditAnchor,
      payload: { group: string; label?: string; remove: string[]; add: string },
    ) => {
      const el = resolveEditElement(anchor)
      if (el) {
        const cl = (el as HTMLElement).classList
        for (const c of payload.remove) if (c !== payload.add) cl.remove(c)
        if (payload.add) cl.add(payload.add)
      }
      void useEditStore.getState().saveClass(anchor, payload)
    },
    [],
  )

  const onPickIcon = React.useCallback(
    (anchor: PageEditAnchor, name: string, prevName?: string) => {
      const el = resolveEditElement(anchor)
      if (el) el.textContent = name // instant feedback (ligature)
      void useEditStore.getState().saveIcon(anchor, name, prevName)
    },
    [],
  )

  const onPickIconStyle = React.useCallback(
    (
      anchor: PageEditAnchor,
      variation: { fill: number; weight: number; grade: number; opticalSize: number },
    ) => {
      const el = resolveEditElement(anchor)
      if (el) {
        (el as HTMLElement).style.setProperty(
          "font-variation-settings",
          buildIconVariation(variation),
        ) // instant feedback
      }
      void useEditStore.getState().saveIconStyle(anchor, variation)
    },
    [],
  )

  const onPickStyleCustom = React.useCallback(
    (anchor: PageEditAnchor, prop: string, value: string) => {
      const el = resolveEditElement(anchor)
      if (el) {
        (el as HTMLElement).style.setProperty(prop, value) // instant feedback
      }
      void useEditStore.getState().saveStyle(anchor, prop, value, { custom: true })
    },
    [],
  )

  const onPickToken = React.useCallback((token: string, value: string) => {
    // Instant global preview: overrides the token on :root (every instance
    // changes). On ship, materialization rewrites it in globals.css.
    document.documentElement.style.setProperty(token, value)
    void useEditStore.getState().saveToken(token, value)
  }, [])

  const onFocusOp = React.useCallback((op: PageEditOp) => {
    const el = resolveEditElement(op.anchor)
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" })
      useEditStore.getState().selectElement(op.anchor)
    }
  }, [])

  // ── Drag-to-reorder ────────────────────────────────────────────────────────
  // Grab the selected element's grip and drag it among its siblings. Captured
  // as ONE move op per parent that stores the desired child order by stable key
  // (see lib/auis-edit/reorder) — robust to the positional anchor.
  const beginDrag = React.useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const sel = useEditStore.getState().selectedAnchor
    if (!sel) return
    const moved = resolveEditElement(sel) as HTMLElement | null
    const parent = moved?.parentElement ?? null
    if (!moved || !parent) return
    const parentAnchor = captureEditAnchor(parent)
    if (!parentAnchor) return

    const priorOpacity = moved.style.opacity
    moved.style.opacity = "0.45" // ghost the block being dragged
    dragRef.current = {
      moved,
      parent,
      parentAnchor,
      baseline: currentOrder(parent),
      lastIndex: -1,
    }
    setDragging(true)

    const onMove = (ev: PointerEvent) => {
      const d = dragRef.current
      if (!d) return
      const drop = computeDrop(d.parent, ev.clientX, ev.clientY)
      if (!drop) {
        setDropRect(null)
        return
      }
      d.lastIndex = drop.index
      setDropRect(drop.rect)
    }
    const onUp = () => {
      document.removeEventListener("pointermove", onMove)
      const d = dragRef.current
      dragRef.current = null
      setDragging(false)
      setDropRect(null)
      moved.style.opacity = priorOpacity
      if (!d || d.lastIndex < 0) return
      const order = buildOrder(d.parent, d.moved, d.lastIndex)
      // No real change → don't persist a no-op move.
      const unchanged =
        order.length === d.baseline.length &&
        order.every((k, i) => k === d.baseline[i])
      if (unchanged) return
      // Optimistic reorder so it feels instant; the applier re-asserts on refresh.
      reorderDom(d.parent, matchOrder(d.parent, order))
      void useEditStore.getState().saveMove(d.parentAnchor, order)
    }
    document.addEventListener("pointermove", onMove)
    document.addEventListener("pointerup", onUp, { once: true })
  }, [])

  if (!active) return null

  return (
    <>
      {hoverRect && !editingActive && !dragging && (
        <Outline rect={hoverRect} color="var(--border-strong)" z={EDIT_Z.hover} dashed />
      )}
      {selectedRect && (
        <Outline rect={selectedRect} color="var(--accent-brand)" z={EDIT_Z.outline} />
      )}
      {selectedRect && !editingActive && (
        <DragGrip rect={selectedRect} dragging={dragging} onStart={beginDrag} />
      )}
      {dragging && dropRect && <DropLine rect={dropRect} />}

      <EditToolbar
        openCount={ops.filter((o) => o.status === "open").length}
        inReviewCount={ops.filter((o) => o.status === "in_review").length}
        inboxOpen={inboxOpen}
        onToggleInbox={() => setInboxOpen((v) => !v)}
        onExit={() => useEditStore.getState().setActive(false)}
      />

      {selectedAnchor && (
        <EditInspector
          anchor={selectedAnchor}
          ops={ops}
          onRequestText={onRequestText}
          onPickStyle={onPickStyle}
          onClearStyle={onClearStyle}
          onHide={onHide}
          onPickVariant={onPickVariant}
          onPickIcon={onPickIcon}
          onPickIconStyle={onPickIconStyle}
          onPickToken={onPickToken}
          onPickCustom={onPickStyleCustom}
          onPickClass={onPickClass}
          onOpenInbox={() => setInboxOpen(true)}
          onClose={() => useEditStore.getState().closeInspector()}
        />
      )}

      {inboxOpen && (
        <EditInbox
          ops={ops}
          onFocus={onFocusOp}
          onApprove={(id) => void useEditStore.getState().transition(id, "apply")}
          onReject={(id) => void useEditStore.getState().transition(id, "reject")}
          onRemove={(id) => void useEditStore.getState().removeOp(id)}
          onClose={() => setInboxOpen(false)}
        />
      )}
    </>
  )
}

function Outline({
  rect,
  color,
  z,
  dashed,
}: {
  rect: DOMRect
  color: string
  z: number
  dashed?: boolean
}) {
  return (
    <div
      aria-hidden
      {...{ [EDIT_OVERLAY_DATA_ATTR]: "outline" }}
      style={{
        position: "fixed",
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
        border: `2px ${dashed ? "dashed" : "solid"} ${color}`,
        borderRadius: 4,
        pointerEvents: "none",
        zIndex: z,
        boxSizing: "border-box",
      }}
    />
  )
}

/** Grab handle on the selected element's corner — pointer-drag to reorder it
 *  among its siblings. Marked as our chrome so the click/hover capture ignores it. */
function DragGrip({
  rect,
  dragging,
  onStart,
}: {
  rect: DOMRect
  dragging: boolean
  onStart: (e: React.PointerEvent) => void
}) {
  return (
    <button
      type="button"
      aria-label="Drag to reorder"
      title="Drag to reorder"
      {...{ [EDIT_OVERLAY_DATA_ATTR]: "grip" }}
      onPointerDown={onStart}
      className="flex h-6 w-6 items-center justify-center rounded-full border border-(--border-subtle) bg-(--bg-raised) text-(--fg-secondary) shadow-(--shadow-sm) hover:text-(--fg-primary)"
      style={{
        position: "fixed",
        left: rect.left - 12,
        top: rect.top - 12,
        zIndex: EDIT_Z.toolbar,
        touchAction: "none",
        cursor: dragging ? "grabbing" : "grab",
      }}
    >
      <Icon name="drag_indicator" size={14} />
    </button>
  )
}

/** Insertion indicator drawn between siblings while dragging. */
function DropLine({ rect }: { rect: Drop["rect"] }) {
  return (
    <div
      aria-hidden
      {...{ [EDIT_OVERLAY_DATA_ATTR]: "dropline" }}
      style={{
        position: "fixed",
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
        background: "var(--accent-brand)",
        borderRadius: 9999,
        boxShadow: "0 0 0 1px var(--bg-raised)",
        pointerEvents: "none",
        zIndex: EDIT_Z.toolbar - 1,
      }}
    />
  )
}
