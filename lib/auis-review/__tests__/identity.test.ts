import assert from "node:assert/strict"
import test from "node:test"

import {
  REVIEW_AGENTS,
  canBridgeSessionWriteAsAgent,
  canReviewAgentSubmitForApproval,
  canonicalReviewAgentActor,
  getReviewAgent,
  getReviewAgentByHandle,
  isReservedReviewAgentIdentity,
} from "../agents"
import { parseReviewCommand } from "../commandParse"
import {
  getReviewSkill,
  isReviewSkillAvailableToAgent,
} from "../skills"

test("Codex is one canonical mention target, never a human identity", () => {
  assert.equal(REVIEW_AGENTS.filter((agent) => agent.id === "codex").length, 1)
  assert.equal(getReviewAgentByHandle("CODEX")?.id, "codex")
  assert.deepEqual(parseReviewCommand("@Codex fix this").mentions, ["codex"])

  assert.equal(
    isReservedReviewAgentIdentity({ id: "rev-member-1", name: "Codex" }),
    true,
  )
  assert.equal(
    isReservedReviewAgentIdentity({ id: "rev-member-2", name: "Alex" }),
    false,
  )
})

test("Codex writes with its canonical agent actor", () => {
  assert.deepEqual(canonicalReviewAgentActor("codex"), {
    kind: "agent",
    id: "codex",
    name: "Codex",
  })
  assert.equal(getReviewAgent("codex")?.accentVar, "var(--au-teal-600)")
  assert.equal(
    canBridgeSessionWriteAsAgent({ role: "agent", authEnabled: true }),
    true,
  )
  assert.equal(
    canBridgeSessionWriteAsAgent({ role: "admin", authEnabled: false }),
    true,
  )
  assert.equal(
    canBridgeSessionWriteAsAgent({ role: "admin", authEnabled: true }),
    false,
  )
})

test("Codex mirrors Claude execution and approval without Germano powers", () => {
  const solve = getReviewSkill("auis-review-bridge-solve")
  assert.ok(solve)
  assert.equal(isReviewSkillAvailableToAgent(solve, "claude"), true)
  assert.equal(isReviewSkillAvailableToAgent(solve, "codex"), true)
  assert.equal(isReviewSkillAvailableToAgent(solve, "germano"), false)

  assert.equal(canReviewAgentSubmitForApproval("claude"), true)
  assert.equal(canReviewAgentSubmitForApproval("codex"), true)
  assert.equal(canReviewAgentSubmitForApproval("germano"), false)
})

test("there is no Cursor executor and no #now directive", () => {
  assert.equal(getReviewAgent("cursor"), undefined)
  assert.equal(getReviewAgentByHandle("cursor"), undefined)
  const parsed = parseReviewCommand("@Claude /auis-ux-writing #now")
  assert.deepEqual(parsed.mentions, ["claude"])
  assert.deepEqual(parsed.skills, ["auis-ux-writing"])
  assert.equal(
    parsed.segments.some((seg) => seg.type === "text" && seg.value.includes("#now")),
    true,
  )
})

test("people are mentionable only when the caller passes their handles", () => {
  assert.deepEqual(
    parseReviewCommand("@alex can you look?").segments.map((seg) => seg.type),
    ["text"],
  )
  const withPeople = parseReviewCommand("@alex can you look?", {
    userHandles: ["alex"],
  })
  assert.equal(withPeople.segments[0]?.type, "mentionUser")
  assert.deepEqual(withPeople.mentions, [])
})
