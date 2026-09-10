export type ReviewMode = "cursor" | "draw" | "pin" | "magic"

export interface ReviewIdentity {
  id: string
  name: string
  colorToken: string
  /** Personal e-mail (distinct from a shared session e-mail). */
  email?: string
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
 * Identity hint for the anchored element: tag + a slice of its text. When the
 * structural `selector` (nth-of-type) shifts — a collapsible sidebar mounting,
 * or a breakpoint-conditional render that changes the sibling indices — it can
 * resolve the WRONG element (or none). The fingerprint recovers the target: if
 * the selector fails or diverges, we look for an element with the same tag and
 * the same text. Optional/additive — older anchors without it still rely on the
 * selector alone.
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

/**
 * One click that re-opens an overlay (modal / drawer / tab) on the way to the
 * pin. Same fingerprint fallback as the anchors. Without a path the pin is
 * shown bare.
 */
export interface ReviewRevealStep {
  selector: string
  fingerprint?: ReviewAnchorFingerprint
  /** Text of the trigger — for the inbox / debugging, never used to match. */
  label?: string
}

export interface ReviewElementContext {
  tag: string
  role?: string
  label?: string
  text?: string
  selector?: string
  /** Ancestor landmarks ("Modal: … › Section: …") — see `describeLocation`. */
  location?: string
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
  /** Persisted landmark trail, outermost → innermost, at most 4 steps. */
  location?: string[]
}

// "backlog" = "future idea": a standalone item (no pin) or a comment moved into
// a backlog. It never becomes a pin on the canvas and never counts as "open";
// it lives in its own tab.
export type ReviewCommentStatus = "open" | "in_review" | "resolved" | "backlog"

export type ReviewActorKind = "agent" | "user"

/**
 * Role of the SESSION that authored a record, stamped by the server. Only an
 * admin dispatches agents, approves or archives. Legacy records without the
 * field go through `effectiveAuthorRole`. Auis ships without an auth
 * provider, so every local session is an admin — the field keeps the data
 * model ready for a hierarchy when one is wired in.
 */
export type ReviewAuthorRole = "admin" | "reviewer"

/** Absent = "team". "admins" is filtered on the server for reviewers. */
export type ReviewCommentVisibility = "team" | "admins"

export interface ReviewActor {
  kind: ReviewActorKind
  id: string
  name: string
}

/**
 * Per-agent operating permissions for the Review Bridge, toggled from the
 * floating Auis dot and read by the dispatcher. The toggle IS the permission —
 * no directive in the comment text is needed.
 * - liveResponse: the agent may reply in-thread when mentioned (talk only).
 * - autoConstruct: the agent may ACT (run a skill, edit, send to review).
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
  /** Session e-mail — independent of the displayed identity. */
  authorEmail?: string
  authorRole?: ReviewAuthorRole
  text: string
  /** Optional/additive — image attachments (data URLs or bridge image refs). */
  images?: string[]
  createdAt: number
  editedAt?: number
}

/**
 * Where a comment was authored. Defaults to a normal page pin/draw ("page").
 * "ux-flow" comments are dropped on a UX-flow diagram node — they carry a
 * `flowRef` and are rendered by the flow editor (not the review canvas, whose
 * document-coord pins would drift on the zoom/pan canvas).
 */
export type ReviewCommentOrigin = "page" | "ux-flow" | "backlog"

export interface ReviewFlowRef {
  /** Flow slug, e.g. "checkout-review". */
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
  /** Explicit for new records; absent on legacy comments and inferred by id. */
  authorKind?: ReviewActorKind
  authorId: string
  authorName: string
  authorColorToken: string
  authorEmail?: string
  authorRole?: ReviewAuthorRole
  visibility?: ReviewCommentVisibility
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
  /** Overlay replay up to the pin. Absent for always-visible content. */
  revealPath?: ReviewRevealStep[]
}

export interface ReviewExportPayload {
  schemaVersion: 3
  exportedAt: number
  exportedBy: ReviewIdentity
  comments: ReviewComment[]
  archivedComments?: ReviewComment[]
}
