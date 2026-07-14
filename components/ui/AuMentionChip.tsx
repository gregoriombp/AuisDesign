import * as React from "react"
import { Badge } from "@/components/ui/badge"
import { Icon } from "@/components/ui/Icon"
import { cn } from "@/lib/utils"

/**
 * AuMentionChip — the inline chip that renders an @agent mention, a /skill or a
 * #directive inside a Review Bridge comment. Purely presentational: the caller
 * picks the tone and the Material Symbol.
 */

export type AuMentionChipTone =
  | "neutral"
  | "inverse"
  | "teal"
  | "purple"
  | "amber"
  | "pink"
  | "blue"

export const AU_MENTION_CHIP_BASE_CLASS =
  "inline-flex min-h-6 items-center gap-1.5 rounded-lg border-transparent px-2.5 py-1 text-xs font-medium leading-none align-baseline select-none"

export const AU_MENTION_CHIP_INTERACTIVE_CLASS =
  "cursor-pointer transition-[background-color,color,border-color,filter] duration-au-fast hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--accent-brand)"

export const AU_MENTION_CHIP_TONE_CLASS: Record<AuMentionChipTone, string> = {
  neutral: "bg-(--bg-hover) text-(--fg-secondary)",
  inverse: "bg-(--bg-inverse) text-(--fg-on-inverse)",
  teal: "bg-(--au-teal-100) text-(--au-teal-800)",
  purple: "bg-(--au-purple-100) text-(--au-purple-800)",
  amber: "bg-(--au-amber-100) text-(--au-amber-900)",
  pink: "bg-(--au-pink-100) text-(--au-pink-800)",
  blue: "bg-(--au-blue-100) text-(--au-blue-800)",
}

type AuMentionChipProps = React.HTMLAttributes<HTMLElement> & {
  as?: "span" | "button"
  tone?: AuMentionChipTone
  /** Material Symbol name. */
  icon?: string
  interactive?: boolean
}

export function AuMentionChip({
  as = "span",
  tone = "neutral",
  icon,
  interactive,
  className,
  children,
  ...rest
}: AuMentionChipProps) {
  const Component = as
  const buttonProps = as === "button" ? { type: "button" as const } : undefined

  const chipClassName = cn(
    AU_MENTION_CHIP_BASE_CLASS,
    AU_MENTION_CHIP_TONE_CLASS[tone],
    interactive && AU_MENTION_CHIP_INTERACTIVE_CLASS,
    className,
  )

  return (
    <Badge asChild variant="outline" className={chipClassName}>
      <Component {...buttonProps} {...rest}>
        {icon ? <Icon name={icon} size={14} className="shrink-0" /> : null}
        {children}
      </Component>
    </Badge>
  )
}
