"use client"

import * as React from "react"

/**
 * Replays a short click recipe from `?ge=` so a UX-flow node can deep-link to
 * a real screen with a modal, drawer, menu, or wizard step already open.
 *
 * Grammar (steps separated by `>>`):
 * - `t:Button label` clicks a visible interactive element by text/aria label.
 * - `c:[data-demo=open]` clicks the first match for a CSS selector.
 * - `w:400` waits for the given number of milliseconds.
 */

type DriveStatus = "driving" | "failed"

const STEP_TIMEOUT_MS = 5000
const POLL_MS = 120
const SETTLE_MS = 350
const CLICKABLE_SELECTOR = [
  "button",
  "a[href]",
  "summary",
  "label",
  '[role="button"]',
  '[role="menuitem"]',
  '[role="menuitemradio"]',
  '[role="menuitemcheckbox"]',
  '[role="tab"]',
  '[role="option"]',
  '[role="switch"]',
  '[role="radio"]',
  '[role="checkbox"]',
].join(", ")

const normalize = (value: string | null | undefined) =>
  (value ?? "").replace(/\s+/g, " ").trim().toLowerCase()

const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms))

function findByText(text: string): HTMLElement | null {
  const wanted = normalize(text)
  if (!wanted) return null
  const candidates = Array.from(
    document.querySelectorAll<HTMLElement>(CLICKABLE_SELECTOR),
  ).filter(
    (element) =>
      element.offsetParent !== null ||
      element.closest("[data-radix-popper-content-wrapper]") !== null,
  )
  const labels = (element: HTMLElement) => [
    normalize(element.innerText),
    normalize(element.getAttribute("aria-label")),
    normalize(element.getAttribute("title")),
  ]
  return (
    candidates.find((element) => labels(element).some((label) => label === wanted)) ??
    candidates.find((element) => labels(element).some((label) => label.includes(wanted))) ??
    null
  )
}

function fireClick(element: HTMLElement) {
  element.scrollIntoView({ block: "center", behavior: "instant" as ScrollBehavior })
  const options = { bubbles: true, cancelable: true, view: window }
  element.dispatchEvent(new PointerEvent("pointerdown", { ...options, pointerId: 1 }))
  element.dispatchEvent(new MouseEvent("mousedown", options))
  element.dispatchEvent(new PointerEvent("pointerup", { ...options, pointerId: 1 }))
  element.dispatchEvent(new MouseEvent("mouseup", options))
  element.click()
}

async function waitFor(find: () => HTMLElement | null) {
  const deadline = Date.now() + STEP_TIMEOUT_MS
  while (Date.now() < deadline) {
    const element = find()
    if (element) return element
    await sleep(POLL_MS)
  }
  return null
}

async function drive(recipe: string, onFailure: (step: string) => void) {
  const steps = recipe.split(">>").map((step) => step.trim()).filter(Boolean)
  for (const step of steps) {
    const separator = step.indexOf(":")
    const kind = separator === -1 ? step : step.slice(0, separator)
    const argument = separator === -1 ? "" : step.slice(separator + 1).trim()
    if (kind === "w") {
      await sleep(Number(argument) || SETTLE_MS)
      continue
    }
    const element = await waitFor(() =>
      kind === "c"
        ? document.querySelector<HTMLElement>(argument)
        : findByText(argument),
    )
    if (!element) {
      onFailure(step)
      return false
    }
    fireClick(element)
    await sleep(SETTLE_MS)
  }
  return true
}

export function FlowStateDriver() {
  const [status, setStatus] = React.useState<DriveStatus | null>(null)
  const [failedStep, setFailedStep] = React.useState<string | null>(null)

  React.useEffect(() => {
    const recipe = new URLSearchParams(window.location.search).get("ge")
    if (!recipe) return
    let active = true
    void sleep(0).then(() => {
      if (active) setStatus("driving")
    })
    void sleep(400)
      .then(() =>
        drive(recipe, (step) => {
          if (!active) return
          setFailedStep(step)
          console.warn(`[FlowStateDriver] step not found: "${step}"`)
        }),
      )
      .then((succeeded) => {
        if (!active) return
        if (succeeded) {
          setStatus(null)
        } else {
          setStatus("failed")
        }
      })
    return () => {
      active = false
    }
  }, [])

  if (!status) return null

  return (
    <div className="pointer-events-none fixed bottom-4 left-4 z-90 flex items-center gap-2 rounded-full border border-default bg-raised px-3 py-1.5 text-xs font-medium shadow-md">
      <span
        className={[
          "inline-block h-2 w-2 rounded-full",
          status === "driving" ? "animate-pulse bg-accent-brand" : "bg-accent-warning",
        ].join(" ")}
      />
      <span className="text-fg-secondary">
        {status === "driving"
          ? "Replaying state…"
          : `Could not reach state${failedStep ? ` at “${failedStep}”` : ""}.`}
      </span>
    </div>
  )
}
