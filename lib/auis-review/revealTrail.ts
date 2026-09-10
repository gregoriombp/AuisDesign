// Reveal trail — how a comment dropped inside a closed overlay finds its way
// back open.
//
// The pain: you open a modal/drawer/dropdown/tab, drop a pin inside it, and
// comment. Later you click that comment to review the work — you land on the
// page, but the modal is closed, so the anchored element isn't in the DOM and
// the pin has nowhere to render. On a screen with several modals you have no
// idea which one to open.
//
// The fix is app-agnostic: while you navigate, we passively record the
// interactive elements you click (the buttons/tabs/options that open and step
// through overlays) into a small per-page ring buffer. When you save a comment
// we snapshot that buffer onto the comment as its `revealPath`. On focus we
// REPLAY the path — clicking each recorded trigger in order — stopping the
// instant the anchored element appears. No app wiring, works for any overlay,
// and degrades to the plain behavior when there's no path (older comments).

import {
  captureElementRef,
  resolveAnchoredElement,
  resolveElementBySelector,
} from "./elementAnchor"
import { stripIconLigature } from "@/lib/auis/iconLigature"
import { fireClick } from "@/lib/auis/fireClick"
import { findClickableByText } from "@/lib/auis/findClickable"
import { OVERLAY_DATA_ATTR } from "@/components/auis-review/constants"
import type {
  ReviewAnchor,
  ReviewRevealStep,
} from "@/components/auis-review/types"

interface TrailEntry extends ReviewRevealStep {
  path: string
  at: number
}

// Keep a short tail; a reveal path longer than this is almost never a real
// open-this-overlay sequence (and we cap replay anyway).
const MAX_TRAIL = 12
const MAX_STEPS = 6

// Replay budget. Per step it is time to SETTLE (the overlay mounting), not time
// to wait for a known target to appear — hence far below the FlowStateDriver's
// 5s, which waits for text. The total cap exists because each step that reveals
// nothing is a blind click: 4 steps at 1.5s are already 6s.
const STEP_SETTLE_MS = 1500
const REVEAL_BUDGET_MS = 6000
const POLL_MS = 100

// What we treat as a "reveal trigger": disclosure / navigation controls. We do
// NOT record plain content clicks — only things that change which UI is shown.
const INTERACTIVE =
  'button,[role="button"],a[href],[role="tab"],[role="radio"],[role="menuitem"],[role="option"],[role="switch"],summary,[aria-haspopup],[aria-expanded],label[for]'

// Skip clearly destructive / final actions: replaying one of these on focus
// could re-fire it. Disclosure clicks (open, next, select a tab) are safe.
//
// The \b boundary only works on a CLEAN label: with the icon ligature glued on
// ("deleteRemove") there is no boundary between "delete" and "Remove" and the
// trigger slipped through. That is why `labelOf` strips the ligature first.
const DESTRUCTIVE =
  /\b(delete|remove|discard|destroy|erase|logout|sign out|log out|pay now|confirm payment|excluir|deletar|remover|apagar|descartar)\b/i

/** A trigger that must not be re-clicked — by text or by explicit marking. */
function isDestructive(el: Element, label: string): boolean {
  if (DESTRUCTIVE.test(label)) return true
  if (el.getAttribute("data-variant") === "destructive") return true
  const aria = stripIconLigature(el.getAttribute("aria-label") ?? "")
  return aria ? DESTRUCTIVE.test(aria) : false
}

let trail: TrailEntry[] = []

function labelOf(el: Element): string {
  const raw =
    el.getAttribute("aria-label") ||
    (el as HTMLElement).innerText ||
    el.textContent ||
    ""
  return stripIconLigature(raw).slice(0, 40)
}

function onClick(e: MouseEvent): void {
  // The clicks the replay fires are synthetic (isTrusted false) — filtering on
  // trust, instead of a global lock during the reveal, is what keeps the trail
  // from poisoning itself without silencing the REAL clicks the author makes
  // while the return is still settling.
  if (!e.isTrusted) return
  const target = e.target as Element | null
  if (!target || typeof target.closest !== "function") return
  // Ignore the review overlay's own chrome (toolbar, sheet, pins, the dot).
  if (target.closest(`[${OVERLAY_DATA_ATTR}]`)) return
  if (target.closest("[data-auis-dot]")) return
  const el = target.closest(INTERACTIVE)
  if (!el) return
  const label = labelOf(el)
  if (isDestructive(el, label)) return
  const ref = captureElementRef(el)
  if (!ref) return
  trail.push({
    selector: ref.selector,
    ...(ref.fingerprint ? { fingerprint: ref.fingerprint } : {}),
    ...(label ? { label } : {}),
    path: window.location.pathname,
    at: Date.now(),
  })
  if (trail.length > MAX_TRAIL) trail = trail.slice(-MAX_TRAIL)
}

/** Start recording reveal triggers globally. Returns a cleanup fn. */
export function startRevealTrail(): () => void {
  if (typeof document === "undefined") return () => {}
  document.addEventListener("click", onClick, true)
  return () => document.removeEventListener("click", onClick, true)
}

/** Drop the recorded trail (call on route change — overlays reset anyway). */
export function resetRevealTrail(): void {
  trail = []
}

/** The path the author took on `pathname` to reach the current state, capped. */
export function snapshotRevealTrail(pathname: string): ReviewRevealStep[] {
  return trail
    .filter((e) => e.path === pathname)
    .slice(-MAX_STEPS)
    .map(({ selector, fingerprint, label }) => ({
      selector,
      ...(fingerprint ? { fingerprint } : {}),
      ...(label ? { label } : {}),
    }))
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

/**
 * Re-open whatever overlay holds a comment's anchored element by replaying the
 * recorded reveal path. Clicks each trigger in order and polls for the anchor
 * after each — returning the moment it appears, so it clicks the MINIMUM needed
 * and never over-clicks past the target. No-op when the element is already
 * visible or there's no path. Returns true if the anchor is resolvable at the
 * end (revealed or already present).
 *
 * Resolves in strict mode on purpose: a step that resolves to the wrong element
 * is worse than a skipped step, because clicking it changes the screen's state.
 */
export async function revealAnchor(
  anchor: ReviewAnchor,
  revealPath?: ReviewRevealStep[],
  signal?: AbortSignal,
): Promise<boolean> {
  if (typeof document === "undefined") return false
  if (resolveAnchoredElement(anchor)) return true
  if (!revealPath?.length) return false
  const deadline = Date.now() + REVEAL_BUDGET_MS
  for (const step of revealPath) {
    if (signal?.aborted) return false
    if (resolveAnchoredElement(anchor)) return true
    if (Date.now() >= deadline) break
    // Paths recorded before the guard fix may still carry a destructive
    // trigger. Re-testing here is what keeps a return from re-clicking Delete.
    if (step.label && DESTRUCTIVE.test(stripIconLigature(step.label))) continue
    // The structural path first; the label is the net. An icon button's
    // fingerprint is the ligature ("edit"), identical on every pencil of the
    // screen — it is the `label` (aria-label: "Organize policies") that
    // identifies which one.
    const el =
      resolveElementBySelector(step.selector, step.fingerprint, {
        strict: true,
      }) ?? (step.label ? findClickableByText(step.label) : null)
    if (!(el instanceof HTMLElement)) continue
    try {
      fireClick(el)
    } catch {
      /* trigger gone or not clickable — try the next step */
    }
    // Let the overlay mount/animate, polling for the anchor as it settles.
    const settleUntil = Math.min(Date.now() + STEP_SETTLE_MS, deadline)
    while (Date.now() < settleUntil) {
      await sleep(POLL_MS)
      if (signal?.aborted) return false
      if (resolveAnchoredElement(anchor)) return true
    }
  }
  return !!resolveAnchoredElement(anchor)
}
