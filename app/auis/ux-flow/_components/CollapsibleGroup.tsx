"use client"

import * as React from "react"
import { Icon } from "@/components/ui/Icon"

/**
 * Seção de grupo colapsável do índice de UX Flows. O label do grupo é um
 * heading de verdade (não eyebrow allcaps) e funciona como menu suspenso:
 * clica pra expandir/colapsar, com chevron. Começa aberto.
 */
export function CollapsibleGroup({
  title,
  count,
  defaultOpen = true,
  children,
}: {
  title: string
  count?: number
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = React.useState(defaultOpen)

  return (
    <section className="mb-6">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="group flex w-full items-center gap-2 py-2 text-left"
      >
        <Icon
          name="keyboard_arrow_down"
          size={22}
          className="text-(--fg-tertiary) transition-transform group-hover:text-(--fg-secondary)"
          style={{
            transform: open ? "rotate(0deg)" : "rotate(-90deg)",
            transition: "transform var(--dur-base) var(--ease-out)",
          }}
        />
        <h2 className="m-0 text-xl font-semibold tracking-tight text-(--fg-primary)">
          {title}
        </h2>
        {typeof count === "number" && (
          <span className="text-sm text-(--fg-tertiary) tabular-nums">{count}</span>
        )}
      </button>

      <div
        className="grid"
        style={{
          gridTemplateRows: open ? "1fr" : "0fr",
          transition: "grid-template-rows var(--dur-base) var(--ease-out)",
        }}
      >
        <div className="overflow-hidden">
          <div className="pt-3">{children}</div>
        </div>
      </div>
    </section>
  )
}
