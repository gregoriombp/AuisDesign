"use client"

import * as React from "react"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { cn } from "@/lib/utils"

/**
 * AuRadioGroup — exclusive selection (one value at a time) on top of the shadcn
 * `radio-group` primitive (@radix-ui/react-radio-group). Visually paired with
 * AuCheckbox: an 18px control, checked filled with accent-brand and a light
 * dot, the same focus ring and the same disabled treatment.
 *
 * Every `AuRadioGroupItem` carries a `label` slot (to the right of the control)
 * and an optional `description` (below the label). For a choice between 2–5
 * short horizontal options prefer `AuSegmented`; for multi-select, `AuCheckbox`.
 */
export type AuRadioGroupProps = Omit<
  React.ComponentPropsWithoutRef<typeof RadioGroup>,
  "onValueChange" | "asChild" | "onChange"
> & {
  /** Fired when the selection changes. Receives the item's `value`. */
  onChange?: (next: string) => void
  /** aria-label of the group — use it when there is no visible legend. */
  label?: string
}

export const AuRadioGroup = React.forwardRef<
  React.ElementRef<typeof RadioGroup>,
  AuRadioGroupProps
>(function AuRadioGroup({ onChange, label, className, ...rest }, ref) {
  return (
    <RadioGroup
      ref={ref}
      onValueChange={onChange}
      aria-label={label}
      className={cn("grid gap-3", className)}
      {...rest}
    />
  )
})

export type AuRadioGroupItemProps = Omit<
  React.ComponentPropsWithoutRef<typeof RadioGroupItem>,
  "asChild" | "children"
> & {
  /** Label to the right of the control. Without `label` only the radio renders —
   *  make sure it has an accessible name through `aria-label` then. */
  label?: React.ReactNode
  /** Supporting text below the label, in fg-secondary. */
  description?: React.ReactNode
}

export const AuRadioGroupItem = React.forwardRef<
  React.ElementRef<typeof RadioGroupItem>,
  AuRadioGroupItemProps
>(function AuRadioGroupItem(
  { label, description, id, disabled, className, ...rest },
  ref
) {
  const autoId = React.useId()
  const controlId = id ?? autoId
  const hasText = label != null || description != null
  const descriptionId = description != null ? `${controlId}-description` : undefined

  const control = (
    <RadioGroupItem
      ref={ref}
      id={controlId}
      disabled={disabled}
      aria-describedby={descriptionId}
      className={cn(
        // Paired with AuCheckbox: 18px, default border over bg-raised.
        "size-4.5 shrink-0 border-(--border-default) bg-(--bg-raised)",
        "hover:border-(--fg-primary)",
        // The inner dot (Indicator) inherits text-* through bg-current.
        "text-(--bg-raised)",
        "ring-offset-(--bg-raised) focus-visible:ring-2 focus-visible:ring-(--fg-primary) focus-visible:ring-offset-2",
        "data-[state=checked]:border-(--accent-brand) data-[state=checked]:bg-(--accent-brand)",
        // With a description the control aligns with the label's first line.
        description != null && "mt-0.5",
        !hasText && className
      )}
      {...rest}
    />
  )

  if (!hasText) return control

  return (
    <div
      className={cn(
        "flex gap-3",
        description != null ? "items-start" : "items-center",
        className
      )}
    >
      {control}
      <div className="flex min-w-0 flex-col gap-1">
        {label != null && (
          <label
            htmlFor={controlId}
            className={cn(
              "body-sm",
              description != null && "font-medium leading-none",
              disabled
                ? "cursor-not-allowed text-(--fg-tertiary)"
                : "cursor-pointer text-(--fg-primary)"
            )}
          >
            {label}
          </label>
        )}
        {description != null && (
          <p
            id={descriptionId}
            className={cn(
              "caption m-0",
              disabled ? "text-(--fg-tertiary)" : "text-(--fg-secondary)"
            )}
          >
            {description}
          </p>
        )}
      </div>
    </div>
  )
})
