import type { PageEditOp } from "./types"
import { resolveEditElement } from "./anchor"
import { isAllowedStyle } from "./token-manifest"
import { buildIconVariation, iconVariationMatches } from "./icon-style"
import { matchOrder, orderMatches, reorderDom } from "./reorder"

// The overlay APPLY engine. React owns textContent/style/className and reverts
// any DOM mutation on its next render — so for every active op we (1) write the
// desired state and (2) keep a per-op MutationObserver that re-writes it the
// instant React (or anything else) clobbers it.
//
// Two invariants make this safe and cheap:
//  • write() is a NO-OP when the DOM already matches the op (value guard). This
//    is what prevents the sibling-observer ping-pong: several ops can target
//    the same element (color + background + hide + variant), all observing the
//    style/class attrs; an unchanged setProperty/classList still emits a
//    mutation record, which would re-trigger the others' observers forever.
//    Guarding on "already equal" breaks that loop.
//  • when we DO mutate, we disconnect → mutate → reconnect so the op's own
//    observer never sees its own write.
//
// Runs whether or not Edit Mode is active — that's what makes saved edits
// survive reload during normal viewing. Purely client-side; only driven from
// the EditModeProvider's post-hydration effects.

const DISPLAY = "display"

/** Texto normalizado de um elemento — espelha o fpText do anchor/resolver. */
function fpText(el: Element): string {
  return (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 60)
}

/**
 * Um alvo de `hide` só é válido se ainda casar o fingerprint capturado.
 *
 * O resolver (resolveElement) devolve um elemento "best-effort" pelo seletor
 * mesmo quando o fingerprint NÃO bate — os pins precisam disso pra grudar em
 * texto volátil. Mas pra ESCONDER isso é destrutivo: assim que uma op de hide
 * vira código (materializada), o elemento some e o seletor nth-of-type velho
 * passa a cair no vizinho que deslizou pra aquela posição — esconder o vizinho
 * apaga conteúdo inocente. Então, se o texto não casa mais o fingerprint,
 * tratamos o alvo como inexistente e não fazemos nada. Sem fingerprint de texto
 * (alvo sem texto), não há como verificar → mantém o comportamento legado.
 */
function hideTargetMatches(el: Element, anchor: PageEditOp["anchor"]): boolean {
  const want = anchor.fingerprint?.text
  if (!want) return true
  return fpText(el) === want
}

/**
 * Chave de CONFLITO de escrita: ops que escrevem no MESMO elemento e no MESMO
 * alvo — mesma prop de estilo, mesmo eixo de variante, ou o elemento inteiro
 * (text/icon/hide). Dois observers no mesmo (elemento, alvo) com valores
 * diferentes se re-disparam pra sempre (cada um desfaz o do outro) e travam a
 * aba — o guard de "valor já igual" não salva, porque cada op tem um alvo
 * diferente e os dois nunca repousam juntos.
 */
function writeTargetKey(op: PageEditOp): string {
  const p = op.payload
  const target =
    p.kind === "style"
      ? `style:${p.prop}`
      : p.kind === "variant"
        ? `variant:${p.axis}`
        : p.kind === "token"
          ? `token:${p.token}`
          : p.kind === "class"
            ? `class:${p.group}`
            : p.kind
  return `${op.anchor.selector}::${target}`
}

/** Last-writer-wins por (elemento, alvo): de cada chave de conflito mantém só a
 *  op mais recente (updatedAt), pra dois observers nunca brigarem pelo mesmo
 *  atributo. As perdedoras seguem no store (o usuário resolve no inbox); só não
 *  são aplicadas pelo overlay. */
function dedupeConflicts(ops: PageEditOp[]): PageEditOp[] {
  const winner = new Map<string, PageEditOp>()
  for (const op of ops) {
    const k = writeTargetKey(op)
    const cur = winner.get(k)
    if (!cur || op.updatedAt > cur.updatedAt) winner.set(k, op)
  }
  return ops.filter((op) => winner.get(writeTargetKey(op)) === op)
}

type PriorInline = { prop: string; value: string; priority: string }

type Entry = {
  op: PageEditOp
  el: Element | null
  observer: MutationObserver | null
  /** Inline value the page authored for the touched prop, captured before our
   *  first write, restored verbatim on revert (so we don't strip page styles). */
  prior?: PriorInline
}

export class OverlayApplier {
  private entries = new Map<string, Entry>()
  private suspended = new Set<string>()

  suspend(selector: string): void {
    this.suspended.add(selector)
    for (const entry of this.entries.values()) {
      if (entry.op.anchor.selector === selector) this.detach(entry)
    }
  }

  resume(selector: string): void {
    this.suspended.delete(selector)
    this.reapplyAll()
  }

  /** Reconcile the live op set: revert dropped ops, (re)apply the rest. */
  setOps(ops: PageEditOp[]): void {
    if (typeof document === "undefined") return
    // Colapsa ops conflitantes (mesmo elemento + mesmo alvo de escrita) ANTES de
    // observar: dois observers brigando pelo mesmo atributo com valores
    // diferentes entram em ping-pong infinito e travam a aba. Ver writeTargetKey.
    const live = dedupeConflicts(ops)
    const next = new Set(live.map((o) => o.id))
    for (const [id, entry] of this.entries) {
      if (!next.has(id)) {
        this.revert(entry)
        this.entries.delete(id)
      }
    }
    for (const op of live) {
      const existing = this.entries.get(op.id)
      if (existing) existing.op = op
      else this.entries.set(op.id, { op, el: null, observer: null })
    }
    this.reapplyAll()
  }

  /** Re-resolve (lazily) and re-apply — call on layout/route changes. */
  reapplyAll(): void {
    if (typeof document === "undefined") return
    for (const entry of this.entries.values()) this.apply(entry)
  }

  private apply(entry: Entry): void {
    if (this.suspended.has(entry.op.anchor.selector)) {
      this.detach(entry)
      return
    }
    // Reuse the cached element while it's still in the document — reflow keeps
    // the node connected, so we avoid a full selector/fingerprint scan per op
    // on every scroll frame. Only re-resolve when the node is gone (route
    // change, React replaced it).
    const el =
      entry.op.payload.kind === "token"
        ? document.documentElement // token edits live on :root, não num elemento
        : entry.el && entry.el.isConnected
          ? entry.el
          : resolveEditElement(entry.op.anchor)
    if (!el) {
      this.detach(entry)
      entry.el = null
      return
    }
    // Op de `hide` materializada (elemento removido do código) não pode cair no
    // fallback do seletor e esconder o vizinho que ocupou a posição. Se o alvo
    // não casa mais o fingerprint, trata como inexistente e não aplica.
    if (entry.op.payload.kind === "hide" && !hideTargetMatches(el, entry.op.anchor)) {
      this.detach(entry)
      entry.el = null
      return
    }
    if (entry.el !== el) {
      this.detach(entry)
      entry.el = el
      entry.prior = undefined
    }
    this.write(entry)
    if (!entry.observer) {
      entry.observer = new MutationObserver(() => {
        if (entry.el) this.write(entry)
      })
      this.observe(entry)
    }
  }

  private observe(entry: Entry): void {
    if (!entry.el || !entry.observer) return
    const kind = entry.op.payload.kind
    if (kind === "text" || kind === "icon") {
      entry.observer.observe(entry.el, {
        childList: true,
        characterData: true,
        subtree: true,
      })
    } else if (kind === "move") {
      // entry.el is the PARENT; re-assert child order when React re-renders it.
      entry.observer.observe(entry.el, { childList: true })
    } else {
      entry.observer.observe(entry.el, {
        attributes: true,
        attributeFilter: ["style", "class"],
      })
    }
  }

  private snapshot(entry: Entry, prop: string): void {
    if (entry.prior) return
    const html = entry.el as HTMLElement | null
    if (!html) return
    entry.prior = {
      prop,
      value: html.style.getPropertyValue(prop),
      priority: html.style.getPropertyPriority(prop),
    }
  }

  // No-op when the DOM already matches (value guard); otherwise
  // disconnect → mutate → reconnect so we never observe our own write.
  private write(entry: Entry): void {
    const el = entry.el
    if (!el) return
    const html = el as HTMLElement
    const { payload } = entry.op

    let mutate: (() => void) | null = null
    if (payload.kind === "text") {
      if (el.textContent !== payload.text) mutate = () => (el.textContent = payload.text)
    } else if (payload.kind === "icon") {
      if (el.textContent !== payload.name) mutate = () => (el.textContent = payload.name)
    } else if (payload.kind === "style") {
      if (
        (payload.custom || isAllowedStyle(payload.prop, payload.token)) &&
        html.style.getPropertyValue(payload.prop) !== payload.token
      ) {
        this.snapshot(entry, payload.prop)
        mutate = () => html.style.setProperty(payload.prop, payload.token)
      }
    } else if (payload.kind === "hide") {
      if (html.style.getPropertyValue(DISPLAY) !== "none") {
        this.snapshot(entry, DISPLAY)
        mutate = () => html.style.setProperty(DISPLAY, "none", "important")
      }
    } else if (payload.kind === "iconStyle") {
      const v = {
        fill: payload.fill,
        weight: payload.weight,
        grade: payload.grade,
        opticalSize: payload.opticalSize,
      }
      if (
        !iconVariationMatches(
          html.style.getPropertyValue("font-variation-settings"),
          v,
        )
      ) {
        this.snapshot(entry, "font-variation-settings")
        mutate = () =>
          html.style.setProperty("font-variation-settings", buildIconVariation(v))
      }
    } else if (payload.kind === "token") {
      if (html.style.getPropertyValue(payload.token) !== payload.value) {
        this.snapshot(entry, payload.token)
        mutate = () => html.style.setProperty(payload.token, payload.value)
      }
    } else if (payload.kind === "variant") {
      const cl = html.classList
      const needs =
        (!!payload.add && !cl.contains(payload.add)) ||
        payload.remove.some((c) => c !== payload.add && cl.contains(c))
      if (needs)
        mutate = () => {
          for (const c of payload.remove) if (c !== payload.add) cl.remove(c)
          if (payload.add) cl.add(payload.add)
        }
    } else if (payload.kind === "class") {
      const cl = html.classList
      const needs =
        (!!payload.add && !cl.contains(payload.add)) ||
        payload.remove.some((c) => c !== payload.add && cl.contains(c))
      if (needs)
        mutate = () => {
          for (const c of payload.remove) if (c !== payload.add) cl.remove(c)
          if (payload.add) cl.add(payload.add)
        }
    } else if (payload.kind === "move") {
      // el is the PARENT container; reorder its children to the saved sequence.
      const ordered = matchOrder(el, payload.order)
      if (!orderMatches(el, ordered)) mutate = () => reorderDom(el, ordered)
    }

    if (!mutate) return
    const obs = entry.observer
    if (obs) obs.disconnect()
    try {
      mutate()
    } finally {
      if (obs) this.observe(entry)
    }
  }

  private detach(entry: Entry): void {
    if (entry.observer) {
      entry.observer.disconnect()
      entry.observer = null
    }
  }

  private revert(entry: Entry): void {
    this.detach(entry)
    const el = entry.el ?? resolveEditElement(entry.op.anchor)
    if (!el) return
    const html = el as HTMLElement
    const { payload } = entry.op
    if (
      payload.kind === "style" ||
      payload.kind === "hide" ||
      payload.kind === "iconStyle" ||
      payload.kind === "token"
    ) {
      const prior = entry.prior
      if (prior) {
        if (prior.value) html.style.setProperty(prior.prop, prior.value, prior.priority)
        else html.style.removeProperty(prior.prop)
      } else {
        const prop =
          payload.kind === "hide"
            ? DISPLAY
            : payload.kind === "iconStyle"
              ? "font-variation-settings"
              : payload.kind === "token"
                ? payload.token
                : payload.prop
        html.style.removeProperty(prop)
      }
    } else if (payload.kind === "text" && payload.prevText != null) {
      if (el.textContent !== payload.prevText) el.textContent = payload.prevText
    } else if (payload.kind === "icon" && payload.prevName != null) {
      if (el.textContent !== payload.prevName) el.textContent = payload.prevName
    } else if (payload.kind === "variant" || payload.kind === "class") {
      // Undo our class add; React restores the original variant on next render.
      if (payload.add) html.classList.remove(payload.add)
    }
    entry.prior = undefined
  }

  destroy(): void {
    for (const entry of this.entries.values()) this.revert(entry)
    this.entries.clear()
  }

  /** Element a still-active op currently targets (for the inspector outline). */
  resolved(id: string): Element | null {
    return this.entries.get(id)?.el ?? null
  }
}
