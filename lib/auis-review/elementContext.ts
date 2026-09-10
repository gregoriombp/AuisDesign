import { resolveAnchoredElement } from "@/lib/auis-review/elementAnchor"
import { stripIconLigature } from "@/lib/auis/iconLigature"
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

/** Presentable label: no icon ligature, truncated. The trail is read by people
 *  (and by agents) on the way back, so "Agentexpand_more" will not do. */
function cleanName(raw: string | null | undefined): string | undefined {
  const t = stripIconLigature(raw ?? "")
  return t ? t.slice(0, 60) : undefined
}

/** Short accessible name of a container (aria-label / aria-labelledby / title). */
function accessibleName(el: Element): string | undefined {
  const aria = cleanName(el.getAttribute("aria-label"))
  if (aria) return aria
  const labelledby = el.getAttribute("aria-labelledby")
  if (labelledby && typeof document !== "undefined") {
    const named = cleanName(
      labelledby
        .split(/\s+/)
        .map((id) => document.getElementById(id)?.textContent?.trim())
        .filter(Boolean)
        .join(" "),
    )
    if (named) return named
  }
  return cleanName(el.getAttribute("title"))
}

/** A container's own title: the first heading inside it. */
function ownHeading(el: Element): string | undefined {
  const h = el.querySelector("h1,h2,h3,h4,h5,h6,[role='heading']")
  return cleanName(h?.textContent)
}

/**
 * A modal's name. The title AuModal renders comes first: falling straight to
 * the accessible name made the trail record a nested landmark's label
 * ("Modal: Side panel") instead of the dialog's own title.
 */
function dialogName(el: Element): string | undefined {
  const own = cleanName(el.querySelector(".au-modal__title")?.textContent)
  if (own) return own
  return accessibleName(el) ?? ownHeading(el)
}

/**
 * Short trail of "where" the element is — ancestor landmarks (modal, tab,
 * section, navigation, panel, form) with an accessible name or their own title.
 * Lean on purpose: one climb, at most 4 steps, never the whole DOM. It gives the
 * agent the exact LOCATION even when the target is an anonymous `<div>`.
 * Ordered from the outermost to the innermost.
 */
export function describeLocation(el: Element): string[] {
  const trail: string[] = []
  const seen = new Set<string>()
  const add = (kind: string, name?: string) => {
    const label = name ? `${kind}: ${name}` : kind
    if (seen.has(label)) return
    seen.add(label)
    trail.push(label)
  }
  let node: Element | null = el.parentElement
  let depth = 0
  while (node && depth < 24 && trail.length < 4) {
    const tag = node.tagName.toLowerCase()
    const role = node.getAttribute("role")
    if (tag === "dialog" || role === "dialog" || role === "alertdialog") {
      add("Modal", dialogName(node))
    } else if (role === "tabpanel") {
      add("Tab", accessibleName(node))
    } else if (tag === "nav" || role === "navigation") {
      add("Navigation", accessibleName(node))
    } else if (tag === "aside" || role === "complementary") {
      add("Side panel", accessibleName(node))
    } else if (tag === "header" || role === "banner") {
      add("Header", accessibleName(node))
    } else if (tag === "footer" || role === "contentinfo") {
      add("Footer", accessibleName(node))
    } else if (tag === "form" || role === "form") {
      add("Form", accessibleName(node) ?? ownHeading(node))
    } else if (tag === "section" || role === "region" || role === "group") {
      const name = accessibleName(node) ?? ownHeading(node)
      if (name) add("Section", name)
    }
    node = node.parentElement
    depth += 1
  }
  return trail.reverse()
}

/** Describes a DOM element (tag + role + accessible label + text). */
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

/** Resolves the element anchored to a comment and describes it, or null. */
export function describeAnchorElement(
  anchor: ReviewAnchor | null,
): ReviewElementContext | null {
  if (typeof document === "undefined" || !anchor) return null
  const selector = anchor.el?.selector
  if (!selector) return null
  const el = resolveAnchoredElement(anchor)
  if (!el) return null
  const trail = describeLocation(el)
  return {
    ...describeElement(el),
    selector,
    ...(trail.length > 0 ? { location: trail.join(" › ") } : {}),
  }
}

/** Snapshot persisted on the comment so agents can resolve short feedback
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
  const location = describeLocation(el)
  return {
    ...base,
    ...(location.length > 0 ? { location } : {}),
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

/** Rebuilds the (lean) element context from the comment's persisted snapshot —
 *  to feed the reply wand ("improve") with the original target + location. */
export function elementFromCommentContext(
  ctx: ReviewCommentContext | undefined | null,
): ReviewElementContext | null {
  const t = ctx?.target
  if (!t) return null
  return {
    tag: t.tag,
    role: t.role,
    label: t.label,
    text: t.text,
    selector: t.selector,
    ...(ctx?.location && ctx.location.length > 0
      ? { location: ctx.location.join(" › ") }
      : {}),
  }
}

/** Short label for the magic pointer chip (e.g. `button · Save`). */
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
