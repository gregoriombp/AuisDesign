"use client"

/* ─────────────────────────────────────────────────────────────────────
 * FlowStateDriver — STATE deep-links for state-driven screens.
 *
 * The UX flows (golden eyes) open the real screens in an iframe, but almost
 * every interesting state (open modal, wizard on step 2, drawer, kebab menu)
 * lives in a local useState and has no URL. This driver gives those states a
 * URL WITHOUT touching the product pages: it reads the `?ge=` param and
 * replays the user's click path after hydration.
 *
 * Grammar (steps separated by `>>`):
 *   t:<text>   → clicks the first clickable whose text/aria-label/title
 *                matches (exact first, then `includes`, case-insensitive)
 *   c:<css>    → clicks the first match of the CSS selector
 *   w:<ms>     → waits <ms> milliseconds
 *
 * E.g. /settings/organization?ge=t%3AEdit%20organization
 *      /settings/password?ge=t%3AReset>>w%3A400>>t%3AContinue
 *
 * Always mounted (like the ReviewModeProvider): without `?ge=` it renders
 * nothing and does nothing. REACTIVE to the param: beyond the initial load, a
 * client-side navigation that changes `?ge=` re-drives — that is how State
 * Mode fires the `interactions` declared in the registry without remounting
 * the screen. Each step waits for its target to appear (portals/modals mount
 * async) for up to 5s; if it never shows up, it stops and says so in the badge.
 *
 * Safety: the driver runs for anyone who opens the app, so a `?ge=` link sent
 * to someone would click inside their session. A recipe that arrives with the
 * page load, outside a same-origin iframe, waits for a click on "Replay". In
 * the states matrix and the UX-flow previews (same-origin iframes) and on
 * in-app navigation (State Mode), the driver stays automatic. No step ever
 * clicks a destructive action (delete, remove, pay, sign out): the same rule
 * as the comment replay (`isDestructiveTarget`).
 *
 * Exception: a headless script can set `GE_AUTOPLAY_GLOBAL` before the load,
 * and the load's recipe then runs without the click. Each run records its
 * progress on `<html>` (`GE_ATTR`), which such a script reads to wait for the
 * end and name the step that failed. Steps are read and run in
 * `lib/auis/geRecipe.ts`.
 * ──────────────────────────────────────────────────────────────────── */

import { Suspense, useEffect, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"

import { AuButton } from "@/components/ui/AuButton"
import { fireClick } from "@auis/core/fireClick"
import { findClickableByText } from "@auis/core/findClickable"
import { isDestructiveTarget } from "@auis/ui/review/revealTrail"
import {
  GE_ATTR,
  GE_AUTOPLAY_GLOBAL,
  GE_START_DELAY_MS,
  runGeRecipe,
  type GeFailReason,
  type GeResult,
  type GeStatus,
} from "@/lib/auis/geRecipe"

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

/**
 * The most recent run. A new run (a `?ge=` change, or StrictMode's second mount
 * in dev) stops the previous one before its next click. Without this both
 * clicked together and a menu opened and closed.
 */
let latestRun = 0

/** An iframe whose top is the app itself: the states matrix and the UX-flow previews. */
function inSameOriginFrame(): boolean {
  if (window.self === window.top) return false
  try {
    return window.top?.location.origin === window.location.origin
  } catch {
    // A top from another origin: reading `location` throws.
    return false
  }
}

function autoplayRequested(): boolean {
  return (window as unknown as Record<string, unknown>)[GE_AUTOPLAY_GLOBAL] === true
}

function markGe(status: GeStatus | null, failure?: { step: string; reason: GeFailReason }) {
  const root = document.documentElement
  if (status) root.setAttribute(GE_ATTR.status, status)
  else root.removeAttribute(GE_ATTR.status)
  if (failure) {
    root.setAttribute(GE_ATTR.failedStep, failure.step)
    root.setAttribute(GE_ATTR.failReason, failure.reason)
  } else {
    root.removeAttribute(GE_ATTR.failedStep)
    root.removeAttribute(GE_ATTR.failReason)
  }
}

function drive(recipe: string, isCancelled: () => boolean): Promise<GeResult> {
  return runGeRecipe<HTMLElement>(recipe, {
    find: (step) =>
      step.kind === "css"
        ? document.querySelector<HTMLElement>(step.selector)
        : findClickableByText(step.text, { fuzzy: true }),
    click: fireClick,
    isDestructive: isDestructiveTarget,
    sleep,
    isCancelled,
  })
}

// useSearchParams requires Suspense on prerender — the wrapper keeps the layout
// mount identical to its siblings (ReviewModeProvider does the same inside).
export function FlowStateDriver() {
  return (
    <Suspense fallback={null}>
      <FlowStateDriverInner />
    </Suspense>
  )
}

function FlowStateDriverInner() {
  const searchParams = useSearchParams()
  const recipe = searchParams.get("ge")
  const [status, setStatus] = useState<GeStatus | null>(null)
  const [failedStep, setFailedStep] = useState<string | null>(null)
  const [blocked, setBlocked] = useState(false)
  const [approved, setApproved] = useState<string | null>(null)
  // The recipe present on page load. `undefined` = the effect has not run yet.
  const initialRecipe = useRef<string | null | undefined>(undefined)

  useEffect(() => {
    if (initialRecipe.current === undefined) initialRecipe.current = recipe
    if (!recipe) {
      // Param removed (scenario change, mode exit): just clear the badge. A run
      // in progress carries on, since a step may have navigated.
      setStatus(null)
      setFailedStep(null)
      markGe(null)
      return
    }
    const cameFromOutside = recipe === initialRecipe.current && !inSameOriginFrame()
    if (cameFromOutside && approved !== recipe && !autoplayRequested()) {
      setStatus("awaiting")
      setFailedStep(null)
      markGe("awaiting")
      return
    }
    let alive = true
    const run = ++latestRun
    const superseded = () => run !== latestRun
    setStatus("driving")
    setFailedStep(null)
    setBlocked(false)
    markGe("driving")
    // Post-hydration (or post-navigation) breather before the first click.
    sleep(GE_START_DELAY_MS)
      .then(() => drive(recipe, superseded))
      .then((result) => {
        if (result.status === "cancelled" || superseded()) return
        if (result.status === "failed") {
          markGe("failed", result)
          console.warn(
            result.reason === "destructive"
              ? `[FlowStateDriver] step blocked (destructive action): "${result.step}" (recipe: "${recipe}")`
              : `[FlowStateDriver] step not found: "${result.step}" (recipe: "${recipe}")`,
          )
        } else {
          markGe("done")
        }
        if (!alive) return
        if (result.status === "failed") {
          setFailedStep(result.step)
          setBlocked(result.reason === "destructive")
          setStatus("failed")
          return
        }
        setStatus("done")
        setTimeout(() => alive && setStatus(null), 1200)
      })
    return () => {
      alive = false
    }
  }, [recipe, approved])

  if (!status || status === "done") return null

  if (status === "awaiting") {
    return (
      <div className="fixed bottom-4 left-4 z-90 flex items-center gap-3 rounded-full border border-(--border-default) bg-(--bg-raised)/95 py-1.5 pr-1.5 pl-4 shadow-(--shadow-md) backdrop-blur">
        <span className="body-xs text-(--fg-secondary)">This link replays clicks on this screen.</span>
        <AuButton size="sm" variant="primary" onClick={() => setApproved(recipe)}>
          Replay
        </AuButton>
        <AuButton size="sm" variant="ghost" onClick={() => setStatus(null)}>
          Not now
        </AuButton>
      </div>
    )
  }

  return (
    <div className="pointer-events-none fixed bottom-4 left-4 z-90 flex items-center gap-2 rounded-full border border-(--border-default) bg-(--bg-raised)/95 px-3 py-1.5 body-xs font-medium shadow-(--shadow-md) backdrop-blur">
      {status === "driving" ? (
        <>
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-(--accent-brand)" />
          <span className="text-(--fg-secondary)">Replaying state…</span>
        </>
      ) : (
        <>
          <span className="inline-block h-2 w-2 rounded-full bg-(--au-amber-500)" />
          <span className="text-(--fg-secondary)">
            {blocked
              ? `State not replayed — the step “${failedStep}” is a destructive action`
              : `Could not reach the state — step ${failedStep ? `“${failedStep}”` : "unknown"} not found`}
          </span>
        </>
      )}
    </div>
  )
}
