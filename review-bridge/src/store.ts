import path from "node:path"
import fs from "node:fs"
import { JSONFile } from "lowdb/node"
import { Low } from "lowdb"
import {
  formatResolutionSummary,
  REVIEW_SCHEMA_VERSION,
  type ReviewActor,
  type ReviewComment,
  type ReviewCommentStatus,
  type ReviewExportPayload,
  type ReviewIdentity,
  type ReviewReply,
} from "./types.js"

interface MainDbShape {
  schemaVersion: number
  comments: ReviewComment[]
  identities: ReviewIdentity[]
}

interface ArchiveDbShape {
  schemaVersion: number
  comments: ReviewComment[]
}

const DEFAULT_MAIN: MainDbShape = {
  schemaVersion: REVIEW_SCHEMA_VERSION,
  comments: [],
  identities: [],
}

const DEFAULT_ARCHIVE: ArchiveDbShape = {
  schemaVersion: REVIEW_SCHEMA_VERSION,
  comments: [],
}

const DATA_DIR = path.resolve(process.cwd(), "data")
const MAIN_FILE = path.join(DATA_DIR, "comments.json")
const ARCHIVE_FILE = path.join(DATA_DIR, "comments.archive.json")

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true })
}

const mainAdapter = new JSONFile<MainDbShape>(MAIN_FILE)
const mainDb = new Low<MainDbShape>(mainAdapter, DEFAULT_MAIN)

const archiveAdapter = new JSONFile<ArchiveDbShape>(ARCHIVE_FILE)
const archiveDb = new Low<ArchiveDbShape>(archiveAdapter, DEFAULT_ARCHIVE)

function makeReplyId(): string {
  const t = Date.now().toString(36)
  const r = Math.random().toString(36).slice(2, 8)
  return `rep-${t}-${r}`
}

/**
 * v2 had `resolvedBy: string` and `resolvedAt: number`. Normalize into the
 * structured `resolution` so older agents/clients that wrote v2 still load.
 */
function toEpochMs(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string") {
    const n = Date.parse(value)
    if (Number.isFinite(n)) return n
  }
  return Date.now()
}

function migrateComment(raw: ReviewComment & { resolvedBy?: string; resolvedAt?: number }): ReviewComment {
  const migrated: ReviewComment = {
    ...raw,
    schemaVersion: REVIEW_SCHEMA_VERSION,
    createdAt: toEpochMs(raw.createdAt),
    updatedAt: toEpochMs(raw.updatedAt),
  }
  // legacy "resolved" with flat resolvedBy field
  const legacyResolvedBy = (raw as { resolvedBy?: string }).resolvedBy
  const legacyResolvedAt = (raw as { resolvedAt?: number }).resolvedAt
  if (!migrated.resolution && legacyResolvedBy) {
    const at = legacyResolvedAt ?? Date.now()
    const actor: ReviewActor = {
      kind: "user",
      id: "legacy",
      name: legacyResolvedBy,
    }
    migrated.resolution = {
      actor,
      at,
      summary: formatResolutionSummary(actor, at),
    }
  }
  // strip legacy fields
  delete (migrated as { resolvedBy?: string }).resolvedBy
  delete (migrated as { resolvedAt?: number }).resolvedAt
  if (!Array.isArray(migrated.replies)) {
    delete migrated.replies
  }
  return migrated
}

export async function initDb(): Promise<void> {
  await mainDb.read()
  await archiveDb.read()
  if (!mainDb.data) mainDb.data = { ...DEFAULT_MAIN }
  if (!archiveDb.data) archiveDb.data = { ...DEFAULT_ARCHIVE }
  if (!Array.isArray(mainDb.data.comments)) mainDb.data.comments = []
  if (!Array.isArray(mainDb.data.identities)) mainDb.data.identities = []
  if (!Array.isArray(archiveDb.data.comments)) archiveDb.data.comments = []

  // Migrate v2 → v3: split "resolved" into archive
  const isMainStale =
    mainDb.data.schemaVersion !== REVIEW_SCHEMA_VERSION ||
    mainDb.data.comments.some((c) => (c as { resolvedBy?: string }).resolvedBy)
  if (isMainStale) {
    const stillOpen: ReviewComment[] = []
    const archivedFromMain: ReviewComment[] = []
    for (const raw of mainDb.data.comments) {
      const migrated = migrateComment(raw)
      if (migrated.status === "resolved") {
        archivedFromMain.push(migrated)
      } else {
        stillOpen.push(migrated)
      }
    }
    mainDb.data.comments = stillOpen
    mainDb.data.schemaVersion = REVIEW_SCHEMA_VERSION

    if (archivedFromMain.length > 0) {
      const archiveById = new Map(archiveDb.data.comments.map((c) => [c.id, c]))
      for (const c of archivedFromMain) {
        archiveById.set(c.id, c)
      }
      archiveDb.data.comments = Array.from(archiveById.values())
      archiveDb.data.schemaVersion = REVIEW_SCHEMA_VERSION
      await archiveDb.write()
    }
    await mainDb.write()
  }

  if (archiveDb.data.schemaVersion !== REVIEW_SCHEMA_VERSION) {
    archiveDb.data.comments = archiveDb.data.comments.map(migrateComment)
    archiveDb.data.schemaVersion = REVIEW_SCHEMA_VERSION
    await archiveDb.write()
  }
}

export interface ListFilter {
  url?: string
  status?: ReviewCommentStatus
}

export async function listComments(filter?: ListFilter): Promise<ReviewComment[]> {
  await mainDb.read()
  const all = mainDb.data?.comments ?? []
  return all
    .filter((c) => {
      if (filter?.url && c.url !== filter.url) return false
      if (filter?.status && c.status !== filter.status) return false
      return true
    })
    .sort((a, b) => b.createdAt - a.createdAt)
}

export interface ArchiveFilter {
  url?: string
  before?: number
  limit?: number
}

export interface ArchivePage {
  comments: ReviewComment[]
  nextCursor?: number
}

export async function listArchive(filter?: ArchiveFilter): Promise<ArchivePage> {
  await archiveDb.read()
  const all = archiveDb.data?.comments ?? []
  const filtered = all
    .filter((c) => {
      if (filter?.url && c.url !== filter.url) return false
      if (filter?.before && c.updatedAt >= filter.before) return false
      return true
    })
    .sort((a, b) => b.updatedAt - a.updatedAt)
  const limit = Math.max(1, Math.min(filter?.limit ?? 50, 200))
  const page = filtered.slice(0, limit)
  const nextCursor = filtered.length > limit ? page[page.length - 1]?.updatedAt : undefined
  return { comments: page, nextCursor }
}

export async function getComment(id: string): Promise<ReviewComment | null> {
  await mainDb.read()
  return mainDb.data?.comments.find((c) => c.id === id) ?? null
}

export async function getArchivedComment(id: string): Promise<ReviewComment | null> {
  await archiveDb.read()
  return archiveDb.data?.comments.find((c) => c.id === id) ?? null
}

export async function upsertComment(comment: ReviewComment): Promise<void> {
  await mainDb.read()
  if (!mainDb.data) mainDb.data = { ...DEFAULT_MAIN }
  const idx = mainDb.data.comments.findIndex((c) => c.id === comment.id)
  if (idx === -1) {
    mainDb.data.comments.push(comment)
  } else {
    mainDb.data.comments[idx] = comment
  }
  await mainDb.write()
}

export async function deleteComment(id: string): Promise<boolean> {
  await mainDb.read()
  await archiveDb.read()
  if (!mainDb.data && !archiveDb.data) return false
  let removed = false
  if (mainDb.data) {
    const before = mainDb.data.comments.length
    mainDb.data.comments = mainDb.data.comments.filter((c) => c.id !== id)
    if (mainDb.data.comments.length !== before) {
      removed = true
      await mainDb.write()
    }
  }
  if (!removed && archiveDb.data) {
    const before = archiveDb.data.comments.length
    archiveDb.data.comments = archiveDb.data.comments.filter((c) => c.id !== id)
    if (archiveDb.data.comments.length !== before) {
      removed = true
      await archiveDb.write()
    }
  }
  return removed
}

export interface TransitionResult {
  comment: ReviewComment
  /** "main" if the resulting comment lives in the main DB after the transition;
   *  "archive" if it was moved to the archive DB. */
  location: "main" | "archive"
  /** "main" if the comment originated from the main DB before the transition;
   *  "archive" if from the archive DB. Useful for SSE event choice. */
  origin: "main" | "archive"
}

export async function transitionToInReview(
  id: string,
  actor: ReviewActor
): Promise<TransitionResult | null> {
  await mainDb.read()
  if (!mainDb.data) return null
  const idx = mainDb.data.comments.findIndex((c) => c.id === id)
  if (idx === -1) return null
  const at = Date.now()
  const existing = mainDb.data.comments[idx]
  if (!existing) return null
  const updated: ReviewComment = {
    ...existing,
    status: "in_review",
    updatedAt: at,
    resolution: {
      actor,
      at,
      summary: formatResolutionSummary(actor, at),
    },
  }
  mainDb.data.comments[idx] = updated
  await mainDb.write()
  return { comment: updated, location: "main", origin: "main" }
}

export async function approve(
  id: string,
  approver: { id: string; name: string }
): Promise<TransitionResult | null> {
  await mainDb.read()
  await archiveDb.read()
  if (!mainDb.data || !archiveDb.data) return null
  const idx = mainDb.data.comments.findIndex((c) => c.id === id)
  if (idx === -1) return null
  const at = Date.now()
  const existing = mainDb.data.comments[idx]
  if (!existing) return null
  const resolution = existing.resolution
    ? {
        ...existing.resolution,
        approvedAt: at,
        approvedBy: approver,
      }
    : {
        actor: { kind: "user" as const, id: approver.id, name: approver.name },
        at,
        summary: formatResolutionSummary(
          { kind: "user", id: approver.id, name: approver.name },
          at
        ),
        approvedAt: at,
        approvedBy: approver,
      }
  const updated: ReviewComment = {
    ...existing,
    status: "resolved",
    updatedAt: at,
    resolution,
  }
  mainDb.data.comments.splice(idx, 1)
  const archiveIdx = archiveDb.data.comments.findIndex((c) => c.id === id)
  if (archiveIdx === -1) {
    archiveDb.data.comments.push(updated)
  } else {
    archiveDb.data.comments[archiveIdx] = updated
  }
  await mainDb.write()
  await archiveDb.write()
  return { comment: updated, location: "archive", origin: "main" }
}

export async function reject(id: string): Promise<TransitionResult | null> {
  await mainDb.read()
  if (!mainDb.data) return null
  const idx = mainDb.data.comments.findIndex((c) => c.id === id)
  if (idx === -1) return null
  const at = Date.now()
  const existing = mainDb.data.comments[idx]
  if (!existing) return null
  const updated: ReviewComment = {
    ...existing,
    status: "open",
    updatedAt: at,
    resolution: undefined,
  }
  delete updated.resolution
  mainDb.data.comments[idx] = updated
  await mainDb.write()
  return { comment: updated, location: "main", origin: "main" }
}

export async function archiveDirect(
  id: string,
  actor: ReviewActor
): Promise<TransitionResult | null> {
  await mainDb.read()
  await archiveDb.read()
  if (!mainDb.data || !archiveDb.data) return null
  const idx = mainDb.data.comments.findIndex((c) => c.id === id)
  if (idx === -1) return null
  const at = Date.now()
  const existing = mainDb.data.comments[idx]
  if (!existing) return null
  const updated: ReviewComment = {
    ...existing,
    status: "resolved",
    updatedAt: at,
    resolution: {
      actor,
      at,
      summary: formatResolutionSummary(actor, at),
      approvedAt: at,
      approvedBy: { id: actor.id, name: actor.name },
    },
  }
  mainDb.data.comments.splice(idx, 1)
  const archiveIdx = archiveDb.data.comments.findIndex((c) => c.id === id)
  if (archiveIdx === -1) {
    archiveDb.data.comments.push(updated)
  } else {
    archiveDb.data.comments[archiveIdx] = updated
  }
  await mainDb.write()
  await archiveDb.write()
  return { comment: updated, location: "archive", origin: "main" }
}

export async function reopenFromArchive(id: string): Promise<TransitionResult | null> {
  await mainDb.read()
  await archiveDb.read()
  if (!mainDb.data || !archiveDb.data) return null
  const idx = archiveDb.data.comments.findIndex((c) => c.id === id)
  if (idx === -1) return null
  const at = Date.now()
  const existing = archiveDb.data.comments[idx]
  if (!existing) return null
  const updated: ReviewComment = {
    ...existing,
    status: "open",
    updatedAt: at,
    resolution: undefined,
  }
  delete updated.resolution
  archiveDb.data.comments.splice(idx, 1)
  const mainIdx = mainDb.data.comments.findIndex((c) => c.id === id)
  if (mainIdx === -1) {
    mainDb.data.comments.push(updated)
  } else {
    mainDb.data.comments[mainIdx] = updated
  }
  await archiveDb.write()
  await mainDb.write()
  return { comment: updated, location: "main", origin: "archive" }
}

export interface AddReplyInput {
  authorKind: "agent" | "user"
  authorId: string
  authorName: string
  authorColorToken?: string
  text: string
}

export interface AddReplyResult {
  reply: ReviewReply
  comment: ReviewComment
  location: "main" | "archive"
}

export async function addReply(
  commentId: string,
  input: AddReplyInput
): Promise<AddReplyResult | null> {
  await mainDb.read()
  await archiveDb.read()
  const reply: ReviewReply = {
    id: makeReplyId(),
    authorKind: input.authorKind,
    authorId: input.authorId,
    authorName: input.authorName,
    authorColorToken: input.authorColorToken ?? "var(--fg-tertiary)",
    text: input.text,
    createdAt: Date.now(),
  }

  if (mainDb.data) {
    const idx = mainDb.data.comments.findIndex((c) => c.id === commentId)
    if (idx !== -1) {
      const existing = mainDb.data.comments[idx]!
      const replies = Array.isArray(existing.replies) ? [...existing.replies, reply] : [reply]
      const updated: ReviewComment = {
        ...existing,
        replies,
        updatedAt: reply.createdAt,
      }
      mainDb.data.comments[idx] = updated
      await mainDb.write()
      return { reply, comment: updated, location: "main" }
    }
  }

  if (archiveDb.data) {
    const idx = archiveDb.data.comments.findIndex((c) => c.id === commentId)
    if (idx !== -1) {
      const existing = archiveDb.data.comments[idx]!
      const replies = Array.isArray(existing.replies) ? [...existing.replies, reply] : [reply]
      const updated: ReviewComment = {
        ...existing,
        replies,
        updatedAt: reply.createdAt,
      }
      archiveDb.data.comments[idx] = updated
      await archiveDb.write()
      return { reply, comment: updated, location: "archive" }
    }
  }

  return null
}

export async function listIdentities(): Promise<ReviewIdentity[]> {
  await mainDb.read()
  return mainDb.data?.identities ?? []
}

export async function upsertIdentity(identity: ReviewIdentity): Promise<void> {
  await mainDb.read()
  if (!mainDb.data) mainDb.data = { ...DEFAULT_MAIN }
  const idx = mainDb.data.identities.findIndex((i) => i.id === identity.id)
  if (idx === -1) {
    mainDb.data.identities.push(identity)
  } else {
    mainDb.data.identities[idx] = identity
  }
  await mainDb.write()
}

export async function exportAll(): Promise<ReviewExportPayload> {
  await mainDb.read()
  await archiveDb.read()
  const identities = mainDb.data?.identities ?? []
  const exportedBy = identities[0] ?? {
    id: "server",
    name: "Server",
    colorToken: "var(--fg-tertiary)",
    createdAt: 0,
  }
  return {
    schemaVersion: REVIEW_SCHEMA_VERSION,
    exportedAt: Date.now(),
    exportedBy,
    comments: mainDb.data?.comments ?? [],
    archivedComments: archiveDb.data?.comments ?? [],
  }
}

export async function importMerge(
  payload: ReviewExportPayload
): Promise<{ added: number; skipped: number }> {
  await mainDb.read()
  await archiveDb.read()
  if (!mainDb.data) mainDb.data = { ...DEFAULT_MAIN }
  if (!archiveDb.data) archiveDb.data = { ...DEFAULT_ARCHIVE }
  const byIdMain = new Map(mainDb.data.comments.map((c) => [c.id, c]))
  const byIdArchive = new Map(archiveDb.data.comments.map((c) => [c.id, c]))
  let added = 0
  let skipped = 0
  for (const raw of payload.comments) {
    const c = migrateComment(raw)
    if (byIdMain.has(c.id) || byIdArchive.has(c.id)) {
      skipped++
      continue
    }
    if (c.status === "resolved") {
      archiveDb.data.comments.push(c)
    } else {
      mainDb.data.comments.push(c)
    }
    added++
  }
  if (Array.isArray(payload.archivedComments)) {
    for (const raw of payload.archivedComments) {
      const c = migrateComment(raw)
      if (byIdMain.has(c.id) || byIdArchive.has(c.id)) {
        skipped++
        continue
      }
      archiveDb.data.comments.push(c)
      added++
    }
  }
  await mainDb.write()
  await archiveDb.write()
  return { added, skipped }
}

export function getDataFilePath(): string {
  return MAIN_FILE
}

export function getArchiveFilePath(): string {
  return ARCHIVE_FILE
}
