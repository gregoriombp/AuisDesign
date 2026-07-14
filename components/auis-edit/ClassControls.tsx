"use client"

import * as React from "react"
import type { ClassGroup } from "@/lib/auis-edit/typography-registry"

// Typography class controls (track 2): scale / weight / alignment. Same
// segmented UI as the variants, but it applies to any text element — swapped
// through classList, only classes that exist in the DS.

export function ClassControls({
  groups,
  current,
  onPick,
}: {
  groups: ClassGroup[]
  current: Record<string, string | null>
  onPick: (group: ClassGroup, value: string) => void
}) {
  return (
    <div className="flex flex-col gap-3">
      {groups.map((group) => (
        <div key={group.key} className="flex flex-col gap-1.5">
          <span className="body-xs font-medium text-(--fg-secondary)">
            {group.label}
          </span>
          <div className="flex flex-wrap gap-1">
            {group.options.map((o) => {
              const active = current[group.key] === o.value
              return (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => onPick(group, o.value)}
                  aria-pressed={active}
                  className={[
                    "rounded-(--radius-sm) border px-2.5 py-1 body-xs transition-colors",
                    active
                      ? "border-(--accent-brand) bg-(--bg-selected) text-(--fg-primary)"
                      : "border-(--border-default) text-(--fg-secondary) hover:bg-(--bg-hover)",
                  ].join(" ")}
                >
                  {o.label}
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
