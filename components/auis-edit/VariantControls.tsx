"use client"

import * as React from "react"
import type { ComponentSpec, VariantAxis } from "@/lib/auis-edit/variant-registry"

// Variant controls for a detected Au* component. One segmented group per axis
// (Variant, Size). Swapped through classList — only values that exist in the
// design system.

export function VariantControls({
  spec,
  current,
  onPick,
}: {
  spec: ComponentSpec
  /** Current value per axis (read from classList, overridden by an open op). */
  current: Record<string, string | null>
  onPick: (axis: VariantAxis, value: string) => void
}) {
  return (
    <div className="flex flex-col gap-3">
      {spec.axes.map((axis) => (
        <div key={axis.key} className="flex flex-col gap-1.5">
          <span className="body-xs font-medium text-(--fg-secondary)">
            {axis.label}
          </span>
          <div className="flex flex-wrap gap-1">
            {axis.options.map((o) => {
              const active = current[axis.key] === o.value
              return (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => onPick(axis, o.value)}
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
