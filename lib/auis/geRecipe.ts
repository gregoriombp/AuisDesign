// The FlowStateDriver's `?ge=` recipe: reading the steps, running them, and the
// contract with scripts that load screens. No React and no DOM: the driver
// injects the lookup, the click and the clock, and the tests inject fakes.

export const GE_START_DELAY_MS = 400
export const GE_STEP_TIMEOUT_MS = 5000
export const GE_POLL_MS = 120
export const GE_SETTLE_MS = 350

/**
 * A global a headless script sets with `addInitScript` before the load. Set to
 * `true`, the page load's recipe runs without the click on "Replay". A URL
 * cannot set it, so a shared link still waits for whoever opens it to approve.
 */
export const GE_AUTOPLAY_GLOBAL = "__auisGeAutoplay"

/** Attributes on `<html>` that record the progress of the most recent recipe. */
export const GE_ATTR = {
  status: "data-ge-status",
  failedStep: "data-ge-failed-step",
  failReason: "data-ge-fail-reason",
} as const

export type GeStatus = "awaiting" | "driving" | "done" | "failed"
export type GeFailReason = "missing" | "destructive"

export type GeStep =
  | { raw: string; kind: "wait"; ms: number }
  | { raw: string; kind: "css"; selector: string }
  | { raw: string; kind: "text"; text: string }

export type GeResult =
  | { status: "done" }
  | { status: "failed"; step: string; reason: GeFailReason }
  | { status: "cancelled" }

export type GeRunnerDeps<T> = {
  find: (step: Exclude<GeStep, { kind: "wait" }>) => T | null
  click: (target: T) => void
  isDestructive: (target: T) => boolean
  sleep: (ms: number) => Promise<void>
  /** True when another run replaced this one. Stops before the next click. */
  isCancelled: () => boolean
  now?: () => number
}

/**
 * Steps separated by `>>`. A prefix other than `c:` and `w:` searches by text,
 * as the driver always did. `w:` without a number waits `GE_SETTLE_MS`.
 */
export function parseGeRecipe(recipe: string): GeStep[] {
  return recipe
    .split(">>")
    .map((raw) => raw.trim())
    .filter(Boolean)
    .map((raw): GeStep => {
      const sep = raw.indexOf(":")
      const kind = sep === -1 ? raw : raw.slice(0, sep)
      const arg = sep === -1 ? "" : raw.slice(sep + 1).trim()
      if (kind === "w") return { raw, kind: "wait", ms: Number(arg) || GE_SETTLE_MS }
      if (kind === "c") return { raw, kind: "css", selector: arg }
      return { raw, kind: "text", text: arg }
    })
}

/**
 * The longest a run can take: the initial delay, the declared waits and, for
 * each click, the whole lookup deadline plus the pause after it.
 */
export function geRecipeBudgetMs(recipe: string): number {
  return parseGeRecipe(recipe).reduce(
    (total, step) => total + (step.kind === "wait" ? step.ms : GE_STEP_TIMEOUT_MS + GE_SETTLE_MS),
    GE_START_DELAY_MS,
  )
}

/**
 * Runs the steps in order. Each click waits for its target for up to
 * `GE_STEP_TIMEOUT_MS`, because portals and modals mount asynchronously. A
 * missing or destructive target ends the run and names the step.
 */
export async function runGeRecipe<T>(recipe: string, deps: GeRunnerDeps<T>): Promise<GeResult> {
  const now = deps.now ?? Date.now
  for (const step of parseGeRecipe(recipe)) {
    if (deps.isCancelled()) return { status: "cancelled" }
    if (step.kind === "wait") {
      await deps.sleep(step.ms)
      continue
    }
    let target = deps.find(step)
    const deadline = now() + GE_STEP_TIMEOUT_MS
    while (!target && now() < deadline) {
      await deps.sleep(GE_POLL_MS)
      if (deps.isCancelled()) return { status: "cancelled" }
      target = deps.find(step)
    }
    if (!target) return { status: "failed", step: step.raw, reason: "missing" }
    if (deps.isDestructive(target)) return { status: "failed", step: step.raw, reason: "destructive" }
    if (deps.isCancelled()) return { status: "cancelled" }
    deps.click(target)
    await deps.sleep(GE_SETTLE_MS)
  }
  return { status: "done" }
}
