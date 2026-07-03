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
 * Backend serverless do Review Mode: fala com as rotas same-origin
 * `/api/review-bridge/*` (sem token, sem env) que persistem nos MESMOS arquivos
 * `review-bridge/data/*.json`. Substitui o RemoteBridgeReview (servidor Express
 * avulso na 9878) como padrão — `next dev` sozinho já serve tudo. Sem SSE: usa
 * polling leve do `/version` (mtime dos arquivos) pra captar escritas externas
 * (ex.: a skill de solve do agente) sem re-render à toa.
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

  // Sem SSE: poll do /version (mtime dos arquivos). Dispara onChange só quando a
  // assinatura muda — capta writes externos (skill do agente) sem re-render à toa.
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
        /* offline/transitório — ignora */
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
