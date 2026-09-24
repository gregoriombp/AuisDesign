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

interface BridgeConfig {
  baseUrl: string
  token: string
}

function authHeaders(token: string): HeadersInit {
  return {
    "Content-Type": "application/json",
    "X-Review-Token": token,
  }
}

async function readBodyError(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { error?: string }
    return data.error ?? `${res.status} ${res.statusText}`
  } catch {
    return `${res.status} ${res.statusText}`
  }
}

export class RemoteBridgeReview implements ReviewStorage {
  private baseUrl: string
  private token: string

  constructor(config: BridgeConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, "")
    this.token = config.token
  }

  private url(path: string): string {
    return `${this.baseUrl}${path}`
  }

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
      window.localStorage.setItem(
        STORAGE_KEYS.identity,
        JSON.stringify(identity)
      )
    }
    const res = await fetch(this.url(`/identity/${encodeURIComponent(identity.id)}`), {
      method: "PUT",
      headers: authHeaders(this.token),
      body: JSON.stringify(identity),
    })
    if (!res.ok) throw new Error(await readBodyError(res))
  }

  async listComments(filter?: ReviewStorageFilter): Promise<ReviewComment[]> {
    const params = new URLSearchParams()
    if (filter?.url) params.set("url", filter.url)
    if (filter?.status) params.set("status", filter.status)
    const qs = params.toString()
    const res = await fetch(this.url(`/comments${qs ? `?${qs}` : ""}`), {
      headers: authHeaders(this.token),
    })
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
    const res = await fetch(this.url(`/comments/archive${qs ? `?${qs}` : ""}`), {
      headers: authHeaders(this.token),
    })
    if (!res.ok) throw new Error(await readBodyError(res))
    return (await res.json()) as ReviewArchivePage
  }

  async getComment(id: string): Promise<ReviewComment | null> {
    const res = await fetch(this.url(`/comments/${encodeURIComponent(id)}`), {
      headers: authHeaders(this.token),
    })
    if (res.status === 404) return null
    if (!res.ok) throw new Error(await readBodyError(res))
    const data = (await res.json()) as { comment: ReviewComment }
    return data.comment
  }

  async saveComment(comment: ReviewComment): Promise<void> {
    const res = await fetch(this.url(`/comments/${encodeURIComponent(comment.id)}`), {
      method: "PUT",
      headers: authHeaders(this.token),
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
    const res = await fetch(this.url(`/comments/${encodeURIComponent(id)}`), {
      method: "PUT",
      headers: authHeaders(this.token),
      body: JSON.stringify(body),
    })
    if (res.status === 404) return null
    if (!res.ok) throw new Error(await readBodyError(res))
    const data = (await res.json()) as { comment?: ReviewComment }
    return data.comment ?? null
  }

  async addReply(commentId: string, reply: ReviewReplyInput): Promise<ReviewReply | null> {
    const res = await fetch(this.url(`/comments/${encodeURIComponent(commentId)}/replies`), {
      method: "POST",
      headers: authHeaders(this.token),
      body: JSON.stringify(reply),
    })
    if (res.status === 404) return null
    if (!res.ok) throw new Error(await readBodyError(res))
    const data = (await res.json()) as { reply: ReviewReply }
    return data.reply
  }

  async deleteComment(id: string): Promise<void> {
    const res = await fetch(this.url(`/comments/${encodeURIComponent(id)}`), {
      method: "DELETE",
      headers: authHeaders(this.token),
    })
    if (!res.ok && res.status !== 404) {
      throw new Error(await readBodyError(res))
    }
  }

  async exportAll(): Promise<ReviewExportPayload> {
    const res = await fetch(this.url(`/export`), {
      headers: authHeaders(this.token),
    })
    if (!res.ok) throw new Error(await readBodyError(res))
    return (await res.json()) as ReviewExportPayload
  }

  async importMerge(
    payload: ReviewExportPayload
  ): Promise<{ added: number; skipped: number }> {
    const res = await fetch(this.url(`/import`), {
      method: "POST",
      headers: authHeaders(this.token),
      body: JSON.stringify(payload),
    })
    if (!res.ok) throw new Error(await readBodyError(res))
    return (await res.json()) as { added: number; skipped: number }
  }

  subscribe(onChange: () => void): () => void {
    if (typeof window === "undefined") return () => {}
    const url = this.url(`/events`) + `?token=${encodeURIComponent(this.token)}`
    const source = new EventSource(url)

    const handler = () => onChange()
    source.addEventListener("comment.upserted", handler)
    source.addEventListener("comment.deleted", handler)
    source.addEventListener("comment.archived", handler)
    source.addEventListener("comment.unarchived", handler)
    source.addEventListener("reply.added", handler)
    source.onerror = () => {
      // EventSource auto-reconnects; surface no-op.
    }

    return () => {
      source.removeEventListener("comment.upserted", handler)
      source.removeEventListener("comment.deleted", handler)
      source.removeEventListener("comment.archived", handler)
      source.removeEventListener("comment.unarchived", handler)
      source.removeEventListener("reply.added", handler)
      source.close()
    }
  }
}

export interface BridgeStatus {
  ok: boolean
  reason?: string
  subscribers?: number
}

function resolveBaseUrl(configuredUrl: string): string {
  return configuredUrl
}

export async function checkBridgeStatus(
  config: BridgeConfig
): Promise<BridgeStatus> {
  try {
    const res = await fetch(`${resolveBaseUrl(config.baseUrl)}/health`, {
      headers: { "X-Review-Token": config.token },
    })
    if (!res.ok) {
      return { ok: false, reason: `${res.status} ${res.statusText}` }
    }
    const data = (await res.json()) as {
      ok: boolean
      tokenRequired: boolean
      subscribers: number
    }
    if (!data.tokenRequired) {
      return { ok: false, reason: "bridge has no token configured" }
    }
    return { ok: true, subscribers: data.subscribers }
  } catch (e) {
    return {
      ok: false,
      reason: e instanceof Error ? e.message : "network error",
    }
  }
}
