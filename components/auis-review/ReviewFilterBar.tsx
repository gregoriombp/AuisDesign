"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { AuButton } from "@/components/ui/AuButton"
import { AuCheckbox } from "@/components/ui/AuCheckbox"
import { Icon } from "@/components/ui/Icon"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  DEFAULT_REVIEW_FILTERS,
  PERIOD_LABEL,
  activeFilterCount,
  formatDayShort,
  hasActiveFilters,
  type ReviewAuthorOption,
  type ReviewListFilters,
  type ReviewPeriod,
} from "@/lib/auis-review/commentFilters"
import { OVERLAY_DATA_ATTR, REVIEW_Z } from "./constants"

/**
 * Filter controls for the comment lists — a filter ICON opens the mega menu
 * (multi-select authors and screens + a period with presets and a custom
 * range), and the ordering lives outside, as a discreet link. Shared by the
 * drawer and the Review Bridge page; a badge on the icon counts the active
 * groups.
 */

// Above the Review Mode sheet (1065) and thread popover (1060).
const MENU_Z = REVIEW_Z.modal + 20

function toggleIn(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="au-eyebrow text-(--fg-tertiary) px-3 pt-3 pb-1.5 block">
      {children}
    </span>
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
        "flex items-center gap-2.5 px-3 py-1.5 cursor-pointer transition-colors duration-au-fast hover:bg-(--bg-hover)",
      )}
    >
      <AuCheckbox checked={checked} onChange={onToggle} label={label} />
      <span
        className={cn(
          "body-xs min-w-0 truncate",
          checked ? "text-(--fg-primary) font-medium" : "text-(--fg-secondary)",
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
  align = "end",
}: {
  filters: ReviewListFilters
  onChange: (next: ReviewListFilters) => void
  authors: ReviewAuthorOption[]
  /** Omit (undefined) to hide the Screen section (e.g. the "This screen" scope). */
  pages?: string[]
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

  const count = activeFilterCount(filters)
  const desc = filters.order === "desc"

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
        className="inline-flex items-center gap-0.5 body-xs text-(--fg-tertiary) hover:text-(--fg-primary) transition-colors"
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
                ? "bg-(--bg-inverse) text-(--fg-on-inverse)"
                : "bg-(--bg-muted) text-(--fg-secondary) hover:text-(--fg-primary)",
            )}
          >
            <Icon name="filter_list" size={15} weight={600} />
            {count > 0 && (
              <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 inline-flex items-center justify-center rounded-full bg-(--accent-brand) text-(--fg-on-inverse) text-2xs font-semibold tabular-nums">
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
          className="w-80 p-0 rounded-lg border border-(--border-subtle) bg-(--bg-raised) shadow-lg overflow-hidden"
        >
          <div className="max-h-[70vh] overflow-y-auto pb-1">
            {/* Authors — multi */}
            <SectionLabel>Author</SectionLabel>
            {authors.length === 0 ? (
              <p className="m-0 px-3 pb-2 body-xs text-(--fg-tertiary)">
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
                <div className="mt-2 mx-3 h-px bg-(--border-subtle)" />
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
            <div className="mt-2 mx-3 h-px bg-(--border-subtle)" />
            <SectionLabel>Period</SectionLabel>
            {(Object.keys(PERIOD_LABEL) as Exclude<ReviewPeriod, "custom">[]).map(
              (p) => {
                const active = filters.period === p
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => pickPreset(p)}
                    className={cn(
                      "flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left body-xs transition-colors duration-au-fast",
                      active
                        ? "bg-(--bg-muted) font-medium text-(--fg-primary)"
                        : "text-(--fg-secondary) hover:bg-(--bg-hover) hover:text-(--fg-primary)",
                    )}
                  >
                    {PERIOD_LABEL[p]}
                    {active && (
                      <Icon name="check" size={14} className="text-(--fg-primary)" />
                    )}
                  </button>
                )
              },
            )}
            <button
              type="button"
              onClick={() => setCustomOpen((v) => !v)}
              className={cn(
                "flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left body-xs transition-colors duration-au-fast",
                filters.period === "custom"
                  ? "bg-(--bg-muted) font-medium text-(--fg-primary)"
                  : "text-(--fg-secondary) hover:bg-(--bg-hover) hover:text-(--fg-primary)",
              )}
            >
              <span className="inline-flex items-center gap-1.5">
                <Icon name="calendar_month" size={13} className="text-(--fg-tertiary)" />
                {customLabel ? `Custom · ${customLabel}` : "Custom…"}
              </span>
              {filters.period === "custom" && !customOpen ? (
                <Icon name="check" size={14} className="text-(--fg-primary)" />
              ) : (
                <Icon
                  name={customOpen ? "expand_less" : "expand_more"}
                  size={14}
                  className="text-(--fg-tertiary)"
                />
              )}
            </button>
            {customOpen && (
              <div ref={customRef} className="px-3 pb-2 flex flex-col gap-2">
                <div className="grid grid-cols-2 gap-2">
                  <label className="flex flex-col gap-1">
                    <span className="body-xs text-(--fg-tertiary)">From</span>
                    <input
                      type="date"
                      value={toDateInput(range.from)}
                      onChange={(e) =>
                        setRange((r) => ({ ...r, from: fromDateInput(e.target.value, false) }))
                      }
                      className="au-input h-8 px-2 body-xs"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="body-xs text-(--fg-tertiary)">To</span>
                    <input
                      type="date"
                      value={toDateInput(range.to)}
                      onChange={(e) =>
                        setRange((r) => ({ ...r, to: fromDateInput(e.target.value, true) }))
                      }
                      className="au-input h-8 px-2 body-xs"
                    />
                  </label>
                </div>
                <div className="flex items-center justify-between gap-2 border-t border-(--border-subtle) pt-2">
                  <p className="m-0 body-xs text-(--fg-tertiary)">
                    {range.from !== undefined && range.to !== undefined
                      ? `${formatDayShort(range.from)} – ${formatDayShort(range.to)}`
                      : "Pick a start and an end"}
                  </p>
                  <AuButton
                    size="sm"
                    variant="primary"
                    disabled={range.from === undefined || range.to === undefined}
                    onClick={applyCustomRange}
                  >
                    Apply
                  </AuButton>
                </div>
              </div>
            )}
          </div>

          {/* Footer — clear everything */}
          {hasActiveFilters(filters) && (
            <div className="border-t border-(--border-subtle) px-3 py-2 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setCustomOpen(false)
                  setRange({})
                  onChange({ ...DEFAULT_REVIEW_FILTERS, order: filters.order })
                }}
                className="inline-flex items-center gap-1 body-xs text-(--fg-secondary) hover:text-(--fg-primary) transition-colors"
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
