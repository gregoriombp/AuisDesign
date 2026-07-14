import cors from "cors"
import express from "express"
import {
  addReply,
  approve,
  archiveDirect,
  deleteComment,
  exportAll,
  getArchiveFilePath,
  getArchivedComment,
  getComment,
  getDataFilePath,
  importMerge,
  initDb,
  listArchive,
  listComments,
  reject,
  reopenFromArchive,
  transitionToInReview,
  upsertComment,
  upsertIdentity,
} from "./store.js"
import { requireToken, tokenConfigured } from "./auth.js"
import {
  attachSubscriber,
  broadcast,
  broadcastHeartbeat,
  subscriberCount,
} from "./sse.js"
import {
  createSearch,
  getSearch,
  listSearches,
  setError,
  setResults,
} from "./mobbin.js"
import {
  REVIEW_SCHEMA_VERSION,
  type MobbinScreenResult,
  type MobbinSearchElement,
  type MobbinSearchStatus,
  type ReviewActor,
  type ReviewComment,
  type ReviewCommentStatus,
  type ReviewIdentity,
} from "./types.js"

const PORT = Number(process.env.AUIS_REVIEW_PORT ?? 9878)
const HOST = process.env.AUIS_REVIEW_HOST ?? "127.0.0.1"
const VERSION = "0.2.0"
const HEARTBEAT_INTERVAL_MS = 15_000

await initDb()

const app = express()

const localOriginRegex = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/

function isLoopbackAddress(address: string | undefined): boolean {
  if (!address) return false
  const normalized = address.replace(/^::ffff:/, "")
  return normalized === "127.0.0.1" || normalized === "::1"
}

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true)
      if (localOriginRegex.test(origin)) return cb(null, true)
      cb(new Error(`Origin not allowed: ${origin}`))
    },
    credentials: false,
    exposedHeaders: ["Content-Type"],
  })
)
app.use(express.json({ limit: "8mb" }))

app.use((req, res, next) => {
  if (isLoopbackAddress(req.socket.remoteAddress)) {
    next()
    return
  }
  res.status(403).json({ error: "local_only" })
})

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    version: VERSION,
    service: "auis-review-bridge",
    tokenRequired: tokenConfigured(),
    subscribers: subscriberCount(),
    dataFile: getDataFilePath(),
    archiveFile: getArchiveFilePath(),
    schemaVersion: REVIEW_SCHEMA_VERSION,
    timestamp: new Date().toISOString(),
    port: PORT,
  })
})

function parseStatus(value: unknown): ReviewCommentStatus | undefined {
  if (value === "open" || value === "in_review" || value === "resolved") return value
  return undefined
}

function isValidActor(value: unknown): value is ReviewActor {
  if (!value || typeof value !== "object") return false
  const v = value as Record<string, unknown>
  return (
    (v.kind === "agent" || v.kind === "user") &&
    typeof v.id === "string" &&
    typeof v.name === "string" &&
    v.name.length > 0
  )
}

function isValidComment(value: unknown): value is ReviewComment {
  if (!value || typeof value !== "object") return false
  const v = value as Record<string, unknown>
  return (
    typeof v.id === "string" &&
    (v.schemaVersion === REVIEW_SCHEMA_VERSION || v.schemaVersion === 2) &&
    typeof v.authorId === "string" &&
    typeof v.text === "string" &&
    typeof v.url === "string" &&
    !!v.anchor &&
    typeof v.anchor === "object"
  )
}

app.get("/comments", requireToken, async (req, res) => {
  const url = typeof req.query.url === "string" ? req.query.url : undefined
  const status = parseStatus(req.query.status)
  const comments = await listComments({ url, status })
  res.json({ comments })
})

app.get("/comments/archive", requireToken, async (req, res) => {
  const url = typeof req.query.url === "string" ? req.query.url : undefined
  const beforeRaw = typeof req.query.before === "string" ? Number(req.query.before) : undefined
  const limitRaw = typeof req.query.limit === "string" ? Number(req.query.limit) : undefined
  const before = Number.isFinite(beforeRaw) ? Number(beforeRaw) : undefined
  const limit = Number.isFinite(limitRaw) ? Number(limitRaw) : undefined
  const page = await listArchive({ url, before, limit })
  res.json(page)
})

app.get("/comments/:id", requireToken, async (req, res) => {
  const id = String(req.params.id)
  const main = await getComment(id)
  if (main) {
    res.json({ comment: main, location: "main" })
    return
  }
  const archived = await getArchivedComment(id)
  if (archived) {
    res.json({ comment: archived, location: "archive" })
    return
  }
  res.status(404).json({ error: "not_found" })
})

app.put("/comments/:id", requireToken, async (req, res) => {
  const id = String(req.params.id)
  const body = req.body as Record<string, unknown> | null
  if (!body) {
    res.status(400).json({ error: "invalid_payload" })
    return
  }

  // Transition path: { transition, actor } takes precedence over upsert.
  const transition = body.transition
  if (typeof transition === "string") {
    const actor = body.actor
    if (transition === "in_review") {
      if (!isValidActor(actor)) {
        res.status(400).json({ error: "invalid_actor" })
        return
      }
      const result = await transitionToInReview(id, actor)
      if (!result) {
        res.status(404).json({ error: "not_found" })
        return
      }
      broadcast({ kind: "comment.upserted", comment: result.comment })
      res.json({ ok: true, comment: result.comment, location: result.location })
      return
    }
    if (transition === "approve") {
      if (!isValidActor(actor)) {
        res.status(400).json({ error: "invalid_actor" })
        return
      }
      const result = await approve(id, { id: actor.id, name: actor.name })
      if (!result) {
        res.status(404).json({ error: "not_found" })
        return
      }
      broadcast({ kind: "comment.archived", comment: result.comment })
      res.json({ ok: true, comment: result.comment, location: result.location })
      return
    }
    if (transition === "reject") {
      const result = await reject(id)
      if (!result) {
        res.status(404).json({ error: "not_found" })
        return
      }
      broadcast({ kind: "comment.upserted", comment: result.comment })
      res.json({ ok: true, comment: result.comment, location: result.location })
      return
    }
    if (transition === "resolve_direct") {
      if (!isValidActor(actor)) {
        res.status(400).json({ error: "invalid_actor" })
        return
      }
      const result = await archiveDirect(id, actor)
      if (!result) {
        res.status(404).json({ error: "not_found" })
        return
      }
      broadcast({ kind: "comment.archived", comment: result.comment })
      res.json({ ok: true, comment: result.comment, location: result.location })
      return
    }
    if (transition === "reopen_from_archive") {
      const result = await reopenFromArchive(id)
      if (!result) {
        res.status(404).json({ error: "not_found" })
        return
      }
      broadcast({ kind: "comment.unarchived", comment: result.comment })
      res.json({ ok: true, comment: result.comment, location: result.location })
      return
    }
    res.status(400).json({ error: "unknown_transition" })
    return
  }

  // Default upsert path
  if (!isValidComment(body)) {
    res.status(400).json({ error: "invalid_comment" })
    return
  }
  if (body.id !== id) {
    res.status(400).json({ error: "id_mismatch" })
    return
  }
  // Normalize older payloads to v3
  const comment: ReviewComment = { ...body, schemaVersion: REVIEW_SCHEMA_VERSION }
  await upsertComment(comment)
  broadcast({ kind: "comment.upserted", comment })
  res.json({ ok: true })
})

app.post("/comments/:id/replies", requireToken, async (req, res) => {
  const id = String(req.params.id)
  const body = req.body as Record<string, unknown> | null
  if (!body) {
    res.status(400).json({ error: "invalid_payload" })
    return
  }
  const authorKind = body.authorKind
  const authorId = body.authorId
  const authorName = body.authorName
  const authorColorToken = body.authorColorToken
  const text = body.text
  if (
    (authorKind !== "agent" && authorKind !== "user") ||
    typeof authorId !== "string" ||
    typeof authorName !== "string" ||
    typeof text !== "string" ||
    text.trim().length === 0
  ) {
    res.status(400).json({ error: "invalid_reply" })
    return
  }
  const result = await addReply(id, {
    authorKind,
    authorId,
    authorName,
    authorColorToken: typeof authorColorToken === "string" ? authorColorToken : undefined,
    text: text.trim(),
  })
  if (!result) {
    res.status(404).json({ error: "not_found" })
    return
  }
  broadcast({ kind: "reply.added", commentId: id, reply: result.reply })
  res.json({ reply: result.reply, location: result.location })
})

app.delete("/comments/:id", requireToken, async (req, res) => {
  const removed = await deleteComment(String(req.params.id))
  if (!removed) {
    res.status(404).json({ error: "not_found" })
    return
  }
  broadcast({ kind: "comment.deleted", id: String(req.params.id) })
  res.json({ ok: true })
})

app.put("/identity/:id", requireToken, async (req, res) => {
  const body = req.body as unknown
  if (
    !body ||
    typeof body !== "object" ||
    typeof (body as ReviewIdentity).id !== "string" ||
    typeof (body as ReviewIdentity).name !== "string" ||
    typeof (body as ReviewIdentity).colorToken !== "string"
  ) {
    res.status(400).json({ error: "invalid_identity" })
    return
  }
  const identity = body as ReviewIdentity
  if (identity.id !== String(req.params.id)) {
    res.status(400).json({ error: "id_mismatch" })
    return
  }
  await upsertIdentity(identity)
  res.json({ ok: true })
})

app.get("/export", requireToken, async (_req, res) => {
  const payload = await exportAll()
  res.json(payload)
})

app.post("/import", requireToken, async (req, res) => {
  const body = req.body as unknown
  if (
    !body ||
    typeof body !== "object" ||
    !Array.isArray((body as { comments?: unknown[] }).comments)
  ) {
    res.status(400).json({ error: "invalid_payload" })
    return
  }
  const payload = body as Parameters<typeof importMerge>[0]
  const validComments = payload.comments.filter(isValidComment)
  const validArchive = Array.isArray(payload.archivedComments)
    ? payload.archivedComments.filter(isValidComment)
    : []
  const result = await importMerge({
    ...payload,
    schemaVersion: REVIEW_SCHEMA_VERSION,
    comments: validComments,
    archivedComments: validArchive,
  })
  for (const c of validComments) {
    if (c.status === "resolved") {
      broadcast({ kind: "comment.archived", comment: c })
    } else {
      broadcast({ kind: "comment.upserted", comment: c })
    }
  }
  for (const c of validArchive) {
    broadcast({ kind: "comment.archived", comment: c })
  }
  res.json(result)
})

// ── Mobbin search queue (transient, in-memory) ───────────────────────────────
function parseMobbinStatus(value: unknown): MobbinSearchStatus | undefined {
  if (value === "pending" || value === "done" || value === "error") return value
  return undefined
}

function isValidMobbinResults(value: unknown): value is MobbinScreenResult[] {
  if (!Array.isArray(value)) return false
  return value.every((r) => {
    if (!r || typeof r !== "object") return false
    const v = r as Record<string, unknown>
    return (
      typeof v.id === "string" &&
      typeof v.imageUrl === "string" &&
      typeof v.mobbinUrl === "string"
    )
  })
}

app.post("/mobbin/searches", requireToken, (req, res) => {
  const body = req.body as Record<string, unknown> | null
  const query = typeof body?.query === "string" ? body.query.trim() : ""
  if (!query) {
    res.status(400).json({ error: "invalid_query" })
    return
  }
  const platform = body?.platform === "ios" ? "ios" : "web"
  const page = typeof body?.page === "string" ? body.page : ""
  const element =
    body?.element && typeof body.element === "object"
      ? (body.element as MobbinSearchElement)
      : undefined
  const search = createSearch({ query, platform, page, element })
  broadcast({ kind: "mobbin.requested", search })
  res.json({ search })
})

app.get("/mobbin/searches", requireToken, (req, res) => {
  const status = parseMobbinStatus(req.query.status)
  res.json({ searches: listSearches(status ? { status } : undefined) })
})

app.get("/mobbin/searches/:id", requireToken, (req, res) => {
  const search = getSearch(String(req.params.id))
  if (!search) {
    res.status(404).json({ error: "not_found" })
    return
  }
  res.json({ search })
})

app.put("/mobbin/searches/:id/results", requireToken, (req, res) => {
  const id = String(req.params.id)
  const body = req.body as Record<string, unknown> | null

  // Agent reports a failure instead of results.
  if (typeof body?.error === "string" && body.error.trim()) {
    const updated = setError(id, body.error.trim())
    if (!updated) {
      res.status(404).json({ error: "not_found" })
      return
    }
    broadcast({ kind: "mobbin.resolved", search: updated })
    res.json({ search: updated })
    return
  }

  if (!isValidMobbinResults(body?.results)) {
    res.status(400).json({ error: "invalid_results" })
    return
  }
  const updated = setResults(id, body.results)
  if (!updated) {
    res.status(404).json({ error: "not_found" })
    return
  }
  broadcast({ kind: "mobbin.resolved", search: updated })
  res.json({ search: updated })
})

app.get("/events", requireToken, (req, res) => {
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8")
  res.setHeader("Cache-Control", "no-cache, no-transform")
  res.setHeader("Connection", "keep-alive")
  res.setHeader("X-Accel-Buffering", "no")
  res.flushHeaders?.()

  const detach = attachSubscriber(res)
  req.on("close", detach)
})

setInterval(broadcastHeartbeat, HEARTBEAT_INTERVAL_MS).unref()

app.listen(PORT, HOST, () => {
  const tokenMsg = tokenConfigured()
    ? "✓ Token configured"
    : "✗ Token NOT configured — the bridge will reject every request"
  console.log(
    [
      `auis-review-bridge ${VERSION}`,
      `→ listening on http://${HOST}:${PORT}`,
      `→ data file: ${getDataFilePath()}`,
      `→ archive file: ${getArchiveFilePath()}`,
      `→ schema: v${REVIEW_SCHEMA_VERSION}`,
      `→ ${tokenMsg}`,
    ].join("\n")
  )
})
