#!/usr/bin/env node
/**
 * Generates a PDF with the State Mode matrix: every screen registered in the
 * registry (lib/auis-states/registry.ts, served at /api/screen-states)
 * photographed in ALL the scenarios of its main axis, side by side.
 *
 * Usage (with the dev server running):
 *   npm run states:pdf
 *   node scripts/states-matrix-pdf.mjs --base http://127.0.0.1:3100 --out matrix.pdf
 *
 * Uses playwright-core with the installed Chrome (channel "chrome") — no
 * browser download. Install it once with `npm i -D playwright-core`, or point
 * PLAYWRIGHT_CHROMIUM_PATH at a Chromium binary. Screenshots at 1280×800 @2x
 * with ?chrome=0 (hides the builder chrome), embedded in an HTML document and
 * printed through page.pdf().
 */

import { resolve } from "node:path"

const args = process.argv.slice(2)
const argOf = (flag, fallback) => {
  const i = args.indexOf(flag)
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback
}

const BASE = argOf("--base", "http://127.0.0.1:3000").replace(/\/$/, "")
const OUT = resolve(argOf("--out", "auis-states-matrix.pdf"))

const FRAME = { width: 1280, height: 800 }
// "networkidle" never settles with the review bridge polling (4s) — load +
// a fixed breather for hydration gives a stable screenshot.
const SETTLE_MS = 1500

const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

function scenarioUrl(screen, displayAxis, value) {
  const base = screen.previewPath ?? screen.pattern
  const params = new URLSearchParams()
  for (const axis of screen.axes) {
    const v = axis.param === displayAxis.param ? value : axis.defaultValue
    if (v !== axis.defaultValue) params.set(axis.param, v)
  }
  const qs = params.toString()
  return qs ? `${base}?${qs}` : base
}

async function loadChromium() {
  try {
    const mod = await import("playwright-core")
    return mod.chromium
  } catch {
    throw new Error(
      "playwright-core is not installed. Run `npm i -D playwright-core` (it uses your installed Chrome, no download) and try again.",
    )
  }
}

async function main() {
  const res = await fetch(`${BASE}/api/screen-states`)
  if (!res.ok) {
    throw new Error(
      `GET ${BASE}/api/screen-states → ${res.status}. Is the dev server running on that port?`,
    )
  }
  const { screens } = await res.json()

  const chromium = await loadChromium()
  const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH
  const browser = await chromium.launch(
    executablePath ? { executablePath, headless: true } : { channel: "chrome", headless: true },
  )
  try {
    const context = await browser.newContext({
      viewport: FRAME,
      deviceScaleFactor: 2,
    })
    const page = await context.newPage()

    const sections = []
    for (const screen of screens) {
      if (screen.pattern.includes("[") && !screen.previewPath) {
        console.log(`~ ${screen.screenLabel}: no previewPath, skipping`)
        continue
      }
      const displayAxis =
        screen.axes.find((a) => a.param === "state") ?? screen.axes[0]
      if (!displayAxis) continue

      const cells = []
      for (const option of displayAxis.options) {
        const url = scenarioUrl(screen, displayAxis, option.value)
        const src = `${BASE}${url}${url.includes("?") ? "&" : "?"}chrome=0`
        process.stdout.write(`• ${screen.screenLabel} · ${option.label} … `)
        await page.goto(src, { waitUntil: "load" })
        await page.waitForTimeout(SETTLE_MS)
        const shot = await page.screenshot({ type: "jpeg", quality: 82 })
        cells.push({
          label: option.label,
          url,
          img: `data:image/jpeg;base64,${shot.toString("base64")}`,
        })
        console.log("ok")
      }
      sections.push({ screen, axisLabel: displayAxis.label, cells })
    }

    const stamp = new Date().toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    })
    const totalShots = sections.reduce((n, s) => n + s.cells.length, 0)

    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: -apple-system, "Helvetica Neue", Arial, sans-serif; color: #111; }
      .cover { height: 96vh; display: flex; flex-direction: column; justify-content: center; padding: 0 8mm; }
      .cover .eyebrow { text-transform: uppercase; letter-spacing: .08em; font-size: 11px; color: #888; margin-bottom: 10px; }
      .cover h1 { font-size: 44px; letter-spacing: -.02em; margin-bottom: 12px; }
      .cover p { font-size: 15px; color: #555; max-width: 560px; line-height: 1.5; }
      .cover .meta { margin-top: 28px; font-size: 12px; color: #888; }
      section { page-break-before: always; padding: 6mm 0; }
      section h2 { font-size: 22px; letter-spacing: -.01em; }
      section .pattern { font-family: ui-monospace, Menlo, monospace; font-size: 11px; color: #888; margin: 4px 0 14px; }
      .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10mm 6mm; }
      figure { break-inside: avoid; }
      figcaption { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; margin-bottom: 4px; }
      figcaption b { font-size: 12px; }
      figcaption span { font-family: ui-monospace, Menlo, monospace; font-size: 9px; color: #999; }
      img { width: 100%; border: 1px solid #e4e4e4; border-radius: 6px; }
    </style></head><body>
      <div class="cover">
        <p class="eyebrow">Auis</p>
        <h1>State matrix</h1>
        <p>Every screen registered in State Mode, photographed in all the scenarios of its main axis — empty, loading, no permission and company — straight from the product, without simulating data.</p>
        <p class="meta">${esc(stamp)} · ${sections.length} screens · ${totalShots} scenarios</p>
      </div>
      ${sections
        .map(
          (s) => `<section>
        <h2>${esc(s.screen.screenLabel)}</h2>
        <p class="pattern">${esc(s.screen.pattern)} · axis: ${esc(s.axisLabel)}</p>
        <div class="grid">
          ${s.cells
            .map(
              (c) => `<figure>
            <figcaption><b>${esc(c.label)}</b><span>${esc(c.url)}</span></figcaption>
            <img src="${c.img}" alt="${esc(s.screen.screenLabel)} — ${esc(c.label)}">
          </figure>`,
            )
            .join("")}
        </div>
      </section>`,
        )
        .join("")}
    </body></html>`

    const pdfPage = await context.newPage()
    await pdfPage.setContent(html, { waitUntil: "load" })
    await pdfPage.pdf({
      path: OUT,
      format: "A4",
      landscape: true,
      printBackground: true,
      margin: { top: "10mm", bottom: "10mm", left: "10mm", right: "10mm" },
    })
    console.log(`\nPDF written: ${OUT} (${sections.length} screens, ${totalShots} scenarios)`)
  } finally {
    await browser.close()
  }
}

main().catch((err) => {
  console.error(err.message ?? err)
  process.exit(1)
})
