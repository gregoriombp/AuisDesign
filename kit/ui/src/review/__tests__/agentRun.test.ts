import assert from "node:assert/strict"
import test from "node:test"

import type { ReviewComment } from "@auis/core/types"
import { agentRunLabel, liveAgentRun } from "../agentRun"

const MIN = 60 * 1000

function withRun(run: ReviewComment["agentRun"]): ReviewComment {
  return { id: "cmt-1", agentRun: run } as ReviewComment
}

test("no mark, no agent working", () => {
  assert.equal(liveAgentRun(withRun(undefined), 10 * MIN), null)
})

test("a recent mark shows; a dead runner's mark goes away after 50 min", () => {
  const run = { agentId: "claude", phase: "running" as const, startedAt: 0 }
  assert.deepEqual(liveAgentRun(withRun(run), 49 * MIN), run)
  assert.equal(liveAgentRun(withRun(run), 51 * MIN), null)
})

test("queued and running read differently", () => {
  assert.equal(agentRunLabel({ agentId: "claude", phase: "running", startedAt: 0 }), "Working…")
  assert.match(agentRunLabel({ agentId: "claude", phase: "queued", startedAt: 0 }), /^Queued/)
})
