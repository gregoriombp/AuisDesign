import * as React from "react"
import { Section } from "../../_primitives"

export type FlowUpdateTag =
  | "new-page"
  | "removed-page"
  | "new-branch"
  | "flow-rework"
  | "integration"

export type FlowUpdate = {
  /** ISO date `YYYY-MM-DD`. Local timezone — never parsed as UTC. */
  date: string
  /** Optional time-of-day label shown next to the date (e.g. "16:37 UTC"). */
  time?: string
  /** One sentence describing the structural change. */
  summary: string
  tags: FlowUpdateTag[]
}

const TAG_STYLE: Record<
  FlowUpdateTag,
  { bg: string; fg: string; border: string; label: string }
> = {
  "new-page": {
    bg: "var(--au-blue-100)",
    fg: "var(--au-blue-900)",
    border: "var(--au-blue-200)",
    label: "new screen",
  },
  "removed-page": {
    bg: "var(--au-red-100)",
    fg: "var(--au-red-900)",
    border: "var(--au-red-300)",
    label: "screen removed",
  },
  "new-branch": {
    bg: "var(--au-amber-100)",
    fg: "var(--au-amber-900)",
    border: "var(--au-amber-300)",
    label: "new branch",
  },
  "flow-rework": {
    bg: "var(--au-amber-100)",
    fg: "var(--au-amber-900)",
    border: "var(--au-amber-300)",
    label: "rework",
  },
  "integration": {
    bg: "var(--au-emerald-100)",
    fg: "var(--au-emerald-900)",
    border: "var(--au-emerald-300)",
    label: "integration",
  },
}

function parseLocalDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1)
}

// en-GB keeps the day-before-month ordering used across the app.
function formatShort(iso: string): string {
  return parseLocalDate(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
  }).replace(".", "")
}

function formatLong(iso: string): string {
  return parseLocalDate(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).replace(/\./g, "")
}

function sortDesc(updates: FlowUpdate[]): FlowUpdate[] {
  return [...updates].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
}

/**
 * Discreet badge next to the page title showing when the flow was last
 * meaningfully updated. Returns null if there are no updates.
 */
export function FlowUpdatesBadge({ updates }: { updates: FlowUpdate[] }) {
  if (!updates || updates.length === 0) return null
  const latest = sortDesc(updates)[0]
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium"
      style={{
        background: "var(--au-amber-100)",
        borderColor: "var(--au-amber-300)",
        color: "var(--au-amber-900)",
      }}
      title={latest.summary}
    >
      <span
        aria-hidden
        className="inline-block w-1.5 h-1.5 rounded-full"
        style={{ background: "var(--au-amber-500)" }}
      />
      Updated on {formatShort(latest.date)}
    </span>
  )
}

/**
 * Timeline section listing each meaningful update to the flow. Returns null
 * if there are no updates — safe to call unconditionally from a flow page.
 */
export function FlowUpdatesHistorySection({ updates }: { updates: FlowUpdate[] }) {
  if (!updates || updates.length === 0) return null
  const sorted = sortDesc(updates)
  return (
    <Section
      id="updates"
      title="Update history"
      lead="Structural changes to the flow since this page was created. Text and style tweaks are not included."
    >
      <ol className="m-0 p-0 list-none flex flex-col gap-3">
        {sorted.map((u, i) => (
          <li
            key={`${u.date}-${i}`}
            className="rounded-lg border border-(--border-subtle) bg-(--bg-raised) p-5 flex flex-col gap-2"
          >
            <div className="flex items-baseline gap-3 flex-wrap">
              <span className="au-eyebrow text-(--fg-tertiary)">
                {formatLong(u.date)}
                {u.time ? ` · ${u.time}` : ""}
              </span>
              {u.tags.map((t) => {
                const s = TAG_STYLE[t]
                return (
                  <span
                    key={t}
                    className="inline-flex items-center rounded-sm border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide"
                    style={{ background: s.bg, borderColor: s.border, color: s.fg }}
                  >
                    {s.label}
                  </span>
                )
              })}
            </div>
            <p className="m-0 text-sm text-(--fg-primary) leading-relaxed">
              {u.summary}
            </p>
          </li>
        ))}
      </ol>
    </Section>
  )
}
