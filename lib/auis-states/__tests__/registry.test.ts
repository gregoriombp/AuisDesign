import assert from "node:assert/strict"
import test from "node:test"

import { matchScreenStates, SCREEN_STATES } from "../registry"

const GE_STEP = /^(t:.+|c:.+|w:\d+)$/

test("each screen has a unique pattern, a label and a path that opens with no parameter", () => {
  const patterns = SCREEN_STATES.map((screen) => screen.pattern)
  assert.equal(new Set(patterns).size, patterns.length, "repeated pattern in the registry")
  for (const screen of SCREEN_STATES) {
    assert.ok(screen.screenLabel.trim(), `${screen.pattern} has no screenLabel`)
    if (screen.pattern.includes("[")) {
      assert.ok(screen.previewPath, `${screen.pattern} is dynamic and has no previewPath`)
      assert.ok(!screen.previewPath.includes("["), `${screen.pattern}: previewPath with a dynamic segment`)
    }
  }
})

test("each axis has a unique param, unique options and its default among them", () => {
  for (const screen of SCREEN_STATES) {
    const params = screen.axes.map((axis) => axis.param)
    assert.equal(new Set(params).size, params.length, `${screen.pattern}: repeated axis param`)
    for (const axis of screen.axes) {
      const values = axis.options.map((option) => option.value)
      assert.equal(new Set(values).size, values.length, `${screen.pattern} ?${axis.param}: repeated option`)
      assert.ok(
        values.includes(axis.defaultValue),
        `${screen.pattern} ?${axis.param}: default "${axis.defaultValue}" is not among the options`,
      )
    }
  }
})

test("?ge= recipes follow the FlowStateDriver format", () => {
  for (const screen of SCREEN_STATES) {
    // State Mode's interactions menu identifies each item by its label.
    const labels = (screen.interactions ?? []).map((interaction) => interaction.label)
    assert.equal(new Set(labels).size, labels.length, `${screen.pattern}: repeated interaction label`)
    for (const interaction of screen.interactions ?? []) {
      assert.ok(interaction.label.trim(), `${screen.pattern}: interaction without a label`)
      for (const step of interaction.ge.split(">>")) {
        assert.match(step.trim(), GE_STEP, `${screen.pattern}: invalid step "${step}" in "${interaction.label}"`)
      }
    }
  }
})

// A wrong param opens the default scenario without warning, and the recipe looks broken.
test("each recipe's params are the screen's axes with values among the options", () => {
  for (const screen of SCREEN_STATES) {
    for (const interaction of screen.interactions ?? []) {
      for (const [param, value] of Object.entries(interaction.params ?? {})) {
        const axis = screen.axes.find((candidate) => candidate.param === param)
        assert.ok(axis, `${screen.pattern}: "${interaction.label}" asks for ?${param}, which is not an axis`)
        assert.ok(
          axis.options.some((option) => option.value === value),
          `${screen.pattern}: "${interaction.label}" asks for ?${param}=${value}, outside the options`,
        )
      }
    }
  }
})

test("each screen's previewPath matches the screen itself", () => {
  for (const screen of SCREEN_STATES) {
    const path = (screen.previewPath ?? screen.pattern).split("?")[0]
    assert.equal(matchScreenStates(path)?.pattern, screen.pattern, `${path} matches another screen`)
  }
})
