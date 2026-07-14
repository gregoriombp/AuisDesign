"use client"

import type {
  ReviewActor,
  ReviewComment,
  ReviewExportPayload,
  ReviewIdentity,
  ReviewReply,
} from "../types"
import { STORAGE_KEYS } from "../constants"
import type {
  ReviewArchiveFilter,
  ReviewArchivePage,
  ReviewReplyInput,
  ReviewStorage,
  ReviewStorageFilter,
  ReviewTransition,
} from "./types"

/**
 * Serverless backend for Review Mode: talks to the same-origin
 * `/api/review-bridge/*` routes (no token, no env) that persist to the SAME
 * `review-bridge/data/*.json` files. It replaces RemoteBridgeReview (the
 * standalone Express server on 9878) as the default — `next dev` alone already
 * serves everything. No SSE: it lightly polls `/version` (the files' mtime) to
 * pick up external writes (e.g. the agent's solve skill) without re-rendering
 * for nothing.
 */
const BASE = "/api/review-bridge"
const POLL_MS = 4000
const JSON_HEADERS: HeadersInit = { "Content-Type": "application/json" }

async function readBodyError(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { error?: string }
    return data.error ?? `${res.status} ${res.statusText}`
  } catch {
    return `${res.status} ${res.statusText}`
  }
}

export class ServerlessReview implements ReviewStorage {
  async getIdentity(): Promise<ReviewIdentity | null> {
    if (typeof window === "undefined") return null
    const raw = window.localStorage.getItem(STORAGE_KEYS.identity)
    if (!raw) return null
    try {
      return JSON.parse(raw) as ReviewIdentity
    } catch {
      return null
    }
  }

  async setIdentity(identity: ReviewIdentity): Promise<void> {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEYS.identity, JSON.stringify(identity))
    }
    const res = await fetch(`${BASE}/identity/${encodeURIComponent(identity.id)}`, {
      method: "PUT",
      headers: JSON_HEADERS,
      body: JSON.stringify(identity),
    })
    if (!res.ok) throw new Error(await readBodyError(res))
  }

  async listComments(filter?: ReviewStorageFilter): Promise<ReviewComment[]> {
    const params = new URLSearchParams()
    if (filter?.url) params.set("url", filter.url)
    if (filter?.status) params.set("status", filter.status)
    const qs = params.toString()
    const res = await fetch(`${BASE}/comments${qs ? `?${qs}` : ""}`, { cache: "no-store" })
    if (!res.ok) throw new Error(await readBodyError(res))
    const data = (await res.json()) as { comments: ReviewComment[] }
    return data.comments
  }

  async listArchive(filter?: ReviewArchiveFilter): Promise<ReviewArchivePage> {
    const params = new URLSearchParams()
    if (filter?.url) params.set("url", filter.url)
    if (filter?.before) params.set("before", String(filter.before))
    if (filter?.limit) params.set("limit", String(filter.limit))
    const qs = params.toString()
    const res = await fetch(`${BASE}/comments/archive${qs ? `?${qs}` : ""}`, { cache: "no-store" })
    if (!res.ok) throw new Error(await readBodyError(res))
    return (await res.json()) as ReviewArchivePage
  }

  async getComment(id: string): Promise<ReviewComment | null> {
    const res = await fetch(`${BASE}/comments/${encodeURIComponent(id)}`, { cache: "no-store" })
    if (res.status === 404) return null
    if (!res.ok) throw new Error(await readBodyError(res))
    const data = (await res.json()) as { comment: ReviewComment }
    return data.comment
  }

  async saveComment(comment: ReviewComment): Promise<void> {
    const res = await fetch(`${BASE}/comments/${encodeURIComponent(comment.id)}`, {
      method: "PUT",
      headers: JSON_HEADERS,
      body: JSON.stringify(comment),
    })
    if (!res.ok) throw new Error(await readBodyError(res))
  }

  async transitionComment(
    id: string,
    transition: ReviewTransition,
    actor?: ReviewActor
  ): Promise<ReviewComment | null> {
    const body: Record<string, unknown> = { transition }
    if (actor) body.actor = actor
    const res = await fetch(`${BASE}/comments/${encodeURIComponent(id)}`, {
      method: "PUT",
      headers: JSON_HEADERS,
      body: JSON.stringify(body),
    })
    if (res.status === 404) return null
    if (!res.ok) throw new Error(await readBodyError(res))
    const data = (await res.json()) as { comment?: ReviewComment }
    return data.comment ?? null
  }

  async addReply(commentId: string, reply: ReviewReplyInput): Promise<ReviewReply | null> {
    const res = await fetch(`${BASE}/comments/${encodeURIComponent(commentId)}/replies`, {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify(reply),
    })
    if (res.status === 404) return null
    if (!res.ok) throw new Error(await readBodyError(res))
    const data = (await res.json()) as { reply: ReviewReply }
    return data.reply
  }

  async deleteComment(id: string): Promise<void> {
    const res = await fetch(`${BASE}/comments/${encodeURIComponent(id)}`, { method: "DELETE" })
    if (!res.ok && res.status !== 404) throw new Error(await readBodyError(res))
  }

  async exportAll(): Promise<ReviewExportPayload> {
    const res = await fetch(`${BASE}/export`, { cache: "no-store" })
    if (!res.ok) throw new Error(await readBodyError(res))
    return (await res.json()) as ReviewExportPayload
  }

  async importMerge(payload: ReviewExportPayload): Promise<{ added: number; skipped: number }> {
    const res = await fetch(`${BASE}/import`, {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify(payload),
    })
    if (!res.ok) throw new Error(await readBodyError(res))
    return (await res.json()) as { added: number; skipped: number }
  }

  // No SSE: poll /version (the files' mtime). Fires onChange only when the
  // signature changes — picks up external writes (the agent's skill) without
  // re-rendering for nothing.
  subscribe(onChange: () => void): () => void {
    if (typeof window === "undefined") return () => {}
    let last: string | null = null
    let stopped = false
    const tick = async () => {
      try {
        const res = await fetch(`${BASE}/version`, { cache: "no-store" })
        if (!res.ok) return
        const { signature } = (await res.json()) as { signature: string }
        if (last !== null && signature !== last) onChange()
        last = signature
      } catch {
        /* offline/transient — ignore */
      }
    }
    void tick()
    const interval = window.setInterval(() => {
      if (!stopped) void tick()
    }, POLL_MS)
    return () => {
      stopped = true
      window.clearInterval(interval)
    }
  }
}
