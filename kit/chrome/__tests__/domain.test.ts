import assert from "node:assert/strict"
import test from "node:test"
import { allowedPage, isNote, pageKey, reviewPrompt, validEndpoint, type Note } from "../src/domain"

const note: Note = { id: "note-1", version: 1, url: "https://example.com/settings?a=1", pageKey: "https://example.com/settings?a=1", title: "Settings", text: "Aumentar o contraste", status: "open", createdAt: 1, updatedAt: 2, anchor: { kind: "pin", position: { x: 10, y: 20 } }, context: { capturedAt: 1, pageUrl: "https://example.com/settings?a=1", target: { tag: "button", label: "Salvar", selector: "button.save" } } }
test("extension page identity isolates hosts, ports, SPA states and fragments", () => {
  assert.notEqual(pageKey("https://a.com/settings"), pageKey("https://b.com/settings"))
  assert.notEqual(pageKey("https://a.com/#/one"), pageKey("https://a.com/#/two"))
  assert.notEqual(pageKey("https://a.com/?tab=a"), pageKey("https://a.com/?tab=b"))
  assert.notEqual(pageKey("http://localhost:3000/"), pageKey("http://localhost:4000/"))
  assert.equal(pageKey("https://a.com/?b=2&utm_source=test&a=1"), pageKey("https://a.com/?a=1&b=2"))
  assert.equal(pageKey("https://a.com/?a=1&a=2"), "https://a.com/?a=1&a=2")
})
test("backup validation rejects executable attachments and malformed anchors", () => {
  assert.equal(isNote(note), true)
  assert.equal(isNote({ ...note, pageKey: "https://other.com/" }), false)
  assert.equal(isNote({ ...note, id: "../../unsafe" }), false)
  assert.equal(isNote({ ...note, images: ["javascript:alert(1)"] }), false)
  assert.equal(isNote({ ...note, images: ["data:image/svg+xml;base64,abc"] }), false)
  assert.equal(isNote({ ...note, anchor: { kind: "draw", path: {} } }), false)
  assert.equal(isNote({ ...note, anchor: { kind: "pin", position: { x: null, y: 2 } } }), false)
  assert.equal(isNote({ ...note, anchor: { ...note.anchor, el: { selector: "h1", fx: 0, fy: 0, fingerprint: { tag: "invalid[" } } } }), false)
  assert.equal(isNote({ ...note, context: { pageUrl: note.url, target: { label: {} } } }), false)
})
test("handoff keeps the actual request and identifies evidence without claiming source files", () => {
  const prompt = reviewPrompt([note])
  assert.ok(prompt.includes(note.text))
  assert.ok(prompt.includes(note.url))
  assert.ok(prompt.includes("button.save"))
  assert.ok(prompt.includes("Captura: Não disponível"))
  assert.ok(prompt.includes("seletores são pistas"))
})
test("only web pages and secure transcription endpoints are accepted", () => {
  assert.equal(allowedPage("chrome://extensions"), false)
  assert.equal(allowedPage("https://apple.com"), true)
  assert.equal(validEndpoint("http://example.com/api"), false)
  assert.equal(validEndpoint("https://secret@example.com/api"), false)
  assert.equal(validEndpoint("https://novah.auis.design/api/review/transcribe"), true)
})
