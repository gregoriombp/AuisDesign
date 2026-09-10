"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { AuButton } from "@/components/ui/AuButton"
import { AuDropdownMenu, type AuDropdownItem } from "@/components/ui/AuDropdownMenu"
import { AuPill } from "@/components/ui/AuPill"
import { Icon } from "@/components/ui/Icon"
import { useReviewStore } from "@/lib/auis-review/store"
import { useCurrentUrl } from "@/lib/auis-review/hooks"
import {
  findPrimaryScrollContainer,
  useLayoutVersion,
} from "@/lib/auis-review/scrollOffset"
import {
  formatFullTimestamp,
  formatRelative,
} from "@/lib/auis-review/format"
import { STALE_DOCUMENT_HEIGHT_THRESHOLD } from "./constants"
import { ReviewAvatar } from "./ReviewAvatar"
import { ReplyComposer } from "./ReplyComposer"
import { UxFlowChip } from "./UxFlowChip"
import { CommentText } from "./CommentText"
import { AuthorName } from "./PersonHover"
import { useImageAttach } from "@/lib/auis-review/useImageAttach"
import { elementFromCommentContext } from "@/lib/auis-review/elementContext"
import { permalinkPath } from "@/lib/auis-review/permalink"
import { resolveAnchoredElement } from "@/lib/auis-review/elementAnchor"
import { canonicalizeReviewUrl } from "@/lib/auis-review/urlMatch"
import type { ReviewComment, ReviewReply } from "./types"

function isStale(comment: ReviewComment, currentDocHeight: number): boolean {
  if (!comment.documentHeight) return false
  const ratio =
    Math.abs(comment.documentHeight - currentDocHeight) /
    comment.documentHeight
  return ratio > STALE_DOCUMENT_HEIGHT_THRESHOLD
}

function StatusPill({ status }: { status: ReviewComment["status"] }) {
  if (status === "in_review") return <AuPill variant="beta">In review</AuPill>
  if (status === "resolved") return <AuPill variant="live">Resolved</AuPill>
  if (status === "backlog")
    return (
      <AuPill variant="draft" dot={false}>
        Future idea
      </AuPill>
    )
  return null
}

function targetSummary(comment: ReviewComment): string | null {
  const target = comment.context?.target
  if (!target) return null
  const detail = target.label ?? target.text ?? target.attributes?.href
  if (!detail) return target.role ? `${target.tag} · ${target.role}` : target.tag
  return `${target.tag} · ${detail}`
}

/**
 * Where the pin was dropped, in words: the landmark trail and, when the target
 * was inside an overlay, how one got there. Only shows when the anchor does not
 * resolve — the pin is not drawn then, and without this the comment vanishes
 * from the screen with no explanation.
 */
function whereItWas(comment: ReviewComment): string | null {
  const trail = comment.context?.location
  const place = trail && trail.length > 0 ? trail.join(" › ") : null
  const steps = (comment.revealPath ?? [])
    .map((step) => step.label?.trim())
    .filter((label): label is string => !!label)
  const how = steps.length > 0 ? `by opening ${steps.join(" › ")}` : null
  if (place && how) return `${place} — ${how}`
  return place ?? how
}

export function ReplyRow({
  reply,
  commentId,
}: {
  reply: ReviewReply
  commentId: string
}) {
  const editReply = useReviewStore((s) => s.editReply)
  const sessionRole = useReviewStore((s) => s.sessionRole)
  const sessionEmail = useReviewStore((s) => s.sessionEmail)
  const isAgent = reply.authorKind === "agent"
  // A reviewer only edits their own reply; an admin edits any human reply.
  const canEdit =
    !isAgent &&
    (sessionRole === "admin" ||
      (!!sessionEmail &&
        reply.authorEmail?.toLowerCase() === sessionEmail.toLowerCase()))
  const [editing, setEditing] = React.useState(false)
  const [editText, setEditText] = React.useState(reply.text)
  const [saving, setSaving] = React.useState(false)
  const editImg = useImageAttach(reply.images ?? [])

  const startEdit = () => {
    setEditText(reply.text)
    editImg.reset(reply.images ?? [])
    setEditing(true)
  }
  const saveEdit = async () => {
    if (editText.trim().length === 0) return
    setSaving(true)
    try {
      await editReply(commentId, reply.id, editText, editImg.images)
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="group/reply flex items-start gap-2 py-1.5">
      <ReviewAvatar
        authorKind={reply.authorKind}
        authorId={reply.authorId}
        authorName={reply.authorName}
        colorToken={reply.authorColorToken}
        size={20}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 leading-tight">
          <AuthorName
            name={reply.authorName}
            email={reply.authorEmail}
            role={reply.authorRole}
            className="body-xs font-medium text-(--fg-primary) truncate"
          />
          {isAgent && (
            <span className="text-2xs px-1 py-0 rounded-xs bg-(--bg-muted) text-(--fg-tertiary)">
              agent
            </span>
          )}
          <span className="text-2xs text-(--fg-tertiary) tabular-nums">
            {formatRelative(reply.createdAt)}
            {reply.editedAt ? " · edited" : ""}
          </span>
          {canEdit && !editing && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                startEdit()
              }}
              aria-label="Edit reply"
              title="Edit reply"
              className="ml-auto shrink-0 h-5 w-5 inline-flex items-center justify-center rounded-xs text-(--fg-tertiary) hover:text-(--fg-primary) hover:bg-(--bg-hover) opacity-0 group-hover/reply:opacity-100 focus-visible:opacity-100 transition-opacity"
            >
              <Icon name="edit" size={11} />
            </button>
          )}
        </div>

        {editing ? (
          <div
            onClick={(e) => e.stopPropagation()}
            className="mt-1 flex flex-col gap-1.5"
          >
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onPaste={editImg.onPaste}
              rows={2}
              autoFocus
              className="w-full rounded-sm border border-(--border-subtle) bg-(--bg-surface) p-2 body-sm text-(--fg-primary) focus:outline-hidden focus:border-(--accent-brand) resize-none"
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") void saveEdit()
                if (e.key === "Escape") setEditing(false)
              }}
            />
            {editImg.images.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {editImg.images.map((src, idx) => (
                  <div key={idx} className="relative group/rethumb">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={src}
                      alt=""
                      className="h-14 w-14 rounded-sm object-cover border border-(--border-subtle)"
                    />
                    <button
                      type="button"
                      onClick={() => editImg.remove(idx)}
                      aria-label="Remove image"
                      className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-(--bg-raised) border border-(--border-subtle) flex items-center justify-center text-(--fg-tertiary) hover:text-(--fg-primary) opacity-0 group-hover/rethumb:opacity-100 transition-opacity"
                    >
                      <Icon name="close" size={9} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-center justify-end gap-1">
              <AuButton variant="ghost" size="sm" onClick={() => setEditing(false)}>
                Cancel
              </AuButton>
              <AuButton
                variant="primary"
                size="sm"
                loading={saving}
                disabled={saving || editText.trim().length === 0}
                onClick={() => void saveEdit()}
              >
                Save
              </AuButton>
            </div>
          </div>
        ) : (
          <>
            {reply.text.length > 0 && (
              <CommentText
                className="m-0 body-sm text-(--fg-primary) whitespace-pre-wrap leading-relaxed"
                text={reply.text}
              />
            )}
            {reply.images && reply.images.length > 0 && (
              <div
                className={[
                  "flex flex-wrap gap-1.5",
                  reply.text.length > 0 ? "mt-1.5" : "mt-0.5",
                ].join(" ")}
              >
                {reply.images.map((src, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      window.open(src, "_blank", "noopener")
                    }}
                    className="rounded-sm overflow-hidden border border-(--border-subtle) hover:border-(--border-strong) transition-colors focus:outline-hidden"
                    aria-label={`View image ${idx + 1}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt="" className="h-16 w-16 object-cover" />
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

type Context = "pin" | "sheet" | "inbox"

type Props = {
  comment: ReviewComment
  /** Where the card is being rendered. Controls visibility of Approve/Reject buttons. */
  context?: Context
  /** When provided, renders a checkbox for bulk selection. */
  selectable?: boolean
  selected?: boolean
  onToggleSelected?: () => void
  /** True if this card is for an archived comment (resolved). */
  archived?: boolean
}

export function ReviewCommentCard({
  comment,
  context = "pin",
  selectable = false,
  selected: bulkSelected = false,
  onToggleSelected,
  archived = false,
}: Props) {
  const router = useRouter()
  const selectedId = useReviewStore((s) => s.selectedCommentId)
  const selectComment = useReviewStore((s) => s.selectComment)
  const setSheetOpen = useReviewStore((s) => s.setSheetOpen)
  const setActive = useReviewStore((s) => s.setActive)
  const sessionRole = useReviewStore((s) => s.sessionRole)
  const sessionEmail = useReviewStore((s) => s.sessionEmail)
  const archiveDirect = useReviewStore((s) => s.archiveDirect)
  const approveComment = useReviewStore((s) => s.approveComment)
  const rejectComment = useReviewStore((s) => s.rejectComment)
  const reopenFromArchive = useReviewStore((s) => s.reopenFromArchive)
  const editComment = useReviewStore((s) => s.editComment)
  const moveToBacklog = useReviewStore((s) => s.moveToBacklog)
  const restoreFromBacklog = useReviewStore((s) => s.restoreFromBacklog)
  const deleteComment = useReviewStore((s) => s.deleteComment)
  const currentUrl = useCurrentUrl()
  const layoutVersion = useLayoutVersion()

  const [historyOpen, setHistoryOpen] = React.useState(false)
  const [replyOpen, setReplyOpen] = React.useState(false)
  const [editing, setEditing] = React.useState(false)
  const [editText, setEditText] = React.useState(comment.text)
  const [editSaving, setEditSaving] = React.useState(false)
  const editImg = useImageAttach(comment.images ?? [])

  const selected = selectedId === comment.id
  const isOnThisPage = canonicalizeReviewUrl(comment.url) === currentUrl
  // Only matters when the comment IS on this screen: elsewhere there is never a
  // pin. `layoutVersion` is a dependency because it is what observes portals
  // mounting — without it the card would not notice the modal reopening.
  const anchorLost = React.useMemo(() => {
    if (!isOnThisPage || comment.status === "backlog") return false
    if (!comment.anchor?.el) return false
    return !resolveAnchoredElement(comment.anchor)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnThisPage, comment.anchor, comment.status, layoutVersion])
  const lostWhere = anchorLost ? whereItWas(comment) : null
  const stale =
    isOnThisPage &&
    typeof window !== "undefined" &&
    isStale(comment, document.documentElement.scrollHeight)

  const navigateToAnchor = () => {
    selectComment(comment.id)
    // A future idea is standalone (no pin) — only select, never scroll/navigate.
    if (comment.status === "backlog") return
    // Keep the review active and the drawer open while taking you to another
    // screen — the navigation is client-side, so it is smooth (no reload).
    setActive(true)
    setSheetOpen(true)
    if (!isOnThisPage) {
      router.push(permalinkPath(comment))
      return
    }
    const anchorY =
      comment.anchor.kind === "pin"
        ? comment.anchor.position.y
        : comment.anchor.centroid.y
    const targetY = Math.max(0, anchorY - 120)
    const container = findPrimaryScrollContainer()
    if (container) {
      container.scrollTo({ top: targetY, behavior: "smooth" })
    } else {
      window.scrollTo({ top: targetY, behavior: "smooth" })
    }
  }

  const copyPermalink = () => {
    if (typeof window === "undefined") return
    const base = window.location.origin
    const fullUrl = `${base}${permalinkPath(comment)}`
    void navigator.clipboard?.writeText(fullUrl)
  }

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

  const isBacklog = comment.status === "backlog"
  // Hierarchy (UI mirror; the server re-validates): an admin moderates; a
  // reviewer edits/deletes only what is theirs and toggles open ↔ future idea
  // on their own pin.
  const isAdmin = sessionRole === "admin"
  const ownComment =
    isAdmin ||
    (!!sessionEmail &&
      comment.authorEmail?.toLowerCase() === sessionEmail.toLowerCase())
  const dropdownItems: AuDropdownItem[] = [
    ...(ownComment
      ? [
          {
            id: "edit",
            label: "Edit",
            icon: "edit",
            onSelect: startEdit,
          } as AuDropdownItem,
        ]
      : []),
    {
      id: "copy-link",
      label: "Copy link",
      icon: "link",
      onSelect: copyPermalink,
    },
    ...(isBacklog && ownComment
      ? [
          {
            id: "restore-backlog",
            label: "Take out of the backlog",
            icon: "outbox",
            onSelect: () => void restoreFromBacklog(comment.id),
          } as AuDropdownItem,
        ]
      : []),
    ...(isAdmin && !isBacklog
      ? [
          archived
            ? ({
                id: "reopen",
                label: "Reopen",
                icon: "refresh",
                onSelect: () => void reopenFromArchive(comment.id),
              } as AuDropdownItem)
            : comment.status === "open"
            ? ({
                id: "archive",
                label: "Mark as resolved",
                icon: "check_circle",
                onSelect: () => void archiveDirect(comment.id),
              } as AuDropdownItem)
            : ({
                id: "reject",
                label: "Reopen (reject review)",
                icon: "refresh",
                onSelect: () => void rejectComment(comment.id),
              } as AuDropdownItem),
        ]
      : []),
    ...(!isBacklog &&
    !archived &&
    (isAdmin || (ownComment && comment.status === "open"))
      ? [
          {
            id: "to-backlog",
            label: "Move to future ideas",
            icon: "lightbulb",
            onSelect: () => void moveToBacklog(comment.id),
          } as AuDropdownItem,
        ]
      : []),
    ...(ownComment
      ? [
          { id: "sep", separator: true } as AuDropdownItem,
          {
            id: "delete",
            label: "Delete",
            icon: "delete",
            danger: true,
            onSelect: () => void deleteComment(comment.id),
          } as AuDropdownItem,
        ]
      : []),
  ]

  const replies = Array.isArray(comment.replies) ? comment.replies : []
  const showApprovalButtons =
    !archived &&
    comment.status === "in_review" &&
    (context === "sheet" || context === "inbox") &&
    isAdmin
  const target = targetSummary(comment)

  return (
    <article
      onClick={navigateToAnchor}
      className={[
        "group rounded-md border p-3 cursor-pointer transition-colors",
        selected
          ? "border-(--accent-brand) bg-(--bg-hover)"
          : "border-(--border-subtle) bg-(--bg-raised) hover:border-(--border-default)",
      ].join(" ")}
    >
      <header className="flex items-center gap-2 mb-2">
        {selectable && (
          <input
            type="checkbox"
            checked={bulkSelected}
            onChange={(e) => {
              e.stopPropagation()
              onToggleSelected?.()
            }}
            onClick={(e) => e.stopPropagation()}
            aria-label="Select"
            className="accent-(--accent-brand) mr-0.5"
          />
        )}
        <ReviewAvatar
          authorKind={comment.authorKind}
          authorId={comment.authorId}
          authorName={comment.authorName}
          colorToken={comment.authorColorToken}
          size={24}
        />
        <div className="flex flex-col leading-tight min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <AuthorName
              name={comment.authorName}
              email={comment.authorEmail}
              role={comment.authorRole}
              className="body-xs font-medium text-(--fg-primary) truncate"
            />
            {comment.authorKind === "agent" && (
              <span className="text-2xs px-1 py-0 rounded-xs bg-(--bg-muted) text-(--fg-tertiary)">
                agent
              </span>
            )}
          </div>
          <span
            className="text-2xs text-(--fg-tertiary) tabular-nums"
            title={new Date(comment.createdAt).toISOString()}
          >
            {formatFullTimestamp(comment.createdAt)}
          </span>
        </div>
        {comment.origin === "ux-flow" && <UxFlowChip flowRef={comment.flowRef} />}
        <div className="ml-auto flex items-center gap-1">
          {comment.visibility === "admins" && (
            <span
              className="inline-flex items-center gap-1 body-xs text-(--fg-tertiary)"
              title="Visible to admins only"
            >
              <Icon name="lock" size={11} />
              Private
            </span>
          )}
          <StatusPill status={comment.status} />
          {stale && (
            <AuPill variant="draft" dot={false}>
              Stale
            </AuPill>
          )}
          <AuDropdownMenu
            trigger={
              <button
                type="button"
                onClick={(e) => e.stopPropagation()}
                aria-label="Actions"
                className="h-7 w-7 inline-flex items-center justify-center rounded-sm text-(--fg-tertiary) hover:text-(--fg-primary) hover:bg-(--bg-hover)"
              >
                <Icon name="more_horiz" size={14} />
              </button>
            }
            items={dropdownItems}
          />
        </div>
      </header>

      {editing ? (
        <div onClick={(e) => e.stopPropagation()} className="flex flex-col gap-2">
          <textarea
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onPaste={editImg.onPaste}
            rows={3}
            autoFocus
            placeholder="Edit the comment…"
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
                    aria-label="Remove image"
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
              Cancel
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
              Save
            </AuButton>
          </div>
        </div>
      ) : (
        <>
          {comment.text.length > 0 && (
            <CommentText
              className="body-sm text-(--fg-primary) whitespace-pre-wrap leading-relaxed"
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
                  onClick={(e) => {
                    e.stopPropagation()
                    window.open(src, "_blank", "noopener")
                  }}
                  className="rounded-sm overflow-hidden border border-(--border-subtle) hover:border-(--border-strong) transition-colors focus:outline-hidden"
                  aria-label={`View image ${idx + 1}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt="" className="h-20 w-20 object-cover" />
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

      {anchorLost && (
        <div className="mt-2 flex items-start gap-1 body-xs text-(--fg-tertiary)">
          <Icon name="location_off" size={11} className="mt-0.5 shrink-0" />
          <span>
            The pin is not drawn on this screen.
            {lostWhere ? ` It was dropped at ${lostWhere}.` : ""}
          </span>
        </div>
      )}

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          navigateToAnchor()
        }}
        title={`Go to ${comment.url}`}
        className="mt-2 w-full body-xs text-(--fg-tertiary) flex items-center gap-1 rounded-xs hover:text-(--accent-brand) transition-colors text-left"
      >
        <Icon name="link" size={11} />
        <span className="truncate underline-offset-2 group-hover:underline">
          {comment.url}
        </span>
        {!isOnThisPage && (
          <Icon name="arrow_outward" size={11} className="ml-auto shrink-0" />
        )}
      </button>

      {comment.resolution?.summary && (
        <p
          className="m-0 mt-2 body-xs text-(--fg-tertiary) italic"
          title={
            comment.resolution.approvedAt
              ? `Approved on ${new Date(
                  comment.resolution.approvedAt
                ).toLocaleString("en-GB")}`
              : undefined
          }
        >
          {comment.resolution.summary}
        </p>
      )}

      {replies.length > 0 && (
        <div className="mt-3 pt-2 border-t border-(--border-subtle) flex flex-col divide-y divide-(--border-subtle)">
          {replies.map((r) => (
            <ReplyRow key={r.id} reply={r} commentId={comment.id} />
          ))}
        </div>
      )}

      {showApprovalButtons && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="mt-3 flex items-center gap-2"
        >
          <AuButton
            variant="primary"
            size="sm"
            iconLeft="check_circle"
            onClick={() => void approveComment(comment.id)}
          >
            Approve
          </AuButton>
          <AuButton
            variant="ghost"
            size="sm"
            iconLeft="undo"
            onClick={() => void rejectComment(comment.id)}
          >
            Reject
          </AuButton>
        </div>
      )}

      {(context === "sheet" || context === "inbox") && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="mt-2 flex items-center gap-3 body-xs"
        >
          <button
            type="button"
            onClick={() => setReplyOpen((v) => !v)}
            className="inline-flex items-center gap-1 text-(--fg-secondary) hover:text-(--fg-primary)"
          >
            <Icon name="reply" size={11} />
            {replyOpen ? "Cancel reply" : "Reply"}
          </button>
          <button
            type="button"
            onClick={() => setHistoryOpen((v) => !v)}
            className="inline-flex items-center gap-1 text-(--fg-tertiary) hover:text-(--fg-secondary)"
            aria-expanded={historyOpen}
          >
            <Icon name={historyOpen ? "expand_less" : "expand_more"} size={11} />
            History
          </button>
        </div>
      )}

      {replyOpen && (
        <div onClick={(e) => e.stopPropagation()} className="mt-2">
          <ReplyComposer
            commentId={comment.id}
            element={elementFromCommentContext(comment.context)}
            autoFocus
            onDone={() => setReplyOpen(false)}
          />
        </div>
      )}

      {historyOpen && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="mt-2 rounded-sm bg-(--bg-surface) border border-(--border-subtle) p-2 flex flex-col gap-1 body-xs text-(--fg-secondary)"
        >
          <div>
            <span className="text-(--fg-primary)">Created</span> ·{" "}
            <span className="text-(--fg-tertiary)">
              {formatFullTimestamp(comment.createdAt)} by {comment.authorName}
            </span>
          </div>
          {replies.map((r) => (
            <div key={r.id}>
              <span className="text-(--fg-primary)">Reply</span> ·{" "}
              <span className="text-(--fg-tertiary)">
                {formatFullTimestamp(r.createdAt)} by {r.authorName}
                {r.authorKind === "agent" ? " (agent)" : ""}
              </span>
            </div>
          ))}
          {comment.resolution?.at && (
            <div>
              <span className="text-(--fg-primary)">In review</span> ·{" "}
              <span className="text-(--fg-tertiary)">
                {formatFullTimestamp(comment.resolution.at)} by{" "}
                {comment.resolution.actor.name}
                {comment.resolution.actor.kind === "agent" ? " (agent)" : ""}
              </span>
            </div>
          )}
          {comment.resolution?.approvedAt && comment.resolution.approvedBy && (
            <div>
              <span className="text-(--fg-primary)">Approved</span> ·{" "}
              <span className="text-(--fg-tertiary)">
                {formatFullTimestamp(comment.resolution.approvedAt)} by{" "}
                {comment.resolution.approvedBy.name}
              </span>
            </div>
          )}
        </div>
      )}
    </article>
  )
}
