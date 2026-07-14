"use client"

import * as React from "react"
import { Icon } from "./Icon"
import { AuLogo } from "./AuLogo"

export type AuNavRailTheme = "light" | "dark"

/* ============================================================
 * AuNavRail — container with optional top + bottom slots.
 * ============================================================ */

export type AuNavRailProps = React.HTMLAttributes<HTMLElement> & {
  collapsed?: boolean
  theme?: AuNavRailTheme
  /**
   * Liquid-glass finish — translucent background + backdrop blur.
   * Pair with `theme` to tint for light or dark canvases.
   */
  translucent?: boolean
  onToggleCollapsed?: () => void
  top?: React.ReactNode
  bottom?: React.ReactNode
  children: React.ReactNode
}

export function AuNavRail({
  collapsed,
  theme = "light",
  translucent,
  onToggleCollapsed,
  top,
  bottom,
  className,
  children,
  ...rest
}: AuNavRailProps) {
  const classes = [
    "au-nav-rail",
    collapsed ? "au-nav-rail--collapsed" : "au-nav-rail--expanded",
    theme === "dark" && "au-nav-rail--dark",
    translucent && "au-nav-rail--translucent",
    className,
  ]
    .filter(Boolean)
    .join(" ")

  const hasToggle = typeof onToggleCollapsed === "function"
  const hasTop = Boolean(top) || hasToggle

  return (
    <nav className={classes} {...rest}>
      {hasTop && (
        <div className="au-nav-rail__top">
          {hasToggle && (
            <div className="au-nav-rail__toolbar">
              {!collapsed && (
                <AuLogo
                  variant="wordmark"
                  height={16}
                  className="au-nav-rail__logo"
                  aria-label="Auis"
                />
              )}
              <button
                type="button"
                className="au-nav-rail__toggle"
                onClick={onToggleCollapsed}
                aria-label={
                  collapsed ? "Expand navigation" : "Collapse navigation"
                }
                aria-expanded={!collapsed}
              >
                <Icon
                  name={collapsed ? "menu_open" : "menu"}
                  size={18}
                />
              </button>
            </div>
          )}
          {top}
        </div>
      )}
      <div className="au-nav-rail__body">{children}</div>
      {bottom && <div className="au-nav-rail__bottom">{bottom}</div>}
    </nav>
  )
}

/* ============================================================
 * AuNavRailGroup — a section with optional uppercase label.
 * ============================================================ */

export type AuNavRailGroupProps = React.HTMLAttributes<HTMLDivElement> & {
  label?: string
  children: React.ReactNode
}

export function AuNavRailGroup({
  label,
  className,
  children,
  ...rest
}: AuNavRailGroupProps) {
  const classes = ["au-nav-rail__group", className].filter(Boolean).join(" ")
  return (
    <div className={classes} {...rest}>
      {label && <div className="au-nav-rail__group-label">{label}</div>}
      <div className="au-nav-rail__items">{children}</div>
    </div>
  )
}

/* ============================================================
 * AuNavRailItem.
 * ============================================================ */

export type AuNavRailItemProps = Omit<
  React.AnchorHTMLAttributes<HTMLAnchorElement>,
  "children"
> & {
  icon: string
  iconFill?: 0 | 1
  active?: boolean
  count?: number | string
  as?: "a" | "button"
  children: React.ReactNode
}

export function AuNavRailItem({
  icon,
  iconFill,
  active,
  count,
  children,
  className,
  as = "a",
  ...rest
}: AuNavRailItemProps) {
  const classes = [
    "au-nav-rail__item",
    active && "au-nav-rail__item--active",
    className,
  ]
    .filter(Boolean)
    .join(" ")

  const label = typeof children === "string" ? children : undefined

  const content = (
    <>
      <Icon name={icon} size={20} fill={iconFill ?? (active ? 1 : 0)} />
      <span className="au-nav-rail__item-label">{children}</span>
      {count !== undefined && (
        <span className="au-nav-rail__count">{count}</span>
      )}
    </>
  )

  if (as === "button") {
    return (
      <button
        type="button"
        aria-current={active ? "page" : undefined}
        aria-label={label}
        className={classes}
        {...(rest as React.ButtonHTMLAttributes<HTMLButtonElement>)}
      >
        {content}
      </button>
    )
  }
  return (
    <a
      aria-current={active ? "page" : undefined}
      aria-label={label}
      className={classes}
      {...rest}
    >
      {content}
    </a>
  )
}

/* ============================================================
 * Shared hook — click-outside + Esc to close a popover.
 * ============================================================ */

function useClosable(open: boolean, close: () => void) {
  const ref = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close()
    }
    document.addEventListener("mousedown", onDoc)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onDoc)
      document.removeEventListener("keydown", onKey)
    }
  }, [open, close])
  return ref
}

/* ============================================================
 * AuNavRailOrgSwitcher — organization selector.
 * ============================================================ */

export type AuNavRailOrgOption = {
  id: string
  name: string
  subtitle?: string
  icon?: string
}

export type AuNavRailOrgSwitcherProps = {
  organization: AuNavRailOrgOption
  organizations?: AuNavRailOrgOption[]
  onSelect?: (id: string) => void
  manageHref?: string
  manageLabel?: string
  className?: string
}

export function AuNavRailOrgSwitcher({
  organization,
  organizations,
  onSelect,
  manageHref,
  manageLabel = "Manage organizations",
  className,
}: AuNavRailOrgSwitcherProps) {
  const [open, setOpen] = React.useState(false)
  const ref = useClosable(open, () => setOpen(false))

  return (
    <div
      ref={ref}
      className={["au-nav-rail__switcher", className].filter(Boolean).join(" ")}
    >
      <button
        type="button"
        className="au-nav-rail__switcher-btn"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Organization: ${organization.name}`}
      >
        <OrgIcon src={organization.icon} name={organization.name} />
        <div className="au-nav-rail__switcher-text">
          <div className="au-nav-rail__switcher-title">{organization.name}</div>
          {organization.subtitle && (
            <div className="au-nav-rail__switcher-sub">
              {organization.subtitle}
            </div>
          )}
        </div>
        <Caret className="au-nav-rail__switcher-caret" />
      </button>

      {open && (
        <div className="au-nav-rail__menu au-nav-rail__menu--bottom" role="menu">
          {organizations?.map((org) => {
            const active = org.id === organization.id
            return (
              <button
                key={org.id}
                type="button"
                role="menuitem"
                className={[
                  "au-nav-rail__menu-item",
                  active && "au-nav-rail__menu-item--active",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onClick={() => {
                  onSelect?.(org.id)
                  setOpen(false)
                }}
              >
                <OrgIcon src={org.icon} name={org.name} compact />
                <div className="au-nav-rail__menu-item-body">
                  <div className="au-nav-rail__menu-item-title">{org.name}</div>
                  {org.subtitle && (
                    <div className="au-nav-rail__menu-item-sub">
                      {org.subtitle}
                    </div>
                  )}
                </div>
              </button>
            )
          })}

          {manageHref && (
            <div className="au-nav-rail__menu-footer">
              <a
                href={manageHref}
                role="menuitem"
                className="au-nav-rail__menu-item"
                onClick={() => setOpen(false)}
              >
                <span className="au-nav-rail__menu-item-body">
                  <span className="au-nav-rail__menu-item-title">
                    {manageLabel}
                  </span>
                </span>
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function OrgIcon({
  src,
  name,
  compact,
}: {
  src?: string
  name: string
  compact?: boolean
}) {
  const size = compact ? 24 : 32
  return (
    <span
      className="au-nav-rail__switcher-avatar"
      style={{ width: size, height: size }}
    >
      {src ? (
        <img src={src} alt="" />
      ) : (
        name.substring(0, 1).toUpperCase()
      )}
    </span>
  )
}

/* ============================================================
 * AuNavRailUserSwitcher — user selector at the bottom.
 * ============================================================ */

export type AuNavRailUserOption = {
  id: string
  name: string
  title?: string
  avatar?: string
  initials?: string
}

export type AuNavRailUserSwitcherProps = {
  user: AuNavRailUserOption
  users?: AuNavRailUserOption[]
  onSelect?: (id: string) => void
  signOutHref?: string
  signOutLabel?: string
  className?: string
}

export function AuNavRailUserSwitcher({
  user,
  users,
  onSelect,
  signOutHref,
  signOutLabel = "Sair / trocar conta",
  className,
}: AuNavRailUserSwitcherProps) {
  const [open, setOpen] = React.useState(false)
  const ref = useClosable(open, () => setOpen(false))

  return (
    <div
      ref={ref}
      className={["au-nav-rail__switcher", className].filter(Boolean).join(" ")}
    >
      <button
        type="button"
        className="au-nav-rail__switcher-btn"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`User: ${user.name}`}
      >
        <UserAvatar user={user} />
        <div className="au-nav-rail__switcher-text">
          <div className="au-nav-rail__switcher-title">{user.name}</div>
          {user.title && (
            <div className="au-nav-rail__switcher-sub">{user.title}</div>
          )}
        </div>
        <Caret className="au-nav-rail__switcher-caret" />
      </button>

      {open && (
        <div className="au-nav-rail__menu au-nav-rail__menu--top" role="menu">
          {users?.map((u) => {
            const active = u.id === user.id
            return (
              <button
                key={u.id}
                type="button"
                role="menuitem"
                className={[
                  "au-nav-rail__menu-item",
                  active && "au-nav-rail__menu-item--active",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onClick={() => {
                  onSelect?.(u.id)
                  setOpen(false)
                }}
              >
                <UserAvatar user={u} compact />
                <div className="au-nav-rail__menu-item-body">
                  <div className="au-nav-rail__menu-item-title">{u.name}</div>
                  {u.title && (
                    <div className="au-nav-rail__menu-item-sub">{u.title}</div>
                  )}
                </div>
              </button>
            )
          })}

          {signOutHref && (
            <div className="au-nav-rail__menu-footer">
              <a
                href={signOutHref}
                role="menuitem"
                className="au-nav-rail__menu-item au-nav-rail__menu-item--danger"
                onClick={() => setOpen(false)}
              >
                <span className="au-nav-rail__menu-item-body">
                  <span className="au-nav-rail__menu-item-title">
                    {signOutLabel}
                  </span>
                </span>
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function UserAvatar({
  user,
  compact,
}: {
  user: AuNavRailUserOption
  compact?: boolean
}) {
  const size = compact ? 28 : 32
  return (
    <span
      className="au-nav-rail__switcher-avatar au-nav-rail__switcher-avatar--round"
      style={{ width: size, height: size }}
    >
      {user.avatar ? (
        <img src={user.avatar} alt="" />
      ) : (
        user.initials ?? user.name.substring(0, 2).toUpperCase()
      )}
    </span>
  )
}

/* ============================================================
 * Caret — shared SVG.
 * ============================================================ */

function Caret({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 4.5L6 7.5L9 4.5" />
    </svg>
  )
}
