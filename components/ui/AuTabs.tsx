"use client"

import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"
import { cn } from "@/lib/utils"

export type AuTabsVariant = "segmented" | "standalone" | "underline"

export type AuTabsItem = {
  value: string
  label: React.ReactNode
  count?: number
  /** Tone of the count badge. `"danger"` paints it red (overdue/failed,
   *  needs-attention counts); defaults to the neutral pill. */
  countTone?: "default" | "danger"
  disabled?: boolean
}

export type AuTabsProps = {
  items: AuTabsItem[]
  value: string
  onChange: (value: string) => void
  variant?: AuTabsVariant
  className?: string
  "aria-label"?: string
}

export function AuTabs({
  items,
  value,
  onChange,
  variant = "segmented",
  className,
  "aria-label": ariaLabel,
}: AuTabsProps) {
  const listRef = React.useRef<HTMLDivElement | null>(null)
  const tabRefs = React.useRef<Map<string, HTMLButtonElement | null>>(new Map())
  const [indicator, setIndicator] = React.useState<{
    left: number
    width: number
  } | null>(null)
  const [ready, setReady] = React.useState(false)

  const recompute = React.useCallback(() => {
    if (variant !== "underline") return
    const list = listRef.current
    const node = tabRefs.current.get(value)
    if (!list || !node) return
    const listBox = list.getBoundingClientRect()
    const nodeBox = node.getBoundingClientRect()
    setIndicator({
      left: nodeBox.left - listBox.left,
      width: nodeBox.width,
    })
  }, [value, variant])

  React.useLayoutEffect(() => {
    recompute()
  }, [recompute])

  React.useEffect(() => {
    if (variant !== "underline") return
    const list = listRef.current
    if (!list) return
    const observer = new ResizeObserver(() => recompute())
    observer.observe(list)
    tabRefs.current.forEach((tab) => tab && observer.observe(tab))
    return () => observer.disconnect()
  }, [recompute, variant])

  // Fade-in only after first measurement so the indicator doesn't jump from 0,0.
  React.useEffect(() => {
    if (indicator && !ready) setReady(true)
  }, [indicator, ready])

  return (
    <TabsPrimitive.Root value={value} onValueChange={onChange}>
      <TabsPrimitive.List
        ref={listRef}
        aria-label={ariaLabel}
        className={cn(
          "au-tabs",
          `au-tabs--${variant}`,
          variant === "underline" && "au-tabs--has-indicator",
          className
        )}
      >
        {items.map((it) => {
          const active = it.value === value
          return (
            <TabsPrimitive.Trigger
              key={it.value}
              ref={(node) => {
                tabRefs.current.set(it.value, node)
              }}
              value={it.value}
              disabled={it.disabled}
              className={cn(
                "au-tabs__tab",
                active && "au-tabs__tab--active"
              )}
            >
              <span className="au-tabs__label">{it.label}</span>
              {typeof it.count === "number" && (
                <span
                  className={cn(
                    "au-tabs__count",
                    it.countTone === "danger" && "au-tabs__count--danger"
                  )}
                >
                  {it.count}
                </span>
              )}
            </TabsPrimitive.Trigger>
          )
        })}
        {variant === "underline" && indicator && (
          <span
            aria-hidden="true"
            className="au-tabs__indicator"
            style={{
              transform: `translateX(${indicator.left}px)`,
              width: `${indicator.width}px`,
              opacity: ready ? 1 : 0,
            }}
          />
        )}
      </TabsPrimitive.List>
    </TabsPrimitive.Root>
  )
}
