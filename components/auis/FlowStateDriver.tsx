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
 * ──────────────────────────────────────────────────────────────────── */

import { Suspense, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"

import { fireClick } from "@/lib/auis/fireClick"
import { findClickableByText } from "@/lib/auis/findClickable"

type DriveStatus = "driving" | "done" | "failed"

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

async function drive(recipe: string, onFail: (step: string) => void): Promise<boolean> {
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
      onFail(step)
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

  useEffect(() => {
    if (!recipe) {
      // Param removed (scenario change, mode exit) — just clear the badge.
      setStatus(null)
      setFailedStep(null)
      return
    }
    let alive = true
    setStatus("driving")
    setFailedStep(null)
    // Post-hydration (or post-navigation) breather before the first click.
    sleep(400)
      .then(() =>
        drive(recipe, (step) => {
          if (!alive) return
          setFailedStep(step)
          console.warn(`[FlowStateDriver] step not found: "${step}" (recipe: "${recipe}")`)
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
  }, [recipe])

  if (!status || status === "done") return null

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
            Could not reach the state — step {failedStep ? `“${failedStep}”` : "unknown"} not found
          </span>
        </>
      )}
    </div>
  )
}
