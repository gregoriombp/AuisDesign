export type ReviewMode = "cursor" | "draw" | "pin" | "magic"

export interface ReviewIdentity {
  id: string
  name: string
  colorToken: string
  createdAt: number
}

export interface ReviewPoint {
  x: number
  y: number
}

export interface ReviewDrawPath {
  points: ReviewPoint[]
  strokeColorToken: string
  strokeWidth: number
}

/**
 * Pista de identidade do elemento ancorado: tag + um trecho do texto. Quando o
 * `selector` estrutural (nth-of-type) desloca — sidebar colapsável montando, ou
 * render condicional por breakpoint que muda os índices dos irmãos — ele pode
 * resolver o elemento ERRADO (ou nenhum). O fingerprint recupera o alvo: se o
 * seletor falhar ou divergir, procura-se um elemento da mesma tag com o mesmo
 * texto. Opcional/aditivo — âncoras antigas sem ele seguem só pelo seletor.
 */
export interface ReviewAnchorFingerprint {
  tag: string
  text?: string
}

/**
 * Element-relative anchor for a pin. Beyond the absolute `position` (doc
 * coords), a pin can remember the element it was dropped on — a resolvable
 * `selector` plus the fractional offset (0..1) of the click inside that
 * element's box. On render the element is re-resolved so the pin follows
 * horizontal reflow (a side panel opening shrinks `<main>` and shifts content).
 * Optional and additive — comments without it fall back to `position`.
 */
export interface ReviewElementAnchor {
  selector: string
  fx: number
  fy: number
  fingerprint?: ReviewAnchorFingerprint
}

/**
 * Element-relative anchor for a freehand stroke. Same idea as
 * {@link ReviewElementAnchor}, but a whole path: one reference element (the
 * element under the stroke's centroid) plus, for every point, its fractional
 * offset (fx, fy) inside that element's box. Re-resolving the element on render
 * makes the stroke follow horizontal reflow (sidebar toggles) AND browser zoom
 * (the box scales, so the fractions scale with it) — the absolute `path.points`
 * can't survive either. Fractions are NOT clamped: a stroke legitimately spills
 * outside its reference box. Optional/additive — strokes without it fall back to
 * `path.points`.
 */
export interface ReviewDrawAnchor {
  selector: string
  points: { fx: number; fy: number }[]
  fingerprint?: ReviewAnchorFingerprint
}

export type ReviewAnchor =
  | { kind: "pin"; position: ReviewPoint; el?: ReviewElementAnchor }
  | { kind: "draw"; path: ReviewDrawPath; centroid: ReviewPoint; el?: ReviewDrawAnchor }

export interface ReviewElementContext {
  tag: string
  role?: string
  label?: string
  text?: string
  selector?: string
}

export interface ReviewElementAttributes {
  id?: string
  name?: string
  type?: string
  href?: string
  ariaLabel?: string
  title?: string
  placeholder?: string
  dataSlot?: string
  dataState?: string
  dataValue?: string
}

export interface ReviewElementRect {
  x: number
  y: number
  width: number
  height: number
}

export interface ReviewCommentTargetContext extends ReviewElementContext {
  fingerprint?: ReviewAnchorFingerprint
  attributes?: ReviewElementAttributes
  rect?: ReviewElementRect
  pointer?: { fx: number; fy: number }
}

export interface ReviewCommentContext {
  capturedAt: number
  pageUrl: string
  pageTitle?: string
  target?: ReviewCommentTargetContext
  nearbyText?: string[]
}

// "backlog" = "ideia futura": item avulso (sem pino) ou comentário movido pra
// um backlog. Não vira pino no canvas nem conta como "aberto"; vive na sua aba.
export type ReviewCommentStatus = "open" | "in_review" | "resolved" | "backlog"

export type ReviewActorKind = "agent" | "user"

export interface ReviewActor {
  kind: ReviewActorKind
  id: string
  name: string
}

/**
 * Per-agent operating permissions for the Review Bridge, toggled from the
 * floating Auis dot and read by the /loop dispatcher.
 * - liveResponse: the agent may reply in-thread when mentioned (talk only).
 * - autoConstruct: the agent may ACT (run a skill, edit, send to review) — only
 *   when the comment also carries the "#now" directive.
 */
export interface ReviewAgentSettings {
  liveResponse: boolean
  autoConstruct: boolean
}

/** agentId → settings. Agents absent from the map are all-off by default. */
export type ReviewAgentSettingsMap = Record<string, ReviewAgentSettings>

export interface ReviewResolution {
  actor: ReviewActor
  at: number
  summary: string
  approvedAt?: number
  approvedBy?: { id: string; name: string }
}

export interface ReviewReply {
  id: string
  authorKind: ReviewActorKind
  authorId: string
  authorName: string
  authorColorToken: string
  text: string
  /** Optional/additive — anexos de imagem (data URLs) na resposta. */
  images?: string[]
  createdAt: number
}

/**
 * Where a comment was authored. Defaults to a normal page pin/draw ("page").
 * "ux-flow" comments are dropped on a styleguide UX-flow diagram node — they
 * carry a `flowRef` and are rendered by the flow editor (not the review
 * canvas, whose document-coord pins would drift on the zoom/pan canvas).
 */
export type ReviewCommentOrigin = "page" | "ux-flow" | "backlog"

export interface ReviewFlowRef {
  /** Flow slug, e.g. "primeiro-acesso". */
  flow: string
  /** Anchored node id in the diagram, when the comment targets a specific node. */
  nodeId?: string
  /** Human label of the anchored node (title), for display in the review inbox. */
  nodeLabel?: string
  /** Position in flow-canvas coordinates where the marker sits. */
  position?: ReviewPoint
}

export interface ReviewComment {
  id: string
  schemaVersion: 3
  authorId: string
  authorName: string
  authorColorToken: string
  createdAt: number
  updatedAt: number
  url: string
  viewportWidth: number
  viewportHeight: number
  scrollY: number
  documentHeight: number
  anchor: ReviewAnchor
  context?: ReviewCommentContext
  text: string
  images?: string[]
  status: ReviewCommentStatus
  resolution?: ReviewResolution
  replies?: ReviewReply[]
  /** Defaults to "page" when absent. */
  origin?: ReviewCommentOrigin
  /** Present when origin === "ux-flow". */
  flowRef?: ReviewFlowRef
}

export interface ReviewExportPayload {
  schemaVersion: 3
  exportedAt: number
  exportedBy: ReviewIdentity
  comments: ReviewComment[]
  archivedComments?: ReviewComment[]
}

// ── Mobbin search (mirror de review-bridge/src/types.ts) ─────────────────────
// "Buscar designs parecidos no Mobbin" no composer. O pedido vai pro bridge, o
// agente resolve via MCP e devolve. Efêmero — nunca entra num ReviewComment; só
// a IMAGEM escolhida vira anexo (images[]).
export type MobbinPlatform = "ios" | "web"

export interface MobbinScreenResult {
  id: string
  imageUrl: string
  mobbinUrl: string
  appName: string
  platform: MobbinPlatform
}

export type MobbinSearchStatus = "pending" | "done" | "error"

export interface MobbinSearch {
  id: string
  query: string
  platform: MobbinPlatform
  page: string
  element?: {
    tag?: string
    role?: string
    label?: string
    text?: string
    selector?: string
  }
  status: MobbinSearchStatus
  results: MobbinScreenResult[]
  error?: string
  createdAt: number
  updatedAt: number
}
