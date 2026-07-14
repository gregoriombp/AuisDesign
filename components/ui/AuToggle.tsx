"use client"

import * as React from "react"
import * as SwitchPrimitives from "@radix-ui/react-switch"
import { cn } from "@/lib/utils"

export type AuToggleProps = Omit<
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>,
  "checked" | "onCheckedChange" | "asChild" | "onChange"
> & {
  checked: boolean
  onChange?: (next: boolean) => void
  label?: string
}

export const AuToggle = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  AuToggleProps
>(function AuToggle(
  { checked, onChange, label, className, disabled, ...rest },
  ref
) {
  return (
    <SwitchPrimitives.Root
      ref={ref}
      checked={checked}
      onCheckedChange={onChange}
      disabled={disabled}
      aria-label={label}
      className={cn("au-toggle", checked && "au-toggle--on", className)}
      {...rest}
    />
  )
})

export type AuToggleRowProps = {
  title: React.ReactNode
  description?: React.ReactNode
  checked: boolean
  onChange?: (next: boolean) => void
  disabled?: boolean
  className?: string
  /**
   * "card" (default) — each row is a card with a border and a background.
   * "plain" — no card chrome, for lists separated by dividers.
   */
  variant?: "card" | "plain"
}

export function AuToggleRow({
  title,
  description,
  checked,
  onChange,
  disabled,
  className,
  variant = "card",
}: AuToggleRowProps) {
  return (
    <div
      className={cn(
        "au-toggle-row",
        variant === "plain" &&
          "border-0! rounded-none! bg-transparent! px-0! py-3.5! min-w-0!",
        className,
      )}
    >
      <div className="au-toggle-row__copy">
        <div className="au-toggle-row__copy-title">{title}</div>
        {description && (
          <div className="au-toggle-row__copy-desc">{description}</div>
        )}
      </div>
      <AuToggle
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        label={typeof title === "string" ? title : undefined}
      />
    </div>
  )
}
