"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ReviewAvatar } from "@/components/auis-review/ReviewAvatar"
import { AuthorName } from "@/components/auis-review/PersonHover"
import { BacklogComposer } from "@/components/auis-review/BacklogComposer"
import { ReviewFilterControls } from "@/components/auis-review/ReviewFilterBar"
import { AuButton } from "@/components/ui/AuButton"
import { AuDropdownMenu, type AuDropdownItem } from "@/components/ui/AuDropdownMenu"
import {
  AuEmpty,
  AuEmptyDescription,
  AuEmptyHeader,
  AuEmptyMedia,
  AuEmptyTitle,
} from "@/components/ui/AuEmpty"
import { AuInput } from "@/components/ui/AuInput"
import { AuPill } from "@/components/ui/AuPill"
import { AuStatCard } from "@/components/ui/AuStatCard"
import { Icon } from "@/components/ui/Icon"
import { useReviewStore } from "@/lib/auis-review/store"
import { permalinkPath } from "@/lib/auis-review/permalink"
import {
  DEFAULT_REVIEW_FILTERS,
  applyReviewFilters,
  collectAuthorOptions,
  collectPageOptions,
  type ReviewListFilters,
} from "@/lib/auis-review/commentFilters"
import type { ReviewComment } from "@/components/auis-review/types"

// "backlog" = Future ideas — their home is HERE now (they left the drawer).
type Tab = "open" | "in_review" | "backlog" | "archive"

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}

function formatTimestamp(ts: number): string {
  const d = new Date(ts)
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()} · ${pad2(
    d.getHours()
  )}:${pad2(d.getMinutes())}`
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
  return <AuPill variant="draft">Open</AuPill>
}

function CommentCard({
  comment,
  archived,
  selectable,
  selected,
  onToggleSelected,
}: {
  comment: ReviewComment
  archived: boolean
  selectable: boolean
  selected: boolean
  onToggleSelected: () => void
}) {
  const router = useRouter()
  const archiveDirect = useReviewStore((s) => s.archiveDirect)
  const approveComment = useReviewStore((s) => s.approveComment)
  const rejectComment = useReviewStore((s) => s.rejectComment)
  const reopenFromArchive = useReviewStore((s) => s.reopenFromArchive)
  const moveToBacklog = useReviewStore((s) => s.moveToBacklog)
  const restoreFromBacklog = useReviewStore((s) => s.restoreFromBacklog)
  const deleteComment = useReviewStore((s) => s.deleteComment)
  const selectComment = useReviewStore((s) => s.selectComment)
  const setSheetOpen = useReviewStore((s) => s.setSheetOpen)
  const setActive = useReviewStore((s) => s.setActive)
  const sessionRole = useReviewStore((s) => s.sessionRole)
  const sessionEmail = useReviewStore((s) => s.sessionEmail)

  // Hierarchy (UI mirror; the server re-validates): status is admin; delete is
  // admin or owner.
  const isAdmin = sessionRole === "admin"
  const ownComment =
    isAdmin ||
    (!!sessionEmail &&
      comment.authorEmail?.toLowerCase() === sessionEmail.toLowerCase())

  // Opens the comment's screen keeping Review Mode on and the comment
  // highlighted (permalink), through client-side navigation — no reload.
  // The URL alone does not say whether the pin was inside a modal. The trail
  // is already recorded and comes back in the lean projection.
  const place = comment.context?.location?.join(" › ")

  const openOnScreen = () => {
    selectComment(comment.id)
    setActive(true)
    setSheetOpen(true)
    router.push(permalinkPath(comment))
  }

  const isBacklog = comment.status === "backlog"
  const items: AuDropdownItem[] = [
    {
      id: "open",
      label: "Open screen",
      icon: "open_in_new",
      onSelect: openOnScreen,
    },
  ]
  if (isBacklog && ownComment) {
    items.push({
      id: "restore-backlog",
      label: "Take out of the backlog",
      icon: "outbox",
      onSelect: () => void restoreFromBacklog(comment.id),
    })
  }
  if (isAdmin && !isBacklog) {
    if (archived) {
      items.push({
        id: "reopen",
        label: "Reopen",
        icon: "refresh",
        onSelect: () => void reopenFromArchive(comment.id),
      })
    } else if (comment.status === "in_review") {
      items.push(
        {
          id: "approve",
          label: "Approve",
          icon: "check_circle",
          onSelect: () => void approveComment(comment.id),
        },
        {
          id: "reject",
          label: "Reject",
          icon: "undo",
          onSelect: () => void rejectComment(comment.id),
        }
      )
    } else {
      items.push(
        {
          id: "archive",
          label: "Mark as resolved",
          icon: "check_circle",
          onSelect: () => void archiveDirect(comment.id),
        },
        {
          id: "to-backlog",
          label: "Move to future ideas",
          icon: "lightbulb",
          onSelect: () => void moveToBacklog(comment.id),
        }
      )
    }
  }
  if (ownComment) {
    items.push(
      { id: "sep", separator: true },
      {
        id: "delete",
        label: "Delete",
        icon: "delete",
        danger: true,
        onSelect: () => void deleteComment(comment.id),
      }
    )
  }

  return (
    <div className="flex items-start gap-3 px-4 py-3 rounded-md border border-(--border-subtle) bg-(--bg-raised) hover:bg-(--bg-hover)">
      {selectable && (
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelected}
          aria-label="Select"
          className="mt-1 accent-(--accent-brand)"
        />
      )}
      <ReviewAvatar
        authorKind={comment.authorKind}
        authorId={comment.authorId}
        authorName={comment.authorName}
        colorToken={comment.authorColorToken}
        size={28}
        className="mt-0.5"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-1">
          <AuthorName
            name={comment.authorName}
            email={comment.authorEmail}
            role={comment.authorRole}
            className="text-sm font-medium text-(--fg-primary) truncate"
          />
          {comment.authorKind === "agent" && (
            <span className="text-2xs px-1 py-0 rounded-xs bg-(--bg-muted) text-(--fg-tertiary)">
              agent
            </span>
          )}
          <StatusPill status={comment.status} />
          {comment.visibility === "admins" && (
            <span
              className="inline-flex items-center gap-1 text-2xs text-(--fg-tertiary)"
              title="Visible to admins only"
            >
              <Icon name="lock" size={11} />
              Private
            </span>
          )}
          <span className="text-2xs text-(--fg-tertiary) tabular-nums ml-auto">
            {formatTimestamp(comment.createdAt)}
          </span>
        </div>
        <p className="m-0 body-sm text-(--fg-primary) whitespace-pre-wrap line-clamp-3">
          {comment.text}
        </p>
        {comment.resolution?.summary && (
          <p className="m-0 mt-1 text-2xs text-(--fg-tertiary) italic">
            {comment.resolution.summary}
          </p>
        )}
        <button
          type="button"
          onClick={openOnScreen}
          className="mt-1 inline-flex items-center gap-1 text-2xs text-(--fg-tertiary) hover:text-(--accent-brand)"
          title={`Go to ${comment.url}`}
        >
          <Icon name="web_asset" size={11} />
          <span className="truncate max-w-[280px]">{comment.url}</span>
          <Icon name="arrow_outward" size={11} />
        </button>
        {place && (
          <p
            className="m-0 mt-1 flex items-center gap-1 text-2xs text-(--fg-tertiary)"
            title={place}
          >
            <Icon name="my_location" size={11} className="shrink-0" />
            <span className="truncate max-w-[280px]">{place}</span>
          </p>
        )}
      </div>
      <AuDropdownMenu
        align="end"
        trigger={
          <button
            type="button"
            aria-label="Actions"
            className="h-7 w-7 inline-flex items-center justify-center rounded-sm text-(--fg-tertiary) hover:text-(--fg-primary) hover:bg-(--bg-hover)"
          >
            <Icon name="more_horiz" size={14} />
          </button>
        }
        items={items}
      />
    </div>
  )
}

export function CommentsPanel() {
  const comments = useReviewStore((s) => s.comments)
  const archivedComments = useReviewStore((s) => s.archivedComments)
  const archiveLoaded = useReviewStore((s) => s.archiveLoaded)
  const archiveCursor = useReviewStore((s) => s.archiveCursor)
  const refresh = useReviewStore((s) => s.refreshFromStorage)
  const loadArchivePage = useReviewStore((s) => s.loadArchivePage)
  const approveComment = useReviewStore((s) => s.approveComment)
  const rejectComment = useReviewStore((s) => s.rejectComment)
  const storage = useReviewStore((s) => s.storage)

  React.useEffect(() => {
    void refresh()
    void loadArchivePage(true)
    const unsubscribe = storage.subscribe?.(() => {
      void refresh()
      void loadArchivePage(true)
    })
    return unsubscribe
  }, [refresh, loadArchivePage, storage])

  const [tab, setTab] = React.useState<Tab>("open")
  const [search, setSearch] = React.useState("")
  const [filters, setFilters] = React.useState<ReviewListFilters>(
    DEFAULT_REVIEW_FILTERS
  )
  const [groupByUrl, setGroupByUrl] = React.useState(true)
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set())
  const [bulkBusy, setBulkBusy] = React.useState(false)
  const sessionRole = useReviewStore((s) => s.sessionRole)
  const isAdmin = sessionRole === "admin"

  React.useEffect(() => {
    setSelectedIds(new Set())
  }, [tab])

  const openCount = comments.filter((c) => c.status === "open").length
  const inReviewCount = comments.filter((c) => c.status === "in_review").length
  const archivedCount = archivedComments.length

  const source: ReviewComment[] = React.useMemo(() => {
    if (tab === "open") return comments.filter((c) => c.status === "open")
    if (tab === "in_review") return comments.filter((c) => c.status === "in_review")
    if (tab === "backlog") return comments.filter((c) => c.status === "backlog")
    return archivedComments
  }, [tab, comments, archivedComments])

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return source
    return source.filter(
      (c) =>
        c.text.toLowerCase().includes(q) ||
        c.authorName?.toLowerCase().includes(q) ||
        c.url?.toLowerCase().includes(q) ||
        c.replies?.some((r) => r.text.toLowerCase().includes(q))
    )
  }, [source, search])

  const sorted = React.useMemo(
    () => applyReviewFilters(filtered, filters),
    [filtered, filters]
  )

  // Dropdown options come from the whole universe (active + archived),
  // otherwise the filter itself would hide the alternatives.
  const authorOptions = React.useMemo(
    () => collectAuthorOptions([...comments, ...archivedComments]),
    [comments, archivedComments]
  )
  const pageOptions = React.useMemo(
    () => collectPageOptions([...comments, ...archivedComments]),
    [comments, archivedComments]
  )

  const grouped = React.useMemo(() => {
    if (!groupByUrl) return null
    const map = new Map<string, ReviewComment[]>()
    for (const c of sorted) {
      const arr = map.get(c.url) ?? []
      arr.push(c)
      map.set(c.url, arr)
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]))
  }, [sorted, groupByUrl])

  const selectableTab = tab === "in_review" && isAdmin

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const runBulk = async (action: (id: string) => Promise<void>) => {
    setBulkBusy(true)
    try {
      for (const id of Array.from(selectedIds)) await action(id)
      setSelectedIds(new Set())
    } finally {
      setBulkBusy(false)
    }
  }

  const renderList = (items: ReviewComment[]) => (
    <div className="flex flex-col gap-2">
      {items.map((c) => (
        <CommentCard
          key={c.id}
          comment={c}
          archived={tab === "archive"}
          selectable={selectableTab}
          selected={selectedIds.has(c.id)}
          onToggleSelected={() => toggleSelected(c.id)}
        />
      ))}
    </div>
  )

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <AuStatCard size="sm" icon="forum" label="Total active" value={comments.length} />
        <AuStatCard size="sm" icon="pending" label="Open" value={openCount} />
        <AuStatCard size="sm" icon="hourglass_top" label="In review" value={inReviewCount} />
        <AuStatCard size="sm" icon="archive" label="Archived" value={archivedCount} />
      </div>

      <div className="rounded-lg border border-(--border-subtle) bg-(--bg-raised) p-4 flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[200px] max-w-md">
          <AuInput
            iconLeft="search"
            placeholder="Search text…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-1 p-1 rounded-full bg-(--bg-muted) text-2xs font-medium">
          {(["open", "in_review", "backlog", "archive"] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={[
                "px-3 py-1 rounded-full transition-colors inline-flex items-center gap-1.5",
                tab === t
                  ? "bg-(--bg-raised) text-(--fg-primary) shadow-sm"
                  : "text-(--fg-secondary) hover:text-(--fg-primary)",
              ].join(" ")}
            >
              {t === "open"
                ? "Open"
                : t === "in_review"
                ? "In review"
                : t === "backlog"
                ? "Future ideas"
                : "Archived"}
              {t === "in_review" && inReviewCount > 0 && (
                <span className="min-w-4 h-4 px-1 inline-flex items-center justify-center rounded-full text-3xs font-semibold bg-(--au-amber-100) text-(--au-amber-700) tabular-nums">
                  {inReviewCount}
                </span>
              )}
            </button>
          ))}
        </div>

        <ReviewFilterControls
          filters={filters}
          onChange={setFilters}
          authors={authorOptions}
          pages={pageOptions}
        />

        <label className="flex items-center gap-2 body-xs text-(--fg-secondary) cursor-pointer">
          <input
            type="checkbox"
            checked={groupByUrl}
            onChange={(e) => setGroupByUrl(e.target.checked)}
            className="accent-(--accent-brand)"
          />
          Group by screen
        </label>

        <span className="ml-auto inline-flex items-center gap-2 text-2xs text-(--fg-tertiary)">
          <Icon name="cloud_done" size={13} />
          Serverless bridge
        </span>

        <AuButton
          variant="ghost"
          size="sm"
          iconLeft="refresh"
          onClick={() => {
            void refresh()
            void loadArchivePage(true)
          }}
        >
          Refresh
        </AuButton>
      </div>

      {/* Compose a future idea — the backlog's home is this page. */}
      {tab === "backlog" && (
        <div className="max-w-xl">
          <BacklogComposer />
        </div>
      )}

      {selectableTab && selectedIds.size > 0 && (
        <div className="flex items-center justify-between gap-3 px-4 py-2 rounded-md bg-(--bg-muted) border border-(--border-subtle)">
          <span className="body-sm text-(--fg-secondary)">
            {selectedIds.size} selected
          </span>
          <div className="flex items-center gap-2">
            <AuButton
              variant="primary"
              size="sm"
              iconLeft="check_circle"
              loading={bulkBusy}
              disabled={bulkBusy}
              onClick={() => void runBulk(approveComment)}
            >
              Approve selected
            </AuButton>
            <AuButton
              variant="secondary"
              size="sm"
              iconLeft="undo"
              disabled={bulkBusy}
              onClick={() => void runBulk(rejectComment)}
            >
              Reject selected
            </AuButton>
          </div>
        </div>
      )}

      {sorted.length === 0 ? (
        <AuEmpty>
          <AuEmptyHeader>
            <AuEmptyMedia variant="icon">
              <Icon name="forum" size={20} />
            </AuEmptyMedia>
            <AuEmptyTitle>
              {tab === "archive" && !archiveLoaded
                ? "Loading archived…"
                : tab === "in_review"
                ? "Nothing waiting for review"
                : tab === "backlog"
                ? "No future ideas yet"
                : tab === "archive"
                ? "Nothing archived yet"
                : comments.length === 0
                ? "No comments yet"
                : "Nothing with these filters"}
            </AuEmptyTitle>
            <AuEmptyDescription>
              {tab === "open" && comments.length === 0
                ? "Turn on Review Mode (⌘⇧Y) on any screen and draw the first comment."
                : tab === "in_review"
                ? "When an agent marks something as resolved, it shows up here for you to approve or reject."
                : tab === "backlog"
                ? "Write down above what is not for now — or move an open comment here."
                : "Try loosening the search."}
            </AuEmptyDescription>
          </AuEmptyHeader>
        </AuEmpty>
      ) : grouped ? (
        <div className="flex flex-col gap-6">
          {grouped.map(([url, items]) => (
            <section key={url} className="flex flex-col gap-3">
              <header className="flex items-center gap-2 min-w-0">
                <Icon name="web_asset" size={14} className="text-(--fg-tertiary) shrink-0" />
                <Link
                  href={url}
                  className="body-sm text-(--fg-primary) hover:text-(--accent-brand) truncate"
                >
                  {url}
                </Link>
                <span className="body-xs text-(--fg-tertiary) shrink-0">
                  {items.length} in total
                </span>
              </header>
              {renderList(items)}
            </section>
          ))}
        </div>
      ) : (
        renderList(sorted)
      )}

      {tab === "archive" && archiveCursor && (
        <div className="flex justify-center">
          <AuButton
            variant="ghost"
            size="sm"
            iconLeft="expand_more"
            onClick={() => void loadArchivePage(false)}
          >
            Load more archived
          </AuButton>
        </div>
      )}
    </div>
  )
}
