"use client"

import { useCallback, useEffect, useState } from "react"
import { usePathname } from "next/navigation"

import { SCHEMA_VERSION } from "@/components/auis-review/constants"
import { makeId } from "@/components/auis-review/storage/utils"
import type { ReviewComment } from "@/components/auis-review/types"
import { useReviewStore } from "@/lib/auis-review/store"

import type {
  GoldenEyeComment,
  GoldenEyeCommentTarget,
} from "./golden-eye-overlays"

export type GoldenEyeCommentMap = Record<string, GoldenEyeComment[]>

type LegacySuggestion = {
  id: string
  description: string
  createdAt: number
  status: string
}

type UseGoldenEyeCommentsOptions = {
  /** Canonical slug used by all new Review Bridge comments. */
  flow: string
  /** Old flow buckets that must remain readable during the compatibility window. */
  legacyFlows?: readonly string[]
  /** Prefixes accepted in old `[prefix:node-id]` suggestion descriptions. */
  legacyPrefixes?: readonly string[]
}

const NO_LEGACY_FLOWS: readonly string[] = []
const DEFAULT_LEGACY_PREFIXES: readonly string[] = ["ge"]

function appendComment(
  map: GoldenEyeCommentMap,
  targetId: string,
  comment: GoldenEyeComment,
) {
  const current = map[targetId] ?? []
  if (current.some((item) => item.id === comment.id)) return
  map[targetId] = [...current, comment]
}

function readLegacySuggestion(
  suggestion: LegacySuggestion,
  prefixes: readonly string[],
): { targetId: string; text: string } | null {
  if (suggestion.status === "discarded") return null
  const escaped = prefixes.map((prefix) => prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
  const match = new RegExp(
    `^\\[(?:${escaped.join("|")}):([^\\]]+)\\]\\s*(?:\\([^)]*\\))?\\s*([\\s\\S]*)$`,
  ).exec(suggestion.description)
  if (!match?.[1] || !match[2]?.trim()) return null
  return { targetId: match[1], text: match[2].trim() }
}

/**
 * Compatibility adapter for Golden Eye comments.
 *
 * New writes always go to Review Bridge as semantic `ux-flow` comments. The
 * flow-suggestions API is queried with GET only so old `[ge:*]` records remain
 * visible without ever being promoted to an operation or rewritten in place.
 */
export function useGoldenEyeComments({
  flow,
  legacyFlows = NO_LEGACY_FLOWS,
  legacyPrefixes = DEFAULT_LEGACY_PREFIXES,
}: UseGoldenEyeCommentsOptions) {
  const pathname = usePathname() ?? ""
  const storage = useReviewStore((state) => state.storage)
  const [comments, setComments] = useState<GoldenEyeCommentMap>({})

  const load = useCallback(async (): Promise<GoldenEyeCommentMap> => {
    const allFlows = Array.from(new Set([flow, ...legacyFlows]))
    const [reviewComments, ...legacyPayloads] = await Promise.all([
      storage.listComments({ url: pathname }),
      ...allFlows.map(async (legacyFlow) => {
        try {
          const response = await fetch(
            `/api/flow-suggestions?flow=${encodeURIComponent(legacyFlow)}`,
            { cache: "no-store" },
          )
          if (!response.ok) return []
          const payload = (await response.json()) as {
            suggestions?: LegacySuggestion[]
          }
          return Array.isArray(payload.suggestions) ? payload.suggestions : []
        } catch {
          return []
        }
      }),
    ])

    const next: GoldenEyeCommentMap = {}
    for (const comment of reviewComments) {
      const flowRef = comment.flowRef
      const targetId = flowRef?.nodeId
      if (
        comment.origin !== "ux-flow" ||
        !flowRef ||
        !targetId ||
        !allFlows.includes(flowRef.flow) ||
        comment.status === "resolved"
      ) {
        continue
      }
      appendComment(next, targetId, {
        id: comment.id,
        text: comment.text,
        at: comment.createdAt,
      })
    }

    for (const suggestions of legacyPayloads) {
      for (const suggestion of suggestions) {
        const parsed = readLegacySuggestion(suggestion, legacyPrefixes)
        if (!parsed) continue
        appendComment(next, parsed.targetId, {
          id: `legacy:${suggestion.id}`,
          text: parsed.text,
          at: suggestion.createdAt,
          legacy: true,
        })
      }
    }

    for (const list of Object.values(next)) {
      list.sort((a, b) => a.at - b.at)
    }
    return next
  }, [flow, legacyFlows, legacyPrefixes, pathname, storage])

  const refresh = useCallback(async () => {
    setComments(await load())
  }, [load])

  useEffect(() => {
    let cancelled = false
    const loadIntoState = async (label: "list" | "refresh") => {
      try {
        const next = await load()
        if (!cancelled) setComments(next)
      } catch (error) {
        if (!cancelled) console.error(`[golden-eye-comments] ${label}`, error)
      }
    }
    void loadIntoState("list")
    const unsubscribe = storage.subscribe?.(() => {
      if (!cancelled) void loadIntoState("refresh")
    })
    return () => {
      cancelled = true
      unsubscribe?.()
    }
  }, [load, storage])

  const addComment = useCallback(
    async (target: GoldenEyeCommentTarget, rawText: string): Promise<boolean> => {
      const text = rawText.trim()
      if (!text) return false

      const review = useReviewStore.getState()
      const identity = review.identity
      if (!identity) {
        review.openIdentityModal("new")
        return false
      }

      const now = Date.now()
      const id = makeId("cmt")
      const comment: ReviewComment = {
        id,
        schemaVersion: SCHEMA_VERSION as 3,
        authorId: identity.id,
        authorName: identity.name,
        authorColorToken: identity.colorToken,
        createdAt: now,
        updatedAt: now,
        url: pathname,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        scrollY: window.scrollY,
        documentHeight: document.documentElement.scrollHeight,
        // Golden Eye cards are semantic nodes, not free-position pins. The
        // required anchor stays inert; flowRef is the canonical target.
        anchor: { kind: "pin", position: { x: 0, y: 0 } },
        text,
        status: "open",
        origin: "ux-flow",
        flowRef: {
          flow,
          nodeId: target.id,
          nodeLabel: target.title,
        },
      }

      await storage.saveComment(comment)
      setComments((current) => {
        const next = { ...current }
        appendComment(next, target.id, { id, text, at: now })
        return next
      })
      return true
    },
    [flow, pathname, storage],
  )

  return { comments, addComment, refresh }
}
