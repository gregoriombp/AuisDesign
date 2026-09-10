"use client"

import { create } from "zustand"
import { ServerlessReview } from "@/components/auis-review/storage/serverless"
import type { ReviewStorage } from "@/components/auis-review/storage/types"
import { makeId } from "@/components/auis-review/storage/utils"
import { buildReviewCommentContext } from "@/lib/auis-review/elementContext"
import { snapshotRevealTrail } from "@/lib/auis-review/revealTrail"
import type {
  ReviewActor,
  ReviewAnchor,
  ReviewComment,
  ReviewDrawAnchor,
  ReviewDrawPath,
  ReviewElementAnchor,
  ReviewIdentity,
  ReviewMode,
  ReviewPoint,
  ReviewReply,
} from "@/components/auis-review/types"
import {
  DEFAULT_STROKE_WIDTH,
  REVIEW_PALETTE,
  SCHEMA_VERSION,
} from "@/components/auis-review/constants"

/** Role of the session on the bridge — mirror of GET /api/review-bridge/session.
 *  It only ADAPTS the UI (hide approve/reject, agent mentions, privacy); the real
 *  permission is re-checked on the server on every write. */
export type BridgeSessionRole = "admin" | "reviewer" | "agent"

const storage = new ServerlessReview()

function identityToActor(identity: ReviewIdentity | null): ReviewActor | null {
  if (!identity) return null
  return { kind: "user", id: identity.id, name: identity.name }
}

const ANONYMOUS_ACTOR: ReviewActor = { kind: "user", id: "anonymous", name: "Anonymous" }

// Saved review accounts (multi-account). The CURRENT identity still lives in the
// storage backend; the LIST of known accounts lives only in the browser's
// localStorage — a local convenience to switch/add reviewers from the dot,
// with no new API.
const ACCOUNTS_STORAGE_KEY = "auis-review:accounts"

function loadAccounts(): ReviewIdentity[] {
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(ACCOUNTS_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (a) =>
        a &&
        typeof a.id === "string" &&
        typeof a.name === "string" &&
        typeof a.colorToken === "string"
    ) as ReviewIdentity[]
  } catch {
    return []
  }
}

function persistAccounts(list: ReviewIdentity[]): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(list))
  } catch {
    /* storage full/unavailable — silent, it is only a convenience */
  }
}

type ReviewState = {
  storage: ReviewStorage

  active: boolean
  mode: ReviewMode
  sheetOpen: boolean
  exportOpen: boolean
  identity: ReviewIdentity | null
  /** E-mail of the AUTHENTICATED session, when the deployment has an auth
   *  provider — stamps comments/replies with the real authorship, independent
   *  of the display identity chosen. Null without auth. */
  sessionEmail: string | null
  /** Role resolved on the server (admin/reviewer/agent). null = loading. */
  sessionRole: BridgeSessionRole | null
  /** true when the session e-mail is an account SHARED between people — forces
   *  the "who are you?" prompt instead of adopting the session identity. */
  sessionShared: boolean
  /** GET /session answered (or resolved locally). */
  sessionReady: boolean
  identityModalOpen: boolean
  identityHydrated: boolean
  /** Review accounts saved in this browser (the current one is `identity`). */
  accounts: ReviewIdentity[]
  /** "edit" reuses the current identity; "new" forces creating another account. */
  identityDraftMode: "edit" | "new"

  drawingPath: ReviewPoint[] | null
  pendingAnchor: ReviewAnchor | null

  comments: ReviewComment[]
  archivedComments: ReviewComment[]
  archiveCursor?: number
  archiveLoaded: boolean
  selectedCommentId: string | null
  /** Comment whose anchored thread popover is open. Mutually exclusive with the sheet. */
  threadCommentId: string | null

  toggleActive: () => void
  setActive: (active: boolean) => void
  setMode: (mode: ReviewMode) => void
  cycleMode: () => void
  toggleSheet: () => void
  setSheetOpen: (open: boolean) => void
  setExportOpen: (open: boolean) => void
  /** Open the Figma-style thread popover anchored to a comment's pin. */
  openThread: (id: string) => void
  closeThread: () => void

  hydrateIdentity: () => Promise<void>
  /** Fetches the session role/flags from the server (idempotent, single-flight). */
  hydrateSession: () => Promise<void>
  setIdentity: (name: string, colorToken: string, email?: string) => Promise<void>
  closeIdentityModal: () => void
  /** Opens the identity modal in edit mode (default) or creation mode. */
  openIdentityModal: (mode?: "edit" | "new") => void
  /** Shortcut: opens the modal already in "new account" mode. */
  addAccount: () => void
  /** Swaps the current identity for one of the saved accounts (by id). */
  switchIdentity: (id: string) => Promise<void>
  /** Adopts an identity coming from an authenticated session when the browser
   *  has no review account yet. Deployments with an auth provider call this
   *  once the session resolves; Auis ships without one. */
  adoptSessionIdentity: (input: { id: string; name: string }) => Promise<void>
  /** Records the session e-mail (null when signed out / no auth). */
  setSessionEmail: (email: string | null) => void

  startDraw: (point: ReviewPoint, colorToken: string) => void
  appendDrawPoint: (point: ReviewPoint) => void
  endDraw: (el?: ReviewDrawAnchor) => void
  placePin: (point: ReviewPoint, el?: ReviewElementAnchor) => void
  cancelPending: () => void
  saveComment: (
    text: string,
    images?: string[],
    opts?: { visibility?: "admins" }
  ) => Promise<void>

  selectComment: (id: string | null) => void

  /** User marks something as resolved without going through in_review — moves straight to archive. */
  archiveDirect: (id: string) => Promise<void>
  /** Agent path. Called via API from outside; surfaced here for completeness/testing. */
  markInReview: (id: string, actor: ReviewActor) => Promise<void>
  approveComment: (id: string) => Promise<void>
  rejectComment: (id: string) => Promise<void>
  reopenFromArchive: (id: string) => Promise<void>
  addReply: (id: string, text: string, images?: string[]) => Promise<ReviewReply | null>
  /** Edits the text/images of an existing reply (marks it "edited"). */
  editReply: (commentId: string, replyId: string, text: string, images?: string[]) => Promise<void>
  /** Edits the text/images of an existing comment, preserving everything else. */
  editComment: (id: string, text: string, images?: string[]) => Promise<void>
  /** Creates a standalone "future idea" (no pin) — goes to the backlog tab. */
  addBacklogIdea: (text: string, images?: string[]) => Promise<void>
  /** Moves an existing comment to the backlog (becomes a "future idea"). */
  moveToBacklog: (id: string) => Promise<void>
  /** Takes it out of the backlog, back to "open". */
  restoreFromBacklog: (id: string) => Promise<void>
  deleteComment: (id: string) => Promise<void>
  refreshFromStorage: () => Promise<void>
  loadArchivePage: (reset?: boolean) => Promise<void>
}

function centroidOf(points: ReviewPoint[]): ReviewPoint {
  if (points.length === 0) return { x: 50, y: 50 }
  const sum = points.reduce(
    (acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }),
    { x: 0, y: 0 }
  )
  return { x: sum.x / points.length, y: sum.y / points.length }
}

// Round to whole px: raw float precision on a freehand stroke is sub-pixel
// (invisible) but bloats the anchor in the JSON.
function quantizePoint(p: ReviewPoint): ReviewPoint {
  return { x: Math.round(p.x), y: Math.round(p.y) }
}
// Reflow fractions (0..1): 4 decimals = sub-pixel on any viewport.
const round4 = (n: number) => Math.round(n * 1e4) / 1e4
function quantizeDrawAnchor(el: ReviewDrawAnchor): ReviewDrawAnchor {
  return { ...el, points: el.points.map((p) => ({ fx: round4(p.fx), fy: round4(p.fy) })) }
}

// Deterministic color per session id: the same person gets the same
// REVIEW_PALETTE token on any browser/machine (no shared state).
function sessionColorToken(id: string): string {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return REVIEW_PALETTE[h % REVIEW_PALETTE.length].token
}

// Single-flight for GET /session — several mounts may ask; only the first one
// goes to the network.
let sessionInflight: Promise<void> | null = null

export const useReviewStore = create<ReviewState>()((set, get) => ({
  storage,

  active: false,
  mode: "cursor",
  sheetOpen: false,
  exportOpen: false,
  identity: null,
  sessionEmail: null,
  sessionRole: null,
  sessionShared: false,
  sessionReady: false,
  identityModalOpen: false,
  identityHydrated: false,
  accounts: [],
  identityDraftMode: "edit",

  drawingPath: null,
  pendingAnchor: null,

  comments: [],
  archivedComments: [],
  archiveCursor: undefined,
  archiveLoaded: false,
  selectedCommentId: null,
  threadCommentId: null,

  toggleActive: () => {
    const next = !get().active
    set({ active: next })
    if (next) {
      const { identity } = get()
      if (!identity) set({ identityModalOpen: true })
      void get().refreshFromStorage()
    } else {
      set({
        mode: "cursor",
        drawingPath: null,
        pendingAnchor: null,
        sheetOpen: false,
        exportOpen: false,
        selectedCommentId: null,
        threadCommentId: null,
      })
    }
  },

  setActive: (active) => set({ active }),

  setMode: (mode) =>
    set({
      mode,
      drawingPath: null,
      pendingAnchor: null,
    }),

  cycleMode: () => {
    const order: ReviewMode[] = ["cursor", "draw", "pin", "magic"]
    const idx = order.indexOf(get().mode)
    set({
      mode: order[(idx + 1) % order.length],
      drawingPath: null,
      pendingAnchor: null,
    })
  },

  // The sheet and the anchored thread popover are mutually exclusive — opening
  // one dismisses the other so a comment never shows in two places at once.
  toggleSheet: () =>
    set((s) => ({ sheetOpen: !s.sheetOpen, threadCommentId: null })),
  setSheetOpen: (open) =>
    set(open ? { sheetOpen: true, threadCommentId: null } : { sheetOpen: false }),
  setExportOpen: (open) => set({ exportOpen: open }),
  openThread: (id) =>
    set({ threadCommentId: id, selectedCommentId: id, sheetOpen: false }),
  closeThread: () => set({ threadCommentId: null }),

  hydrateIdentity: async () => {
    try {
      const identity = await get().storage.getIdentity()
      let accounts = loadAccounts()
      // Installs that predate multi-account only had the current identity:
      // make sure it shows up in the saved accounts list.
      if (identity && !accounts.some((a) => a.id === identity.id)) {
        accounts = [...accounts, identity]
        persistAccounts(accounts)
      }
      set({ identity, accounts, identityHydrated: true })
    } catch (e) {
      console.warn("[review] failed to hydrate identity:", e)
      set({ identityHydrated: true })
    }
  },

  hydrateSession: async () => {
    if (get().sessionReady) return
    if (sessionInflight) return sessionInflight
    sessionInflight = (async () => {
      try {
        const res = await fetch("/api/review-bridge/session", { cache: "no-store" })
        if (!res.ok) throw new Error(`session_${res.status}`)
        const data = (await res.json()) as {
          role?: BridgeSessionRole
          shared?: boolean
          email?: string | null
        }
        set({
          sessionRole: data.role ?? null,
          sessionShared: Boolean(data.shared),
          sessionEmail: typeof data.email === "string" ? data.email : null,
          sessionReady: true,
        })
      } catch {
        // Route down / network: fail CLOSED (null = treated as non-admin in
        // the UI); the server re-checks for real on every write.
        set({ sessionReady: true })
      } finally {
        sessionInflight = null
      }
    })()
    return sessionInflight
  },

  setIdentity: async (name, colorToken, email) => {
    const trimmed = name.trim()
    if (!trimmed) return
    const trimmedEmail = email?.trim() || undefined
    const { identity: existing, identityDraftMode, accounts } = get()
    // "new" mode creates another account even when one is current; otherwise
    // it edits the current one keeping the id (preserves the authorship of
    // comments already made). The "rev-member" prefix marks an identity
    // created by a real person — only those enter the @mention list (see
    // /api/review-bridge/reviewers).
    const isNew = identityDraftMode === "new" || !existing
    const identity: ReviewIdentity = isNew
      ? {
          id: makeId("rev-member"),
          name: trimmed,
          colorToken,
          ...(trimmedEmail ? { email: trimmedEmail } : {}),
          createdAt: Date.now(),
        }
      : (() => {
          const next: ReviewIdentity = { ...existing, name: trimmed, colorToken }
          if (trimmedEmail) next.email = trimmedEmail
          else delete next.email
          return next
        })()
    await get().storage.setIdentity(identity)
    const nextAccounts = isNew
      ? [...accounts, identity]
      : accounts.map((a) => (a.id === identity.id ? identity : a))
    if (!nextAccounts.some((a) => a.id === identity.id)) nextAccounts.push(identity)
    persistAccounts(nextAccounts)
    set({
      identity,
      accounts: nextAccounts,
      identityModalOpen: false,
      identityDraftMode: "edit",
    })
  },

  closeIdentityModal: () => {
    if (!get().identity) {
      set({ identityModalOpen: false, active: false, identityDraftMode: "edit" })
      return
    }
    set({ identityModalOpen: false, identityDraftMode: "edit" })
  },

  openIdentityModal: (mode = "edit") =>
    set({ identityModalOpen: true, identityDraftMode: mode }),

  addAccount: () => set({ identityModalOpen: true, identityDraftMode: "new" }),

  switchIdentity: async (id) => {
    const account = get().accounts.find((a) => a.id === id)
    if (!account || account.id === get().identity?.id) return
    await get().storage.setIdentity(account)
    set({ identity: account })
  },

  // Only acts when the browser has NO identity yet: whoever already reviewed
  // here (historic rev-… id) keeps continuous authorship; a new reviewer is
  // born with the session account instead of the manual modal.
  adoptSessionIdentity: async ({ id, name }) => {
    const { identityHydrated, identity, accounts } = get()
    if (!identityHydrated || identity) return
    const trimmed = name.trim()
    if (!trimmed) return
    const known = accounts.find((a) => a.id === id)
    const adopted: ReviewIdentity = known
      ? { ...known, name: trimmed }
      : { id, name: trimmed, colorToken: sessionColorToken(id), createdAt: Date.now() }
    await get().storage.setIdentity(adopted)
    const nextAccounts = known
      ? accounts.map((a) => (a.id === id ? adopted : a))
      : [...accounts, adopted]
    persistAccounts(nextAccounts)
    set({ identity: adopted, accounts: nextAccounts })
  },

  setSessionEmail: (email) => {
    if (get().sessionEmail !== email) set({ sessionEmail: email })
  },

  startDraw: (point, colorToken) => {
    set({
      drawingPath: [point],
      pendingAnchor: null,
    })
    void colorToken
  },

  appendDrawPoint: (point) => {
    const path = get().drawingPath
    if (!path) return
    const last = path[path.length - 1]
    if (last && Math.abs(last.x - point.x) < 0.05 && Math.abs(last.y - point.y) < 0.05) {
      return
    }
    set({ drawingPath: [...path, point] })
  },

  endDraw: (el) => {
    const path = get().drawingPath
    const identity = get().identity
    if (!path || path.length < 2 || !identity) {
      set({ drawingPath: null })
      return
    }
    // Quantize the points before persisting: a freehand stroke has ~350 points
    // and raw float precision changes nothing visually (sub-pixel) but doubles
    // or triples the anchor's weight in the JSON. px -> integer, fractions -> 4 decimals.
    const drawPath: ReviewDrawPath = {
      points: path.map(quantizePoint),
      strokeColorToken: identity.colorToken,
      strokeWidth: DEFAULT_STROKE_WIDTH,
    }
    const anchor: ReviewAnchor = {
      kind: "draw",
      path: drawPath,
      centroid: quantizePoint(centroidOf(path)),
      ...(el ? { el: quantizeDrawAnchor(el) } : {}),
    }
    set({ drawingPath: null, pendingAnchor: anchor })
  },

  placePin: (point, el) => {
    if (!get().identity) return
    set({
      pendingAnchor: { kind: "pin", position: point, ...(el ? { el } : {}) },
      drawingPath: null,
    })
  },

  cancelPending: () =>
    set({ drawingPath: null, pendingAnchor: null, mode: "cursor" }),

  saveComment: async (text, images, opts) => {
    const trimmed = text.trim()
    const { pendingAnchor, identity, storage, sessionEmail } = get()
    if ((!trimmed && (!images || images.length === 0)) || !pendingAnchor || !identity) return
    if (typeof window === "undefined") return
    const now = Date.now()
    const params = new URLSearchParams(window.location.search)
    params.delete("reviewCommentId")
    const cleanSearch = params.toString()
    // Reveal trail: if the pin was dropped inside a modal/drawer/tab, record the
    // clicks that opened that state so it can be re-opened on focus later.
    const revealPath = snapshotRevealTrail(window.location.pathname)
    const comment: ReviewComment = {
      id: makeId("cmt"),
      schemaVersion: SCHEMA_VERSION as 3,
      authorKind: "user",
      authorId: identity.id,
      authorName: identity.name,
      authorColorToken: identity.colorToken,
      ...(sessionEmail ? { authorEmail: sessionEmail } : {}),
      createdAt: now,
      updatedAt: now,
      url: cleanSearch
        ? `${window.location.pathname}?${cleanSearch}`
        : window.location.pathname,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      scrollY: window.scrollY,
      documentHeight: document.documentElement.scrollHeight,
      anchor: pendingAnchor,
      context: buildReviewCommentContext(pendingAnchor),
      text: trimmed,
      ...(images && images.length > 0 ? { images } : {}),
      ...(revealPath.length > 0 ? { revealPath } : {}),
      // "Admins only": the server validates (a reviewer cannot even ask).
      ...(opts?.visibility === "admins" ? { visibility: "admins" as const } : {}),
      status: "open",
    }
    await storage.saveComment(comment)
    set({ pendingAnchor: null, mode: "cursor" })
    await get().refreshFromStorage()
  },

  selectComment: (id) => set({ selectedCommentId: id }),

  archiveDirect: async (id) => {
    const { storage, identity } = get()
    const actor = identityToActor(identity) ?? ANONYMOUS_ACTOR
    if (storage.transitionComment) {
      await storage.transitionComment(id, "resolve_direct", actor)
    } else {
      // legacy fallback: mark resolved via saveComment
      const existing = await storage.getComment(id)
      if (!existing) return
      await storage.saveComment({
        ...existing,
        status: "resolved",
        updatedAt: Date.now(),
      })
    }
    if (get().selectedCommentId === id) set({ selectedCommentId: null })
    if (get().threadCommentId === id) set({ threadCommentId: null })
    await get().refreshFromStorage()
  },

  markInReview: async (id, actor) => {
    const { storage } = get()
    if (storage.transitionComment) {
      await storage.transitionComment(id, "in_review", actor)
    }
    await get().refreshFromStorage()
  },

  approveComment: async (id) => {
    const { storage, identity } = get()
    const actor = identityToActor(identity) ?? ANONYMOUS_ACTOR
    if (storage.transitionComment) {
      await storage.transitionComment(id, "approve", actor)
    }
    if (get().selectedCommentId === id) set({ selectedCommentId: null })
    if (get().threadCommentId === id) set({ threadCommentId: null })
    await get().refreshFromStorage()
  },

  rejectComment: async (id) => {
    const { storage, identity } = get()
    const actor = identityToActor(identity) ?? ANONYMOUS_ACTOR
    if (storage.transitionComment) {
      await storage.transitionComment(id, "reject", actor)
    }
    await get().refreshFromStorage()
  },

  reopenFromArchive: async (id) => {
    const { storage, identity } = get()
    const actor = identityToActor(identity) ?? ANONYMOUS_ACTOR
    if (storage.transitionComment) {
      await storage.transitionComment(id, "reopen_from_archive", actor)
    }
    await get().refreshFromStorage()
    await get().loadArchivePage(true)
  },

  addReply: async (id, text, images) => {
    const trimmed = text.trim()
    if (!trimmed && (!images || images.length === 0)) return null
    const { storage, identity, sessionEmail } = get()
    if (!storage.addReply || !identity) return null
    const reply = await storage.addReply(id, {
      authorKind: "user",
      authorId: identity.id,
      authorName: identity.name,
      authorColorToken: identity.colorToken,
      ...(sessionEmail ? { authorEmail: sessionEmail } : {}),
      text: trimmed,
      ...(images && images.length > 0 ? { images } : {}),
    })
    await get().refreshFromStorage()
    return reply
  },

  editReply: async (commentId, replyId, text, images) => {
    const trimmed = text.trim()
    if (!trimmed) return
    const { storage } = get()
    if (!storage.editReply) return
    await storage.editReply(commentId, replyId, {
      text: trimmed,
      ...(images === undefined ? {} : { images }),
    })
    await get().refreshFromStorage()
  },

  editComment: async (id, text, images) => {
    const trimmed = text.trim()
    const { storage } = get()
    const existing =
      get().comments.find((c) => c.id === id) ??
      get().archivedComments.find((c) => c.id === id) ??
      (await storage.getComment(id))
    if (!existing) return
    // images === undefined → keep the current ones; array (even empty) → replace.
    const nextImages = images === undefined ? existing.images : images
    const updated: ReviewComment = {
      ...existing,
      text: trimmed,
      updatedAt: Date.now(),
    }
    if (nextImages && nextImages.length > 0) updated.images = nextImages
    else delete updated.images
    await storage.saveComment(updated)
    await get().refreshFromStorage()
  },

  addBacklogIdea: async (text, images) => {
    const trimmed = text.trim()
    const { storage, identity, sessionEmail } = get()
    if ((!trimmed && (!images || images.length === 0)) || !identity) return
    if (typeof window === "undefined") return
    const now = Date.now()
    const comment: ReviewComment = {
      id: makeId("cmt"),
      schemaVersion: SCHEMA_VERSION as 3,
      authorKind: "user",
      authorId: identity.id,
      authorName: identity.name,
      authorColorToken: identity.colorToken,
      ...(sessionEmail ? { authorEmail: sessionEmail } : {}),
      createdAt: now,
      updatedAt: now,
      url: window.location.pathname,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      scrollY: 0,
      documentHeight: 0,
      // Sentinel anchor: passes validation but NEVER becomes a pin — the canvas
      // skips origin "backlog". A future idea is standalone, not pinned to an element.
      anchor: { kind: "pin", position: { x: 0, y: 0 } },
      text: trimmed,
      ...(images && images.length > 0 ? { images } : {}),
      status: "backlog",
      origin: "backlog",
    }
    await storage.saveComment(comment)
    await get().refreshFromStorage()
  },

  moveToBacklog: async (id) => {
    const { storage } = get()
    const existing =
      get().comments.find((c) => c.id === id) ?? (await storage.getComment(id))
    if (!existing) return
    await storage.saveComment({ ...existing, status: "backlog", updatedAt: Date.now() })
    if (get().selectedCommentId === id) set({ selectedCommentId: null })
    if (get().threadCommentId === id) set({ threadCommentId: null })
    await get().refreshFromStorage()
  },

  restoreFromBacklog: async (id) => {
    const { storage } = get()
    const existing =
      get().comments.find((c) => c.id === id) ?? (await storage.getComment(id))
    if (!existing) return
    await storage.saveComment({ ...existing, status: "open", updatedAt: Date.now() })
    await get().refreshFromStorage()
  },

  deleteComment: async (id) => {
    await get().storage.deleteComment(id)
    if (get().selectedCommentId === id) set({ selectedCommentId: null })
    if (get().threadCommentId === id) set({ threadCommentId: null })
    await get().refreshFromStorage()
  },

  refreshFromStorage: async () => {
    try {
      const comments = await get().storage.listComments()
      set({ comments })
    } catch (e) {
      console.warn("[review] failed to load comments:", e)
    }
  },

  loadArchivePage: async (reset = true) => {
    const { storage, archiveCursor, archivedComments } = get()
    if (!storage.listArchive) {
      set({ archivedComments: [], archiveCursor: undefined, archiveLoaded: true })
      return
    }
    const filter = reset
      ? { limit: 50 }
      : { limit: 50, ...(archiveCursor ? { before: archiveCursor } : {}) }
    const page = await storage.listArchive(filter)
    const merged = reset ? page.comments : [...archivedComments, ...page.comments]
    set({
      archivedComments: merged,
      archiveCursor: page.nextCursor,
      archiveLoaded: true,
    })
  },
}))
