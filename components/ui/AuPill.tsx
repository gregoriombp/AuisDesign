import * as React from "react"

export type AuPillVariant =
  | "live"
  | "draft"
  | "beta"
  | "warning"
  | "error"
  | "neutral"
  | "info"
  | "ai"

export type AuPillProps = React.HTMLAttributes<HTMLSpanElement> & {
  variant?: AuPillVariant
  dot?: boolean
}

export function AuPill({
  variant = "neutral",
  dot = true,
  children,
  className,
  ...rest
}: AuPillProps) {
  const classes = ["au-pill", `au-pill--${variant}`, className]
    .filter(Boolean)
    .join(" ")
  return (
    <span className={classes} {...rest}>
      {dot && <span className="au-pill__dot" aria-hidden="true" />}
      {children}
    </span>
  )
}
