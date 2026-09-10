"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * AuTextarea — multi-line text field with the same visual frame as `AuInput`
 * (`.au-input`: border, background, radius, hover, focus ring). `AuField`'s
 * framed variant is single-line only — do not wrap a textarea in it.
 */
export type AuTextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  /** Paints the frame with the error color — same treatment as AuInput.
   *  Plain `aria-invalid` also works; the prop only shortens the path. */
  invalid?: boolean
  /** "vertical" (default) keeps the resize handle on the vertical axis;
   *  "none" locks the height (only `rows` decides). */
  resize?: "none" | "vertical"
}

export const AuTextarea = React.forwardRef<HTMLTextAreaElement, AuTextareaProps>(
  function AuTextarea(
    { invalid, resize = "vertical", rows = 3, className, disabled, ...rest },
    ref
  ) {
    const ariaInvalid = rest["aria-invalid"]
    const isInvalid =
      invalid ?? (ariaInvalid === true || ariaInvalid === "true")

    return (
      <textarea
        ref={ref}
        rows={rows}
        disabled={disabled}
        className={cn(
          // Frame shared with AuInput (globals.css): border, background, radius,
          // hover, focus ring and transition. `:focus-within` also matches when
          // the element itself receives focus.
          "au-input",
          isInvalid && "au-input--invalid",
          // `.au-input:has(input:disabled)` does not reach a <textarea>; the
          // explicit class covers it (the same path AuInput uses).
          disabled && "au-input--disabled",
          // .au-input is unlayered CSS — the single-line geometry
          // (display/height/padding) only yields to the `!` modifier.
          "block! h-auto! py-2!",
          // The `.au-input input` selector does not reach a <textarea>; text,
          // placeholder and the height floor come from here.
          "min-h-0 w-full text-sm text-(--fg-primary) placeholder:text-(--fg-tertiary)",
          // The focus ring is the box-shadow of .au-input:focus-within — zero
          // the inherited utility ring so it does not double up.
          "outline-none focus-visible:ring-0 focus-visible:ring-offset-0",
          "disabled:cursor-not-allowed",
          resize === "vertical" ? "resize-y" : "resize-none",
          className
        )}
        {...rest}
        aria-invalid={isInvalid || undefined}
      />
    )
  }
)
