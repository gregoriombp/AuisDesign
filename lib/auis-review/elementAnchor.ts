import { elementBelowOverlayAt } from "@/lib/auis-review/scrollOffset"
import type {
  ReviewAnchor,
  ReviewAnchorFingerprint,
  ReviewDrawAnchor,
  ReviewElementAnchor,
  ReviewPoint,
} from "@/components/auis-review/types"

// Pins store an absolute position (doc coords), but when a side panel opens or
// closes (Copilot, sidebars) `<main>` changes width and the content reflows
// horizontally — and a pin nailed to a fixed x "comes unstuck" from its element.
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

/**
 * Re-resolve an anchor's element. Tries the structural selector first; when that
 * fails or diverges from the fingerprint (nth-of-type indices shift when a
 * sidebar mounts/unmounts or a breakpoint changes the DOM), it recovers by
 * finding a single element with the same tag and the same text. When that is
 * ambiguous (several identical) or the text is volatile (a live counter), it
 * keeps the selector's result.
 */
function resolveElement(
  selector: string,
  fingerprint?: ReviewAnchorFingerprint,
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
  // Selector failed or matched another element: try to recover by fingerprint.
  const matches = Array.from(document.querySelectorAll(fingerprint.tag)).filter(
    (c) => fpText(c) === fingerprint.text,
  )
  if (matches.length === 1) return matches[0]
  return bySelector
}

/** Resolve an anchor's target element with the same fingerprint fallback that
 *  keeps pins/strokes attached to the right element on render. */
export function resolveAnchoredElement(anchor: ReviewAnchor | null): Element | null {
  if (typeof document === "undefined" || !anchor?.el?.selector) return null
  return resolveElement(anchor.el.selector, anchor.el.fingerprint)
}

/** The same resolution (selector + fingerprint fallback), exposed for consumers
 *  that only keep a loose `selector`/`fingerprint` pair (e.g. Live Edit Mode),
 *  without the `anchor.el` wrapper. */
export function resolveElementBySelector(
  selector: string,
  fingerprint?: ReviewAnchorFingerprint,
): Element | null {
  if (typeof document === "undefined") return null
  return resolveElement(selector, fingerprint)
}

// A `body > tag:nth-of-type(n) > …` path, stable across layout toggles (the DOM
// is the same; only the width changes). Uses nth-of-type (not ids) because Radix
// ids contain `:` and break querySelector.
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

/** Capture the element anchor under a viewport point, or null. */
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

/** Re-resolve an anchor to its current viewport point, or null when not found. */
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
 * Capture the element anchor of a freehand stroke. Takes points ALREADY in
 * viewport coords, picks the element under the centroid as the reference, and
 * stores, for each point, its fraction (fx, fy) inside that element's box.
 * Fractions are NOT clamped: a stroke can (and usually does) spill past the box.
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

/** Re-resolve a freehand stroke to its current viewport points, or null. */
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
