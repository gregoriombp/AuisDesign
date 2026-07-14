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
      // RAW value outside the palette (breaks the token). `token` holds the
      // literal value (e.g. "#ff5500"). On ship, materialization promotes it to
      // a --custom-* token.
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
  // Curated utility-class swap (typography: scale/weight/alignment) on ANY
  // element — not bound to a component. Same mechanics as variant.
  | {
      kind: "class"
      group: string
      label?: string
      remove: string[]
      add: string
    }
  // Material Symbol ligature swap on an icon span.
  | { kind: "icon"; name: string; prevName?: string }
  // Override of an icon's optical axes (font-variation-settings). Materializes
  // into <Icon> props: weight / fill / grade / opticalSize.
  | {
      kind: "iconStyle"
      fill: number
      weight: number
      grade: number
      opticalSize: number
    }
  // GLOBAL edit of a token's value (e.g. --accent-brand). Applied live on :root
  // (every instance changes); on ship, materialization rewrites the token in
  // globals.css and stores a backup to revert. anchor.selector = ":root".
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
