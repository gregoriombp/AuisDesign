"use client"

import { SCHEMA_VERSION, STORAGE_KEYS } from "../constants"
import type {
  ReviewActor,
  ReviewComment,
  ReviewExportPayload,
  ReviewIdentity,
  ReviewReply,
} from "../types"
import type {
  ReviewArchiveFilter,
  ReviewArchivePage,
  ReviewReplyInput,
  ReviewStorage,
  ReviewStorageFilter,
  ReviewTransition,
} from "./types"
import { formatResolutionSummary, makeId, safeParseComments } from "./utils"

function readAllRaw(): ReviewComment[] {
  if (typeof window === "undefined") return []
  return safeParseComments(window.localStorage.getItem(STORAGE_KEYS.comments))
}

function writeAllRaw(comments: ReviewComment[]): void {
  if (typeof window === "undefined") return
  window.localStorage.setItem(STORAGE_KEYS.comments, JSON.stringify(comments))
  window.localStorage.setItem(STORAGE_KEYS.schemaVersion, String(SCHEMA_VERSION))
}

function applyFilter(
  comments: ReviewComment[],
  filter?: ReviewStorageFilter
): ReviewComment[] {
  if (!filter) return comments
  return comments.filter((c) => {
    if (filter.url !== undefined && c.url !== filter.url) return false
    if (filter.status !== undefined && c.status !== filter.status) return false
    return true
  })
}

export class LocalStorageReview implements ReviewStorage {
  async getIdentity(): Promise<ReviewIdentity | null> {
    if (typeof window === "undefined") return null
    const raw = window.localStorage.getItem(STORAGE_KEYS.identity)
    if (!raw) return null
    try {
      const parsed = JSON.parse(raw) as ReviewIdentity
      if (
        parsed &&
        typeof parsed.id === "string" &&
        typeof parsed.name === "string" &&
        typeof parsed.colorToken === "string"
      ) {
        return parsed
      }
      return null
    } catch {
      return null
    }
  }

  async setIdentity(identity: ReviewIdentity): Promise<void> {
    if (typeof window === "undefined") return
    window.localStorage.setItem(
      STORAGE_KEYS.identity,
      JSON.stringify(identity)
    )
  }

  async listComments(filter?: ReviewStorageFilter): Promise<ReviewComment[]> {
    // Hide resolved (archived) from the default listing; agents/users should
    // call listArchive() explicitly when they want the archived ones.
    const all = readAllRaw().filter((c) => c.status !== "resolved")
    return applyFilter(all, filter).sort((a, b) => b.createdAt - a.createdAt)
  }

  async listArchive(filter?: ReviewArchiveFilter): Promise<ReviewArchivePage> {
    const all = readAllRaw().filter((c) => c.status === "resolved")
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

  async getComment(id: string): Promise<ReviewComment | null> {
    return readAllRaw().find((c) => c.id === id) ?? null
  }

  async saveComment(comment: ReviewComment): Promise<void> {
    const all = readAllRaw()
    const idx = all.findIndex((c) => c.id === comment.id)
    if (idx === -1) {
      all.push(comment)
    } else {
      all[idx] = comment
    }
    writeAllRaw(all)
  }

  async transitionComment(
    id: string,
    transition: ReviewTransition,
    actor?: ReviewActor
  ): Promise<ReviewComment | null> {
    const all = readAllRaw()
    const idx = all.findIndex((c) => c.id === id)
    if (idx === -1) return null
    const existing = all[idx]
    if (!existing) return null
    const at = Date.now()
    let updated: ReviewComment = existing
    switch (transition) {
      case "in_review": {
        if (!actor) return null
        updated = {
          ...existing,
          status: "in_review",
          updatedAt: at,
          resolution: {
            actor,
            at,
            summary: formatResolutionSummary(actor, at),
          },
        }
        break
      }
      case "approve": {
        if (!actor) return null
        const resolution = existing.resolution
          ? {
              ...existing.resolution,
              approvedAt: at,
              approvedBy: { id: actor.id, name: actor.name },
            }
          : {
              actor,
              at,
              summary: formatResolutionSummary(actor, at),
              approvedAt: at,
              approvedBy: { id: actor.id, name: actor.name },
            }
        updated = {
          ...existing,
          status: "resolved",
          updatedAt: at,
          resolution,
        }
        break
      }
      case "reject": {
        updated = {
          ...existing,
          status: "open",
          updatedAt: at,
        }
        delete updated.resolution
        break
      }
      case "resolve_direct": {
        if (!actor) return null
        updated = {
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
        break
      }
      case "reopen_from_archive": {
        updated = {
          ...existing,
          status: "open",
          updatedAt: at,
        }
        delete updated.resolution
        break
      }
    }
    all[idx] = updated
    writeAllRaw(all)
    return updated
  }

  async addReply(commentId: string, input: ReviewReplyInput): Promise<ReviewReply | null> {
    const all = readAllRaw()
    const idx = all.findIndex((c) => c.id === commentId)
    if (idx === -1) return null
    const existing = all[idx]
    if (!existing) return null
    const reply: ReviewReply = {
      id: makeId("rep"),
      authorKind: input.authorKind,
      authorId: input.authorId,
      authorName: input.authorName,
      authorColorToken: input.authorColorToken ?? "var(--fg-tertiary)",
      text: input.text,
      createdAt: Date.now(),
    }
    const replies = Array.isArray(existing.replies) ? [...existing.replies, reply] : [reply]
    all[idx] = { ...existing, replies, updatedAt: reply.createdAt }
    writeAllRaw(all)
    return reply
  }

  async deleteComment(id: string): Promise<void> {
    const all = readAllRaw().filter((c) => c.id !== id)
    writeAllRaw(all)
  }

  async exportAll(): Promise<ReviewExportPayload> {
    const identity = await this.getIdentity()
    const all = readAllRaw()
    const main = all.filter((c) => c.status !== "resolved")
    const archived = all.filter((c) => c.status === "resolved")
    return {
      schemaVersion: SCHEMA_VERSION as 3,
      exportedAt: Date.now(),
      exportedBy: identity ?? {
        id: "anonymous",
        name: "Anônimo",
        colorToken: "var(--fg-tertiary)",
        createdAt: 0,
      },
      comments: main,
      archivedComments: archived,
    }
  }

  async importMerge(
    payload: ReviewExportPayload
  ): Promise<{ added: number; skipped: number }> {
    const all = readAllRaw()
    const byId = new Map(all.map((c) => [c.id, c]))
    let added = 0
    let skipped = 0
    for (const comment of payload.comments) {
      if (byId.has(comment.id)) {
        skipped++
        continue
      }
      all.push(comment)
      added++
    }
    if (Array.isArray(payload.archivedComments)) {
      for (const comment of payload.archivedComments) {
        if (byId.has(comment.id)) {
          skipped++
          continue
        }
        all.push(comment)
        added++
      }
    }
    writeAllRaw(all)
    return { added, skipped }
  }

  subscribe(onChange: () => void): () => void {
    if (typeof window === "undefined") return () => {}
    const handler = (e: StorageEvent) => {
      if (
        e.key === STORAGE_KEYS.comments ||
        e.key === STORAGE_KEYS.identity ||
        e.key === null
      ) {
        onChange()
      }
    }
    window.addEventListener("storage", handler)
    return () => window.removeEventListener("storage", handler)
  }
}
