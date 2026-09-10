// Find a clickable element by its label — the tie-breaker left when the
// structural path no longer resolves.
//
// Shared by both replayers: the FlowStateDriver resolves `t:<text>` here, and
// the Review Mode reveal trail lands here when a step's fingerprint is
// ambiguous. And it is ambiguous often: the text of an icon button is the
// ligature ("edit"), identical on every pencil button of the screen, while the
// aria-label ("Organize policies") is unique.

import { stripIconLigature } from "./iconLigature"

export const CLICKABLE_SELECTOR = [
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

const norm = (s: string | null | undefined) =>
  (s ?? "").replace(/\s+/g, " ").trim().toLowerCase()

/**
 * First visible clickable whose label matches. Exact match first; `fuzzy`
 * enables `includes` (`?ge=` relies on it: "Simulate" matches "Simulate 12
 * scenarios"). The Review Mode replay does NOT use fuzzy — there, a wrong
 * target changes the screen's state, so finding nothing is the better outcome.
 */
export function findClickableByText(
  text: string,
  opts?: { fuzzy?: boolean },
): HTMLElement | null {
  const wanted = norm(text)
  if (!wanted || typeof document === "undefined") return null
  const candidates = Array.from(
    document.querySelectorAll<HTMLElement>(CLICKABLE_SELECTOR),
  ).filter(
    (el) =>
      el.offsetParent !== null ||
      el.closest("[data-radix-popper-content-wrapper]"),
  )
  const haystack = (el: HTMLElement) => [
    norm(el.innerText),
    norm(stripIconLigature(el.innerText)),
    norm(el.getAttribute("aria-label")),
    norm(el.getAttribute("title")),
  ]
  const exact = candidates.find((el) => haystack(el).some((h) => h === wanted))
  if (exact) return exact
  if (!opts?.fuzzy) return null
  return (
    candidates.find((el) => haystack(el).some((h) => h.includes(wanted))) ?? null
  )
}
