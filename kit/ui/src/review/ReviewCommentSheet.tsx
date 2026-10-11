"use client"

import * as React from "react"
import { Button } from "../primitives/Button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "../primitives/Empty"
import { Sheet } from "../primitives/Sheet"
import { Icon } from "../primitives/Icon"
import { useReviewStore } from "./store"
import { useCurrentUrl } from "./hooks"
import { matchesCurrentReviewUrl } from "./urlMatch"
import {
  DEFAULT_REVIEW_FILTERS,
  applyReviewFilters,
  collectAuthorOptions,
  collectPageOptions,
  type ReviewListFilters,
} from "./commentFilters"
import { OVERLAY_DATA_ATTR, REVIEW_Z } from "./constants"
import { ReviewCommentCard } from "./ReviewCommentCard"
import { ReviewFilterControls, type ReviewScope } from "./ReviewFilterBar"
import type { ReviewComment } from "@auis/core/types"

// "Future ideas" (backlog) no longer lives in the drawer — its home is the
// Review Bridge page (/auis/review-bridge), which has room to compose and triage.
type Tab = "all" | "open" | "in_review" | "archive"

const TAB_LABEL: Record<Tab, string> = {
  all: "All",
  open: "Open",
  in_review: "In review",
  archive: "Archived",
}

/**
 * "All" joins open, in review and archived. Future ideas stay out, as in the
 * other tabs. A comment can sit in both lists until the store's next read; the
 * live copy wins, since it carries the current status.
 */
function mergeAll(
  main: readonly ReviewComment[],
  archive: readonly ReviewComment[]
): ReviewComment[] {
  const live = main.filter(
    (c) => c.status === "open" || c.status === "in_review"
  )
  const liveIds = new Set(live.map((c) => c.id))
  return [...live, ...archive.filter((c) => !liveIds.has(c.id))]
}

export function ReviewCommentSheet() {
  const open = useReviewStore((s) => s.sheetOpen)
  const setSheetOpen = useReviewStore((s) => s.setSheetOpen)
  const allComments = useReviewStore((s) => s.comments)
  const archivedComments = useReviewStore((s) => s.archivedComments)
  const archiveCursor = useReviewStore((s) => s.archiveCursor)
  const archiveLoaded = useReviewStore((s) => s.archiveLoaded)
  const loadArchivePage = useReviewStore((s) => s.loadArchivePage)
  const setExportOpen = useReviewStore((s) => s.setExportOpen)
  const selectedCommentId = useReviewStore((s) => s.selectedCommentId)
  const approveComment = useReviewStore((s) => s.approveComment)
  const rejectComment = useReviewStore((s) => s.rejectComment)
  const sessionRole = useReviewStore((s) => s.sessionRole)
  const isAdmin = sessionRole === "admin"

  const currentUrl = useCurrentUrl()

  const [scope, setScope] = React.useState<ReviewScope>("all")
  const [tab, setTab] = React.useState<Tab>("all")
  const [query, setQuery] = React.useState("")
  const [filters, setFilters] = React.useState<ReviewListFilters>(
    DEFAULT_REVIEW_FILTERS
  )
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set())
  const [bulkBusy, setBulkBusy] = React.useState(false)

  // The drawer stays mounted between openings: every opening goes back to "All
  // screens", and "This screen" is a choice for that time, from the filter menu.
  // Adjusted during render (not in an effect) so the first frame is already right.
  const [wasOpen, setWasOpen] = React.useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) setScope("all")
  }

  React.useEffect(() => {
    if ((tab === "archive" || tab === "all") && !archiveLoaded) {
      void loadArchivePage(true)
    }
  }, [tab, archiveLoaded, loadArchivePage])

  // Reset selection when switching tabs/scope.
  React.useEffect(() => {
    setSelectedIds(new Set())
  }, [tab, scope])

  // Arriving through a permalink on a comment that lives in another tab opened
  // the drawer on "Open" and the targeted comment was not even listed. Follow
  // the tab of its status, and widen the scope if it is not on this screen.
  //
  // Depends on the IDENTITY of the selection, not on the `visible` recompute:
  // the store re-fetches every 4s, and reacting to that would pull the tab
  // back every time the reviewer navigated away from the comment.
  React.useEffect(() => {
    if (!selectedCommentId) return
    const target =
      allComments.find((c) => c.id === selectedCommentId) ??
      archivedComments.find((c) => c.id === selectedCommentId)
    if (!target) return
    // On "All" the comment is already listed — keep the tab.
    setTab((current) =>
      current === "all"
        ? current
        : target.status === "in_review"
        ? "in_review"
        : target.status === "open"
        ? "open"
        : "archive"
    )
    if (!matchesCurrentReviewUrl(target.url, currentUrl)) setScope("all")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCommentId])

  const sourceMain = scope === "page"
    ? allComments.filter((c) => matchesCurrentReviewUrl(c.url, currentUrl))
    : allComments
  const sourceArchive = scope === "page"
    ? archivedComments.filter((c) => matchesCurrentReviewUrl(c.url, currentUrl))
    : archivedComments

  const visible: ReviewComment[] = React.useMemo(() => {
    const base =
      tab === "all"
        ? mergeAll(sourceMain, sourceArchive)
        : tab === "open"
        ? sourceMain.filter((c) => c.status === "open")
        : tab === "in_review"
        ? sourceMain.filter((c) => c.status === "in_review")
        : sourceArchive
    const q = query.trim().toLowerCase()
    const searched = !q
      ? base
      : base.filter(
          (c) =>
            c.text?.toLowerCase().includes(q) ||
            c.authorName?.toLowerCase().includes(q) ||
            c.url?.toLowerCase().includes(q) ||
            c.replies?.some((r) => r.text.toLowerCase().includes(q))
        )
    return applyReviewFilters(searched, filters)
  }, [tab, sourceMain, sourceArchive, query, filters])

  // Dropdown options come from the tab's universe (before filters), otherwise
  // the filter would hide its own alternatives.
  const authorOptions = React.useMemo(
    () => collectAuthorOptions([...allComments, ...archivedComments]),
    [allComments, archivedComments]
  )
  const pageOptions = React.useMemo(
    () => collectPageOptions([...allComments, ...archivedComments]),
    [allComments, archivedComments]
  )

  const inReviewCount = allComments.filter((c) => c.status === "in_review").length

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const bulkApprove = async () => {
    setBulkBusy(true)
    try {
      for (const id of Array.from(selectedIds)) {
        await approveComment(id)
      }
      setSelectedIds(new Set())
    } finally {
      setBulkBusy(false)
    }
  }

  const bulkReject = async () => {
    setBulkBusy(true)
    try {
      for (const id of Array.from(selectedIds)) {
        await rejectComment(id)
      }
      setSelectedIds(new Set())
    } finally {
      setBulkBusy(false)
    }
  }

  const showBulkBar = tab === "in_review" && selectedIds.size > 0 && isAdmin

  return (
    <Sheet
      open={open}
      onClose={() => setSheetOpen(false)}
      zIndex={REVIEW_Z.sheet}
      title="Comments"
      meta={
        <span className="body-xs text-(--fg-tertiary)">
          {scope === "page" ? "On this screen" : "Across all screens"} ·{" "}
          {visible.length}
        </span>
      }
      footer={
        <div
          {...{ [OVERLAY_DATA_ATTR]: "" }}
          className="flex items-center justify-between gap-2"
        >
          <span className="body-xs text-(--fg-tertiary)">
            Total: {allComments.length}
          </span>
          <Button
            variant="secondary"
            size="sm"
            iconLeft="ios_share"
            onClick={() => {
              setSheetOpen(false)
              setExportOpen(true)
            }}
          >
            Export
          </Button>
        </div>
      }
    >
      <div
        {...{ [OVERLAY_DATA_ATTR]: "" }}
        className="flex flex-col gap-3 h-full"
      >
        <div className="relative">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-(--fg-tertiary) pointer-events-none">
            <Icon name="search" size={16} weight={500} />
          </span>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search comments…"
            className="w-full h-9 pl-8 pr-8 rounded-full bg-(--bg-muted) border border-transparent focus:border-(--border-default) focus:bg-(--bg-raised) outline-none body-sm text-(--fg-primary) placeholder:text-(--fg-tertiary) transition-colors"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 h-5 w-5 inline-flex items-center justify-center rounded-full text-(--fg-tertiary) hover:text-(--fg-primary) hover:bg-(--bg-hover) transition-colors"
            >
              <Icon name="close" size={14} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1 body-xs font-medium">
          {(["all", "open", "in_review", "archive"] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={[
                "px-2.5 py-1 rounded-full transition-colors inline-flex items-center gap-1.5",
                tab === t
                  ? "bg-(--bg-inverse) text-(--fg-on-inverse)"
                  : "text-(--fg-secondary) hover:bg-(--bg-hover)",
              ].join(" ")}
            >
              {TAB_LABEL[t]}
              {t === "in_review" && inReviewCount > 0 && (
                <span
                  className={[
                    "min-w-4 h-4 px-1 inline-flex items-center justify-center rounded-full body-xs font-semibold tabular-nums",
                    tab === t
                      ? "bg-(--bg-raised) text-(--fg-primary)"
                      : "bg-(--au-amber-100) text-(--au-amber-700)",
                  ].join(" ")}
                >
                  {inReviewCount}
                </span>
              )}
            </button>
          ))}
          {/* Filter (mega menu) + ordering, discreet at the end of the row. */}
          <div className="ml-auto">
            <ReviewFilterControls
              filters={filters}
              onChange={setFilters}
              authors={authorOptions}
              // In the "This screen" scope the screen filter is redundant — hide it.
              pages={scope === "all" ? pageOptions : undefined}
              scope={scope}
              onScopeChange={setScope}
            />
          </div>
        </div>

        {showBulkBar && (
          <div className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-sm bg-(--bg-muted) body-xs">
            <span className="text-(--fg-secondary)">
              {selectedIds.size} selected
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="primary"
                size="sm"
                iconLeft="check_circle"
                loading={bulkBusy}
                disabled={bulkBusy}
                onClick={() => void bulkApprove()}
              >
                Approve
              </Button>
              <Button
                variant="ghost"
                size="sm"
                iconLeft="undo"
                disabled={bulkBusy}
                onClick={() => void bulkReject()}
              >
                Reject
              </Button>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto -mx-1 px-1">
          {visible.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Icon name="forum" size={20} />
                </EmptyMedia>
                <EmptyTitle>
                  {query.trim()
                    ? "Nothing found for that search"
                    : tab === "archive"
                    ? "Nothing archived here"
                    : tab === "in_review"
                    ? "Nothing waiting for review"
                    : scope === "page"
                    ? "No comments on this screen"
                    : tab === "all"
                    ? "No comments yet"
                    : "No open comments"}
                </EmptyTitle>
                {(tab === "open" || tab === "all") && scope === "page" && (
                  <EmptyDescription>
                    Use the freehand mark or the pin on the bottom bar to leave
                    the first comment.
                  </EmptyDescription>
                )}
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="flex flex-col gap-2">
              {visible.map((c) => (
                <ReviewCommentCard
                  key={c.id}
                  comment={c}
                  context="sheet"
                  archived={tab === "archive" || c.status === "resolved"}
                  selectable={tab === "in_review" && isAdmin}
                  selected={selectedIds.has(c.id)}
                  onToggleSelected={() => toggleSelected(c.id)}
                />
              ))}
              {(tab === "archive" || tab === "all") && archiveCursor && (
                <button
                  type="button"
                  onClick={() => void loadArchivePage(false)}
                  className="mt-2 body-xs text-(--accent-brand) hover:underline self-center"
                >
                  Load more archived
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </Sheet>
  )
}
