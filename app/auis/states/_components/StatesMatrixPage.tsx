"use client"

import * as React from "react"
import Link from "next/link"

import { AuCard } from "@/components/ui/AuCard"
import { AuButton } from "@/components/ui/AuButton"
import { AuPill } from "@/components/ui/AuPill"
import { AuSegmented } from "@/components/ui/AuSegmented"
import {
  AuDropdownMenu,
  type AuDropdownItem,
} from "@/components/ui/AuDropdownMenu"
import { Icon } from "@/components/ui/Icon"
import { SCREEN_STATES } from "@/lib/auis-states/registry"
import type {
  ScreenStateAxis,
  ScreenStatesEntry,
} from "@/lib/auis-states/types"

// Thumbnails: each cell renders the REAL screen in a desktop-viewport iframe
// (1280×800) scaled down with a transform — the same technique the golden-eye
// flows use, only side by side. The iframes are inert (pointer-events-none);
// the cell's link opens the real URL in another tab.
const FRAME_W = 1280
const FRAME_H = 800
const CELL_SCALE = 0.4

/** Only inside the iframe: hides the builder chrome (dot, Review pill) from the
 *  thumbnail. The cell's "open" link uses the clean URL, without the param. */
function frameSrc(url: string): string {
  return `${url}${url.includes("?") ? "&" : "?"}chrome=0`
}

/** URL of a scenario: the displayed axis at the cell's value, the other axes pinned. */
function scenarioUrl(
  entry: ScreenStatesEntry,
  displayAxis: ScreenStateAxis,
  value: string,
  fixed: Record<string, string>,
): string {
  const base = entry.previewPath ?? entry.pattern
  const params = new URLSearchParams()
  for (const axis of entry.axes) {
    const v =
      axis.param === displayAxis.param ? value : (fixed[axis.param] ?? axis.defaultValue)
    if (v !== axis.defaultValue) params.set(axis.param, v)
  }
  const qs = params.toString()
  return qs ? `${base}?${qs}` : base
}

function totalStates(entry: ScreenStatesEntry): number {
  const declaredStates = entry.axes.reduce(
    (sum, axis) => sum + axis.options.length,
    0,
  )
  // A screen without axes still has the default scenario, reproducible by the clean URL.
  return declaredStates || 1
}

/** Builder demos live under /auis and do not count as product coverage. */
function isBuilderDemo(entry: ScreenStatesEntry): boolean {
  return entry.pattern.startsWith("/auis/")
}

export function StatesMatrixPage({
  totalProductPages,
}: {
  totalProductPages: number
}) {
  const [selectedPattern, setSelectedPattern] = React.useState<string>(
    SCREEN_STATES[0]?.pattern ?? "",
  )
  const entry =
    SCREEN_STATES.find((e) => e.pattern === selectedPattern) ?? SCREEN_STATES[0]

  const productEntries = SCREEN_STATES.filter((e) => !isBuilderDemo(e)).length
  const pct = totalProductPages
    ? Math.min(100, Math.round((productEntries / totalProductPages) * 100))
    : 0

  return (
    <main className="min-h-screen bg-(--bg-canvas) text-(--fg-primary)">
      <div className="max-w-6xl mx-auto px-8 py-16">
        <Link href="/auis" className="no-underline">
          <AuButton variant="ghost" size="sm" iconLeft="arrow_back">
            Auis
          </AuButton>
        </Link>

        <header className="mt-6 mb-10">
          <p className="au-eyebrow mb-3">Auis</p>
          <h1 className="text-5xl font-semibold tracking-tight mb-3">State Mode</h1>
          <p className="text-lg text-(--fg-secondary) max-w-2xl">
            Every scenario of each registered screen, side by side — without
            simulating data. On the real screen, enter State Mode from the dot
            (⌘⇧S) and flip the scenarios; the URL is the only source of truth.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <AuPill variant="live">
              {productEntries} {productEntries === 1 ? "product screen" : "product screens"} registered
            </AuPill>
            <span className="body-sm text-(--fg-secondary)">
              of {totalProductPages} product {totalProductPages === 1 ? "page" : "pages"} ({pct}% coverage)
            </span>
            <span className="body-xs text-(--fg-tertiary)">
              Registry: <code className="font-mono text-xs">lib/auis-states/registry.ts</code> ·
              PDF: <code className="font-mono text-xs">npm run states:pdf</code>
            </span>
          </div>
        </header>

        {/* Registered screens */}
        <section className="mb-12">
          <h2 className="text-xl font-semibold tracking-tight mb-3">
            Registered screens
          </h2>
          {SCREEN_STATES.length === 0 ? (
            <p className="body-sm text-(--fg-secondary)">
              Nothing registered yet. Add an entry to{" "}
              <code className="font-mono text-xs">lib/auis-states/registry.ts</code>{" "}
              or run <code className="font-mono text-xs">/auis-update-states</code>.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {SCREEN_STATES.map((e) => {
                const selected = e.pattern === entry?.pattern
                const stateCount = totalStates(e)
                return (
                  <AuCard
                    key={e.pattern}
                    interactive
                    className={[
                      "p-5 flex flex-col gap-3 rounded-2xl bg-(--bg-raised)",
                      selected ? "ring-2 ring-(--ring-focus)" : "",
                    ].join(" ")}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex flex-col gap-1 min-w-0">
                        <h3 className="text-lg font-semibold tracking-tight flex items-center gap-2">
                          {e.screenLabel}
                          {isBuilderDemo(e) && (
                            <AuPill variant="draft" dot={false}>
                              Demo
                            </AuPill>
                          )}
                        </h3>
                        <p className="font-mono text-xs font-medium text-(--fg-tertiary) truncate">
                          {e.pattern}
                        </p>
                      </div>
                      <span className="shrink-0 body-sm text-(--fg-secondary) whitespace-nowrap">
                        {e.axes.length} {e.axes.length === 1 ? "axis" : "axes"} ·{" "}
                        {stateCount} {stateCount === 1 ? "state" : "states"}
                        {e.interactions?.length
                          ? ` · ${e.interactions.length} ${
                              e.interactions.length === 1
                                ? "interaction"
                                : "interactions"
                            }`
                          : ""}
                      </span>
                    </div>
                    <div className="mt-auto flex items-center gap-2">
                      <AuButton
                        variant={selected ? "primary" : "secondary"}
                        size="sm"
                        iconLeft="grid_view"
                        onClick={() => setSelectedPattern(e.pattern)}
                      >
                        {selected ? "In the matrix" : "Show matrix"}
                      </AuButton>
                      <Link
                        href={e.previewPath ?? e.pattern}
                        target="_blank"
                        className="no-underline"
                      >
                        <AuButton variant="ghost" size="sm" iconRight="open_in_new">
                          Open screen
                        </AuButton>
                      </Link>
                    </div>
                  </AuCard>
                )
              })}
            </div>
          )}
        </section>

        {/* Matrix of the selected screen */}
        {entry && <Matrix key={entry.pattern} entry={entry} />}
      </div>
    </main>
  )
}

function Matrix({ entry }: { entry: ScreenStatesEntry }) {
  const needsPreviewPath = entry.pattern.includes("[") && !entry.previewPath

  // Axis displayed in the cells (default: the `state` axis, the screen's view);
  // the others are pinned in the selectors above the grid.
  const [displayParam, setDisplayParam] = React.useState<string>(
    entry.axes.find((a) => a.param === "state")?.param ??
      entry.axes[0]?.param ??
      "",
  )
  const displayAxis =
    entry.axes.find((a) => a.param === displayParam) ?? entry.axes[0]
  const [fixed, setFixed] = React.useState<Record<string, string>>({})

  if (needsPreviewPath) {
    return (
      <section>
        <h2 className="text-xl font-semibold tracking-tight mb-3">Matrix</h2>
        <p className="body-sm text-(--fg-secondary)">
          This route has a dynamic segment and has not declared a{" "}
          <code className="font-mono text-sm font-medium">previewPath</code> in the
          registry yet — declare one to see the matrix.
        </p>
      </section>
    )
  }

  if (!displayAxis) {
    const url = entry.previewPath ?? entry.pattern
    return (
      <section>
        <h2 className="mb-4 text-xl font-semibold tracking-tight">
          Matrix · {entry.screenLabel}
        </h2>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <figure className="flex flex-col gap-2">
            <figcaption className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold">Default</span>
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-mono text-xs font-medium text-(--fg-tertiary) no-underline hover:text-(--fg-primary)"
              >
                {url}
                <Icon name="open_in_new" size={12} />
              </a>
            </figcaption>
            <div
              className="relative overflow-hidden rounded-xl border border-(--border-subtle) bg-(--bg-surface)"
              style={{ width: FRAME_W * CELL_SCALE, height: FRAME_H * CELL_SCALE }}
            >
              <iframe
                src={frameSrc(url)}
                title={`${entry.screenLabel} · Default`}
                loading="lazy"
                className="pointer-events-none absolute left-0 top-0 origin-top-left border-0"
                style={{
                  width: FRAME_W,
                  height: FRAME_H,
                  transform: `scale(${CELL_SCALE})`,
                }}
              />
            </div>
          </figure>
        </div>
      </section>
    )
  }

  const otherAxes = entry.axes.filter((a) => a.param !== displayAxis.param)

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h2 className="text-xl font-semibold tracking-tight">
          Matrix · {entry.screenLabel}
        </h2>
        <div className="flex flex-wrap items-center gap-3">
          {entry.axes.length > 1 && (
            <AuSegmented
              size="sm"
              ariaLabel="Axis displayed in the matrix"
              options={entry.axes.map((a) => ({ value: a.param, label: a.label }))}
              value={displayAxis.param}
              onChange={(param) => setDisplayParam(param)}
            />
          )}
          {otherAxes.map((axis) => {
            const current = fixed[axis.param] ?? axis.defaultValue
            const currentLabel =
              axis.options.find((o) => o.value === current)?.label ?? current
            const items: AuDropdownItem[] = [
              { id: `${axis.param}-label`, isLabel: true, label: axis.label },
              ...axis.options.map(
                (o): AuDropdownItem => ({
                  id: o.value,
                  label: o.label,
                  checked: o.value === current,
                  onSelect: () =>
                    setFixed((prev) => ({ ...prev, [axis.param]: o.value })),
                }),
              ),
            ]
            return (
              <AuDropdownMenu
                key={axis.param}
                aria-label={`Pin ${axis.label}`}
                items={items}
                trigger={
                  <button
                    type="button"
                    className="h-8 inline-flex items-center gap-1.5 px-2.5 rounded-full border border-(--border-subtle) text-(--fg-secondary) hover:bg-(--bg-hover) hover:text-(--fg-primary) transition-colors"
                  >
                    <span className="body-xs text-(--fg-tertiary)">
                      {axis.label}
                    </span>
                    <span className="body-xs font-medium">{currentLabel}</span>
                    <Icon name="keyboard_arrow_down" size={14} />
                  </button>
                }
              />
            )
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {displayAxis.options.map((option) => {
          const url = scenarioUrl(entry, displayAxis, option.value, fixed)
          return (
            <figure key={option.value} className="flex flex-col gap-2">
              <figcaption className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold">{option.label}</span>
                <a
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 font-mono text-xs font-medium text-(--fg-tertiary) hover:text-(--fg-primary) no-underline"
                >
                  {url}
                  <Icon name="open_in_new" size={12} />
                </a>
              </figcaption>
              <div
                className="relative overflow-hidden rounded-xl border border-(--border-subtle) bg-(--bg-surface)"
                style={{ width: FRAME_W * CELL_SCALE, height: FRAME_H * CELL_SCALE }}
              >
                <iframe
                  src={frameSrc(url)}
                  title={`${entry.screenLabel} · ${option.label}`}
                  loading="lazy"
                  className="pointer-events-none absolute left-0 top-0 origin-top-left border-0"
                  style={{
                    width: FRAME_W,
                    height: FRAME_H,
                    transform: `scale(${CELL_SCALE})`,
                  }}
                />
              </div>
            </figure>
          )
        })}
      </div>
    </section>
  )
}
