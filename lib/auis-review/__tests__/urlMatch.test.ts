import assert from "node:assert/strict"
import test from "node:test"

import {
  canonicalizeReviewUrl,
  isSameReviewUrl,
  matchesCurrentReviewUrl,
} from "../urlMatch"

const SCREEN = "/auis/states/example"

test("ephemeral params do not distinguish screens", () => {
  assert.equal(canonicalizeReviewUrl(`${SCREEN}?reviewCommentId=cmt-1&ge=t:Open`), SCREEN)
  assert.ok(isSameReviewUrl(`${SCREEN}?chrome=0`, SCREEN))
})

test("a state axis distinguishes screens, whatever the key order", () => {
  assert.ok(!isSameReviewUrl(`${SCREEN}?state=empty`, `${SCREEN}?state=error`))
  assert.ok(isSameReviewUrl(`${SCREEN}?plan=pro&state=empty`, `${SCREEN}?state=empty&plan=pro`))
})

test("a new pin only matches its own scenario", () => {
  const current = canonicalizeReviewUrl(`${SCREEN}?state=error&plan=pro`)
  assert.ok(matchesCurrentReviewUrl(`${SCREEN}?plan=pro&state=error`, current))
  assert.ok(!matchesCurrentReviewUrl(`${SCREEN}?state=empty`, current))
})

test("without a legacy entry the comparison stays strict", () => {
  assert.ok(!matchesCurrentReviewUrl(SCREEN, canonicalizeReviewUrl(`${SCREEN}?state=empty`)))
})

const LEGACY = [{ path: SCREEN, params: ["state", "plan"] }]

test("a pin from before the axis matches any value of it", () => {
  // Saved when the screen did not write its state into the URL yet.
  const old = SCREEN
  for (const current of [
    SCREEN,
    `${SCREEN}?state=empty`,
    `${SCREEN}?plan=pro&state=error`,
  ]) {
    assert.ok(
      matchesCurrentReviewUrl(old, canonicalizeReviewUrl(current), LEGACY),
      `should match ${current}`,
    )
  }
})

test("the looseness is only on the stored side, and only for that screen", () => {
  // The bare current screen does not inherit pins from other scenarios.
  assert.ok(
    !matchesCurrentReviewUrl(`${SCREEN}?state=error`, canonicalizeReviewUrl(SCREEN), LEGACY),
  )
  // A stored pin that names one of the axes is strict again.
  assert.ok(
    !matchesCurrentReviewUrl(
      `${SCREEN}?state=empty`,
      canonicalizeReviewUrl(`${SCREEN}?state=error`),
      LEGACY,
    ),
  )
  // Params outside the legacy axes still have to match.
  assert.ok(
    !matchesCurrentReviewUrl(SCREEN, canonicalizeReviewUrl(`${SCREEN}?tab=links`), LEGACY),
  )
  // Another route without an entry stays strict.
  assert.ok(!matchesCurrentReviewUrl("/auis/projects", canonicalizeReviewUrl("/auis/projects?tab=links"), LEGACY))
})
