"use client"

import * as React from "react"
import { cn } from "./cn"

/**
 * Spinner — indeterminate loading ring. Border-only (`border-current` with a
 * transparent top + `animate-spin`), no SVG: it inherits the text color of its
 * context via currentColor — paint it with `text-(--auis-fg-secondary)`,
 * `text-(--auis-accent-brand)` etc. on the element or an ancestor.
 *
 * Use `Progress` when the progress is known. The spinner is for short,
 * indeterminate actions (saving, connecting, loading a list).
 */
export type SpinnerSize = "sm" | "md" | "lg"

const SIZE_CLASSES: Record<SpinnerSize, string> = {
  // 14 / 20 / 28px on the spacing scale (3.5 / 5 / 7).
  sm: "size-3.5 border-[1.5px]",
  md: "size-5 border-2",
  lg: "size-7 border-2",
}

export type SpinnerProps = Omit<
  React.HTMLAttributes<HTMLSpanElement>,
  "children"
> & {
  /** Ring size: sm (14px), md (20px, default) or lg (28px). */
  size?: SpinnerSize
  /** Optional text next to the ring (text-sm, fg-secondary). When present it is
   *  what screen readers announce; without it the aria-label applies. */
  label?: React.ReactNode
}

export const Spinner = React.forwardRef<HTMLSpanElement, SpinnerProps>(
  function Spinner({ size = "md", label, className, ...rest }, ref) {
    const hasLabel = label != null && label !== ""
    return (
      <span
        ref={ref}
        role="status"
        aria-label={hasLabel ? undefined : "Loading"}
        className={cn("inline-flex items-center gap-2 align-middle", className)}
        {...rest}
      >
        <span
          aria-hidden="true"
          className={cn(
            "inline-block shrink-0 animate-spin rounded-full border-current border-t-transparent",
            SIZE_CLASSES[size]
          )}
        />
        {hasLabel && (
          <span className="text-sm text-(--auis-fg-secondary)">{label}</span>
        )}
      </span>
    )
  }
)
