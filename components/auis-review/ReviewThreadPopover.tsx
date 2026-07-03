"use client"

import * as React from "react"
import { AuButton } from "@/components/ui/AuButton"
import {
  AuDropdownMenu,
  type AuDropdownItem,
} from "@/components/ui/AuDropdownMenu"
import { AuPill } from "@/components/ui/AuPill"
import { Icon } from "@/components/ui/Icon"
import { useReviewStore } from "@/lib/auis-review/store"
import {
  useCumulativeScrollOffset,
  useLayoutVersion,
} from "@/lib/auis-review/scrollOffset"
import {
  resolveDrawPoints,
  resolveElementPoint,
} from "@/lib/auis-review/elementAnchor"
import { formatFullTimestamp } from "@/lib/auis-review/format"
import { OVERLAY_DATA_ATTR, REVIEW_Z } from "./constants"
import { ReplyRow } from "./ReviewCommentCard"
import { ReplyComposer } from "./ReplyComposer"
import { UxFlowChip } from "./UxFlowChip"
import { CommentText } from "./CommentText"
import { useImageAttach } from "@/lib/auis-review/useImageAttach"
import type { ReviewComment, ReviewPoint } from "./types"

const THREAD_WIDTH = 360
const GAP = 16

/** Elements that should NOT dismiss the thread when clicked: the review
 * overlay itself and any Radix popper (the ⋯ menu portals outside the tree). */
const KEEP_OPEN_SELECTOR = `[${OVERLAY_DATA_ATTR}], [data-radix-popper-content-wrapper], .au-dropdown, [role="menu"]`

function anchorPoint(comment: ReviewComment): ReviewPoint {
  return comment.anchor.kind === "pin"
    ? comment.anchor.position
    : comment.anchor.centroid
}

function targetSummary(comment: ReviewComment): string | null {
  const target = comment.context?.target
  if (!target) return null
  const detail = target.label ?? target.text ?? target.attributes?.href
  if (!detail) return target.role ? `${target.tag} · ${target.role}` : target.tag
  return `${target.tag} · ${detail}`
}

export function ReviewThreadPopover() {
  const threadCommentId = useReviewStore((s) => s.threadCommentId)
  const comments = useReviewStore((s) => s.comments)
  const archivedComments = useReviewStore((s) => s.archivedComments)
  const pendingAnchor = useReviewStore((s) => s.pendingAnchor)

  const closeThread = useReviewStore((s) => s.closeThread)
  const setSheetOpen = useReviewStore((s) => s.setSheetOpen)
  const archiveDirect = useReviewStore((s) => s.archiveDirect)
  const approveComment = useReviewStore((s) => s.approveComment)
  const rejectComment = useReviewStore((s) => s.rejectComment)
  const editComment = useReviewStore((s) => s.editComment)
  const moveToBacklog = useReviewStore((s) => s.moveToBacklog)
  const deleteComment = useReviewStore((s) => s.deleteComment)

  const scroll = useCumulativeScrollOffset()
  const layoutVersion = useLayoutVersion()

  const [editing, setEditing] = React.useState(false)
  const [editText, setEditText] = React.useState("")
  const [editSaving, setEditSaving] = React.useState(false)
  const editImg = useImageAttach()
  const bodyRef = React.useRef<HTMLDivElement>(null)

  const comment =
    comments.find((c) => c.id === threadCommentId) ??
    archivedComments.find((c) => c.id === threadCommentId) ??
    null

  // Sai do modo de edição ao trocar de comentário.
  React.useEffect(() => {
    setEditing(false)
  }, [threadCommentId])

  // Keep the latest reply in view as the thread grows.
  React.useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight })
  }, [comment?.replies?.length, threadCommentId])

  // Figma-style dismiss: click anywhere that isn't the overlay or a menu.
  React.useEffect(() => {
    if (!threadCommentId) return
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Element | null
      if (target?.closest(KEEP_OPEN_SELECTOR)) return
      closeThread()
    }
    document.addEventListener("pointerdown", onPointerDown, true)
    return () =>
      document.removeEventListener("pointerdown", onPointerDown, true)
  }, [threadCommentId, closeThread])

  // While composing a new comment, the compose popover takes over.
  if (!comment || pendingAnchor || typeof window === "undefined") return null

  // Acompanha o marcador quando ele segue o reflow/zoom (âncora resolvida):
  // pin → ponto do elemento; traço → centroide dos pontos re-resolvidos.
  void layoutVersion
  const anchorEl = comment.anchor.el
  let elPoint: ReviewPoint | null = null
  if (comment.anchor.kind === "pin" && comment.anchor.el) {
    elPoint = resolveElementPoint(comment.anchor.el)
  } else if (comment.anchor.kind === "draw" && comment.anchor.el) {
    const pts = resolveDrawPoints(comment.anchor.el)
    if (pts && pts.length > 0) {
      const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length
      const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length
      elPoint = { x: cx, y: cy }
    }
  }
  // Comentário ancorado a um elemento que não existe mais (modal fechou): o
  // marcador some no canvas, então a thread também não deve flutuar solta sobre
  // o conteúdo/sidebar. Volta quando o elemento reaparece.
  if (anchorEl && !elPoint) return null
  const point = elPoint
    ? { x: elPoint.x + scroll.x, y: elPoint.y + scroll.y }
    : anchorPoint(comment)
  const pxX = point.x - scroll.x
  const pxY = point.y - scroll.y

  // Horizontal: prefer the right of the pin, flip left if it would overflow.
  let left = pxX + GAP
  if (left + THREAD_WIDTH > window.innerWidth - 8) {
    left = pxX - GAP - THREAD_WIDTH
  }
  left = Math.max(8, Math.min(left, window.innerWidth - THREAD_WIDTH - 8))

  // Vertical: anchor near the pin, flip above when the space below is cramped.
  const spaceBelow = window.innerHeight - pxY - GAP
  const spaceAbove = pxY - GAP
  const placeAbove = spaceBelow < 240 && spaceAbove > spaceBelow
  const maxHeight = Math.max(
    200,
    Math.min(560, placeAbove ? spaceAbove : spaceBelow)
  )
  const vertical: React.CSSProperties = placeAbove
    ? { bottom: window.innerHeight - pxY + GAP }
    : { top: Math.max(8, pxY - 24) }

  const replies = Array.isArray(comment.replies) ? comment.replies : []
  const isResolved = comment.status === "resolved"
  const isInReview = comment.status === "in_review"
  const target = targetSummary(comment)

  const startEdit = () => {
    setEditText(comment.text)
    editImg.reset(comment.images ?? [])
    setEditing(true)
  }
  const saveEdit = async () => {
    setEditSaving(true)
    try {
      await editComment(comment.id, editText, editImg.images)
      setEditing(false)
    } finally {
      setEditSaving(false)
    }
  }

  const copyPermalink = () => {
    const base = window.location.origin
    const pathWithQuery = comment.url.includes("?")
      ? `${comment.url}&reviewCommentId=${encodeURIComponent(comment.id)}`
      : `${comment.url}?reviewCommentId=${encodeURIComponent(comment.id)}`
    void navigator.clipboard?.writeText(`${base}${pathWithQuery}`)
  }

  const dropdownItems: AuDropdownItem[] = [
    { id: "edit", label: "Editar", icon: "edit", onSelect: startEdit },
    { id: "copy-link", label: "Copiar link", icon: "link", onSelect: copyPermalink },
    isInReview
      ? {
          id: "reject",
          label: "Reabrir (rejeitar revisão)",
          icon: "refresh",
          onSelect: () => void rejectComment(comment.id),
        }
      : {
          id: "archive",
          label: "Marcar como resolvido",
          icon: "check_circle",
          onSelect: () => void archiveDirect(comment.id),
        },
    ...(!isResolved
      ? [
          {
            id: "to-backlog",
            label: "Mover pra ideias futuras",
            icon: "lightbulb",
            onSelect: () => void moveToBacklog(comment.id),
          } as AuDropdownItem,
        ]
      : []),
    { id: "sep", separator: true },
    {
      id: "delete",
      label: "Excluir",
      icon: "delete",
      danger: true,
      onSelect: () => void deleteComment(comment.id),
    },
  ]

  return (
    <div
      {...{ [OVERLAY_DATA_ATTR]: "" }}
      className="fixed pointer-events-none"
      style={{ zIndex: REVIEW_Z.popover, left, width: THREAD_WIDTH, ...vertical }}
    >
      <div
        className="pointer-events-auto flex flex-col rounded-lg bg-(--bg-raised) border border-(--border-subtle) shadow-lg overflow-hidden"
        style={{ maxHeight }}
      >
        {/* Header */}
        <header className="flex items-center gap-2 px-3 py-2.5 border-b border-(--border-subtle)">
          <span
            className="h-6 w-6 shrink-0 rounded-full flex items-center justify-center body-xs font-semibold text-(--fg-on-inverse)"
            style={{ background: comment.authorColorToken }}
          >
            {comment.authorName.charAt(0).toUpperCase()}
          </span>
          <div className="flex flex-col leading-tight min-w-0">
            <span className="body-xs font-medium text-(--fg-primary) truncate">
              {comment.authorName}
            </span>
            <span className="body-xs text-(--fg-tertiary) tabular-nums">
              {formatFullTimestamp(comment.createdAt)}
            </span>
          </div>
          {comment.origin === "ux-flow" && <UxFlowChip flowRef={comment.flowRef} />}

          <div className="ml-auto flex items-center gap-0.5">
            {isInReview && <AuPill variant="beta">Em revisão</AuPill>}
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              className="inline-flex items-center gap-1 px-1.5 h-7 rounded-sm body-xs text-(--fg-tertiary) hover:text-(--fg-primary) hover:bg-(--bg-hover) transition-colors"
              title="Abrir no painel lateral"
            >
              <Icon name="open_in_full" size={11} />
              Ver mais
            </button>
            {!isResolved && !isInReview && (
              <button
                type="button"
                onClick={() => void archiveDirect(comment.id)}
                aria-label="Marcar como resolvido"
                title="Marcar como resolvido"
                className="h-7 w-7 inline-flex items-center justify-center rounded-sm text-(--fg-tertiary) hover:text-(--accent-success) hover:bg-(--bg-hover) transition-colors"
              >
                <Icon name="check_circle" size={15} />
              </button>
            )}
            <AuDropdownMenu
              align="end"
              trigger={
                <button
                  type="button"
                  aria-label="Ações"
                  className="h-7 w-7 inline-flex items-center justify-center rounded-sm text-(--fg-tertiary) hover:text-(--fg-primary) hover:bg-(--bg-hover) transition-colors"
                >
                  <Icon name="more_horiz" size={15} />
                </button>
              }
              items={dropdownItems}
            />
            <button
              type="button"
              onClick={closeThread}
              aria-label="Fechar"
              className="h-7 w-7 inline-flex items-center justify-center rounded-sm text-(--fg-tertiary) hover:text-(--fg-primary) hover:bg-(--bg-hover) transition-colors"
            >
              <Icon name="close" size={15} />
            </button>
          </div>
        </header>

        {/* Body: comment + replies */}
        <div ref={bodyRef} className="flex-1 overflow-y-auto px-3 py-2.5">
          {editing ? (
            <div className="flex flex-col gap-2">
              <textarea
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                onPaste={editImg.onPaste}
                rows={3}
                autoFocus
                placeholder="Edite o comentário…"
                className="w-full rounded-sm border border-(--border-subtle) bg-(--bg-surface) p-2 body-sm text-(--fg-primary) focus:outline-hidden focus:border-(--accent-brand) resize-none"
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") void saveEdit()
                  if (e.key === "Escape") setEditing(false)
                }}
              />
              {editImg.images.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {editImg.images.map((src, idx) => (
                    <div key={idx} className="relative group/ethumb">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={src}
                        alt=""
                        className="h-16 w-16 rounded-sm object-cover border border-(--border-subtle)"
                      />
                      <button
                        type="button"
                        onClick={() => editImg.remove(idx)}
                        aria-label="Remover imagem"
                        className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-(--bg-raised) border border-(--border-subtle) flex items-center justify-center text-(--fg-tertiary) hover:text-(--fg-primary) opacity-0 group-hover/ethumb:opacity-100 transition-opacity"
                      >
                        <Icon name="close" size={9} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex items-center justify-end gap-1">
                <AuButton variant="ghost" size="sm" onClick={() => setEditing(false)}>
                  Cancelar
                </AuButton>
                <AuButton
                  variant="primary"
                  size="sm"
                  loading={editSaving}
                  disabled={
                    editSaving ||
                    (editText.trim().length === 0 && editImg.images.length === 0)
                  }
                  onClick={() => void saveEdit()}
                >
                  Salvar
                </AuButton>
              </div>
            </div>
          ) : (
            <>
              {comment.text.length > 0 && (
                <CommentText
                  className="m-0 body-sm text-(--fg-primary) whitespace-pre-wrap leading-relaxed"
                  text={comment.text}
                />
              )}

              {comment.images && comment.images.length > 0 && (
                <div
                  className={[
                    "flex flex-wrap gap-1.5",
                    comment.text.length > 0 ? "mt-2" : "",
                  ].join(" ")}
                >
                  {comment.images.map((src, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => window.open(src, "_blank", "noopener")}
                      className="rounded-sm overflow-hidden border border-(--border-subtle) hover:border-(--border-strong) transition-colors focus:outline-hidden"
                      aria-label={`Ver imagem ${idx + 1}`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={src} alt="" className="h-24 w-24 object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </>
          )}

          {target && (
            <div className="mt-2 flex items-center gap-1 body-xs text-(--fg-tertiary)">
              <Icon name="my_location" size={11} />
              <span className="truncate">{target}</span>
            </div>
          )}

          {comment.resolution?.summary && (
            <p className="m-0 mt-2 body-xs text-(--fg-tertiary) italic">
              {comment.resolution.summary}
            </p>
          )}

          {replies.length > 0 && (
            <div className="mt-2 pt-1 border-t border-(--border-subtle) flex flex-col divide-y divide-(--border-subtle)">
              {replies.map((r) => (
                <ReplyRow key={r.id} reply={r} />
              ))}
            </div>
          )}
        </div>

        {/* Footer: approve/reject when in review, then the reply composer */}
        <div className="border-t border-(--border-subtle) p-2 flex flex-col gap-2">
          {isInReview && (
            <div className="flex items-center gap-1.5">
              <AuButton
                variant="primary"
                size="sm"
                iconLeft="check_circle"
                onClick={() => void approveComment(comment.id)}
              >
                Aprovar
              </AuButton>
              <AuButton
                variant="ghost"
                size="sm"
                iconLeft="undo"
                onClick={() => void rejectComment(comment.id)}
              >
                Rejeitar
              </AuButton>
            </div>
          )}

          <ReplyComposer key={comment.id} commentId={comment.id} />
        </div>
      </div>
    </div>
  )
}
