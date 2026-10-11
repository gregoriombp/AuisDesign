"use client"

import * as React from "react"
import * as CheckboxPrimitives from "@radix-ui/react-checkbox"
import { cn } from "./cn"
import { Icon } from "./Icon"

export type CheckboxProps = Omit<
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitives.Root>,
  "checked" | "onCheckedChange" | "asChild" | "onChange"
> & {
  checked: boolean | "indeterminate"
  onChange?: (next: boolean) => void
  label?: string
}

export const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitives.Root>,
  CheckboxProps
>(function Checkbox(
  { checked, onChange, label, className, disabled, ...rest },
  ref
) {
  return (
    <CheckboxPrimitives.Root
      ref={ref}
      checked={checked}
      onCheckedChange={(v) => onChange?.(v === true)}
      disabled={disabled}
      aria-label={label}
      className={cn(
        "peer inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-sm border border-(--auis-border-default) bg-(--auis-bg-raised) outline-hidden transition-colors duration-au-fast",
        "hover:border-(--auis-fg-primary)",
        "focus-visible:ring-2 focus-visible:ring-(--auis-fg-primary) focus-visible:ring-offset-2 focus-visible:ring-offset-(--auis-bg-raised)",
        "data-[state=checked]:border-(--auis-fg-primary) data-[state=checked]:bg-(--auis-fg-primary) data-[state=checked]:text-(--auis-bg-raised)",
        "data-[state=indeterminate]:border-(--auis-fg-primary) data-[state=indeterminate]:bg-(--auis-fg-primary) data-[state=indeterminate]:text-(--auis-bg-raised)",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...rest}
    >
      <CheckboxPrimitives.Indicator className="flex items-center justify-center text-current">
        {checked === "indeterminate" ? (
          <Icon name="remove" size={14} weight={700} />
        ) : (
          <Icon name="check" size={14} weight={700} />
        )}
      </CheckboxPrimitives.Indicator>
    </CheckboxPrimitives.Root>
  )
})
