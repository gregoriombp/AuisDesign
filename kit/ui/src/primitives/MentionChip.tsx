import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { Icon } from "./Icon"
import { cn } from "./cn"

/**
 * MentionChip — the inline chip that renders an @agent mention, a /skill or a
 * #directive inside a Review Bridge comment. Purely presentational: the caller
 * picks the tone and either a Material Symbol or an image mark (an agent's
 * official logo, passed in — the chip never ships one).
 */

export type MentionChipTone =
  | "neutral"
  | "inverse"
  | "teal"
  | "purple"
  | "amber"
  | "pink"
  | "blue"

// The outline badge this chip used to wrap (shadcn's `badge`), inlined.
const BADGE_OUTLINE_CLASS =
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-hidden focus:ring-2 focus:ring-ring focus:ring-offset-2 text-foreground"

export const MENTION_CHIP_BASE_CLASS =
  "inline-flex min-h-6 items-center gap-1.5 rounded-lg border-transparent px-2.5 py-1 text-xs font-medium leading-none align-baseline select-none"

export const MENTION_CHIP_INTERACTIVE_CLASS =
  "cursor-pointer transition-[background-color,color,border-color,filter] duration-au-fast hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--auis-accent-brand)"

export const MENTION_CHIP_TONE_CLASS: Record<MentionChipTone, string> = {
  neutral: "bg-(--auis-bg-hover) text-(--auis-fg-secondary)",
  inverse: "bg-(--auis-bg-inverse) text-(--auis-fg-on-inverse)",
  teal: "bg-(--au-teal-100) text-(--au-teal-800)",
  purple: "bg-(--au-purple-100) text-(--au-purple-800)",
  amber: "bg-(--au-amber-100) text-(--au-amber-900)",
  pink: "bg-(--au-pink-100) text-(--au-pink-800)",
  blue: "bg-(--au-blue-100) text-(--au-blue-800)",
}

type MentionChipProps = React.HTMLAttributes<HTMLElement> & {
  as?: "span" | "button"
  tone?: MentionChipTone
  /** Material Symbol name. */
  icon?: string
  /** Image mark rendered in place of the glyph (e.g. an agent's official logo). */
  iconSrc?: string
  interactive?: boolean
}

export function MentionChip({
  as = "span",
  tone = "neutral",
  icon,
  iconSrc,
  interactive,
  className,
  children,
  ...rest
}: MentionChipProps) {
  const Component = as
  const buttonProps = as === "button" ? { type: "button" as const } : undefined

  const chipClassName = cn(
    BADGE_OUTLINE_CLASS,
    MENTION_CHIP_BASE_CLASS,
    MENTION_CHIP_TONE_CLASS[tone],
    interactive && MENTION_CHIP_INTERACTIVE_CLASS,
    className,
  )

  return (
    <Slot className={chipClassName}>
      <Component {...buttonProps} {...rest}>
        {iconSrc ? (
          // An <img> keeps the chip inline: it renders inside comment text (<p>).
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={iconSrc}
            alt=""
            aria-hidden="true"
            className="h-4 w-4 shrink-0 rounded-full object-cover"
          />
        ) : icon ? (
          <Icon name={icon} size={14} className="shrink-0" />
        ) : null}
        {children}
      </Component>
    </Slot>
  )
}
