"use client"

import * as React from "react"
import * as DropdownPrimitive from "@radix-ui/react-dropdown-menu"
import { cn } from "@/lib/utils"
import { Icon } from "./Icon"

/**
 * AuDropdownMenu — declarative dropdown / action menu.
 *
 * Wraps `@radix-ui/react-dropdown-menu` with a single-component API that
 * mirrors `AuTabs` (items as data, trigger as a slot). Use it for sort
 * menus, row action menus, overflow menus, and any other "click-to-open"
 * list of commands.
 *
 * Items can be commands, separators, or labels. Commands optionally
 * carry an icon, a `checked` state (rendered as a trailing check),
 * a `danger` flag (paints the row in `--accent-danger`), and a
 * `disabled` flag.
 */

export type AuDropdownCommandItem = {
  id: string
  label: React.ReactNode
  icon?: string
  onSelect?: () => void
  /** Marks the row as the active selection — adds a trailing check. */
  checked?: boolean
  /** Renders the row in danger color. Use for destructive actions. */
  danger?: boolean
  disabled?: boolean
  /** Keep the menu open after selecting this item (multi-select pattern). */
  closeOnSelect?: boolean
  separator?: false
  isLabel?: false
}

export type AuDropdownSeparatorItem = {
  id: string
  separator: true
}

export type AuDropdownLabelItem = {
  id: string
  isLabel: true
  label: React.ReactNode
}

export type AuDropdownItem =
  | AuDropdownCommandItem
  | AuDropdownSeparatorItem
  | AuDropdownLabelItem

export type AuDropdownMenuProps = {
  /** Click target. Forwarded to Radix via `asChild`, so the consumer's
   *  own button (AuButton, plain button, etc.) becomes the trigger. */
  trigger: React.ReactNode
  items: AuDropdownItem[]
  align?: "start" | "center" | "end"
  side?: "top" | "right" | "bottom" | "left"
  /** Px gap between trigger and content. Default 4. */
  sideOffset?: number
  className?: string
  /** Optional aria-label for the menu surface. */
  "aria-label"?: string
}

function isSeparator(it: AuDropdownItem): it is AuDropdownSeparatorItem {
  return (it as AuDropdownSeparatorItem).separator === true
}
function isLabel(it: AuDropdownItem): it is AuDropdownLabelItem {
  return (it as AuDropdownLabelItem).isLabel === true
}

export function AuDropdownMenu({
  trigger,
  items,
  align = "end",
  side = "bottom",
  sideOffset = 4,
  className,
  "aria-label": ariaLabel,
}: AuDropdownMenuProps) {
  return (
    <DropdownPrimitive.Root>
      <DropdownPrimitive.Trigger asChild>{trigger}</DropdownPrimitive.Trigger>
      <DropdownPrimitive.Portal>
        <DropdownPrimitive.Content
          align={align}
          side={side}
          sideOffset={sideOffset}
          aria-label={ariaLabel}
          className={cn("au-dropdown", className)}
        >
          {items.map((it) => {
            if (isSeparator(it)) {
              return (
                <DropdownPrimitive.Separator
                  key={it.id}
                  className="au-dropdown__separator"
                />
              )
            }
            if (isLabel(it)) {
              return (
                <DropdownPrimitive.Label
                  key={it.id}
                  className="au-dropdown__label"
                >
                  {it.label}
                </DropdownPrimitive.Label>
              )
            }
            return (
              <DropdownPrimitive.Item
                key={it.id}
                disabled={it.disabled}
                onSelect={(e) => {
                  if (it.closeOnSelect === false) {
                    /* Multi-select pattern — keep the menu open. */
                    e.preventDefault()
                  }
                  it.onSelect?.()
                }}
                className={cn(
                  "au-dropdown__item",
                  it.danger && "au-dropdown__item--danger",
                  it.checked && "au-dropdown__item--checked",
                )}
              >
                {it.icon && (
                  <Icon
                    name={it.icon}
                    size={16}
                    className="au-dropdown__item-icon"
                  />
                )}
                <span className="au-dropdown__item-label">{it.label}</span>
                {it.checked && (
                  <Icon
                    name="check"
                    size={14}
                    className="au-dropdown__item-check"
                  />
                )}
              </DropdownPrimitive.Item>
            )
          })}
        </DropdownPrimitive.Content>
      </DropdownPrimitive.Portal>
    </DropdownPrimitive.Root>
  )
}
