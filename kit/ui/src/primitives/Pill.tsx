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
}

export function Pill({
  variant = "neutral",
  dot = true,
  children,
  className,
  ...rest
}: PillProps) {
  const classes = ["auis-pill", `auis-pill--${variant}`, className]
    .filter(Boolean)
    .join(" ")
  return (
    <span className={classes} {...rest}>
      {dot && <span className="auis-pill__dot" aria-hidden="true" />}
      {children}
    </span>
  )
}
