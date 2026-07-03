"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { usePathname } from "next/navigation"
import type { Node, NodeProps } from "@xyflow/react"

import { Icon } from "@/components/ui/Icon"
import { useReviewStore } from "@/lib/auis-review/store"
import { formatRelative } from "@/lib/auis-review/format"
import { makeId } from "@/components/auis-review/storage/utils"
import { REVIEW_PALETTE, SCHEMA_VERSION } from "@/components/auis-review/constants"
import type { ReviewComment, ReviewPoint } from "@/components/auis-review/types"

/* ─────────────────────────────────────────────────────────────────────
 * FigJam-style comments on the flow canvas. A comment is dropped on a node
 * (or free position) and persisted to the SAME review-bridge as page
 * comments, tagged `origin: "ux-flow"` so it shows in the review inbox with
 * a "UX Flow" chip. Markers are ReactFlow nodes, so they pan/zoom with the
 * canvas (no document-coord drift).
 * ──────────────────────────────────────────────────────────────────── */

/** Where a pending comment will be anchored. */
export type CommentTarget = {
  nodeId?: string
  nodeLabel?: string
  position: ReviewPoint
}

export type ScreenPoint = { x: number; y: number }

/* ── Marker node ──────────────────────────────────────────────────── */

export type CommentNodeData = { comment: ReviewComment }

export function CommentNode({ data }: NodeProps<Node<CommentNodeData>>) {
  const c = data.comment
  const replyCount = Array.isArray(c.replies) ? c.replies.length : 0
  const inReview = c.status === "in_review"
  return (
    <div className="relative cursor-pointer select-none" title={c.text}>
      <div
        className="flex items-center gap-1 rounded-full rounded-bl-none border-2 border-(--bg-canvas) px-2 py-1 shadow-(--shadow-md)"
        style={{ background: c.authorColorToken }}
      >
        <span className="text-[10px] font-bold leading-none text-white">
          {c.authorName.charAt(0).toUpperCase()}
        </span>
        {replyCount > 0 && (
          <span className="text-[10px] font-semibold leading-none text-white/90">
            {replyCount}
          </span>
        )}
      </div>
      {inReview && (
        <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-(--au-amber-500) ring-2 ring-(--bg-canvas)" />
      )}
    </div>
  )
}

export const COMMENT_MARKER_PREFIX = "comment-"

export function commentMarkerNode(c: ReviewComment): Node<CommentNodeData> {
  const position =
    c.flowRef?.position ??
    (c.anchor.kind === "pin" ? c.anchor.position : c.anchor.centroid)
  return {
    id: `${COMMENT_MARKER_PREFIX}${c.id}`,
    type: "comment",
    position,
    draggable: false,
    selectable: false,
    zIndex: 1000,
    data: { comment: c },
  }
}

/* ── Data hook ────────────────────────────────────────────────────── */

export function useFlowComments(flow: string) {
  const storage = useReviewStore((s) => s.storage)
  const pathname = usePathname() ?? ""
  const [comments, setComments] = useState<ReviewComment[]>([])

  const refresh = useCallback(async () => {
    try {
      const all = await storage.listComments({ url: pathname })
      setComments(
        all.filter(
          (c) =>
            c.origin === "ux-flow" &&
            c.flowRef?.flow === flow &&
            c.status !== "resolved",
        ),
      )
    } catch (e) {
      console.error("[flow-comments] list", e)
    }
  }, [storage, pathname, flow])

  useEffect(() => {
    let cancelled = false
    // Initial load (setState runs in the async continuation, not synchronously).
    void (async () => {
      try {
        const all = await storage.listComments({ url: pathname })
        if (cancelled) return
        setComments(
          all.filter(
            (c) =>
              c.origin === "ux-flow" &&
              c.flowRef?.flow === flow &&
              c.status !== "resolved",
          ),
        )
      } catch (e) {
        console.error("[flow-comments] list", e)
      }
    })()
    // Live updates from the bridge drive refresh via its callback.
    const unsub = storage.subscribe?.(() => {
      if (!cancelled) void refresh()
    })
    return () => {
      cancelled = true
      unsub?.()
    }
  }, [storage, pathname, flow, refresh])

  return { comments, refresh, pathname }
}

/* ── Positioned popover shell ─────────────────────────────────────── */

const POPOVER_WIDTH = 300

function PopoverShell({
  at,
  children,
}: {
  at: ScreenPoint
  children: React.ReactNode
}) {
  if (typeof window === "undefined") return null
  const left = Math.max(
    8,
    Math.min(at.x, window.innerWidth - POPOVER_WIDTH - 8),
  )
  const top = Math.max(8, Math.min(at.y + 12, window.innerHeight - 280))
  return (
    <div
      className="fixed z-1200"
      style={{ left, top, width: POPOVER_WIDTH }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex flex-col overflow-hidden rounded-lg border border-(--border-subtle) bg-(--bg-raised) shadow-(--shadow-lg)">
        {children}
      </div>
    </div>
  )
}

/* ── Composer ─────────────────────────────────────────────────────── */

export function FlowCommentComposer({
  flow,
  target,
  at,
  onClose,
  onSaved,
}: {
  flow: string
  target: CommentTarget
  at: ScreenPoint
  onClose: () => void
  onSaved: () => void
}) {
  const storage = useReviewStore((s) => s.storage)
  const identity = useReviewStore((s) => s.identity)
  const setIdentity = useReviewStore((s) => s.setIdentity)
  const pathname = usePathname() ?? ""

  const [text, setText] = useState("")
  const [name, setName] = useState("")
  const [busy, setBusy] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    requestAnimationFrame(() => textareaRef.current?.focus())
  }, [])

  const submit = async () => {
    const trimmed = text.trim()
    if (!trimmed || busy) return
    setBusy(true)
    try {
      let id = identity
      if (!id) {
        const nm = name.trim()
        if (!nm) {
          setBusy(false)
          return
        }
        await setIdentity(nm, REVIEW_PALETTE[3]?.token ?? "var(--au-purple-600)")
        id = useReviewStore.getState().identity
      }
      if (!id) {
        setBusy(false)
        return
      }
      const now = Date.now()
      const comment: ReviewComment = {
        id: makeId("cmt"),
        schemaVersion: SCHEMA_VERSION as 3,
        authorId: id.id,
        authorName: id.name,
        authorColorToken: id.colorToken,
        createdAt: now,
        updatedAt: now,
        url: pathname,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        scrollY: window.scrollY,
        documentHeight: document.documentElement.scrollHeight,
        anchor: { kind: "pin", position: target.position },
        text: trimmed,
        status: "open",
        origin: "ux-flow",
        flowRef: {
          flow,
          nodeId: target.nodeId,
          nodeLabel: target.nodeLabel,
          position: target.position,
        },
      }
      await storage.saveComment(comment)
      onSaved()
    } catch (e) {
      console.error("[flow-comments] save", e)
    } finally {
      setBusy(false)
    }
  }

  return (
    <PopoverShell at={at}>
      <div className="flex items-center gap-2 border-b border-(--border-subtle) px-3 py-2">
        <Icon name="comment" size={13} className="text-(--au-purple-600)" />
        <span className="text-xs font-medium text-(--fg-primary)">
          {target.nodeLabel ? `Comentar em "${target.nodeLabel}"` : "Novo comentário"}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="ml-auto text-(--fg-tertiary) hover:text-(--fg-primary)"
        >
          <Icon name="close" size={14} />
        </button>
      </div>
      <div className="flex flex-col gap-2 p-2.5">
        {!identity && (
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Seu nome (aparece no review)"
            className="rounded-sm border border-(--border-default) bg-(--bg-canvas) px-2.5 py-1.5 text-xs text-(--fg-primary) placeholder:text-(--fg-tertiary) focus:border-(--au-purple-400) focus:outline-hidden"
          />
        )}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault()
              void submit()
            } else if (e.key === "Escape") {
              e.preventDefault()
              onClose()
            }
          }}
          rows={3}
          placeholder="O que muda aqui? Ex: falta a tela de confirmação…"
          className="resize-none rounded-sm border border-(--border-default) bg-(--bg-canvas) px-2.5 py-1.5 text-sm text-(--fg-primary) placeholder:text-(--fg-tertiary) focus:border-(--au-purple-400) focus:outline-hidden"
        />
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-sm px-2.5 py-1 text-xs font-medium text-(--fg-secondary) hover:bg-(--bg-muted)"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={!text.trim() || busy || (!identity && !name.trim())}
            className="rounded-sm bg-(--au-purple-600) px-2.5 py-1 text-xs font-medium text-white hover:bg-(--au-purple-700) disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? "Salvando…" : "Comentar"}
          </button>
        </div>
      </div>
    </PopoverShell>
  )
}

/* ── Thread (existing comment) ────────────────────────────────────── */

export function FlowCommentThread({
  comment,
  at,
  onClose,
  onChanged,
}: {
  comment: ReviewComment
  at: ScreenPoint
  onClose: () => void
  onChanged: () => void
}) {
  const storage = useReviewStore((s) => s.storage)
  const identity = useReviewStore((s) => s.identity)
  const setActive = useReviewStore((s) => s.setActive)
  const setSheetOpen = useReviewStore((s) => s.setSheetOpen)
  const selectComment = useReviewStore((s) => s.selectComment)

  const [reply, setReply] = useState("")
  const [busy, setBusy] = useState(false)
  const replies = Array.isArray(comment.replies) ? comment.replies : []

  const sendReply = async () => {
    const trimmed = reply.trim()
    if (!trimmed || busy || !identity || !storage.addReply) return
    setBusy(true)
    try {
      await storage.addReply(comment.id, {
        authorKind: "user",
        authorId: identity.id,
        authorName: identity.name,
        authorColorToken: identity.colorToken,
        text: trimmed,
      })
      setReply("")
      onChanged()
    } catch (e) {
      console.error("[flow-comments] reply", e)
    } finally {
      setBusy(false)
    }
  }

  const resolve = async () => {
    if (busy || !storage.transitionComment) return
    setBusy(true)
    try {
      const actor = identity
        ? { kind: "user" as const, id: identity.id, name: identity.name }
        : { kind: "user" as const, id: "anonymous", name: "Anônimo" }
      await storage.transitionComment(comment.id, "resolve_direct", actor)
      onChanged()
      onClose()
    } catch (e) {
      console.error("[flow-comments] resolve", e)
    } finally {
      setBusy(false)
    }
  }

  const openInReview = () => {
    setActive(true)
    setSheetOpen(true)
    selectComment(comment.id)
    onClose()
  }

  return (
    <PopoverShell at={at}>
      <div className="flex items-center gap-2 border-b border-(--border-subtle) px-3 py-2">
        <span
          className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold text-white"
          style={{ background: comment.authorColorToken }}
        >
          {comment.authorName.charAt(0).toUpperCase()}
        </span>
        <span className="text-xs font-medium text-(--fg-primary)">
          {comment.authorName}
        </span>
        {comment.status === "in_review" && (
          <span className="rounded-xs bg-(--au-amber-100) px-1.5 py-0.5 text-[10px] font-medium text-(--au-amber-800)">
            em revisão
          </span>
        )}
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="ml-auto text-(--fg-tertiary) hover:text-(--fg-primary)"
        >
          <Icon name="close" size={14} />
        </button>
      </div>

      <div className="max-h-64 overflow-y-auto px-3 py-2.5">
        <p className="m-0 whitespace-pre-wrap text-sm leading-relaxed text-(--fg-primary)">
          {comment.text}
        </p>
        {replies.length > 0 && (
          <div className="mt-2 flex flex-col gap-2 border-t border-(--border-subtle) pt-2">
            {replies.map((r) => (
              <div key={r.id} className="flex items-start gap-2">
                <span
                  className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-semibold text-white"
                  style={{ background: r.authorColorToken }}
                >
                  {r.authorName.charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-medium text-(--fg-primary)">
                      {r.authorName}
                    </span>
                    {r.authorKind === "agent" && (
                      <span className="rounded-xs bg-(--bg-muted) px-1 text-[10px] text-(--fg-tertiary)">
                        agente
                      </span>
                    )}
                    <span className="text-[10px] text-(--fg-tertiary)">
                      {formatRelative(r.createdAt)}
                    </span>
                  </div>
                  <p className="m-0 whitespace-pre-wrap text-[13px] leading-snug text-(--fg-primary)">
                    {r.text}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2 border-t border-(--border-subtle) p-2">
        <div className="flex items-end gap-1.5">
          <textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault()
                void sendReply()
              }
            }}
            rows={1}
            placeholder="Responder…"
            className="max-h-20 flex-1 resize-none rounded-sm border border-(--border-default) bg-(--bg-canvas) px-2.5 py-1.5 text-sm text-(--fg-primary) placeholder:text-(--fg-tertiary) focus:border-(--au-purple-400) focus:outline-hidden"
          />
          <button
            type="button"
            onClick={() => void sendReply()}
            disabled={!reply.trim() || busy}
            aria-label="Enviar"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-(--au-purple-600) text-white hover:bg-(--au-purple-700) disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Icon name="arrow_upward" size={14} />
          </button>
        </div>
        <div className="flex items-center justify-between text-[11px]">
          <button
            type="button"
            onClick={openInReview}
            className="inline-flex items-center gap-1 text-(--fg-tertiary) hover:text-(--fg-primary)"
          >
            <Icon name="open_in_full" size={11} />
            Ver no review
          </button>
          <button
            type="button"
            onClick={() => void resolve()}
            disabled={busy}
            className="inline-flex items-center gap-1 text-(--fg-secondary) hover:text-(--accent-success) disabled:opacity-40"
          >
            <Icon name="check_circle" size={12} />
            Resolver
          </button>
        </div>
      </div>
    </PopoverShell>
  )
}
