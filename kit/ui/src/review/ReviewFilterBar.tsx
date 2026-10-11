"use client"

import * as React from "react"
import { cn } from "../primitives/cn"
import { Button } from "../primitives/Button"
import { Checkbox } from "../primitives/Checkbox"
import { Icon } from "../primitives/Icon"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../primitives/Popover"
import {
  DEFAULT_REVIEW_FILTERS,
  PERIOD_LABEL,
  activeFilterCount,
  formatDayShort,
  hasActiveFilters,
  type ReviewAuthorOption,
  type ReviewListFilters,
  type ReviewPeriod,
} from "./commentFilters"
import { OVERLAY_DATA_ATTR, REVIEW_Z } from "./constants"

/**
 * Filter controls for the comment lists — a filter ICON opens the mega menu
 * (the screen scope when the drawer asks for it, multi-select authors and
 * screens + a period with presets and a custom range), and the ordering lives
 * outside, as a discreet link. Shared by the drawer and the Review Bridge page;
 * a badge on the icon counts the active groups.
 */

// Above the Review Mode sheet (1065) and thread popover (1060).
const MENU_Z = REVIEW_Z.modal + 20

export type ReviewScope = "all" | "page"

const SCOPE_LABEL: Record<ReviewScope, string> = {
  all: "All screens",
  page: "This screen",
}

function toggleIn(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="au-eyebrow text-(--auis-fg-tertiary) px-3 pt-3 pb-1.5 block">
      {children}
    </span>
  )
}

function OptionRow({
  label,
  active,
  onSelect,
  children,
}: {
  label: React.ReactNode
  active: boolean
  onSelect: () => void
  children?: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left body-xs transition-colors duration-au-fast",
        active
          ? "bg-(--auis-bg-muted) font-medium text-(--auis-fg-primary)"
          : "text-(--auis-fg-secondary) hover:bg-(--auis-bg-hover) hover:text-(--auis-fg-primary)",
      )}
    >
      {label}
      {children ??
        (active && <Icon name="check" size={14} className="text-(--auis-fg-primary)" />)}
    </button>
  )
}

function CheckRow({
  label,
  checked,
  onToggle,
  mono,
}: {
  label: string
  checked: boolean
  onToggle: () => void
  mono?: boolean
}) {
  return (
    <label
      className={cn(
        "flex items-center gap-2.5 px-3 py-1.5 cursor-pointer transition-colors duration-au-fast hover:bg-(--auis-bg-hover)",
      )}
    >
      <Checkbox checked={checked} onChange={onToggle} label={label} />
      <span
        className={cn(
          "body-xs min-w-0 truncate",
          checked ? "text-(--auis-fg-primary) font-medium" : "text-(--auis-fg-secondary)",
          mono && "tabular-nums",
        )}
      >
        {label}
      </span>
    </label>
  )
}

// Native date inputs speak ISO (yyyy-mm-dd) in the local time zone.
function toDateInput(ms: number | undefined): string {
  if (ms === undefined) return ""
  const d = new Date(ms)
  const pad = (n: number) => (n < 10 ? `0${n}` : String(n))
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
function fromDateInput(value: string, endOfDay: boolean): number | undefined {
  if (!value) return undefined
  const [y, m, d] = value.split("-").map(Number)
  if (!y || !m || !d) return undefined
  return endOfDay
    ? new Date(y, m - 1, d, 23, 59, 59, 999).getTime()
    : new Date(y, m - 1, d, 0, 0, 0, 0).getTime()
}

export function ReviewFilterControls({
  filters,
  onChange,
  authors,
  pages,
  scope,
  onScopeChange,
  align = "end",
}: {
  filters: ReviewListFilters
  onChange: (next: ReviewListFilters) => void
  authors: ReviewAuthorOption[]
  /** Omit (undefined) to hide the list of screens (e.g. the "This screen" scope). */
  pages?: string[]
  /** Scope of the list. Only the drawer passes it; without it the section is hidden. */
  scope?: ReviewScope
  onScopeChange?: (next: ReviewScope) => void
  align?: "start" | "end"
}) {
  const [open, setOpen] = React.useState(false)
  const [customOpen, setCustomOpen] = React.useState(false)
  const [range, setRange] = React.useState<{ from?: number; to?: number }>({})
  const customRef = React.useRef<HTMLDivElement>(null)

  // The custom range expands below the fold of the menu — bring it into view.
  React.useEffect(() => {
    if (customOpen) {
      requestAnimationFrame(() =>
        customRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }),
      )
    }
  }, [customOpen])

  const set = (patch: Partial<ReviewListFilters>) =>
    onChange({ ...filters, ...patch })

  // "This screen" narrows the list like any filter — it counts in the badge
  // and in "Clear filters", or it would hide comments without a trace.
  const scoped = scope === "page"
  const count = activeFilterCount(filters) + (scoped ? 1 : 0)
  const desc = filters.order === "desc"

  const pickScope = (next: ReviewScope) => {
    if (!onScopeChange || next === scope) return
    onScopeChange(next)
    // The list of screens only exists under "All screens" — an old selection
    // would hide everything.
    if (next === "page" && filters.pages.length > 0) set({ pages: [] })
  }

  const pickPreset = (p: Exclude<ReviewPeriod, "custom">) => {
    setCustomOpen(false)
    setRange({})
    set({ period: p, customFrom: undefined, customTo: undefined })
  }

  const applyCustomRange = () => {
    if (range.from === undefined || range.to === undefined) return
    const from = Math.min(range.from, range.to)
    const to = Math.max(range.from, range.to)
    set({ period: "custom", customFrom: from, customTo: to })
    setCustomOpen(false)
  }

  const customLabel =
    filters.period === "custom" &&
    filters.customFrom !== undefined &&
    filters.customTo !== undefined
      ? `${formatDayShort(filters.customFrom)} – ${formatDayShort(filters.customTo)}`
      : null

  return (
    <div className="flex items-center gap-2">
      {/* Ordering — discreet link, outside the menu (a frequent toggle). */}
      <button
        type="button"
        onClick={() => set({ order: desc ? "asc" : "desc" })}
        title={
          desc
            ? "Newest first — click for chronological order"
            : "Chronological order (oldest first) — click to flip"
        }
        className="inline-flex items-center gap-0.5 body-xs text-(--auis-fg-tertiary) hover:text-(--auis-fg-primary) transition-colors"
      >
        <Icon name={desc ? "south" : "north"} size={11} />
        {desc ? "Newest" : "Oldest"}
      </button>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label="Filters"
            title="Filters"
            className={cn(
              "relative h-7 w-7 inline-flex items-center justify-center rounded-full transition-colors",
              count > 0 || open
                ? "bg-(--auis-bg-inverse) text-(--auis-fg-on-inverse)"
                : "bg-(--auis-bg-muted) text-(--auis-fg-secondary) hover:text-(--auis-fg-primary)",
            )}
          >
            <Icon name="filter_list" size={15} weight={600} />
            {count > 0 && (
              <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 inline-flex items-center justify-center rounded-full bg-(--auis-accent-brand) text-(--auis-fg-on-inverse) text-2xs font-semibold tabular-nums">
                {count}
              </span>
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent
          {...{ [OVERLAY_DATA_ATTR]: "" }}
          align={align}
          sideOffset={6}
          style={{ zIndex: MENU_Z }}
          className="w-80 p-0 rounded-lg border border-(--auis-border-subtle) bg-(--auis-bg-raised) shadow-lg overflow-hidden"
        >
          <div className="max-h-[70vh] overflow-y-auto pb-1">
            {/* Scope — only in the drawer, which knows what "this screen" is */}
            {scope && onScopeChange && (
              <>
                <SectionLabel>Where</SectionLabel>
                {(["all", "page"] as ReviewScope[]).map((s) => (
                  <OptionRow
                    key={s}
                    label={SCOPE_LABEL[s]}
                    active={scope === s}
                    onSelect={() => pickScope(s)}
                  />
                ))}
                <div className="mt-2 mx-3 h-px bg-(--auis-border-subtle)" />
              </>
            )}

            {/* Authors — multi */}
            <SectionLabel>Author</SectionLabel>
            {authors.length === 0 ? (
              <p className="m-0 px-3 pb-2 body-xs text-(--auis-fg-tertiary)">
                No authors yet.
              </p>
            ) : (
              <div className="max-h-44 overflow-y-auto">
                {authors.map((a) => (
                  <CheckRow
                    key={a.id}
                    label={a.name}
                    checked={filters.authorIds.includes(a.id)}
                    onToggle={() =>
                      set({ authorIds: toggleIn(filters.authorIds, a.id) })
                    }
                  />
                ))}
              </div>
            )}

            {/* Screens — multi (hidden in the "This screen" scope) */}
            {pages && (
              <>
                <div className="mt-2 mx-3 h-px bg-(--auis-border-subtle)" />
                <SectionLabel>Screen</SectionLabel>
                <div className="max-h-44 overflow-y-auto">
                  {pages.map((p) => (
                    <CheckRow
                      key={p}
                      label={p}
                      checked={filters.pages.includes(p)}
                      onToggle={() => set({ pages: toggleIn(filters.pages, p) })}
                      mono
                    />
                  ))}
                </div>
              </>
            )}

            {/* Period — presets + custom */}
            <div className="mt-2 mx-3 h-px bg-(--auis-border-subtle)" />
            <SectionLabel>Period</SectionLabel>
            {(Object.keys(PERIOD_LABEL) as Exclude<ReviewPeriod, "custom">[]).map(
              (p) => (
                <OptionRow
                  key={p}
                  label={PERIOD_LABEL[p]}
                  active={filters.period === p}
                  onSelect={() => pickPreset(p)}
                />
              ),
            )}
            <button
              type="button"
              onClick={() => setCustomOpen((v) => !v)}
              className={cn(
                "flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left body-xs transition-colors duration-au-fast",
                filters.period === "custom"
                  ? "bg-(--auis-bg-muted) font-medium text-(--auis-fg-primary)"
                  : "text-(--auis-fg-secondary) hover:bg-(--auis-bg-hover) hover:text-(--auis-fg-primary)",
              )}
            >
              <span className="inline-flex items-center gap-1.5">
                <Icon name="calendar_month" size={13} className="text-(--auis-fg-tertiary)" />
                {customLabel ? `Custom · ${customLabel}` : "Custom…"}
              </span>
              {filters.period === "custom" && !customOpen ? (
                <Icon name="check" size={14} className="text-(--auis-fg-primary)" />
              ) : (
                <Icon
                  name={customOpen ? "expand_less" : "expand_more"}
                  size={14}
                  className="text-(--auis-fg-tertiary)"
                />
              )}
            </button>
            {customOpen && (
              <div ref={customRef} className="px-3 pb-2 flex flex-col gap-2">
                <div className="grid grid-cols-2 gap-2">
                  <label className="flex flex-col gap-1">
                    <span className="body-xs text-(--auis-fg-tertiary)">From</span>
                    <input
                      type="date"
                      value={toDateInput(range.from)}
                      onChange={(e) =>
                        setRange((r) => ({ ...r, from: fromDateInput(e.target.value, false) }))
                      }
                      className="auis-input h-8 px-2 body-xs"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="body-xs text-(--auis-fg-tertiary)">To</span>
                    <input
                      type="date"
                      value={toDateInput(range.to)}
                      onChange={(e) =>
                        setRange((r) => ({ ...r, to: fromDateInput(e.target.value, true) }))
                      }
                      className="auis-input h-8 px-2 body-xs"
                    />
                  </label>
                </div>
                <div className="flex items-center justify-between gap-2 border-t border-(--auis-border-subtle) pt-2">
                  <p className="m-0 body-xs text-(--auis-fg-tertiary)">
                    {range.from !== undefined && range.to !== undefined
                      ? `${formatDayShort(range.from)} – ${formatDayShort(range.to)}`
                      : "Pick a start and an end"}
                  </p>
                  <Button
                    size="sm"
                    variant="primary"
                    disabled={range.from === undefined || range.to === undefined}
                    onClick={applyCustomRange}
                  >
                    Apply
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Footer — clear everything */}
          {(hasActiveFilters(filters) || scoped) && (
            <div className="border-t border-(--auis-border-subtle) px-3 py-2 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setCustomOpen(false)
                  setRange({})
                  onChange({ ...DEFAULT_REVIEW_FILTERS, order: filters.order })
                  if (scoped) onScopeChange?.("all")
                }}
                className="inline-flex items-center gap-1 body-xs text-(--auis-fg-secondary) hover:text-(--auis-fg-primary) transition-colors"
              >
                <Icon name="filter_alt_off" size={12} />
                Clear filters
              </button>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  )
}
