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

/** Captura a âncora de um elemento selecionado, ou null se não der pra ancorar. */
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

/** Re-resolve o elemento de uma âncora (seletor + fallback de fingerprint). */
export function resolveEditElement(anchor: PageEditAnchor): Element | null {
  return resolveElementBySelector(anchor.selector, anchor.fingerprint)
}

// ── Text-leaf walk ──────────────────────────────────────────────────────────
// `el.textContent = …` apaga TODOS os filhos. Só é seguro num nó cujo conteúdo
// é texto puro. Dado um elemento selecionado, descemos por cadeias de wrapper
// de filho único até o nó-folha de texto; recusamos quando há texto direto
// MISTURADO com elementos, ou vários filhos-elemento (container ambíguo).

function directText(el: Element): string {
  let t = ""
  el.childNodes.forEach((n) => {
    if (n.nodeType === Node.TEXT_NODE) t += n.textContent ?? ""
  })
  return t.trim()
}

/** Acha o nó-folha de texto editável dentro do elemento, ou null se ambíguo. */
export function findEditableTextLeaf(el: Element): Element | null {
  let node: Element = el
  for (let depth = 0; depth < 8; depth++) {
    const kids = Array.from(node.children)
    const dt = directText(node)
    if (kids.length === 0) {
      return node.textContent && node.textContent.trim() ? node : null
    }
    // Texto direto + filhos-elemento → setTextContent destruiria os filhos.
    if (dt) return null
    if (kids.length === 1) {
      node = kids[0]
      continue
    }
    // Vários filhos-elemento, sem texto direto → container, não folha.
    return null
  }
  return null
}
