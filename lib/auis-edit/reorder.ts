// Helpers for sibling-reorder ("move") ops. A move op anchors to the PARENT
// container and stores the desired child sequence as stable fingerprint keys
// ("<tag>::<text>"), NOT positional indices — because the shared anchor uses
// nth-of-type selectors that shift the moment you reorder. Keys survive the
// reorder; positions don't.
//
// Pure DOM helpers (no React, no store) so both the applier and the drag UX in
// EditModeProvider can share them, and the materialization skill can mirror the
// same matching when it reorders JSX children.

// Mirror of EDIT_OVERLAY_DATA_ATTR (components/auis-edit/constants) —
// inlined to keep this lib module free of any components/* import.
const OVERLAY_ATTR = "data-auis-edit"

function fpText(el: Element): string {
  return (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 40)
}

/** Real, reorderable element children of a parent — skips our overlay chrome
 *  (outline grip, drop line) so it never lands in the saved order. */
export function reorderableChildren(parent: Element): Element[] {
  return Array.from(parent.children).filter(
    (c) => !c.hasAttribute(OVERLAY_ATTR),
  )
}

/** Stable-ish key for a child: tag + text, or tag + positional index when the
 *  child has no text to anchor on (identical empty siblings degrade to order). */
export function childKey(el: Element, index: number): string {
  const tag = el.tagName.toLowerCase()
  const text = fpText(el)
  return text ? `${tag}::${text}` : `${tag}::#${index}`
}

/** The identity order of the parent's children right now. */
export function currentOrder(parent: Element): string[] {
  return reorderableChildren(parent).map((c, i) => childKey(c, i))
}

/** Desired order keys after moving `moved` to `targetIndex` (index relative to
 *  the CURRENT children list, i.e. still counting `moved` at its old slot). */
export function buildOrder(
  parent: Element,
  moved: Element,
  targetIndex: number,
): string[] {
  const kids = reorderableChildren(parent)
  const from = kids.indexOf(moved)
  if (from === -1) return currentOrder(parent)
  const next = kids.slice()
  next.splice(from, 1)
  // Removing `moved` from before the target shifts everything after it left by 1.
  let insert = from < targetIndex ? targetIndex - 1 : targetIndex
  insert = Math.max(0, Math.min(insert, next.length))
  next.splice(insert, 0, moved)
  return next.map((c, i) => childKey(c, i))
}

/** Resolve a saved order to the live children, in the desired sequence. Greedy:
 *  each key consumes the first unused child whose key matches (then a tag-only
 *  fallback for drifted text); leftover children keep their order at the end. */
export function matchOrder(parent: Element, order: string[]): Element[] {
  const kids = reorderableChildren(parent)
  const used = new Set<number>()
  const out: Element[] = []
  const take = (pred: (el: Element, i: number) => boolean): number => {
    for (let i = 0; i < kids.length; i++) {
      if (!used.has(i) && pred(kids[i], i)) return i
    }
    return -1
  }
  for (const key of order) {
    const tag = key.split("::")[0]
    let idx = take((el, i) => childKey(el, i) === key)
    if (idx === -1) idx = take((el) => el.tagName.toLowerCase() === tag)
    if (idx !== -1) {
      used.add(idx)
      out.push(kids[idx])
    }
  }
  kids.forEach((c, i) => {
    if (!used.has(i)) out.push(c)
  })
  return out
}

/** Move the parent's children into `ordered` (appendChild relocates in place). */
export function reorderDom(parent: Element, ordered: Element[]): void {
  for (const el of ordered) parent.appendChild(el)
}

/** True when the parent's current child order already matches `ordered`. */
export function orderMatches(parent: Element, ordered: Element[]): boolean {
  const cur = reorderableChildren(parent)
  return (
    cur.length === ordered.length && ordered.every((el, i) => el === cur[i])
  )
}

export type Drop = {
  index: number
  rect: { left: number; top: number; width: number; height: number }
}

/** For a pointer at (x, y) over `parent`, the insertion index among its
 *  reorderable children plus a viewport rect for the drop-line indicator. Picks
 *  the dominant layout axis (row vs column) from the children's geometry. */
export function computeDrop(parent: Element, x: number, y: number): Drop | null {
  const kids = reorderableChildren(parent)
  if (kids.length === 0) return null
  const rects = kids.map((c) => c.getBoundingClientRect())
  const spread = (a: number[]) => Math.max(...a) - Math.min(...a)
  const cx = rects.map((r) => r.left + r.width / 2)
  const cy = rects.map((r) => r.top + r.height / 2)
  const horizontal = spread(cx) > spread(cy) // children flow left → right
  const pos = horizontal ? x : y
  let index = rects.length
  for (let i = 0; i < rects.length; i++) {
    const r = rects[i]
    const mid = horizontal ? r.left + r.width / 2 : r.top + r.height / 2
    if (pos < mid) {
      index = i
      break
    }
  }
  const append = index >= rects.length
  const ref = rects[Math.min(index, rects.length - 1)]
  const rect = horizontal
    ? { left: (append ? ref.right : ref.left) - 1, top: ref.top, width: 2, height: ref.height }
    : { left: ref.left, top: (append ? ref.bottom : ref.top) - 1, width: ref.width, height: 2 }
  return { index, rect }
}
