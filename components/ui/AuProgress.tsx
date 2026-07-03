"use client"

import * as React from "react"
import * as ProgressPrimitive from "@radix-ui/react-progress"
import { cn } from "@/lib/utils"

export type AuProgressVariant = "default" | "success" | "warning" | "danger"

export type AuProgressProps = {
  value: number
  max?: number
  label?: React.ReactNode
  valueLabel?: React.ReactNode
  variant?: AuProgressVariant
  className?: string
}

export function AuProgress({
  value,
  max = 100,
  label,
  valueLabel,
  variant = "default",
  className,
}: AuProgressProps) {
  const clamped = Math.max(0, Math.min(value, max))
  const pct = (clamped / max) * 100

  return (
    <div className={cn("au-progress-row", className)}>
      {(label || valueLabel !== undefined) && (
        <div className="au-progress-row__top">
          <span>{label}</span>
          <b>{valueLabel ?? `${Math.round(pct)}%`}</b>
        </div>
      )}
      <ProgressPrimitive.Root
        value={clamped}
        max={max}
        className={cn(
          "au-progress",
          variant !== "default" && `au-progress--${variant}`
        )}
      >
        <ProgressPrimitive.Indicator
          className="au-progress__fill"
          style={{ width: `${pct}%` }}
        />
      </ProgressPrimitive.Root>
    </div>
  )
}
