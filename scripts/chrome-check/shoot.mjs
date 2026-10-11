#!/usr/bin/env node
/**
 * Screenshots of every review-chrome surface, to prove a change did not move a
 * pixel (docs/review-bridge-packages-plan.md, wave 2 → Verify).
 *
 * With the dev server running:
 *   node scripts/chrome-check/shoot.mjs before          # on the commit before
 *   node scripts/chrome-check/shoot.mjs after           # on your change
 *   node scripts/chrome-check/compare.mjs before after  # every shot, pixel by pixel
 *
 *   BARE=1 node scripts/chrome-check/shoot.mjs bare     # the app's CSS swapped for chrome.css alone
 *   CLIPS=1 node scripts/chrome-check/compare.mjs after bare   # chrome surfaces only
 *
 * The bridge is mocked (lib.mjs): fixed comments, writes dropped, so the real
 * data is never touched. The clock, motion and SVG animations are frozen. Shots
 * go to <tmp>/auis-chrome-check/<label>/ (`--dir` to change, `--base` for the
 * server). Needs Playwright — see lib.mjs.
 */
import { readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import { BASE, CHROME_CSS, NOW, launchOptions, loadPlaywright, mockBridge, newContext, outDir } from "./lib.mjs"

const LABEL = process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : "shots"
const BARE = process.env.BARE === "1"
const OUT = outDir(LABEL)
const { chromium } = loadPlaywright()

const shots = []
const clips = []

async function freeze(page) {
  await page.evaluate(async () => {
    await document.fonts.ready
    for (const svg of document.querySelectorAll("svg")) {
      try {
        svg.pauseAnimations()
        svg.setCurrentTime(0)
      } catch {
        // not an SVG with animations
      }
    }
  })
}

// The collapsed "Review" pill measures its width after the fonts settle, so on
// heavy pages it can be caught mid-way: page-only shots leave it out (the
// toolbar has shots of its own).
const HIDE_TOOLBAR = '[data-auis-review]:has([aria-label="Open Review Mode (⌘⇧Y)"]) { visibility: hidden !important; }'

async function shot(page, name, { settle = true, hideToolbar = false } = {}) {
  if (settle) {
    await page.waitForTimeout(450)
    await page.mouse.move(1, 1)
    await page.waitForTimeout(150)
  }
  await freeze(page)
  await page.screenshot({
    path: path.join(OUT, `${name}.png`),
    animations: "disabled",
    caret: "hide",
    style: hideToolbar ? HIDE_TOOLBAR : undefined,
  })
  shots.push(name)
}

/** The surface itself, inset 8px so the page behind its rounded corners and
 *  shadow does not count. */
async function clip(page, name, selector) {
  const loc = page.locator(selector).last()
  if (!(await loc.count())) return console.log(`  (no ${name}: ${selector})`)
  const box = await loc.boundingBox()
  if (!box) return
  await freeze(page)
  await page.screenshot({
    path: path.join(OUT, `clip-${name}.png`),
    clip: { x: box.x + 8, y: box.y + 8, width: box.width - 16, height: box.height - 16 },
    animations: "disabled",
    caret: "hide",
  })
  clips.push(`clip-${name}`)
}

const byLabel = (page, label) => page.locator(`[aria-label="${label}"]`).first()
async function clickLabel(page, label) {
  await byLabel(page, label).click()
  await page.waitForTimeout(350)
}
async function closeDialogs(page) {
  for (let i = 0; i < 4 && (await page.locator('[role="dialog"]').count()); i++) {
    await page.keyboard.press("Escape")
    await page.waitForTimeout(350)
  }
}

async function run(theme) {
  const browser = await chromium.launch(launchOptions())
  const context = await newContext(browser)
  const page = await context.newPage()
  await page.clock.setFixedTime(NOW)
  await mockBridge(page)
  if (BARE) {
    // Next bundles globals.css and chrome.css into the same chunks: serve the
    // chrome's stylesheet alone in their place.
    await page.route("**/_next/static/**/*.css", (route) =>
      route.fulfill({ status: 200, contentType: "text/css", body: readFileSync(CHROME_CSS, "utf8") }),
    )
  }
  const go = async (route) => {
    await page.goto(BASE + route, { waitUntil: "domcontentloaded" })
    await page.waitForTimeout(2500)
    if (theme === "dark") await page.evaluate(() => document.documentElement.classList.add("dark"))
    await page.evaluate(() => document.fonts.ready)
    await page.waitForTimeout(300)
  }
  const t = (name) => `${theme}-${name}`

  await go("/auis")
  await shot(page, t("01-pill"))
  await clickLabel(page, "Open Review Mode (⌘⇧Y)")
  await shot(page, t("02-bar-cursor-pins"))
  await clip(page, t("toolbar"), '[data-auis-review]:has([aria-label="Close Review Mode"])')
  await clickLabel(page, "Freehand mark")
  await shot(page, t("03-mode-draw"))
  await clickLabel(page, "Pin")
  await page.mouse.click(700, 470)
  await page.waitForTimeout(500)
  await shot(page, t("04-compose-popover"))
  await page.keyboard.type("Looks off @")
  await page.waitForTimeout(500)
  await shot(page, t("05-compose-mention-menu"))
  await clip(page, t("compose-popover"), "[data-auis-review]:has(textarea)")
  await clip(page, t("mention-menu"), '[role="presentation"][data-auis-review]')
  for (let i = 0; i < 3; i++) await page.keyboard.press("Escape")
  await page.waitForTimeout(300)
  await clickLabel(page, "Magic pointer")
  await page.mouse.move(640, 300)
  await page.waitForTimeout(400)
  await shot(page, t("06-mode-magic-hover"), { settle: false })
  await clickLabel(page, "Cursor")
  await page.mouse.click(420, 260) // the first pin
  await page.waitForTimeout(500)
  await shot(page, t("07-thread-popover"))
  await clip(page, t("thread-popover"), '[data-auis-review]:has([aria-label="Mark as resolved"])')
  await page.keyboard.press("Escape")
  await page.waitForTimeout(300)
  await page.locator('[aria-label^="Comments"]').first().click()
  await page.waitForTimeout(600)
  await shot(page, t("08-drawer"))
  await clip(page, t("drawer"), '[role="dialog"]')
  await clickLabel(page, "Filters")
  await shot(page, t("09-drawer-filters"))
  await clip(page, t("filters-menu"), '[role="menu"], [data-radix-popper-content-wrapper]')
  await page.keyboard.press("Escape")
  await closeDialogs(page)
  await page.locator('[aria-label^="Account:"]').first().click()
  await page.waitForTimeout(400)
  await shot(page, t("10-account-menu"))
  await clip(page, t("account-menu"), '[role="menu"]')
  await page.getByText("Edit current account").click()
  await page.waitForTimeout(600)
  await shot(page, t("11-identity-modal"))
  await clip(page, t("identity-modal"), '[role="dialog"]')
  await page.keyboard.press("Escape")
  await page.waitForTimeout(400)
  await clickLabel(page, "Export comments")
  await page.waitForTimeout(400)
  await shot(page, t("12-export-modal"))
  await clip(page, t("export-modal"), '[role="dialog"]')
  await page.keyboard.press("Escape")

  await go("/auis/review-bridge")
  await shot(page, t("13-inbox"), { hideToolbar: true })
  await go("/auis/ux-flow/example-golden-eye")
  await shot(page, t("14-golden-eye"), { hideToolbar: true })

  await browser.close()
}

for (const theme of ["light", "dark"]) await run(theme)
writeFileSync(path.join(OUT, "shots.json"), JSON.stringify(shots, null, 2))
writeFileSync(path.join(OUT, "clips.json"), JSON.stringify(clips, null, 2))
console.log(`${shots.length} shots and ${clips.length} clips in ${OUT}`)
