"use client"

import * as React from "react"
import Link from "next/link"
import { AuButton } from "@/components/ui/AuButton"
import {
  AuEmpty,
  AuEmptyDescription,
  AuEmptyHeader,
  AuEmptyMedia,
  AuEmptyTitle,
} from "@/components/ui/AuEmpty"
import { AuPill } from "@/components/ui/AuPill"
import { AuStatCard } from "@/components/ui/AuStatCard"
import { Icon } from "@/components/ui/Icon"
import { getFlowMeta } from "../../ux-flow/_data/flow-meta"

type SuggestionStatus = "open" | "in_review" | "applied" | "discarded"
type Transition = "in_review" | "apply" | "discard" | "reject"

type FlowSuggestion = {
  id: string
  flow: string
  description: string
  createdAt: number
  updatedAt: number
  authorName?: string
  status: SuggestionStatus
  resolution?: { summary: string }
}

const USER_ACTOR = { kind: "user", id: "user", name: "User" } as const

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}
function formatTimestamp(ts: number): string {
  const d = new Date(ts)
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()} · ${pad2(
    d.getHours()
  )}:${pad2(d.getMinutes())}`
}

function StatusPill({ status }: { status: SuggestionStatus }) {
  if (status === "in_review") return <AuPill variant="beta">In review</AuPill>
  return <AuPill variant="draft">Open</AuPill>
}

function SuggestionCard({
  suggestion,
  busy,
  onTransition,
}: {
  suggestion: FlowSuggestion
  busy: boolean
  onTransition: (id: string, t: Transition) => void
}) {
  const meta = getFlowMeta(suggestion.flow)
  const inReview = suggestion.status === "in_review"
  return (
    <div className="flex flex-col gap-3 px-4 py-3 rounded-md border border-(--border-subtle) bg-(--bg-raised)">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium text-(--fg-primary)">
              {suggestion.authorName?.trim() || "Anonymous"}
            </span>
            <StatusPill status={suggestion.status} />
          </div>
          <p className="m-0 text-sm text-(--fg-primary) whitespace-pre-wrap">
            {suggestion.description}
          </p>
          {suggestion.resolution?.summary && (
            <p className="m-0 mt-1 text-[11px] text-(--fg-tertiary) italic">
              {suggestion.resolution.summary}
            </p>
          )}
        </div>
        <span className="text-[11px] text-(--fg-tertiary) tabular-nums shrink-0">
          {formatTimestamp(suggestion.createdAt)}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Link href={`/auis/ux-flow/${suggestion.flow}`} className="no-underline">
          <AuButton variant="ghost" size="sm" iconLeft="account_tree">
            Open flow
          </AuButton>
        </Link>
        <span className="text-[11px] text-(--fg-tertiary)">
          {meta?.title ?? suggestion.flow}
        </span>
        <div className="ml-auto flex items-center gap-2">
          {inReview ? (
            <AuButton
              variant="ghost"
              size="sm"
              iconLeft="undo"
              disabled={busy}
              onClick={() => onTransition(suggestion.id, "reject")}
            >
              Reopen
            </AuButton>
          ) : (
            <AuButton
              variant="ghost"
              size="sm"
              iconLeft="hourglass_top"
              disabled={busy}
              onClick={() => onTransition(suggestion.id, "in_review")}
            >
              In review
            </AuButton>
          )}
          <AuButton
            variant="secondary"
            size="sm"
            iconLeft="delete"
            disabled={busy}
            onClick={() => onTransition(suggestion.id, "discard")}
          >
            Discard
          </AuButton>
          <AuButton
            variant="primary"
            size="sm"
            iconLeft="check_circle"
            disabled={busy}
            onClick={() => onTransition(suggestion.id, "apply")}
          >
            Apply
          </AuButton>
        </div>
      </div>
    </div>
  )
}

export function SuggestionsPanel() {
  const [suggestions, setSuggestions] = React.useState<FlowSuggestion[]>([])
  const [loaded, setLoaded] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [busyId, setBusyId] = React.useState<string | null>(null)

  const refresh = React.useCallback(async () => {
    try {
      const res = await fetch("/api/flow-suggestions", { cache: "no-store" })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as { suggestions?: FlowSuggestion[] }
      setSuggestions(Array.isArray(data.suggestions) ? data.suggestions : [])
      setError(null)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not load suggestions. Refresh to try again."
      )
    } finally {
      setLoaded(true)
    }
  }, [])

  React.useEffect(() => {
    void refresh()
  }, [refresh])

  const onTransition = React.useCallback(
    async (id: string, transition: Transition) => {
      setBusyId(id)
      try {
        const res = await fetch(`/api/flow-suggestions/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transition, actor: USER_ACTOR }),
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        await refresh()
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Could not update the suggestion. Try again."
        )
      } finally {
        setBusyId(null)
      }
    },
    [refresh]
  )

  const openCount = suggestions.filter((s) => s.status === "open").length
  const inReviewCount = suggestions.filter((s) => s.status === "in_review").length

  const grouped = React.useMemo(() => {
    const map = new Map<string, FlowSuggestion[]>()
    for (const s of suggestions) {
      const arr = map.get(s.flow) ?? []
      arr.push(s)
      map.set(s.flow, arr)
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]))
  }, [suggestions])

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <AuStatCard icon="lightbulb" label="Pending" value={suggestions.length} />
        <AuStatCard icon="pending" label="Open" value={openCount} />
        <AuStatCard icon="hourglass_top" label="In review" value={inReviewCount} />
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="m-0 text-xs text-(--fg-tertiary)">
          Edit suggestions coming from the UX Flow editor. Apply/Discard archives the
          suggestion; the actual node changes are made by a skill.
        </p>
        <AuButton variant="ghost" size="sm" iconLeft="refresh" onClick={() => void refresh()}>
          Refresh
        </AuButton>
      </div>

      {error && (
        <div className="px-4 py-2 rounded-md border border-(--border-subtle) bg-(--bg-muted) text-sm text-(--fg-secondary)">
          <Icon name="error" size={14} className="mr-1 align-text-bottom" />
          {error}
        </div>
      )}

      {suggestions.length === 0 ? (
        <AuEmpty>
          <AuEmptyHeader>
            <AuEmptyMedia variant="icon">
              <Icon name="lightbulb" size={20} />
            </AuEmptyMedia>
            <AuEmptyTitle>
              {!loaded ? "Loading suggestions…" : "No pending suggestions"}
            </AuEmptyTitle>
            <AuEmptyDescription>
              Open a flow, hit &quot;Suggest edit&quot; in the editor, and the proposals
              show up here for you to triage.
            </AuEmptyDescription>
          </AuEmptyHeader>
        </AuEmpty>
      ) : (
        <div className="flex flex-col gap-6">
          {grouped.map(([flow, items]) => {
            const meta = getFlowMeta(flow)
            return (
              <section key={flow} className="flex flex-col gap-3">
                <header className="flex items-center gap-2 min-w-0">
                  <Icon
                    name="account_tree"
                    size={14}
                    className="text-(--fg-tertiary) shrink-0"
                  />
                  <Link
                    href={`/auis/ux-flow/${flow}`}
                    className="text-sm text-(--fg-primary) hover:text-(--accent-brand) truncate"
                  >
                    {meta?.title ?? flow}
                  </Link>
                  <span className="text-xs text-(--fg-tertiary) shrink-0">
                    {items.length} {items.length === 1 ? "suggestion" : "suggestions"}
                  </span>
                </header>
                <div className="flex flex-col gap-2">
                  {items.map((s) => (
                    <SuggestionCard
                      key={s.id}
                      suggestion={s}
                      busy={busyId === s.id}
                      onTransition={onTransition}
                    />
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
