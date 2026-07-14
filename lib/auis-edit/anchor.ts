import {
  cssPath,
  resolveElementBySelector,
} from "@/lib/auis-review/elementAnchor"
import type { PageEditAnchor } from "./types"

// Edit Mode reuses the review-mode element addressing (selector + fingerprint),
// but targets the WHOLE element (no fx/fy pin offset). Capture records enough
// for both live re-resolution and the materialization skill's source grep.

function fpText(el: Element): string {
  return (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 60)
}

function readComponent(el: Element): string | undefined {
  const owner = el.closest("[data-au-component]")
  return owner?.getAttribute("data-au-component") || undefined
}

/** Capture the anchor of a selected element, or null when it can't be anchored. */
export function captureEditAnchor(el: Element): PageEditAnchor | null {
  const selector = cssPath(el)
  if (!selector) return null
  const text = fpText(el)
  return {
    selector,
    fingerprint: { tag: el.tagName.toLowerCase(), text: text || undefined },
    component: readComponent(el),
    domText: text || undefined,
  }
}

/** Re-resolve an anchor's element (selector + fingerprint fallback). */
export function resolveEditElement(anchor: PageEditAnchor): Element | null {
  return resolveElementBySelector(anchor.selector, anchor.fingerprint)
}

// ── Text-leaf walk ──────────────────────────────────────────────────────────
// `el.textContent = …` wipes out ALL children. It's only safe on a node whose
// content is pure text. Starting from the selected element, we descend through
// single-child wrapper chains down to the text leaf; we refuse when direct text
// is MIXED with elements, or when there are several element children (ambiguous
// container).

function directText(el: Element): string {
  let t = ""
  el.childNodes.forEach((n) => {
    if (n.nodeType === Node.TEXT_NODE) t += n.textContent ?? ""
  })
  return t.trim()
}

/** Find the editable text leaf inside the element, or null when it's ambiguous. */
export function findEditableTextLeaf(el: Element): Element | null {
  let node: Element = el
  for (let depth = 0; depth < 8; depth++) {
    const kids = Array.from(node.children)
    const dt = directText(node)
    if (kids.length === 0) {
      return node.textContent && node.textContent.trim() ? node : null
    }
    // Direct text + element children → setTextContent would destroy the children.
    if (dt) return null
    if (kids.length === 1) {
      node = kids[0]
      continue
    }
    // Several element children, no direct text → a container, not a leaf.
    return null
  }
  return null
}
