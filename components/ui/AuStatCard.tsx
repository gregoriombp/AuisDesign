import * as React from "react"
import { cn } from "@/lib/utils"
import { Icon } from "./Icon"

/**
 * AuStatCard — KPI / stat tile.
 *
 * Auis-era replacement for the legacy `KPICard` and `MetricCard` in
 * `/components/`, both of which are pre-token-system and use hardcoded
 * colors. AuStatCard takes a value, a label, an optional eyebrow icon
 * and an optional hint line, with two visual variants:
 *
 *  - `default` — neutral surface, used for inventory KPIs (counts, totals).
 *  - `ai`      — soft AI-gradient mesh on the corners (same treatment used
 *                by `au-card--ai`), reserved for AI-flavoured stats.
 *
 * Lives in Playground until reviewed for promotion.
 */

export type AuStatCardVariant = "default" | "ai"

/** Tile density — `sm` tightens padding, radius and the value scale for dense
 *  grids (inbox counters); `md` (default) is the dashboard tile. */
export type AuStatCardSize = "sm" | "md"

export type AuStatCardProps = React.HTMLAttributes<HTMLDivElement> & {
  /** Material Symbol shown in the eyebrow line, before the label. */
  icon?: string
  /** Small uppercase label above the value (the eyebrow). */
  label: string
  /** Big value — number, formatted string, or any node. */
  value: React.ReactNode
  /** Optional one-line hint below the value. */
  hint?: React.ReactNode
  /** Variant — `ai` paints the soft mesh used elsewhere in the DS. */
  variant?: AuStatCardVariant
  size?: AuStatCardSize
}

export const AuStatCard = React.forwardRef<HTMLDivElement, AuStatCardProps>(
  function AuStatCard(
    { icon, label, value, hint, variant = "default", size = "md", className, ...rest },
    ref,
  ) {
    return (
      <div
        ref={ref}
        data-slot="stat-card"
        className={cn(
          "flex flex-col gap-1.5 border border-subtle bg-raised",
          size === "sm" ? "rounded-xl p-4" : "rounded-2xl p-5",
          variant === "ai" && "au-card--ai",
          className,
        )}
        {...rest}
      >
        <div className="flex items-center gap-2 text-(length:--body-xs-size) font-medium text-fg-secondary">
          {icon && <Icon name={icon} size={16} />}
          <span>{label}</span>
        </div>
        <div
          className={cn(
            "font-semibold leading-none tracking-heading-tighter text-fg-primary",
            size === "sm" ? "text-(length:--h4-size)" : "text-(length:--h3-size)",
          )}
        >
          {value}
        </div>
        {hint && (
          <div className="body-xs text-fg-tertiary">
            {hint}
          </div>
        )}
      </div>
    )
  },
)
