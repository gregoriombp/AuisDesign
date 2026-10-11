// Shared pieces of the review-chrome checks (see README in shoot.mjs): the
// browser, a mocked Review Bridge with fixed comments, and a fixed clock, so two
// runs of the same code produce the same pixels and nothing is written to the
// real bridge.
import { createRequire } from "node:module"
import { mkdirSync } from "node:fs"
import os from "node:os"
import path from "node:path"

export const ROOT = path.resolve(import.meta.dirname, "../..")
export const CHROME_CSS = path.join(ROOT, "kit/ui/src/styles/chrome.css")

const args = process.argv.slice(2)
export const argOf = (flag, fallback) => {
  const i = args.indexOf(flag)
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback
}
export const BASE = argOf("--base", "http://127.0.0.1:3000").replace(/\/$/, "")

/** `<tmp>/auis-chrome-check/<label>/` unless `--dir` says otherwise. */
export function outDir(label) {
  const dir = path.join(argOf("--dir", path.join(os.tmpdir(), "auis-chrome-check")), label)
  mkdirSync(dir, { recursive: true })
  return dir
}

/** playwright-core, from PLAYWRIGHT_MODULE (any Playwright package) or the
 *  repo's node_modules, like states-matrix-pdf.mjs and anchor-survival.mjs. */
export function loadPlaywright() {
  const require = createRequire(path.join(ROOT, "package.json"))
  const custom = process.env.PLAYWRIGHT_MODULE
  let dir
  try {
    dir = path.dirname(require.resolve(`${custom ?? "playwright-core"}/package.json`))
  } catch {
    throw new Error(
      "playwright-core is not installed. Run `npm i -D playwright-core` (it uses your installed Chrome), or set PLAYWRIGHT_MODULE.",
    )
  }
  const { chromium } = require(dir)
  // The pixel comparator Playwright's own toHaveScreenshot uses.
  const core = custom && !custom.endsWith("-core") ? path.join(dir, "..", "playwright-core") : dir
  const { getComparator } = require(path.join(core, "lib/server/utils/comparators.js"))
  return { chromium, compare: getComparator("image/png") }
}

export const launchOptions = () =>
  process.env.PLAYWRIGHT_CHROMIUM_PATH
    ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH, headless: true }
    : { channel: "chrome", headless: true }

export const NOW = Date.parse("2026-10-10T12:00:00Z")
export const ME = { id: "rev-baseline", name: "Greg", colorToken: "var(--au-blue-600)", createdAt: NOW - 86400000 }

const comment = (over) => ({
  schemaVersion: 3,
  authorId: ME.id,
  authorName: "Greg",
  authorColorToken: "var(--au-blue-600)",
  createdAt: NOW - 3600_000,
  updatedAt: NOW - 1800_000,
  url: "/auis",
  viewportWidth: 1440,
  viewportHeight: 900,
  scrollY: 0,
  documentHeight: 900,
  status: "open",
  ...over,
})

/** Every kind of card the drawer draws: open with human and agent replies and
 *  chips, in review with a resolution, resolved, a freehand mark, a future idea,
 *  and one comment on another screen. */
export const COMMENTS = [
  comment({
    id: "cmt-a",
    anchor: { kind: "pin", position: { x: 420, y: 260 } },
    text: "The heading feels heavy next to the cards. @Claude can you try a lighter weight?",
    replies: [
      { id: "r1", authorKind: "user", authorId: "rev-ana", authorName: "Ana", authorColorToken: "var(--au-emerald-600)", text: "Agree, and the spacing below it too.", createdAt: NOW - 3000_000 },
      { id: "r2", authorKind: "agent", authorId: "claude", authorName: "Claude", authorColorToken: "var(--au-purple-600)", text: "Lowered it to 500 and tightened the gap to 16px. /auis-ux-writing next?", createdAt: NOW - 2000_000 },
    ],
  }),
  comment({
    id: "cmt-b",
    authorId: "rev-ana",
    authorName: "Ana",
    authorEmail: "ana@example.com",
    authorColorToken: "var(--au-emerald-600)",
    anchor: { kind: "pin", position: { x: 900, y: 420 } },
    text: "This card should open the styleguide directly.",
    status: "in_review",
    resolution: { actor: { kind: "agent", id: "claude", name: "Claude" }, at: NOW - 600_000, summary: "Linked the card to /auis/styleguide." },
  }),
  comment({ id: "cmt-c", anchor: { kind: "pin", position: { x: 1100, y: 640 } }, text: "Resolved: footer contrast.", status: "resolved" }),
  comment({
    id: "cmt-d",
    authorId: "rev-bia",
    authorName: "Bia",
    authorColorToken: "var(--au-pink-600)",
    text: "Freehand around the hero.",
    anchor: {
      kind: "draw",
      path: {
        points: [{ x: 200, y: 520 }, { x: 260, y: 500 }, { x: 340, y: 510 }, { x: 380, y: 560 }, { x: 330, y: 610 }, { x: 240, y: 600 }, { x: 205, y: 560 }],
        strokeColorToken: "var(--au-pink-600)",
        strokeWidth: 3,
      },
      centroid: { x: 290, y: 555 },
    },
  }),
  comment({ id: "cmt-e", text: "Idea: keyboard shortcuts cheat sheet.", status: "backlog", origin: "backlog", anchor: { kind: "pin", position: { x: 0, y: 0 } } }),
  comment({
    id: "cmt-far",
    authorId: "rev-ana",
    authorName: "Ana",
    authorEmail: "ana@example.com",
    authorColorToken: "var(--au-emerald-600)",
    url: "/auis/styleguide",
    anchor: { kind: "pin", position: { x: 500, y: 200 } },
    text: "This one lives on the styleguide.",
  }),
]

/** Answers /api/review-bridge/* from the fixtures; a write is acknowledged and
 *  dropped, so the real data is never touched. */
export async function mockBridge(page) {
  await page.route("**/api/review-bridge/**", async (route) => {
    const req = route.request()
    const p = new URL(req.url()).pathname.replace(/^\/api\/review-bridge\/?/, "")
    const json = (body) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) })
    if (req.method() !== "GET") return json({ ok: true })
    if (p === "comments") return json({ comments: COMMENTS })
    if (p === "comments/archive") return json({ comments: [] })
    if (p === "version") return json({ signature: "fixed" })
    if (p === "session") return json({ role: "admin", email: null, shared: false, authEnabled: false })
    if (p === "reviewers") {
      return json({ reviewers: [{ id: "rev-ana", name: "Ana", handle: "Ana", colorToken: "var(--au-emerald-600)", email: "ana@example.com" }] })
    }
    if (p === "export") {
      return json({ schemaVersion: 3, exportedAt: NOW, exportedBy: { id: "server", name: "Server", colorToken: "var(--fg-tertiary)", createdAt: 0 }, comments: COMMENTS, archivedComments: [] })
    }
    if (p.startsWith("comments/")) return json(COMMENTS.find((c) => c.id === p.split("/")[1]) ?? {})
    return route.continue() // members, agent-settings, health: read-only
  })
}

/** A browser context already signed in as the fixture reviewer. */
export async function newContext(browser, extra = {}) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce", deviceScaleFactor: 1, ...extra })
  await context.addInitScript(([key, me]) => localStorage.setItem(key, JSON.stringify(me)), ["auis-review:identity", ME])
  return context
}
