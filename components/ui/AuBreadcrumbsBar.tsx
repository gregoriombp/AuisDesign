"use client"

import * as React from "react"
import { AuBreadcrumb, type AuBreadcrumbItem } from "./AuBreadcrumb"
import { Icon } from "./Icon"

export type AuBreadcrumbsBarItem = {
  label: string
  href?: string
  icon?: React.ReactNode
}

export type AuBreadcrumbsBarItems = Array<string | AuBreadcrumbsBarItem>

export function AuBreadcrumbs({ items }: { items: AuBreadcrumbsBarItems }) {
  if (items.length === 0) return null
  const mapped: AuBreadcrumbItem[] = items.map((item) => {
    const value = typeof item === "string" ? { label: item } : item
    return {
      href: value.href,
      label: value.icon ? (
        <span className="inline-flex items-center gap-1.5">
          <span className="shrink-0">{value.icon}</span>
          {value.label}
        </span>
      ) : (
        value.label
      ),
    }
  })
  return (
    <AuBreadcrumb
      items={mapped}
      separator={<Icon name="chevron_right" size={14} />}
    />
  )
}

export function AuBreadcrumbsBar({
  items,
  innerClassName,
  trailing,
}: {
  items: AuBreadcrumbsBarItems
  innerClassName?: string
  trailing?: React.ReactNode
}) {
  if (items.length <= 1) return null
  return (
    <div className="flex h-11 shrink-0 items-center bg-raised">
      <div
        className={[
          "flex w-full items-center justify-between gap-4",
          innerClassName ?? "px-8",
        ].join(" ")}
      >
        <AuBreadcrumbs items={items} />
        {trailing ? <div className="shrink-0">{trailing}</div> : null}
      </div>
    </div>
  )
}
