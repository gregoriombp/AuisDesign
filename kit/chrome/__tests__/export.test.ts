import assert from "node:assert/strict"
import test from "node:test"
import { exportPages, placeCallout } from "../src/renderPage"
import { isPageCapture, type Note, type PageCapture } from "../src/domain"

const capture: PageCapture = { pageKey: "https://example.com/", url: "https://example.com/", title: "Example", capturedAt: 1, data: "data:image/png;base64,AA==", width: 1200, height: 3000, marks: [{ id: "one", pin: { x: 100, y: 2500 }, bounds: { x: 50, y: 2400, width: 500, height: 200 } }] }
test("export grouping keeps full pages shared or duplicates them per comment by choice", () => {
  const notes = [{ id: "one", pageKey: capture.pageKey }, { id: "two", pageKey: capture.pageKey }] as Note[]
  assert.equal(exportPages([capture], notes, "page").length, 1)
  assert.equal(exportPages([capture], notes, "page")[0].notes.length, 2)
  assert.equal(exportPages([capture], notes, "comment").length, 2)
  assert.equal(exportPages([capture], notes, "comment")[1].notes[0].id, "two")
})
test("callouts stay within a long page and avoid an occupied callout", () => {
  const target = { x: 100, y: 2800, width: 300, height: 100 }
  const first = placeCallout(target, 360, 180, capture, [])
  const second = placeCallout(target, 360, 180, capture, [first])
  for (const r of [first, second]) { assert.ok(r.x >= 0 && r.y >= 0); assert.ok(r.x + r.width <= 1200 && r.y + r.height <= 3000) }
  assert.ok(second.x + second.width <= first.x || first.x + first.width <= second.x || second.y + second.height <= first.y || first.y + first.height <= second.y)
})
test("imported full-page captures reject executable data and malformed marker coordinates", () => {
  assert.equal(isPageCapture(capture), true)
  assert.equal(isPageCapture({ ...capture, data: "data:image/svg+xml;base64,AA==" }), false)
  assert.equal(isPageCapture({ ...capture, marks: [{ id: "one", pin: { x: Infinity, y: 1 } }] }), false)
  assert.equal(isPageCapture({ ...capture, pageKey: "https://elsewhere.com/" }), false)
})
