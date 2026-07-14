import * as React from "react"
import { Icon } from "./Icon"

export type AuAlertVariant = "info" | "success" | "warning" | "danger"

export type AuAlertProps = React.HTMLAttributes<HTMLDivElement> & {
  variant?: AuAlertVariant
  title?: React.ReactNode
  icon?: string
  /** When passed, shows a close button (X) on the right. */
  onClose?: () => void
  children?: React.ReactNode
}

const DEFAULT_ICON: Record<AuAlertVariant, string> = {
  info: "info",
  success: "check_circle",
  warning: "warning",
  danger: "error",
}

export function AuAlert({
  variant = "info",
  title,
  icon,
  onClose,
  children,
  className,
  ...rest
}: AuAlertProps) {
  const glyph = icon ?? DEFAULT_ICON[variant]
  const classes = ["au-alert", `au-alert--${variant}`, className]
    .filter(Boolean)
    .join(" ")
  return (
    <div role="status" className={classes} {...rest}>
      <span className="au-alert__icon">
        <Icon name={glyph} size={20} fill={1} />
      </span>
      <div className="au-alert__body">
        {title && <strong className="au-alert__title">{title}</strong>}
        {children}
      </div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="-mr-1 ml-auto inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center self-start rounded-md opacity-60 transition-opacity duration-au-fast hover:opacity-100"
        >
          <Icon name="close" size={16} />
        </button>
      )}
    </div>
  )
}
