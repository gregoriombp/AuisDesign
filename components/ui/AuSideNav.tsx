"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Icon } from "./Icon"

export type AuSideNavItem = {
  key: string
  label: string
  /** Renders the item as a link. Omit it to get a button driven by `onSelect`. */
  href?: string
  /** Material Symbols name, resolved through `Icon`. */
  icon?: string
  /** Trailing count or status, e.g. an unread badge. */
  trailing?: React.ReactNode
}

export type AuSideNavGroup = {
  /** Small caps label above the group. Omit for an unlabeled block. */
  label?: string
  items: AuSideNavItem[]
}

export type AuSideNavProps = {
  groups: AuSideNavGroup[]
  /** `key` of the item to paint as current. */
  activeKey?: string
  onSelect?: (key: string) => void
  className?: string
  "aria-label"?: string
}

/**
 * Grouped vertical navigation for `AuAppShell`'s sidebar.
 *
 * Two shapes on purpose: items with an `icon` read as destinations (a module
 * list), items without one read as records (a history of conversations, files,
 * recents). Both live in the same component so a sidebar can mix them without
 * two competing implementations.
 */
export function AuSideNav({
  groups,
  activeKey,
  onSelect,
  className,
  "aria-label": ariaLabel,
}: AuSideNavProps) {
  return (
    <nav aria-label={ariaLabel} className={cn("flex flex-col gap-6", className)}>
      {groups.map((group, index) => (
        <div key={group.label ?? `group-${index}`} className="flex flex-col gap-1">
          {group.label ? (
            <div className="px-3 pb-1 text-2xs font-medium text-fg-tertiary">
              {group.label}
            </div>
          ) : null}
          {group.items.map((item) => {
            const active = item.key === activeKey
            const content = (
              <>
                {item.icon ? (
                  <Icon
                    name={item.icon}
                    size={18}
                    fill={active ? 1 : 0}
                    className="shrink-0"
                  />
                ) : null}
                <span className="min-w-0 flex-1 truncate text-left">{item.label}</span>
                {item.trailing}
              </>
            )
            const classes = cn(
              "flex w-full items-center gap-2.5 rounded-md px-3 py-1.5 text-sm",
              "hover:bg-(--bg-hover) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--ring-focus)",
              active
                ? "bg-(--bg-selected) font-medium text-fg-primary"
                : "text-fg-secondary"
            )

            return item.href ? (
              <a
                key={item.key}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={classes}
              >
                {content}
              </a>
            ) : (
              <button
                key={item.key}
                type="button"
                aria-current={active ? "page" : undefined}
                onClick={() => onSelect?.(item.key)}
                className={classes}
              >
                {content}
              </button>
            )
          })}
        </div>
      ))}
    </nav>
  )
}
