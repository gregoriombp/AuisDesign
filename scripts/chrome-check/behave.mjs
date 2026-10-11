#!/usr/bin/env node
/**
 * The review chrome's behaviour, end to end, against the mocked bridge in
 * lib.mjs: the mode switch, cross-screen navigation through the host router,
 * the chrome's own toast, @ menus in the drawer and on app pages, the chrome
 * pieces app pages render on their own, and a clean console. Exits 1 on any
 * failure.
 *
 *   node scripts/chrome-check/behave.mjs [--base http://127.0.0.1:3000]
 */
import path from "node:path"
import { BASE, launchOptions, loadPlaywright, mockBridge, newContext, outDir } from "./lib.mjs"

const OUT = outDir("behave")
const { chromium } = loadPlaywright()
const results = []
const check = (name, ok, detail = "") => {
  results.push(!!ok)
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`)
}

const browser = await chromium.launch(launchOptions())
const context = await newContext(browser)
await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: BASE })
const page = await context.newPage()
const problems = []
page.on("console", (m) => {
  if (m.type() === "error" || /validateDOMNesting|cannot be a descendant|cannot contain|hydrat/i.test(m.text())) {
    problems.push(`${page.url().replace(BASE, "")}: ${m.text().slice(0, 220)}`)
  }
})
page.on("pageerror", (e) => problems.push(`${page.url().replace(BASE, "")}: ${e.message.slice(0, 220)}`))
await mockBridge(page)

const go = async (route) => {
  await page.goto(BASE + route, { waitUntil: "domcontentloaded" })
  await page.waitForTimeout(2500)
}
const label = (l) => page.locator(`[aria-label="${l}"]`).first()
const visible = async (sel) => (await page.locator(sel).count()) > 0 && (await page.locator(sel).first().isVisible())
const shot = (name) => page.screenshot({ path: path.join(OUT, `${name}.png`) })
const openReview = async () => {
  await go("/auis")
  await label("Open Review Mode (⌘⇧Y)").click()
  await page.waitForTimeout(600)
}

// The mode switch on the review toolbar is data the host passes (AuisReview).
await openReview()
await label("Edit Mode").click()
await page.waitForTimeout(700)
check("Review toolbar → Edit Mode turns Edit on", await visible('[aria-label="Edit Mode"][aria-pressed="true"]'))
check("… and Review off", await visible('[aria-label="Open Review Mode (⌘⇧Y)"]'))
await page.locator('[data-auis-edit="toolbar"] [aria-label="Review Mode"]').click()
await page.waitForTimeout(700)
check("Edit toolbar → Review Mode turns Review back on", await visible('[aria-label="Close Review Mode"]'))
await page.locator('[data-auis-review] [aria-label="State Mode"]').click()
await page.waitForTimeout(700)
check("Review toolbar → State Mode turns States on", await visible('[aria-label="State Mode"][aria-pressed="true"]:not([data-auis-review] *)'))

// A card on another screen navigates through the host's router, not a page load.
await openReview()
await page.evaluate(() => {
  window.__noReload = 1
})
await page.locator('[aria-label^="Comments"]').first().click()
await page.waitForTimeout(1200)
await page.locator('[role="dialog"] article:has-text("lives on the styleguide")').click({ position: { x: 200, y: 12 } })
// The dev server may still be compiling the route on first visit.
await page.waitForURL("**/auis/styleguide**", { timeout: 30000 }).catch(() => {})
await page.waitForTimeout(1500)
const nav = await page.evaluate(() => ({ path: location.pathname, kept: window.__noReload === 1 }))
await shot("cross-screen")
check("A card on another screen navigates there", nav.path === "/auis/styleguide", nav.path)
check("… client-side (no page load)", nav.kept)

// Export → Copy shows the chrome's own toast.
await openReview()
await label("Export comments").click()
await page.waitForTimeout(700)
await page.locator('[role="dialog"] button:has-text("Copy")').click()
await page.waitForTimeout(700)
await shot("copy-toast")
check("Copy shows the chrome's toast", await visible('text="Copied"'))
const copied = await page.evaluate(() => navigator.clipboard.readText().then((t) => t.length).catch(() => -1))
check("… with the JSON on the clipboard", copied > 100, `${copied} chars`)

// @ in a drawer reply.
await openReview()
await page.locator('[aria-label^="Comments"]').first().click()
await page.waitForTimeout(700)
await page.locator('[role="dialog"] button:has-text("Reply")').first().click()
await page.waitForTimeout(500)
await page.keyboard.type("Ping @")
await page.waitForTimeout(600)
await shot("reply-mention")
check("@ in a reply opens the agent menu in the chrome's portal", await visible('[data-auis-portal] [role="presentation"] >> text=Claude'))

// Chrome pieces the inbox renders on its own, inside ChromeScope.
await go("/auis/review-bridge")
await page.locator('[aria-label="Filters"]').first().click()
await page.waitForTimeout(600)
await shot("inbox-filters")
check("Inbox filter menu opens in the chrome's portal", await visible("[data-auis-portal] >> text=Any date"))
await page.keyboard.press("Escape")
check("Author names carry the e-mail hover", (await page.locator('[data-auis-ui] span[title*="ana@example.com"]').count()) > 0)
await page.getByText("Future ideas").first().click()
await page.waitForTimeout(500)
await page.getByText("Add future idea").first().click()
await page.waitForTimeout(500)
check("Backlog composer opens", await visible("[data-auis-ui] textarea"))

// The command menu inside an app modal on the flow canvas.
await go("/auis/ux-flow/example-golden-eye")
await page.locator('button:has-text("Comment")').first().click()
await page.waitForTimeout(500)
await page.getByText("Open a project").first().click()
await page.waitForTimeout(900)
await page.keyboard.type("Look @")
await page.waitForTimeout(700)
await shot("golden-eye-mention")
check("Golden-eye composer @ opens the agent menu", await visible('[data-auis-portal] [role="presentation"] >> text=Claude'))
await page.locator('[data-auis-portal] [role="presentation"]').getByText("Claude").first().click()
await page.waitForTimeout(400)
const draft = await page.locator("textarea").first().inputValue()
check("… and picking Claude writes the mention", /@Claude/i.test(draft), draft)

// The dot's Agents panel shows each agent's mark (inline, from @auis/core).
await go("/auis")
await label("Auis shortcuts").click()
await page.waitForTimeout(500)
await page.getByText(/Agents · \d+ on/).click()
await page.waitForTimeout(700)
await shot("agents-panel")
check(
  "Agents panel shows the agents' marks",
  await page.evaluate(() => [...document.querySelectorAll("[data-auis-ui] img")].filter((i) => i.naturalWidth > 0).length >= 3),
)

await browser.close()
check("No console errors or DOM-nesting warnings", problems.length === 0, problems.join(" | "))
console.log(`screenshots in ${OUT}`)
process.exit(results.every(Boolean) ? 0 : 1)
