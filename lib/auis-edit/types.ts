// Client-side mirror of the page-edits contract. The server store
// (app/api/page-edits/_store.ts) imports node:fs, so it can't be pulled into
// client bundles — these types are the browser-safe twin, kept in sync by hand.

export type PageEditOpType =
  | "text"
  | "style"
  | "hide"
  | "variant"
  | "icon"
  | "iconStyle"
  | "token"
  | "class"
  | "move"

export type PageEditStatus = "open" | "in_review" | "applied" | "discarded"

export type PageEditActor = { kind: "agent" | "user"; id: string; name: string }

export interface PageEditResolution {
  actor: PageEditActor
  at: number
  summary: string
}

/** Reuses the review-mode anchor (selector + fingerprint). `component`/`domText`
 *  are a diagnostic snapshot the materialization skill greps the source with. */
export interface PageEditAnchor {
  selector: string
  fingerprint?: { tag: string; text?: string }
  component?: string
  domText?: string
}

export type PageEditPayload =
  | { kind: "text"; text: string; prevText?: string }
  // token is always a `var(--token)` string so the override tracks dark mode.
  // offSpec marks a direct style override on a component ROOT (diverges from the
  // component's own variant system); offSpecComponent is its label ("Card").
  | {
      kind: "style"
      prop: string
      token: string
      prevToken?: string
      offSpec?: boolean
      offSpecComponent?: string
      // Valor CRU fora da paleta (quebra o token). `token` guarda o valor literal
      // (ex.: "#ff5500"). No ship a materialização promove pra um --custom-*.
      custom?: boolean
    }
  | { kind: "hide"; mode: "hide" | "remove" }
  // variant/size swap on a class-based Au* component (classList swap).
  | {
      kind: "variant"
      axis: string
      value: string
      label?: string
      remove: string[]
      add: string
    }
  // Troca de classe utilitária curada (tipografia: escala/peso/alinhamento) em
  // QUALQUER elemento — não preso a um componente. Mesma mecânica do variant.
  | {
      kind: "class"
      group: string
      label?: string
      remove: string[]
      add: string
    }
  // Material Symbol ligature swap on an icon span.
  | { kind: "icon"; name: string; prevName?: string }
  // Override das axes ópticas de um ícone (font-variation-settings). Materializa
  // em props do <Icon>: weight / fill / grade / opticalSize.
  | {
      kind: "iconStyle"
      fill: number
      weight: number
      grade: number
      opticalSize: number
    }
  // Edição GLOBAL do valor de um token (ex.: --accent-brand). Aplicada no :root
  // ao vivo (todas as instâncias mudam); no ship a materialização reescreve o
  // token no globals.css + grava um backup pra reverter. anchor.selector = ":root".
  | { kind: "token"; token: string; value: string; prevValue?: string }
  // Sibling reorder: anchor is the PARENT container; `order` is the desired
  // child sequence by stable fingerprint key ("<tag>::<text>"). One move op per
  // parent (upsert) — see _store payloadDisc.
  | { kind: "move"; order: string[] }

export interface PageEditOp {
  id: string
  schemaVersion: 1
  route: string
  anchor: PageEditAnchor
  type: PageEditOpType
  payload: PageEditPayload
  createdAt: number
  updatedAt: number
  authorName?: string
  status: PageEditStatus
  resolution?: PageEditResolution
}
