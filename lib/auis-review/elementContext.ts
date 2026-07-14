import { resolveAnchoredElement } from "@/lib/auis-review/elementAnchor"
import type {
  ReviewAnchor,
  ReviewCommentContext,
  ReviewElementAttributes,
  ReviewElementContext,
} from "@/components/auis-review/types"

// A lean context of the element under the comment — feeds the prompt suggestion
// (/api/review/suggest) and the magic pointer's label. Text/attributes only,
// never the whole DOM.
export type { ReviewElementContext }

function snippet(el: Element, max: number): string {
  return (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, max)
}

function attr(el: Element, name: string, max = 120): string | undefined {
  const value = el.getAttribute(name)?.trim()
  return value ? value.slice(0, max) : undefined
}

function compactAttributes(
  value: ReviewElementAttributes,
): ReviewElementAttributes | undefined {
  const entries = Object.entries(value).filter(([, v]) => Boolean(v))
  if (entries.length === 0) return undefined
  return Object.fromEntries(entries) as ReviewElementAttributes
}

function elementAttributes(el: Element): ReviewElementAttributes | undefined {
  return compactAttributes({
    id: attr(el, "id"),
    name: attr(el, "name"),
    type: attr(el, "type"),
    href: attr(el, "href", 200),
    ariaLabel: attr(el, "aria-label"),
    title: attr(el, "title"),
    placeholder: attr(el, "placeholder"),
    dataSlot: attr(el, "data-slot"),
    dataState: attr(el, "data-state"),
    dataValue: attr(el, "data-value"),
  })
}

function uniquePush(list: string[], value: string | undefined) {
  const normalized = value?.trim().replace(/\s+/g, " ")
  if (!normalized || list.includes(normalized)) return
  list.push(normalized)
}

function nearbyText(el: Element): string[] | undefined {
  const chunks: string[] = []
  let parent = el.parentElement
  for (let depth = 0; parent && depth < 2 && chunks.length < 5; depth += 1) {
    for (const child of Array.from(parent.children)) {
      if (child === el || child.contains(el)) continue
      uniquePush(chunks, snippet(child, 140))
      if (chunks.length >= 5) break
    }
    uniquePush(chunks, snippet(parent, 220))
    parent = parent.parentElement
  }
  return chunks.length > 0 ? chunks : undefined
}

/** Describe a DOM element (tag + role + accessible label + text). */
export function describeElement(el: Element): ReviewElementContext {
  const tag = el.tagName.toLowerCase()
  const role = el.getAttribute("role") || undefined
  const label =
    el.getAttribute("aria-label") ||
    el.getAttribute("title") ||
    el.getAttribute("placeholder") ||
    undefined
  const text = snippet(el, 80) || undefined
  return { tag, role, label, text }
}

/** Resolve the element a comment is anchored to and describe it, or null. */
export function describeAnchorElement(
  anchor: ReviewAnchor | null,
): ReviewElementContext | null {
  if (typeof document === "undefined" || !anchor) return null
  const selector = anchor.el?.selector
  if (!selector) return null
  const el = resolveAnchoredElement(anchor)
  if (!el) return null
  return { ...describeElement(el), selector }
}

/** Snapshot persisted on the comment so agents can act on terse feedback
 *  ("remove this", "change this label") without relying on coordinates alone. */
export function buildReviewCommentContext(anchor: ReviewAnchor | null): ReviewCommentContext {
  const pageUrl =
    typeof window === "undefined"
      ? ""
      : `${window.location.pathname}${window.location.search}`
  const base: ReviewCommentContext = {
    capturedAt: Date.now(),
    pageUrl,
    ...(typeof document !== "undefined" && document.title
      ? { pageTitle: document.title }
      : {}),
  }
  const el = resolveAnchoredElement(anchor)
  if (!el || !anchor?.el) return base
  const rect = el.getBoundingClientRect()
  return {
    ...base,
    target: {
      ...describeElement(el),
      selector: anchor.el.selector,
      fingerprint: anchor.el.fingerprint,
      attributes: elementAttributes(el),
      rect: {
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      },
      ...(anchor.kind === "pin"
        ? { pointer: { fx: anchor.el.fx, fy: anchor.el.fy } }
        : {}),
    },
    nearbyText: nearbyText(el),
  }
}

/** Short label for the magic pointer's chip (e.g. `button · Save`). */
export function shortLabelFor(el: Element): string {
  const tag = el.tagName.toLowerCase()
  const aria = el.getAttribute("aria-label") || el.getAttribute("title")
  if (aria) return `${tag} · ${aria.slice(0, 28)}`
  const role = el.getAttribute("role")
  if (role) return `${tag} · ${role}`
  const text = snippet(el, 24)
  if (text) return `${tag} · "${text}"`
  return tag
}
