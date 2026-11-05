import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { COMPONENT_REGISTRY } from "../variant-registry"

const css = readFileSync(new URL("../../../app/globals.css", import.meta.url), "utf8")
const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

// A class the registry applies but the stylesheet lacks leaves the element
// unstyled after a Live Edit variant switch, and the inspector cannot read it back.
test("every class Live Edit applies exists in globals.css", () => {
  const missing: string[] = []
  for (const spec of COMPONENT_REGISTRY) {
    for (const axis of spec.axes) {
      for (const option of axis.options) {
        if (!option.className) continue
        if (!new RegExp(`\\.${escape(option.className)}(?![\\w-])`).test(css)) {
          missing.push(`${spec.component} ${axis.key}=${option.value} → .${option.className}`)
        }
      }
    }
  }
  assert.deepEqual(missing, [])
})
