import assert from "node:assert/strict"
import test from "node:test"

import {
  REVIEW_AGENT_RUNTIME,
  normalizeAgentSettings,
  normalizeAgentSettingsMap,
  runnableMentions,
  validateAgentSettings,
} from "../agentRuntime"

test("defaults reproduce the trigger as shipped: Claude on in Edit, the rest off", () => {
  const s = normalizeAgentSettingsMap({})
  assert.deepEqual(s.claude, { enabled: true, permission: "edit", model: "claude-opus-5-5" })
  assert.deepEqual(Object.keys(s).sort(), ["claude", "codex", "grok"])
  assert.deepEqual(s.grok, { enabled: false, permission: "reply", model: "grok-4.7" })
  assert.deepEqual(s.codex, { enabled: false, permission: "reply", model: null })
})

test("a record in another shape falls back to the defaults", () => {
  const s = normalizeAgentSettingsMap({
    claude: { liveResponse: true, autoConstruct: true },
    codex: { liveResponse: true, autoConstruct: true },
    stranger: { liveResponse: false, autoConstruct: false },
  })
  assert.deepEqual(s.claude, { enabled: true, permission: "edit", model: "claude-opus-5-5" })
  assert.equal(s.codex.enabled, false)
  assert.equal("stranger" in s, false)
})

test("Codex never switches on while it has no CLI", () => {
  assert.equal(REVIEW_AGENT_RUNTIME.codex.cli, null)
  assert.equal(
    normalizeAgentSettings("codex", { enabled: true, permission: "edit", model: null })?.enabled,
    false,
  )
  assert.equal(
    validateAgentSettings("codex", { enabled: true, permission: "reply", model: null }),
    null,
  )
})

test("a ceiling outside the agent's list is refused", () => {
  assert.equal(
    validateAgentSettings("claude", { enabled: true, permission: "review", model: "claude-opus-5-5" }),
    null,
  )
  assert.equal(
    validateAgentSettings("grok", { enabled: true, permission: "review", model: "grok-4.7" }),
    null,
  )
  assert.equal(
    validateAgentSettings("stranger", { enabled: true, permission: "reply", model: "claude-opus-5-5" }),
    null,
  )
})

test("a model outside the list: refused on write, swapped for the default on read", () => {
  assert.equal(
    validateAgentSettings("claude", { enabled: true, permission: "reply", model: "opus" }),
    null,
  )
  assert.equal(
    normalizeAgentSettings("claude", { enabled: true, permission: "reply", model: "opus" })?.model,
    "claude-opus-5-5",
  )
})

test("off or without an engine never opens a process", () => {
  const s = normalizeAgentSettingsMap({
    claude: { enabled: false, permission: "edit", model: "claude-opus-5-5" },
    grok: { enabled: true, permission: "reply", model: "grok-4.7" },
  })
  assert.deepEqual(runnableMentions(["claude", "grok"], s), ["grok"])
  assert.deepEqual(runnableMentions(["codex", "stranger"], s), [])
})

test("effort: Claude's Edit goes to high, Reply stays on the model's default", () => {
  assert.equal(REVIEW_AGENT_RUNTIME.claude.effort.edit, "high")
  assert.equal(REVIEW_AGENT_RUNTIME.claude.effort.reply, undefined)
})

test("every agent offers exactly the Reply and Edit ceilings", () => {
  for (const runtime of Object.values(REVIEW_AGENT_RUNTIME)) {
    assert.deepEqual([...runtime.permissions], ["reply", "edit"])
  }
})

test("Grok's models are the ones `grok models` lists (Grok Build 1.0.41)", () => {
  assert.deepEqual(
    REVIEW_AGENT_RUNTIME.grok.models.map((m) => m.id),
    ["grok-4.7", "grok-4.7-build-fast"],
  )
  assert.equal(REVIEW_AGENT_RUNTIME.grok.defaults.model, "grok-4.7")
})
