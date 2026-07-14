"use client"

import * as React from "react"
import {
  ICON_GRADES,
  ICON_WEIGHTS,
  type IconVariation,
} from "@/lib/auis-edit/icon-style"

// Controls for an icon's optical axes (track 4): weight (wght), fill (FILL) and
// grade (GRAD). Color goes through the Color section (the icon's span IS the
// selected element). Every click records the whole variation.

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={[
        "rounded-(--radius-sm) border px-2.5 py-1 body-xs transition-colors",
        active
          ? "border-(--accent-brand) bg-(--bg-selected) text-(--fg-primary)"
          : "border-(--border-default) text-(--fg-secondary) hover:bg-(--bg-hover)",
      ].join(" ")}
    >
      {children}
    </button>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="body-xs font-medium text-(--fg-secondary)">{label}</span>
      <div className="flex flex-wrap gap-1">{children}</div>
    </div>
  )
}

export function IconStyleControls({
  current,
  onPick,
}: {
  current: IconVariation
  onPick: (next: IconVariation) => void
}) {
  return (
    <div className="flex flex-col gap-3">
      <Row label="Weight">
        {ICON_WEIGHTS.map((w) => (
          <Chip
            key={w}
            active={current.weight === w}
            onClick={() => onPick({ ...current, weight: w })}
          >
            {w}
          </Chip>
        ))}
      </Row>
      <Row label="Fill">
        <Chip active={current.fill === 0} onClick={() => onPick({ ...current, fill: 0 })}>
          Outlined
        </Chip>
        <Chip active={current.fill === 1} onClick={() => onPick({ ...current, fill: 1 })}>
          Filled
        </Chip>
      </Row>
      <Row label="Grade">
        {ICON_GRADES.map((g) => (
          <Chip
            key={g.value}
            active={current.grade === g.value}
            onClick={() => onPick({ ...current, grade: g.value })}
          >
            {g.label}
          </Chip>
        ))}
      </Row>
    </div>
  )
}
