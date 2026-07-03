import * as React from "react"

export type AuBreadcrumbItem = {
  label: React.ReactNode
  href?: string
  current?: boolean
}

export type AuBreadcrumbProps = React.HTMLAttributes<HTMLElement> & {
  items: AuBreadcrumbItem[]
  separator?: React.ReactNode
}

export function AuBreadcrumb({
  items,
  separator = "/",
  className,
  ...rest
}: AuBreadcrumbProps) {
  return (
    <nav
      aria-label="Breadcrumb"
      className={["au-crumbs", className].filter(Boolean).join(" ")}
      {...rest}
    >
      {items.map((it, i) => {
        const isLast = i === items.length - 1
        const current = it.current ?? isLast
        return (
          <React.Fragment key={i}>
            {current || !it.href ? (
              <span
                className={current ? "au-crumbs__current" : undefined}
                aria-current={current ? "page" : undefined}
              >
                {it.label}
              </span>
            ) : (
              <a href={it.href}>{it.label}</a>
            )}
            {!isLast && (
              <span className="au-crumbs__sep" aria-hidden="true">
                {separator}
              </span>
            )}
          </React.Fragment>
        )
      })}
    </nav>
  )
}
