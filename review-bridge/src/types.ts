export type ReviewMode = "cursor" | "draw" | "pin"

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

// Element-relative anchors (mirror of components/auis-review/types.ts).
// Additive/optional: they let a pin or stroke re-resolve to the element it was
// dropped on, so it follows reflow + zoom. The server stores them verbatim.
export interface ReviewAnchorFingerprint {
  tag: string
  text?: string
}

export interface ReviewElementAnchor {
  selector: string
  fx: number
  fy: number
  fingerprint?: ReviewAnchorFingerprint
}

export interface ReviewDrawAnchor {
  selector: string
  points: { fx: number; fy: number }[]
  fingerprint?: ReviewAnchorFingerprint
}

export type ReviewAnchor =
  | { kind: "pin"; position: ReviewPoint; el?: ReviewElementAnchor }
  | {
      kind: "draw"
      path: ReviewDrawPath
      centroid: ReviewPoint
      el?: ReviewDrawAnchor
    }

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

export type ReviewCommentStatus = "open" | "in_review" | "resolved" | "backlog"

export type ReviewActorKind = "agent" | "user"

export interface ReviewActor {
  kind: ReviewActorKind
  id: string
  name: string
}

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

export const REVIEW_SCHEMA_VERSION = 3

// Mirror of the client type (components/auis-review/types.ts). "ux-flow"
// comments come from the styleguide flow editor; the server just stores the
// extra optional fields verbatim (additive — no schema bump).
export type ReviewCommentOrigin = "page" | "ux-flow" | "backlog"

export interface ReviewFlowRef {
  flow: string
  nodeId?: string
  nodeLabel?: string
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
  origin?: ReviewCommentOrigin
  flowRef?: ReviewFlowRef
}

export interface ReviewExportPayload {
  schemaVersion: 3
  exportedAt: number
  exportedBy: ReviewIdentity
  comments: ReviewComment[]
  archivedComments?: ReviewComment[]
}

// ── Mobbin search (transient, in-memory) ─────────────────────────────────────
// "Buscar designs parecidos no Mobbin" do composer do Review Mode. O app não
// alcança o Mobbin (o MCP vive no ambiente do agente), então enfileira um pedido
// aqui; o agente lê, roda o search via MCP e devolve os resultados. Nada disso
// entra no store de comentários — é efêmero, só vive em memória no bridge.
export type MobbinPlatform = "ios" | "web"

export interface MobbinScreenResult {
  id: string
  imageUrl: string
  mobbinUrl: string
  appName: string
  platform: MobbinPlatform
}

export type MobbinSearchStatus = "pending" | "done" | "error"

export interface MobbinSearchElement {
  tag?: string
  role?: string
  label?: string
  text?: string
  selector?: string
}

export interface MobbinSearch {
  id: string
  query: string
  platform: MobbinPlatform
  page: string
  element?: MobbinSearchElement
  status: MobbinSearchStatus
  results: MobbinScreenResult[]
  error?: string
  createdAt: number
  updatedAt: number
}

export type BridgeEvent =
  | { kind: "comment.upserted"; comment: ReviewComment }
  | { kind: "comment.deleted"; id: string }
  | { kind: "comment.archived"; comment: ReviewComment }
  | { kind: "comment.unarchived"; comment: ReviewComment }
  | { kind: "reply.added"; commentId: string; reply: ReviewReply }
  | { kind: "mobbin.requested"; search: MobbinSearch }
  | { kind: "mobbin.resolved"; search: MobbinSearch }
  | { kind: "hello"; serverStartedAt: number }

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}

/**
 * Server timezone. The summary string is meant to be human-readable inside
 * the team — DD/MM/YYYY, hour-of-day from server clock. Documented in README.
 */
export function formatResolutionSummary(actor: ReviewActor, at: number): string {
  const d = new Date(at)
  const day = pad2(d.getDate())
  const month = pad2(d.getMonth() + 1)
  const year = d.getFullYear()
  const hours = pad2(d.getHours())
  const minutes = pad2(d.getMinutes())
  const seconds = pad2(d.getSeconds())
  return `Resolvido por ${actor.name} em ${day}/${month}/${year} às ${hours}:${minutes}:${seconds}.`
}
