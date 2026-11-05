import * as React from "react"

export type PillVariant =
  | "live"
  | "draft"
  | "beta"
  | "warning"
  | "error"
  | "neutral"
  | "info"
  | "ai"

export type PillProps = React.HTMLAttributes<HTMLSpanElement> & {
  variant?: PillVariant
  dot?: boolean
  /** A process in progress: a turning ring takes the dot's place. */
  busy?: boolean
}

export function Pill({
  variant = "neutral",
  dot = true,
  busy = false,
  children,
  className,
  ...rest
}: PillProps) {
  const classes = ["auis-pill", `auis-pill--${variant}`, className]
    .filter(Boolean)
    .join(" ")
  return (
    <span className={classes} {...rest}>
      {busy ? (
        <span
          aria-hidden="true"
          className="size-2.5 shrink-0 rounded-full border-[1.5px] border-current border-t-transparent animate-spin motion-reduce:animate-none"
        />
      ) : (
        dot && <span className="auis-pill__dot" aria-hidden="true" />
      )}
      {children}
    </span>
  )
}
