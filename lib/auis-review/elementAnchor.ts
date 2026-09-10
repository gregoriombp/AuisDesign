import { elementBelowOverlayAt } from "@/lib/auis-review/scrollOffset"
import type {
  ReviewAnchor,
  ReviewAnchorFingerprint,
  ReviewDrawAnchor,
  ReviewElementAnchor,
  ReviewPoint,
} from "@/components/auis-review/types"

// Pins store an absolute position (doc coords), but when a side panel opens or
// closes the container changes width and the content reflows horizontally —
// and a pin nailed to a fixed x "comes unstuck" from its element.
//
// To fix that, on top of the absolute coord we anchor the pin to the ELEMENT
// under it: a resolvable selector + the fraction (fx, fy) of where the click
// landed inside its bounding box. On render we re-resolve the element and place
// the pin over it again — so the pin follows the reflow. If the selector doesn't
// resolve (page changed, element gone), we fall back to the absolute coord.

function clamp01(n: number): number {
  return n < 0 ? 0 : n > 1 ? 1 : n
}

/** An element's normalized, truncated text — the basis of the fingerprint. */
function fpText(el: Element): string {
  return (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 60)
}

/** Identity hint (tag + text) used to recover the element when the structural
 *  selector shifts. */
function fingerprintOf(el: Element): ReviewAnchorFingerprint {
  const text = fpText(el)
  return { tag: el.tagName.toLowerCase(), text: text || undefined }
}

/** Steps of a `body > a > b` path, to compare ancestry. */
function segmentsOf(selector: string): string[] {
  return selector
    .split(">")
    .map((part) => part.trim())
    .filter(Boolean)
}

function commonRun(a: string[], b: string[], fromEnd: boolean): number {
  let n = 0
  while (n < a.length && n < b.length) {
    const x = fromEnd ? a[a.length - 1 - n] : a[n]
    const y = fromEnd ? b[b.length - 1 - n] : b[n]
    if (x !== y) break
    n++
  }
  return n
}

/**
 * Structural tie-break between candidates with the same text, on three
 * criteria, in this order:
 *
 *  1. Same DEPTH as the stored path. This separates a modal's centering
 *     container from the `.au-modal` inside it: both carry the same text, but
 *     one is `fixed inset-0` (the whole viewport) and the other is the panel —
 *     anchoring to the wrong one throws the pin far away.
 *  2. Longest common suffix. The end of the path is the stable part when the
 *     portal index moves (`body > div:nth-of-type(8)` becomes `33`).
 *  3. Longest common prefix. This separates two "edit" buttons in the same
 *     rail: the right one shares every ancestor, the sibling diverges one level
 *     up.
 *
 * A tie at the end returns null: guessing between equals is worse than
 * admitting the ambiguity.
 */
function disambiguate(matches: Element[], selector: string): Element | null {
  const want = segmentsOf(selector)
  let best: Element | null = null
  let bestScore: [number, number, number] = [-1, -1, -1]
  let tied = false
  for (const candidate of matches) {
    const path = cssPath(candidate)
    if (!path) continue
    const have = segmentsOf(path)
    const score: [number, number, number] = [
      have.length === want.length ? 1 : 0,
      commonRun(have, want, true),
      commonRun(have, want, false),
    ]
    const cmp =
      score[0] - bestScore[0] || score[1] - bestScore[1] || score[2] - bestScore[2]
    if (cmp > 0) {
      bestScore = score
      best = candidate
      tied = false
    } else if (cmp === 0) {
      tied = true
    }
  }
  if (tied || !best) return null
  // No criterion matched: the paths have nothing in common with the stored one.
  return bestScore[0] === 0 && bestScore[1] === 0 && bestScore[2] === 0
    ? null
    : best
}

/**
 * Re-resolve an anchor's element. Tries the structural selector; if it fails or
 * diverges from the fingerprint (nth-of-type indices shift when a sidebar
 * mounts/unmounts or a breakpoint changes the DOM), recovers through a single
 * element with the same tag and the same text, tie-breaking on ancestry when
 * there are several.
 *
 * `strict` changes what happens when none of that converges. Without it
 * (canvas, popover, Live Edit) we return the selector's result: a pin roughly
 * in place beats no pin. With it — only the reveal trail uses it — we return
 * null, because returning an element we already know is wrong makes the replay
 * believe it arrived, stop clicking, and paint the pin over something else.
 */
function resolveElement(
  selector: string,
  fingerprint?: ReviewAnchorFingerprint,
  opts?: { strict?: boolean },
): Element | null {
  let bySelector: Element | null = null
  try {
    bySelector = document.querySelector(selector)
  } catch {
    bySelector = null
  }
  // No fingerprint (older anchors) → legacy behavior: trust the selector.
  if (!fingerprint?.text) return bySelector
  // Selector resolved AND the text matches → best case, no ambiguity.
  if (bySelector && fpText(bySelector) === fingerprint.text) return bySelector
  // Selector failed or matched another element: recover through the fingerprint.
  const matches = Array.from(document.querySelectorAll(fingerprint.tag)).filter(
    (c) => fpText(c) === fingerprint.text,
  )
  if (matches.length === 1) return matches[0]
  if (matches.length > 1) {
    const picked = disambiguate(matches, selector)
    if (picked) return picked
  }
  return opts?.strict ? null : bySelector
}

/** Resolve an anchor's target element with the same fingerprint fallback that
 *  keeps pins/strokes stuck to the right element on render. */
export function resolveAnchoredElement(
  anchor: ReviewAnchor | null,
  opts?: { strict?: boolean },
): Element | null {
  if (typeof document === "undefined" || !anchor?.el?.selector) return null
  return resolveElement(anchor.el.selector, anchor.el.fingerprint, opts)
}

/** Same resolution (selector + fingerprint fallback), exposed for consumers that
 *  store a loose `selector`/`fingerprint` (e.g. Live Edit Mode) without the
 *  `anchor.el` wrapper. */
export function resolveElementBySelector(
  selector: string,
  fingerprint?: ReviewAnchorFingerprint,
  opts?: { strict?: boolean },
): Element | null {
  if (typeof document === "undefined") return null
  return resolveElement(selector, fingerprint, opts)
}

// `body > tag:nth-of-type(n) > …` path, stable across layout toggles (the DOM
// is the same; only the width changes). Uses nth-of-type (not ids) because
// Radix ids carry `:` and break querySelector.
export function cssPath(start: Element): string | null {
  if (typeof document === "undefined") return null
  const parts: string[] = []
  let node: Element | null = start
  while (
    node &&
    node.nodeType === 1 &&
    node !== document.body &&
    node !== document.documentElement
  ) {
    const parent: Element | null = node.parentElement
    if (!parent) break
    const tag = node.tagName.toLowerCase()
    const sameTag = Array.from(parent.children).filter(
      (c) => c.tagName === node!.tagName,
    )
    const idx = sameTag.indexOf(node) + 1
    parts.unshift(`${tag}:nth-of-type(${idx})`)
    node = parent
  }
  if (parts.length === 0) return null
  return `body > ${parts.join(" > ")}`
}

/** Resolvable reference (selector + fingerprint) of an element — the basis of
 *  the reveal TRAIL: the triggers the author clicked (a button that opens a
 *  modal, a wizard option, a tab) to reach the state where the pin was dropped.
 *  Reuses the same selector+fingerprint pair that anchors pins, so it
 *  re-resolves with the same fallback. */
export function captureElementRef(
  el: Element,
): { selector: string; fingerprint?: ReviewAnchorFingerprint } | null {
  const selector = cssPath(el)
  if (!selector) return null
  return { selector, fingerprint: fingerprintOf(el) }
}

/** Captures the element anchor under a viewport point, or null. */
export function captureElementAnchor(
  clientX: number,
  clientY: number,
): ReviewElementAnchor | null {
  const el = elementBelowOverlayAt(clientX, clientY)
  if (!el) return null
  const rect = el.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) return null
  const selector = cssPath(el)
  if (!selector) return null
  return {
    selector,
    fx: clamp01((clientX - rect.left) / rect.width),
    fy: clamp01((clientY - rect.top) / rect.height),
    fingerprint: fingerprintOf(el),
  }
}

/** Re-resolves the anchor to the current viewport point, or null if not found. */
export function resolveElementPoint(
  anchor: ReviewElementAnchor,
): ReviewPoint | null {
  if (typeof document === "undefined") return null
  const el = resolveElement(anchor.selector, anchor.fingerprint)
  if (!el) return null
  const rect = el.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) return null
  return {
    x: rect.left + anchor.fx * rect.width,
    y: rect.top + anchor.fy * rect.height,
  }
}

/**
 * Captures the element anchor of a freehand stroke. Receives the points ALREADY
 * in viewport coords, picks the element under the centroid as the reference and
 * stores, for every point, its fraction (fx, fy) inside that element's box.
 * Fractions are NOT clamped: the stroke can (and usually does) spill outside
 * the box.
 */
export function captureDrawAnchor(
  viewportPoints: ReviewPoint[],
): ReviewDrawAnchor | null {
  if (viewportPoints.length === 0) return null
  let cx = 0
  let cy = 0
  for (const p of viewportPoints) {
    cx += p.x
    cy += p.y
  }
  cx /= viewportPoints.length
  cy /= viewportPoints.length
  const el = elementBelowOverlayAt(cx, cy)
  if (!el) return null
  const rect = el.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) return null
  const selector = cssPath(el)
  if (!selector) return null
  return {
    selector,
    points: viewportPoints.map((p) => ({
      fx: (p.x - rect.left) / rect.width,
      fy: (p.y - rect.top) / rect.height,
    })),
    fingerprint: fingerprintOf(el),
  }
}

/** Re-resolves the freehand stroke to the current viewport points, or null. */
export function resolveDrawPoints(
  anchor: ReviewDrawAnchor,
): ReviewPoint[] | null {
  if (typeof document === "undefined") return null
  const el = resolveElement(anchor.selector, anchor.fingerprint)
  if (!el) return null
  const rect = el.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) return null
  return anchor.points.map((p) => ({
    x: rect.left + p.fx * rect.width,
    y: rect.top + p.fy * rect.height,
  }))
}
