import assert from "node:assert/strict"
import test from "node:test"

import {
  GE_SETTLE_MS,
  GE_START_DELAY_MS,
  GE_STEP_TIMEOUT_MS,
  geRecipeBudgetMs,
  parseGeRecipe,
  runGeRecipe,
  type GeRunnerDeps,
  type GeStep,
} from "../geRecipe"

type Target = { label: string; destructive?: boolean }
type TargetStep = Exclude<GeStep, { kind: "wait" }>

// A fake clock: `sleep` moves time forward at once, so a step's 5 s deadline
// runs without really waiting.
function harness(find: (step: TargetStep, now: number) => Target | null, cancelAfterClicks = Infinity) {
  let now = 0
  const clicked: string[] = []
  const deps: GeRunnerDeps<Target> = {
    find: (step) => find(step, now),
    click: (target) => clicked.push(target.label),
    isDestructive: (target) => target.destructive === true,
    sleep: async (ms) => {
      now += ms
    },
    isCancelled: () => clicked.length >= cancelAfterClicks,
    now: () => now,
  }
  return { deps, clicked, elapsed: () => now }
}

const byLabel = (step: TargetStep) => ({ label: step.kind === "css" ? step.selector : step.text })

test("parseGeRecipe splits the steps, skips empty ones and cuts only at the first colon", () => {
  assert.deepEqual(parseGeRecipe(" t:New suite >>>> c:a:not(.x) >>w:180>>w:>>w"), [
    { raw: "t:New suite", kind: "text", text: "New suite" },
    { raw: "c:a:not(.x)", kind: "css", selector: "a:not(.x)" },
    { raw: "w:180", kind: "wait", ms: 180 },
    { raw: "w:", kind: "wait", ms: GE_SETTLE_MS },
    { raw: "w", kind: "wait", ms: GE_SETTLE_MS },
  ])
})

test("parseGeRecipe treats an unknown prefix as a text search", () => {
  assert.deepEqual(parseGeRecipe("x:Open"), [{ raw: "x:Open", kind: "text", text: "Open" }])
})

test("runGeRecipe clicks each target in order and ends in done", async () => {
  const { deps, clicked } = harness(byLabel)
  const result = await runGeRecipe("t:New suite>>w:180>>c:button[title='Move']", deps)
  assert.deepEqual(result, { status: "done" })
  assert.deepEqual(clicked, ["New suite", "button[title='Move']"])
})

test("runGeRecipe waits for a target that mounts later", async () => {
  const { deps, clicked } = harness((step, now) => (now >= 1000 ? byLabel(step) : null))
  assert.deepEqual(await runGeRecipe("t:Modal", deps), { status: "done" })
  assert.deepEqual(clicked, ["Modal"])
})

test("runGeRecipe stops at a missing target and names the step after the deadline", async () => {
  const { deps, clicked, elapsed } = harness((step) =>
    step.kind === "text" && step.text === "Gone" ? null : byLabel(step),
  )
  const result = await runGeRecipe("t:Open>>t:Gone>>t:After", deps)
  assert.deepEqual(result, { status: "failed", step: "t:Gone", reason: "missing" })
  assert.deepEqual(clicked, ["Open"])
  assert.ok(elapsed() >= GE_SETTLE_MS + GE_STEP_TIMEOUT_MS)
})

test("runGeRecipe does not click a destructive target", async () => {
  const { deps, clicked } = harness((step) => ({ label: byLabel(step).label, destructive: true }))
  assert.deepEqual(await runGeRecipe("t:Delete", deps), {
    status: "failed",
    step: "t:Delete",
    reason: "destructive",
  })
  assert.deepEqual(clicked, [])
})

test("an interrupted runGeRecipe clicks nothing more", async () => {
  const { deps, clicked } = harness(byLabel, 1)
  assert.deepEqual(await runGeRecipe("t:One>>t:Two>>t:Three", deps), { status: "cancelled" })
  assert.deepEqual(clicked, ["One"])
})

test("geRecipeBudgetMs adds the initial delay, the waits and each click's worst case", () => {
  assert.equal(
    geRecipeBudgetMs("t:A>>w:300>>c:b"),
    GE_START_DELAY_MS + 300 + 2 * (GE_STEP_TIMEOUT_MS + GE_SETTLE_MS),
  )
  assert.equal(geRecipeBudgetMs("w"), GE_START_DELAY_MS + GE_SETTLE_MS)
})
