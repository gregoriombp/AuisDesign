"use client"

import { useSyncExternalStore } from "react"

/**
 * The LIVE address of the window — path and query, including what was written
 * with `history.replaceState`.
 *
 * Why not `useSearchParams()`: screens whose real flow mirrors its step into
 * the URL (a wizard, a detail view with tabs) write with `replaceState` on
 * purpose — that is how each step gets an address of its own without
 * remounting and losing what the person built so far. A write that passes
 * Next's own history state (`window.history.state`) is invisible to the App
 * Router, and `useSearchParams` keeps returning the address of the last real
 * navigation; only `useMirroredScenario` writes in a way the router follows.
 * This hook sees both kinds of write.
 *
 * For Review Mode the difference is serious, not cosmetic: a comment is saved
 * with `window.location` (the live address), and comparing that with a stale
 * snapshot would hide from the canvas exactly the pin that was just dropped —
 * it would be born "on another screen".
 *
 * `pushState` and `replaceState` emit no event: both are wrapped once, on the
 * first subscription, to notify listeners. The wrapper chains whatever is
 * already there (Next wraps both itself).
 */
const LOCATION_EVENT = "auis:locationchange"

let historyPatched = false

function patchHistory() {
  if (historyPatched || typeof window === "undefined") return
  historyPatched = true
  const methods = ["pushState", "replaceState"] as const
  for (const method of methods) {
    const original = window.history[method].bind(window.history)
    window.history[method] = (...args: Parameters<History["pushState"]>) => {
      original(...args)
      // In a microtask: Next writes the address from inside a
      // `useInsertionEffect`, and notifying there would schedule a render in
      // the middle of the commit ("useInsertionEffect must not schedule updates").
      queueMicrotask(() => window.dispatchEvent(new Event(LOCATION_EVENT)))
    }
  }
}

function subscribe(onStoreChange: () => void) {
  patchHistory()
  // Back/forward does not go through the wrapped methods.
  window.addEventListener("popstate", onStoreChange)
  window.addEventListener(LOCATION_EVENT, onStoreChange)
  return () => {
    window.removeEventListener("popstate", onStoreChange)
    window.removeEventListener(LOCATION_EVENT, onStoreChange)
  }
}

const clientSnapshot = () => window.location.pathname + window.location.search
/** No window on the server; callers fall back to the route's pathname. */
const serverSnapshot = () => ""

export function useLiveLocation(): string {
  return useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot)
}
