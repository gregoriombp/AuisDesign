"use client"

import * as React from "react"
import { Button } from "../primitives/Button"
import {
  DropdownMenu,
  type DropdownItem,
} from "../primitives/DropdownMenu"
import { Pill } from "../primitives/Pill"
import { Icon } from "../primitives/Icon"
import { Spinner } from "../primitives/Spinner"
import { getReviewAgent } from "@auis/core/agents"
import { useReviewStore } from "./store"
import { useCumulativeScrollOffset, useLayoutVersion } from "../scrollHooks"
import {
  resolveDrawPoints,
  resolveElementPoint,
} from "@auis/core/elementAnchor"
import { formatFullTimestamp, formatRelative } from "@auis/core/format"
import { elementFromCommentContext } from "@auis/core/elementContext"
import { OVERLAY_DATA_ATTR, REVIEW_Z } from "./constants"
import { AgentBadge, ReplyRow } from "./ReviewCommentCard"
import { ReplyComposer } from "./ReplyComposer"
import { UxFlowChip } from "./UxFlowChip"
import { agentRunLabel, liveAgentRun } from "./agentRun"
import { ReviewAvatar } from "./ReviewAvatar"
import { CommentText } from "./CommentText"
import { AuthorName } from "./PersonHover"
import { useImageAttach } from "./useImageAttach"
import { permalinkHref } from "./permalink"
import type { ReviewComment, ReviewPoint } from "@auis/core/types"

const THREAD_WIDTH = 360
const GAP = 16

/** Elements that should NOT dismiss the thread when clicked: the review
 * overlay itself and any Radix popper (the ⋯ menu portals outside the tree). */
const KEEP_OPEN_SELECTOR = `[${OVERLAY_DATA_ATTR}], [data-radix-popper-content-wrapper], .auis-dropdown, [role="menu"]`

function anchorPoint(comment: ReviewComment): ReviewPoint {
  return comment.anchor.kind === "pin"
    ? comment.anchor.position
    : comment.anchor.centroid
}

export function ReviewThreadPopover() {
  const threadCommentId = useReviewStore((s) => s.threadCommentId)
  const comments = useReviewStore((s) => s.comments)
  const archivedComments = useReviewStore((s) => s.archivedComments)
  const pendingAnchor = useReviewStore((s) => s.pendingAnchor)
  const sessionRole = useReviewStore((s) => s.sessionRole)
  const sessionEmail = useReviewStore((s) => s.sessionEmail)

  const closeThread = useReviewStore((s) => s.closeThread)
  const setSheetOpen = useReviewStore((s) => s.setSheetOpen)
  const archiveDirect = useReviewStore((s) => s.archiveDirect)
  const approveComment = useReviewStore((s) => s.approveComment)
  const rejectComment = useReviewStore((s) => s.rejectComment)
  const reopenFromArchive = useReviewStore((s) => s.reopenFromArchive)
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

  // Leave edit mode when switching comments.
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

  // Follow the marker when it tracks reflow/zoom (resolved anchor):
  // pin → element point; stroke → centroid of the re-resolved points.
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
  // Comment anchored to an element that no longer exists (modal closed): the
  // marker disappears from the canvas, so the thread must not float loose over
  // the content/sidebar either. It comes back when the element reappears.
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
  const agentRun = liveAgentRun(comment)
  const agentName = agentRun
    ? (getReviewAgent(agentRun.agentId)?.name ?? agentRun.agentId)
    : ""
  const resolvedBy =
    comment.resolution?.approvedBy?.name ?? comment.resolution?.actor.name
  const resolvedAt = comment.resolution?.approvedAt ?? comment.resolution?.at

  // Hierarchy: an admin moderates (status/visibility); a reviewer only touches
  // what is theirs. The server re-validates everything — here it only keeps the
  // UI from offering what would return 403.
  const isAdmin = sessionRole === "admin"
  const ownComment =
    isAdmin ||
    (!!sessionEmail &&
      comment.authorEmail?.toLowerCase() === sessionEmail.toLowerCase())

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
    void navigator.clipboard?.writeText(permalinkHref(comment))
  }

  const dropdownItems: DropdownItem[] = [
    // In review, Approve and Reject take the header and the side panel moves
    // into the menu.
    ...(isInReview && isAdmin
      ? [
          {
            id: "open-sheet",
            label: "Open in the side panel",
            icon: "open_in_full",
            onSelect: () => setSheetOpen(true),
          } as DropdownItem,
        ]
      : []),
    ...(ownComment
      ? [{ id: "edit", label: "Edit", icon: "edit", onSelect: startEdit } as DropdownItem]
      : []),
    { id: "copy-link", label: "Copy link", icon: "link", onSelect: copyPermalink },
    // Changing status is an admin decision — a reviewer asks, does not resolve.
    ...(isAdmin
      ? [
          isInReview
            ? ({
                id: "reject",
                label: "Reopen (reject review)",
                icon: "refresh",
                onSelect: () => void rejectComment(comment.id),
              } as DropdownItem)
            : ({
                id: "archive",
                label: "Mark as resolved",
                icon: "check_circle",
                onSelect: () => void archiveDirect(comment.id),
              } as DropdownItem),
          ...(!isResolved
            ? [
                {
                  id: "to-backlog",
                  label: "Move to future ideas",
                  icon: "lightbulb",
                  onSelect: () => void moveToBacklog(comment.id),
                } as DropdownItem,
              ]
            : []),
        ]
      : []),
    ...(ownComment
      ? [
          { id: "sep", separator: true } as DropdownItem,
          {
            id: "delete",
            label: "Delete",
            icon: "delete",
            danger: true,
            onSelect: () => void deleteComment(comment.id),
          } as DropdownItem,
        ]
      : []),
  ]

  return (
    <div
      {...{ [OVERLAY_DATA_ATTR]: "" }}
      className="fixed pointer-events-none"
      style={{ zIndex: REVIEW_Z.popover, left, width: THREAD_WIDTH, ...vertical }}
    >
      <div
        className={[
          "pointer-events-auto flex flex-col rounded-(--auis-radius-xl) bg-(--auis-bg-raised) border shadow-lg overflow-hidden",
          isResolved
            ? "border-(--au-emerald-300) dark:border-(--au-emerald-800)"
            : "border-(--auis-border-subtle)",
        ].join(" ")}
        style={{ maxHeight }}
      >
        <header className="flex items-center gap-2 pl-3.5 pr-2 py-2.5 border-b border-(--auis-border-subtle)">
          <ReviewAvatar
            authorKind={comment.authorKind}
            authorId={comment.authorId}
            authorName={comment.authorName}
            colorToken={comment.authorColorToken}
            size={36}
          />
          <div className="flex items-baseline gap-1.5 min-w-0 flex-1">
            <AuthorName
              name={comment.authorName}
              email={comment.authorEmail}
              role={comment.authorRole}
              className="body-sm font-medium text-(--auis-fg-primary) truncate"
            />
            {comment.authorKind === "agent" && <AgentBadge />}
            <span
              className="shrink-0 body-xs text-(--auis-fg-tertiary) tabular-nums"
              title={formatFullTimestamp(comment.createdAt)}
            >
              {formatRelative(comment.createdAt)}
            </span>
          </div>
          {comment.origin === "ux-flow" && <UxFlowChip flowRef={comment.flowRef} />}

          <div className="flex items-center gap-0.5 shrink-0">
            {comment.visibility === "admins" && (
              <span
                className="h-7 w-7 inline-flex items-center justify-center text-(--auis-fg-tertiary)"
                title="Private: only admins see it"
              >
                <Icon name="lock" size={16} />
                <span className="sr-only">Private</span>
              </span>
            )}
            {isInReview && (
              <div role="group" aria-label="Review" className="flex items-center gap-0.5 mr-0.5">
                <Pill variant="beta" className="mr-1">
                  In review
                </Pill>
                {isAdmin && (
                  <>
                    <Button
                      variant="primary"
                      size="sm"
                      iconOnly="check"
                      iconSize={16}
                      aria-label="Approve"
                      title="Approve"
                      onClick={() => void approveComment(comment.id)}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      iconOnly="undo"
                      iconSize={20}
                      aria-label="Reject"
                      title="Reject"
                      onClick={() => void rejectComment(comment.id)}
                      className="bg-transparent! text-(--auis-fg-secondary)! hover:bg-(--auis-bg-hover)!"
                    />
                  </>
                )}
              </div>
            )}
            {!(isInReview && isAdmin) && (
              <button
                type="button"
                onClick={() => setSheetOpen(true)}
                aria-label="Open in the side panel"
                title="Open in the side panel"
                className="h-7 w-7 inline-flex items-center justify-center rounded-sm text-(--auis-fg-tertiary) hover:text-(--auis-fg-primary) hover:bg-(--auis-bg-hover) transition-colors"
              >
                <Icon name="open_in_full" size={16} />
              </button>
            )}
            {!isResolved && !isInReview && isAdmin && (
              <button
                type="button"
                onClick={() => void archiveDirect(comment.id)}
                aria-label="Mark as resolved"
                title="Mark as resolved"
                className="h-7 w-7 inline-flex items-center justify-center rounded-sm text-(--auis-fg-tertiary) hover:text-(--auis-accent-success) hover:bg-(--auis-bg-hover) transition-colors"
              >
                <Icon name="check_circle" size={20} />
              </button>
            )}
            {isResolved && (
              <button
                type="button"
                onClick={isAdmin ? () => void reopenFromArchive(comment.id) : undefined}
                disabled={!isAdmin}
                aria-pressed="true"
                aria-label={isAdmin ? "Resolved. Reopen the conversation" : "Resolved"}
                title={isAdmin ? "Reopen the conversation" : "Resolved"}
                className="h-7 w-7 inline-flex items-center justify-center rounded-sm bg-(--au-emerald-100) dark:bg-(--au-emerald-900) text-(--auis-accent-success) transition-colors disabled:cursor-default"
              >
                <Icon name="check_circle" size={20} fill={1} />
              </button>
            )}
            <DropdownMenu
              align="end"
              trigger={
                <button
                  type="button"
                  aria-label="Actions"
                  className="h-7 w-7 inline-flex items-center justify-center rounded-sm text-(--auis-fg-tertiary) hover:text-(--auis-fg-primary) hover:bg-(--auis-bg-hover) transition-colors"
                >
                  <Icon name="more_horiz" size={20} />
                </button>
              }
              items={dropdownItems}
            />
            <button
              type="button"
              onClick={closeThread}
              aria-label="Close"
              className="h-7 w-7 inline-flex items-center justify-center rounded-sm text-(--auis-fg-tertiary) hover:text-(--auis-fg-primary) hover:bg-(--auis-bg-hover) transition-colors"
            >
              <Icon name="close" size={20} />
            </button>
          </div>
        </header>

        {/* Body: comment + replies */}
        <div ref={bodyRef} className="flex-1 overflow-y-auto px-3.5 py-3">
          {editing ? (
            <div className="flex flex-col gap-2">
              <textarea
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                onPaste={editImg.onPaste}
                rows={3}
                autoFocus
                placeholder="Edit the comment…"
                className="w-full rounded-sm border border-(--auis-border-subtle) bg-(--auis-bg-surface) p-2 body-sm text-(--auis-fg-primary) focus:outline-hidden focus:border-(--auis-accent-brand) resize-none"
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
                        className="h-16 w-16 rounded-sm object-cover border border-(--auis-border-subtle)"
                      />
                      <button
                        type="button"
                        onClick={() => editImg.remove(idx)}
                        aria-label="Remove image"
                        className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-(--auis-bg-raised) border border-(--auis-border-subtle) flex items-center justify-center text-(--auis-fg-tertiary) hover:text-(--auis-fg-primary) opacity-0 group-hover/ethumb:opacity-100 transition-opacity"
                      >
                        <Icon name="close" size={9} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex items-center justify-end gap-1">
                <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  loading={editSaving}
                  disabled={
                    editSaving ||
                    (editText.trim().length === 0 && editImg.images.length === 0)
                  }
                  onClick={() => void saveEdit()}
                >
                  Save
                </Button>
              </div>
            </div>
          ) : (
            <>
              {comment.text.length > 0 && (
                <CommentText
                  className={[
                    "m-0 body-sm whitespace-pre-wrap leading-relaxed",
                    isResolved
                      ? "text-(--auis-fg-tertiary) line-through decoration-(--auis-fg-muted)"
                      : "text-(--auis-fg-primary)",
                  ].join(" ")}
                  text={comment.text}
                />
              )}

              {comment.images && comment.images.length > 0 && (
                <div
                  className={[
                    "flex flex-wrap gap-2",
                    comment.text.length > 0 ? "mt-2.5" : "",
                  ].join(" ")}
                >
                  {comment.images.map((src, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => window.open(src, "_blank", "noopener")}
                      className="rounded-md overflow-hidden border border-(--auis-border-subtle) hover:border-(--auis-border-strong) transition-colors focus:outline-hidden"
                      aria-label={`View image ${idx + 1}`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={src} alt="" className="h-24 w-24 object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </>
          )}

          {isResolved ? (
            <div className="mt-3 flex gap-2.5 rounded-md px-3 py-2.5 bg-(--au-emerald-100) dark:bg-(--au-emerald-900) border border-(--au-emerald-300) dark:border-(--au-emerald-800)">
              <Icon
                name="check_circle"
                size={16}
                fill={1}
                className="mt-0.5 shrink-0 text-(--auis-accent-success)"
              />
              <div className="flex flex-col gap-0.5 min-w-0">
                <span className="body-xs font-medium text-(--auis-fg-primary) tabular-nums">
                  {resolvedBy
                    ? `Resolved by ${resolvedBy} · ${formatFullTimestamp(resolvedAt ?? comment.createdAt)}`
                    : "Resolved"}
                </span>
                {comment.resolution?.summary && (
                  <span className="body-xs text-(--auis-fg-secondary)">
                    {comment.resolution.summary}
                  </span>
                )}
              </div>
            </div>
          ) : (
            comment.resolution?.summary && (
              <p className="m-0 mt-2 body-xs text-(--auis-fg-tertiary) italic">
                {comment.resolution.summary}
              </p>
            )
          )}

          {replies.length > 0 && (
            <div className="mt-3 flex flex-col gap-1">
              {replies.map((r) => (
                <ReplyRow key={r.id} reply={r} commentId={comment.id} />
              ))}
            </div>
          )}

          {agentRun && (
            <div className="mt-3 flex items-start gap-2" aria-live="polite">
              <ReviewAvatar
                authorKind="agent"
                authorId={agentRun.agentId}
                authorName={agentName}
                colorToken="var(--auis-fg-tertiary)"
                size={24}
              />
              <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                <div className="flex items-center gap-1.5 min-h-6">
                  <span className="body-sm font-medium text-(--auis-fg-primary)">{agentName}</span>
                  <AgentBadge />
                </div>
                <div className="rounded-md border border-(--auis-border-subtle) bg-(--auis-bg-surface) px-3 py-2.5 text-(--auis-fg-secondary)">
                  <Spinner size="sm" label={agentRunLabel(agentRun)} />
                </div>
              </div>
            </div>
          )}
        </div>

        {isResolved && isAdmin ? (
          <div className="p-1 border-t border-(--auis-border-subtle)">
            <Button
              variant="ghost"
              block
              iconLeft="refresh"
              onClick={() => void reopenFromArchive(comment.id)}
              className="bg-transparent! border-transparent! text-(--auis-fg-secondary)! hover:bg-(--auis-bg-hover)!"
            >
              Reopen the conversation
            </Button>
          </div>
        ) : (
          <div className="px-2 pb-2 pt-1">
            <ReplyComposer
              key={comment.id}
              commentId={comment.id}
              element={elementFromCommentContext(comment.context)}
            />
          </div>
        )}
      </div>
    </div>
  )
}
