#!/usr/bin/env node
/**
 * Wave 0 of docs/review-bridge-packages-plan.md: do review pins stay on their
 * element in apps Auis did not author? Results: docs/anchor-survival.md.
 *
 * The anchoring code is lifted VERBATIM from kit/core/src/elementAnchor.ts
 * (types stripped, imports dropped) and injected into each page. Pins are
 * dropped the way the canvas drops them — captureElementAnchor() at a click
 * point — then the page is perturbed (resize, navigate away and back, reload,
 * change data) and each anchor is re-resolved. A pin survives when it resolves
 * to the element an independent locator says it was on.
 *
 * Usage (start the apps first; the URLs are the ones the sheet was measured on):
 *   node scripts/anchor-survival.mjs                 # every app
 *   node scripts/anchor-survival.mjs --only saved    # apps whose name matches
 *   node scripts/anchor-survival.mjs --out results.json
 *
 * Uses playwright-core with the installed Chrome (channel "chrome"), like
 * states-matrix-pdf.mjs. PLAYWRIGHT_MODULE points at another Playwright
 * package (its bundled browser is used), PLAYWRIGHT_CHROMIUM_PATH at a binary.
 */

import { createRequire } from "node:module"
import { readFileSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"

const args = process.argv.slice(2)
const argOf = (flag, fallback) => {
  const i = args.indexOf(flag)
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback
}
const ONLY = argOf("--only", "")
const OUT = argOf("--out", "")

const ROOT = resolve(import.meta.dirname, "..")
const ANCHOR_SOURCE = resolve(ROOT, "kit/core/src/elementAnchor.ts")

/** elementAnchor.ts as a script that exposes its functions on window. With no
 *  Auis overlay in the host, elementBelowOverlayAt is elementFromPoint. */
function anchorLibrary() {
  const ts = createRequire(resolve(ROOT, "package.json"))("typescript")
  const source = readFileSync(ANCHOR_SOURCE, "utf8")
  const js = ts
    .transpileModule(source, {
      compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext },
    })
    .outputText.replace(/^import .*$/gm, "")
    .replace(/^export /gm, "")
  return `(() => {
const elementBelowOverlayAt = (x, y) => document.elementFromPoint(x, y)
${js}
window.__auisAnchor = { cssPath, resolveElement, fpText, captureElementAnchor }
})()`
}

async function loadChromium() {
  const custom = process.env.PLAYWRIGHT_MODULE
  try {
    const mod = custom ? createRequire(import.meta.url)(custom) : await import("playwright-core")
    return mod.chromium
  } catch {
    throw new Error(
      "playwright-core is not installed. Run `npm i -D playwright-core` (it uses your installed Chrome, no download), or set PLAYWRIGHT_MODULE.",
    )
  }
}

const DESKTOP = { width: 1440, height: 900 }

async function settle(page, ms = 900) {
  try {
    await page.waitForLoadState("networkidle", { timeout: 8000 })
  } catch {
    // Pages that poll never go idle; the fixed wait below covers hydration.
  }
  await page.waitForTimeout(ms)
}
const resize = (width, height) => async (page) => {
  await page.setViewportSize({ width, height })
  await settle(page, 700)
}
const reload = async (page) => {
  await page.reload()
  await settle(page)
}
const back = async (page) => {
  await page.goBack()
  await settle(page)
}
const clickText = (selector, text) => async (page) => {
  await page.evaluate(
    ([selector, text]) => {
      const el = [...document.querySelectorAll(selector)].find((e) => e.textContent.trim() === text)
      if (!el) throw new Error(`no ${selector} "${text}"`)
      el.click()
    },
    [selector, text],
  )
  await settle(page)
}
const seq =
  (...steps) =>
  async (page) => {
    for (const step of steps) await step(page)
  }

// Truth locators run in the page: (info) => Element | null, where `info` is what
// was recorded at capture ({ attrs, text }) — for slot-style truths. `pick`, when
// present, chooses the element at capture and `truth` finds it again.
const byText = (selector, text) =>
  `() => [...document.querySelectorAll(${JSON.stringify(selector)})].find(e => e.textContent.trim() === ${JSON.stringify(text)}) || null`
const sameText = (selector) =>
  `(info) => [...document.querySelectorAll(${JSON.stringify(selector)})].find(e => e.textContent.trim().slice(0, 60) === info.text) || null`

const SAVED_KEY = "dm.saved.v1"
const SAVED = [
  { id: "carla-1988-3-2", name: "Carla Mendes", birth: { day: 2, month: 3, year: 1988 }, reduction: "digitsum", createdAt: "2026-10-01T10:00:00Z" },
  { id: "bruno-1985-11-3", name: "Bruno Lima", birth: { day: 3, month: 11, year: 1985 }, reduction: "digitsum", createdAt: "2026-10-02T10:00:00Z" },
  { id: "ana-1990-5-17", name: "Ana Souza", birth: { day: 17, month: 5, year: 1990 }, reduction: "digitsum", createdAt: "2026-10-03T10:00:00Z" },
]
const NEWER = { id: "davi-1979-8-21", name: "Davi Rocha", birth: { day: 21, month: 8, year: 1979 }, reduction: "digitsum", createdAt: "2026-10-04T10:00:00Z" }
const rowOf = (name, inner) =>
  `() => [...document.querySelectorAll("li")].find(li => li.textContent.includes(${JSON.stringify(name)}))?.querySelector(${JSON.stringify(inner)}) || null`

const SANITY = { id: "baseline", label: "Re-resolve at once (sanity)", run: async () => {} }

const APPS = [
  {
    app: "Destiny Matrix /chart",
    stack: "Next 16 App Router, React 19, Tailwind v4, SVG chart",
    url: "http://localhost:3301/chart?name=Ana&birth=1990-05-17",
    pins: [
      { label: "Person's name (h1)", truth: `() => document.querySelector("h1")` },
      { label: "Destiny number (top right)", truth: `() => [...document.querySelectorAll(".label")].find(e => e.textContent.trim() === "Número de destino")?.nextElementSibling?.querySelector("span") || null` },
      {
        label: "Octagram centre number (SVG <text>)",
        pick: `() => [...document.querySelectorAll("#octagram-svg text")].find(t => t.getAttribute("x") === "400" && Math.abs(+t.getAttribute("y") - 400) < 30) || null`,
        truth: `(info) => [...document.querySelectorAll("#octagram-svg text")].find(t => t.getAttribute("x") === info.attrs.x && t.getAttribute("y") === info.attrs.y) || null`,
      },
      { label: "\"Salvar mapa\" button", truth: byText("button", "Salvar mapa") },
      { label: "Quote under \"Linha do amor\"", truth: `() => [...document.querySelectorAll("h2")].find(h => h.textContent.trim() === "Linha do amor")?.nextElementSibling || null` },
    ],
    scenarios: [
      SANITY,
      { label: "Resize to 1024×768", run: resize(1024, 768) },
      { label: "Resize to 390×844 (phone)", run: resize(390, 844) },
      { label: "Navigate away (\"Novo mapa\") and back", run: seq(clickText("a", "Novo mapa"), back) },
      { label: "Reload", run: reload },
      { label: "Click a reading tab (\"Linha do dinheiro\")", run: clickText("button", "Linha do dinheiro") },
    ],
  },
  {
    app: "Destiny Matrix /saved",
    stack: "list rendered from localStorage (seeded in the test browser only)",
    url: "http://localhost:3301/saved",
    seed: { key: SAVED_KEY, value: SAVED },
    pins: [
      { label: "Page title (h1 \"Salvos\")", truth: `() => document.querySelector("h1")` },
      { label: "Second row's name (Bruno)", truth: byText("li span", "Bruno Lima") },
      { label: "Third row's \"Abrir\" link (Carla)", truth: rowOf("Carla Mendes", "a") },
      { label: "First row's \"Remover\" button (Ana)", truth: rowOf("Ana Souza", "button") },
      { label: "First row's date (Ana)", truth: rowOf("Ana Souza", ".text-sm") },
    ],
    scenarios: [
      SANITY,
      { label: "Resize to 390×844 (phone)", run: resize(390, 844) },
      { label: "Navigate away (\"Novo mapa\") and back", run: seq(clickText("a", "Novo mapa"), back) },
      { label: "Reload", run: reload },
      {
        label: "Data: a newer map is saved (new first row)",
        run: async (page) => {
          await page.evaluate(
            ([key, map]) => {
              const list = JSON.parse(localStorage.getItem(key) || "[]")
              list.push(map)
              localStorage.setItem(key, JSON.stringify(list))
            },
            [SAVED_KEY, NEWER],
          )
          await reload(page)
        },
      },
      {
        label: "Data: the middle row is removed",
        run: async (page) => {
          await page.evaluate(() =>
            [...document.querySelectorAll("li")].find((li) => li.textContent.includes("Bruno Lima")).querySelector("button").click(),
          )
          await settle(page, 500)
        },
      },
    ],
  },
  {
    app: "Destiny Matrix /",
    stack: "form page, aside hidden below lg",
    url: "http://localhost:3301/",
    pins: [
      { label: "Headline's italic line", truth: `() => document.querySelector("h1 span")` },
      { label: "Name input", truth: `() => document.querySelector('input[placeholder="Quem é essa pessoa?"]')` },
      { label: "Pull quote (hidden below lg)", truth: `() => document.querySelector(".pull-quote")` },
      { label: "\"Consultor\" feature text (hidden below lg)", truth: `() => [...document.querySelectorAll(".label")].find(e => e.textContent.trim() === "Consultor")?.nextElementSibling || null` },
      { label: "Form submit button", truth: `() => document.querySelector("form button[type=submit]") || [...document.querySelectorAll("form button")].pop() || null` },
    ],
    scenarios: [
      SANITY,
      { label: "Resize to 900×800 (aside hides)", run: resize(900, 800) },
      { label: "Resize to 390×844 (phone)", run: resize(390, 844) },
      { label: "Navigate away (\"Salvos\") and back", run: seq(clickText("a", "Salvos"), back) },
      { label: "Reload", run: reload },
      {
        label: "Data: submit empty, an error message is inserted",
        run: async (page) => {
          await page.evaluate(() => document.querySelector("form").requestSubmit())
          await settle(page, 500)
        },
      },
    ],
  },
  {
    app: "Vite SPA",
    stack: "a production build served statically: Vite 8, React 19, Tailwind v4, views in state (no router)",
    url: "http://127.0.0.1:4174/",
    pins: [
      { label: "Page title (h1)", truth: `() => document.querySelector("h1")` },
      { label: "\"Nova Base\" button", truth: byText("button", "Nova Base") },
      { label: "Panel heading (h3)", pick: `() => document.querySelector("h3")`, truth: sameText("h3") },
      { label: "\"Abrir Fluxo Unificado\" button", truth: byText("button", "Abrir Fluxo Unificado") },
      { label: "Sidebar \"Produtos\" (hidden below md)", truth: byText("div", "Produtos") },
    ],
    scenarios: [
      SANITY,
      { label: "Resize to 700×800 (sidebar hides)", run: resize(700, 800) },
      { label: "Resize to 390×844 (phone)", run: resize(390, 844) },
      { label: "Switch view and back (state, no URL)", run: seq(clickText("div", "Documentação Handoff"), clickText("div", "Bases de Conhecimento")) },
      { label: "Reload", run: reload },
      { label: "Open the wizard (hub content replaced)", run: clickText("button", "Nova Base") },
      { label: "Open the wizard and cancel it", run: seq(clickText("button", "Nova Base"), clickText("button", "Cancelar")) },
    ],
  },
  {
    app: "vuejs.org",
    stack: "VitePress: Vue 3 (not React), client-side router",
    url: "https://vuejs.org/guide/essentials/computed.html",
    pins: [
      { label: "Page title (h1)", truth: `() => document.querySelector(".vt-doc h1")` },
      { label: "Section heading \"Computed Caching vs. Methods\"", truth: `() => [...document.querySelectorAll(".vt-doc h2")].find(h => h.textContent.includes("Computed Caching")) || null` },
      {
        label: "Paragraph shown only for the Composition API",
        pick: `() => [...document.querySelectorAll(".vt-doc .composition-api p")].find(p => p.getBoundingClientRect().height > 0) || null`,
        truth: sameText(".vt-doc .composition-api p"),
      },
      { label: "Sidebar link \"Computed Properties\"", truth: byText("aside a", "Computed Properties") },
      { label: "\"Next\" pager link", truth: `() => document.querySelector("a.next-link")` },
    ],
    scenarios: [
      SANITY,
      { label: "Resize to 900×800 (sidebar collapses)", run: resize(900, 800) },
      { label: "Resize to 390×844 (phone)", run: resize(390, 844) },
      { label: "Client-side nav (sidebar link) and back", run: seq(clickText("aside a", "Class and Style Bindings"), back) },
      { label: "Reload", run: reload },
      {
        label: "Data: switch API preference (same URL, content swaps)",
        run: async (page) => {
          await page.evaluate(() => document.querySelector("button.api-switch").click())
          await settle(page, 600)
        },
      },
    ],
  },
]

async function capture(page, pin) {
  const pick = pin.pick || pin.truth
  await page.evaluate((pick) => {
    new Function(`return (${pick})`)()({})?.scrollIntoView({ block: "center", inline: "center" })
  }, pick)
  await page.waitForTimeout(250)
  return page.evaluate((pick) => {
    const el = new Function(`return (${pick})`)()({})
    if (!el) return { error: "target not found at capture" }
    const r = el.getClientRects()[0] || el.getBoundingClientRect()
    const x = r.left + r.width / 2
    const y = r.top + r.height / 2
    const anchor = window.__auisAnchor.captureElementAnchor(x, y)
    // A pin anchors to the deepest element under the cursor: remember the path
    // from the target down to it so the truth can follow the same way.
    const hit = document.elementFromPoint(x, y)
    const rel = []
    let node = hit
    while (node && node !== el && node.parentElement) {
      rel.unshift([...node.parentElement.children].indexOf(node))
      node = node.parentElement
    }
    const attrs = {}
    for (const a of el.attributes) attrs[a.name] = a.value
    return { anchor, rel: node === el ? rel : null, info: { attrs, text: el.textContent.trim().slice(0, 60) } }
  }, pick)
}

/** Outcome of re-resolving one anchor, for the loose resolution the canvas uses
 *  and the strict one the reveal trail uses. */
async function check(page, pin, cap) {
  return page.evaluate(
    ([truthSource, cap]) => {
      const A = window.__auisAnchor
      let truth = new Function(`return (${truthSource})`)()(cap.info)
      if (truth && cap.rel) for (const i of cap.rel) truth = truth?.children[i] || null
      const { selector, fingerprint } = cap.anchor
      let bySelector = null
      try {
        bySelector = document.querySelector(selector)
      } catch {
        bySelector = null
      }
      const shown = (e) => {
        if (!e) return false
        const r = e.getBoundingClientRect()
        return r.width > 0 && r.height > 0
      }
      const describe = (e) => (e ? `${e.tagName.toLowerCase()} "${A.fpText(e).slice(0, 30)}"` : "nothing")
      const classify = (got) => {
        if (!truth) return got && shown(got) ? "wrong: target gone, drawn on another element" : "ok: target gone, pin hidden"
        if (!shown(truth)) return got && got !== truth && shown(got) ? "wrong: target hidden, drawn on another element" : "ok: target not displayed, pin hidden"
        if (!got) return "lost"
        if (got !== truth) return "wrong"
        if (bySelector === truth && (A.fpText(bySelector) || undefined) === fingerprint?.text) return "ok: selector"
        if (bySelector === truth) return "ok: selector, text changed"
        return "ok: fingerprint recovery"
      }
      const loose = A.resolveElement(selector, fingerprint)
      const strict = A.resolveElement(selector, fingerprint, { strict: true })
      let drift = null
      if (truth && loose && loose !== truth && shown(truth) && shown(loose)) {
        const a = truth.getBoundingClientRect()
        const b = loose.getBoundingClientRect()
        drift = Math.round(Math.hypot(a.left - b.left, a.top - b.top))
      }
      return { loose: classify(loose), strict: classify(strict), got: describe(loose), want: describe(truth), drift }
    },
    [pin.truth, cap],
  )
}

async function main() {
  const library = anchorLibrary()
  const chromium = await loadChromium()
  const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH
  const browser = await chromium.launch(
    executablePath
      ? { executablePath, headless: true }
      : process.env.PLAYWRIGHT_MODULE
        ? { headless: true }
        : { channel: "chrome", headless: true },
  )
  const results = []
  try {
    for (const app of APPS) {
      if (ONLY && !app.app.toLowerCase().includes(ONLY.toLowerCase())) continue
      for (const scenario of app.scenarios) {
        // A fresh context per scenario: each one starts from the same baseline.
        const context = await browser.newContext({ viewport: DESKTOP })
        await context.addInitScript(library)
        if (app.seed) {
          await context.addInitScript(([key, value]) => {
            if (sessionStorage.getItem("__anchor_seeded")) return
            localStorage.setItem(key, JSON.stringify(value))
            sessionStorage.setItem("__anchor_seeded", "1")
          }, [app.seed.key, app.seed.value])
        }
        const page = await context.newPage()
        await page.goto(app.url, { waitUntil: "domcontentloaded" })
        await settle(page, 1200)
        const caps = []
        for (const pin of app.pins) caps.push(await capture(page, pin))
        await page.evaluate(() => window.scrollTo(0, 0))
        await scenario.run(page)
        for (const [i, pin] of app.pins.entries()) {
          const cap = caps[i]
          const row = { app: app.app, scenario: scenario.label, pin: pin.label }
          if (cap.error || !cap.anchor) results.push({ ...row, loose: `capture failed: ${cap.error || "no anchor"}` })
          else results.push({ ...row, selector: cap.anchor.selector, ...(await check(page, pin, cap)) })
        }
        await context.close()
        process.stderr.write(".")
      }
    }
  } finally {
    await browser.close()
  }
  process.stderr.write("\n")
  if (OUT) writeFileSync(resolve(OUT), JSON.stringify(results, null, 2))

  for (const app of APPS) {
    const rows = results.filter((r) => r.app === app.app && r.scenario !== SANITY.label)
    if (rows.length === 0) continue
    const ok = rows.filter((r) => r.loose.startsWith("ok")).length
    console.log(`\n${app.app} (${app.stack}): ${ok}/${rows.length} survived`)
    for (const r of rows.filter((r) => !r.loose.startsWith("ok"))) {
      const where = r.drift != null ? `, ${r.drift}px away` : ""
      console.log(`  ${r.scenario} · ${r.pin}: ${r.loose} (drew on ${r.got}, wanted ${r.want}${where}; strict: ${r.strict})`)
    }
  }
  const sanity = results.filter((r) => r.scenario === SANITY.label && !r.loose.startsWith("ok"))
  if (sanity.length) console.log(`\n${sanity.length} pins failed the sanity re-resolve — the harness, not the anchors, is wrong.`)
}

main().catch((error) => {
  console.error(error.message || error)
  process.exit(1)
})
