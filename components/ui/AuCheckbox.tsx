"use client"

import * as React from "react"
import * as CheckboxPrimitives from "@radix-ui/react-checkbox"
import { cn } from "@/lib/utils"
import { Icon } from "@/components/ui/Icon"

export type AuCheckboxProps = Omit<
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitives.Root>,
  "checked" | "onCheckedChange" | "asChild" | "onChange"
> & {
  checked: boolean | "indeterminate"
  onChange?: (next: boolean) => void
  label?: string
}

export const AuCheckbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitives.Root>,
  AuCheckboxProps
>(function AuCheckbox(
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
        "peer inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-sm border border-(--border-default) bg-(--bg-raised) outline-hidden transition-colors duration-au-fast",
        "hover:border-(--fg-primary)",
        "focus-visible:ring-2 focus-visible:ring-(--fg-primary) focus-visible:ring-offset-2 focus-visible:ring-offset-(--bg-raised)",
        "data-[state=checked]:border-(--fg-primary) data-[state=checked]:bg-(--fg-primary) data-[state=checked]:text-(--bg-raised)",
        "data-[state=indeterminate]:border-(--fg-primary) data-[state=indeterminate]:bg-(--fg-primary) data-[state=indeterminate]:text-(--bg-raised)",
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
