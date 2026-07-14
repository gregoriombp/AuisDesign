import { elementBelowOverlayAt } from "@/lib/auis-review/scrollOffset"
import type {
  ReviewAnchor,
  ReviewAnchorFingerprint,
  ReviewDrawAnchor,
  ReviewElementAnchor,
  ReviewPoint,
} from "@/components/auis-review/types"

// Pins guardam uma posição absoluta (doc coords), mas quando um painel lateral
// abre/fecha (Copilot, sidebars) o `<main>` muda de largura e o conteúdo reflui
// horizontalmente — aí o pin preso a um x fixo "desgruda" do elemento.
//
// Pra resolver isso, além da coord absoluta, ancoramos o pin ao ELEMENTO sob
// ele: um seletor resolvível + a fração (fx, fy) de onde o clique caiu dentro
// da bounding box. No render, re-resolvemos o elemento e posicionamos o pin
// sobre ele de novo — então o pin acompanha o reflow. Se o seletor não resolver
// (página mudou, elemento sumiu), caímos de volta na coord absoluta.

function clamp01(n: number): number {
  return n < 0 ? 0 : n > 1 ? 1 : n
}

/** Texto normalizado de um elemento, recortado — base do fingerprint. */
function fpText(el: Element): string {
  return (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 60)
}

/** Pista de identidade (tag + texto) pra recuperar o elemento quando o seletor
 *  estrutural deslocar. */
function fingerprintOf(el: Element): ReviewAnchorFingerprint {
  const text = fpText(el)
  return { tag: el.tagName.toLowerCase(), text: text || undefined }
}

/**
 * Re-resolve o elemento de uma âncora. Tenta o seletor estrutural; se ele
 * falhar ou divergir do fingerprint (índices nth-of-type deslocam quando uma
 * sidebar monta/desmonta ou um breakpoint muda o DOM), recupera por um único
 * elemento da mesma tag com o mesmo texto. Em caso ambíguo (vários iguais) ou
 * texto volátil (contador ao vivo), fica com o resultado do seletor.
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
  // Sem fingerprint (âncoras antigas) → comportamento legado: confia no seletor.
  if (!fingerprint?.text) return bySelector
  // Seletor resolveu E o texto bate → melhor caso, sem ambiguidade.
  if (bySelector && fpText(bySelector) === fingerprint.text) return bySelector
  // Seletor falhou ou casou outro elemento: tenta recuperar pelo fingerprint.
  const matches = Array.from(document.querySelectorAll(fingerprint.tag)).filter(
    (c) => fpText(c) === fingerprint.text,
  )
  if (matches.length === 1) return matches[0]
  return bySelector
}

/** Resolve o elemento alvo de uma âncora usando o mesmo fallback de fingerprint
 *  que mantém pins/traços presos ao elemento certo no render. */
export function resolveAnchoredElement(anchor: ReviewAnchor | null): Element | null {
  if (typeof document === "undefined" || !anchor?.el?.selector) return null
  return resolveElement(anchor.el.selector, anchor.el.fingerprint)
}

/** Mesma resolução (seletor + fallback de fingerprint), exposta pra consumidores
 *  que guardam só `selector`/`fingerprint` soltos (ex.: Live Edit Mode), sem o
 *  embrulho `anchor.el`. */
export function resolveElementBySelector(
  selector: string,
  fingerprint?: ReviewAnchorFingerprint,
): Element | null {
  if (typeof document === "undefined") return null
  return resolveElement(selector, fingerprint)
}

// Caminho `body > tag:nth-of-type(n) > …` estável entre toggles de layout (o
// DOM é o mesmo; só a largura muda). Usa nth-of-type (não ids) porque ids do
// Radix carregam `:` e quebram o querySelector.
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

/** Captura a âncora-de-elemento sob um ponto de viewport, ou null. */
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

/** Re-resolve a âncora pro ponto de viewport atual, ou null se não achar. */
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
 * Captura a âncora-de-elemento de uma marcação livre. Recebe os pontos JÁ em
 * coords de viewport, escolhe o elemento sob o centroide como referência e
 * guarda, pra cada ponto, sua fração (fx, fy) dentro do box desse elemento.
 * Frações NÃO são clampeadas: o traço pode (e costuma) extrapolar o box.
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

/** Re-resolve a marcação livre pros pontos de viewport atuais, ou null. */
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
