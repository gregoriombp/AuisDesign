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
 * ──────────────────────────────────────────────────────────────────── */

import { Suspense, useEffect, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"

import { AuButton } from "@/components/ui/AuButton"
import { fireClick } from "@/lib/auis/fireClick"
import { findClickableByText } from "@/lib/auis/findClickable"
import { isDestructiveTarget } from "@/lib/auis-review/revealTrail"

type DriveStatus = "awaiting" | "driving" | "done" | "failed"
type FailReason = "missing" | "destructive"

const STEP_TIMEOUT_MS = 5000
const POLL_MS = 120
const SETTLE_MS = 350

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function waitFor(find: () => HTMLElement | null): Promise<HTMLElement | null> {
  const deadline = Date.now() + STEP_TIMEOUT_MS
  while (Date.now() < deadline) {
    const el = find()
    if (el) return el
    await sleep(POLL_MS)
  }
  return null
}

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

async function drive(
  recipe: string,
  onFail: (step: string, reason: FailReason) => void,
): Promise<boolean> {
  const steps = recipe.split(">>").map((s) => s.trim()).filter(Boolean)
  for (const step of steps) {
    const sep = step.indexOf(":")
    const kind = sep === -1 ? step : step.slice(0, sep)
    const arg = sep === -1 ? "" : step.slice(sep + 1).trim()
    if (kind === "w") {
      await sleep(Number(arg) || SETTLE_MS)
      continue
    }
    const el = await waitFor(() =>
      kind === "c" ? document.querySelector<HTMLElement>(arg) : findClickableByText(arg, { fuzzy: true }),
    )
    if (!el) {
      onFail(step, "missing")
      return false
    }
    if (isDestructiveTarget(el)) {
      onFail(step, "destructive")
      return false
    }
    fireClick(el)
    await sleep(SETTLE_MS)
  }
  return true
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
  const [status, setStatus] = useState<DriveStatus | null>(null)
  const [failedStep, setFailedStep] = useState<string | null>(null)
  const [blocked, setBlocked] = useState(false)
  const [approved, setApproved] = useState<string | null>(null)
  // The recipe present on page load. `undefined` = the effect has not run yet.
  const initialRecipe = useRef<string | null | undefined>(undefined)

  useEffect(() => {
    if (initialRecipe.current === undefined) initialRecipe.current = recipe
    if (!recipe) {
      // Param removed (scenario change, mode exit) — just clear the badge.
      setStatus(null)
      setFailedStep(null)
      return
    }
    const cameFromOutside = recipe === initialRecipe.current && !inSameOriginFrame()
    if (cameFromOutside && approved !== recipe) {
      setStatus("awaiting")
      setFailedStep(null)
      return
    }
    let alive = true
    setStatus("driving")
    setFailedStep(null)
    setBlocked(false)
    // Post-hydration (or post-navigation) breather before the first click.
    sleep(400)
      .then(() =>
        drive(recipe, (step, reason) => {
          if (!alive) return
          setFailedStep(step)
          setBlocked(reason === "destructive")
          console.warn(
            reason === "destructive"
              ? `[FlowStateDriver] step blocked (destructive action): "${step}" (recipe: "${recipe}")`
              : `[FlowStateDriver] step not found: "${step}" (recipe: "${recipe}")`,
          )
        }),
      )
      .then((ok) => {
        if (!alive) return
        setStatus(ok ? "done" : "failed")
        if (ok) setTimeout(() => alive && setStatus(null), 1200)
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
