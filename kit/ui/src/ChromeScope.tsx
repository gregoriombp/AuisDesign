"use client"

import "./styles/chrome.css"
import * as React from "react"

/**
 * The chrome's styles only apply under an element marked `data-auis-ui` (see
 * styles/chrome.source.css), and that element also carries the chrome's own
 * tokens. Every chrome surface sits in one: `ReviewChrome` wraps itself, and an
 * app page that renders a chrome piece on its own (an avatar in an inbox, the
 * command menu on a flow canvas) wraps that piece in `ChromeScope` — the piece,
 * not the page around it, because app markup inside the scope would lose its
 * own utilities to the chrome's base styles.
 */
export const SCOPE_ATTR = "data-auis-ui"

// Overlays (menus, modals, the drawer) do not render where their trigger is:
// they portal out. They go to ONE scoped element at the end of <body> shared by
// every scope on the page — inside the chrome's styles, and out from under any
// transformed ancestor, which would turn their fixed positioning relative to it.
let portalRoot: HTMLElement | null = null
let users = 0

function subscribe() {
  users++
  if (!portalRoot) {
    portalRoot = document.createElement("div")
    portalRoot.setAttribute(SCOPE_ATTR, "")
    portalRoot.setAttribute("data-auis-portal", "")
    document.body.appendChild(portalRoot)
  }
  return () => {
    users--
    if (users > 0) return
    portalRoot?.remove()
    portalRoot = null
  }
}
const getPortalRoot = () => portalRoot
const getServerPortalRoot = () => null

const PortalContext = React.createContext<HTMLElement | null>(null)

/** Where a chrome overlay mounts. Undefined outside a scope (Radix then falls
 *  back to <body>, where the chrome's styles do not reach). */
export function useChromePortal(): HTMLElement | undefined {
  return React.useContext(PortalContext) ?? undefined
}

/**
 * The scope element is `display: contents` — it draws nothing and the layout
 * sees through it. Pass `as="span"` where a `div` is not allowed (inside a
 * button, a label or a paragraph).
 */
export function ChromeScope({
  as: Tag = "div",
  children,
}: {
  as?: "div" | "span"
  children: React.ReactNode
}) {
  const portal = React.useSyncExternalStore(subscribe, getPortalRoot, getServerPortalRoot)
  return (
    <Tag {...{ [SCOPE_ATTR]: "" }}>
      <PortalContext.Provider value={portal}>{children}</PortalContext.Provider>
    </Tag>
  )
}
