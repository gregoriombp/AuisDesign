// Runs against a disposable Chrome profile and synthetic pages only.
// No cookies or credentials are copied from a user's browser.
import { chromium } from "playwright"
import assert from "node:assert/strict"
import fs from "node:fs/promises"
import path from "node:path"
import os from "node:os"
import { unzipSync, strFromU8 } from "fflate"

const extension = path.resolve(import.meta.dirname, "../dist")
const artifacts = await fs.mkdtemp(path.join(os.tmpdir(), "auis-review-check-"))
const profile = path.join(artifacts, "profile")
const fixture = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Revisão de interface</title><style>
html{font-size:10px}body{margin:0;background:#f6f6f4;color:#202020;font-family:Arial,sans-serif}header{padding:30px 64px;border-bottom:1px solid #ddd;font-size:18px}main{padding:65px 64px;max-width:1000px}h1{font-size:58px;max-width:700px;line-height:1.1}p{font-size:20px;max-width:650px;line-height:1.5}button{padding:16px 24px;border:0;border-radius:8px;background:#202020;color:white;font-size:16px}.blocks{display:flex;gap:30px;margin-top:60px}.blocks section{padding:25px;background:white;width:240px}h2{font-size:22px}dialog{padding:32px;border:0;border-radius:12px}
</style></head><body><header>Northwind / Página de teste</header><main><h1>Uma página para revisar com cuidado.</h1><p>Selecione um elemento, faça uma marcação e registre o que precisa mudar.</p><button id="details" onclick="document.querySelector('dialog').showModal()">Abrir detalhes</button> <button onclick="history.pushState({},'', '?state=two')">Outro estado</button><div class="blocks"><section><h2>Primeiro item</h2><p>Conteúdo de demonstração.</p></section><section><h2>Segundo item</h2><p>Outro elemento para selecionar.</p></section></div><div style="height:900px"></div><h2>Fim da página</h2></main><dialog><h2>Detalhes do item</h2><button onclick="this.closest('dialog').close()">Fechar detalhes</button></dialog></body></html>`
const errors = []
let context, browserCDP, worker, id, q
async function launch() {
  context = await chromium.launchPersistentContext(profile, { channel: "chromium", headless: true, viewport: null, args: ["--window-size=1360,987","--enable-unsafe-extension-debugging", `--disable-extensions-except=${extension}`, `--load-extension=${extension}`, "--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] })
  await context.route("https://example.com/**", route => route.fulfill({ contentType: "text/html; charset=utf-8", body: fixture }))
  await context.route("https://novah.auis.design/api/review/transcribe", route => route.fulfill({ status: 401, contentType: "application/json", body: '{"error":"unauthorized"}' }))
  browserCDP = await context.browser().newBrowserCDPSession()
  worker = context.serviceWorkers()[0] || await context.waitForEvent("serviceworker")
  id = worker.url().split("/")[2]
  q = await context.newPage()
  q.on("pageerror", error => errors.push(error.message))
  await q.goto("https://example.com/review")
  await q.locator("body").ariaSnapshot()
}
async function activate() {
  await q.bringToFront()
  const { targetInfos } = await browserCDP.send("Target.getTargets", { filter: [{ type: "tab", exclude: false }] })
  await browserCDP.send("Extensions.triggerAction", { id, targetId: targetInfos.find(t => t.url === q.url()).targetId })
  await q.getByRole("toolbar", { name: "AuisRewiew" }).waitFor()
}
async function notes() {
  const p = await context.newPage(); await p.goto(`chrome-extension://${id}/library.html`)
  const list = await p.evaluate(() => chrome.runtime.sendMessage({ channel: "auis-review", type: "list" }))
  await p.close(); await q.bringToFront(); return list.value
}
async function addNote(x, y, text) {
  await q.mouse.click(x, y)
  const editor = q.getByRole("textbox", { name: "Comentário", exact: true })
  await editor.fill(text)
  await q.getByRole("button", { name: "Salvar comentário", exact: true }).click()
  await editor.waitFor({ state: "hidden" })
}
async function saveExport(format, filename, options = {}) {
  await q.locator("html").ariaSnapshot()
  const opened = context.waitForEvent("page")
  await q.getByRole("button", { name: format, exact: true }).click()
  const exp = await opened; await exp.waitForLoadState(); await exp.locator("body").ariaSnapshot()
  if (options.grouping) await exp.getByRole("combobox", { name: "Agrupar comentários", exact: true }).selectOption(options.grouping)
  if (options.layout) await exp.getByRole("combobox", { name: "Comentários no PDF", exact: true }).selectOption(options.layout)
  const download = exp.waitForEvent("download")
  await exp.getByRole("button", { name: `Baixar ${format === "Pacote completo" ? "pacote completo" : format}`, exact: true }).click()
  await (await download).saveAs(path.join(artifacts, filename)); await exp.close(); await q.bringToFront()
}
try {
  await launch(); await activate()
  await q.mouse.move(300, 250)
  await q.screenshot({ path: path.join(artifacts, "toolbar.png") })
  await addNote(300, 250, "Aumentar o contraste deste título, preservando o texto.")
  let saved = await notes(); assert.equal(saved.length, 1); assert.ok(saved[0].shot?.data.startsWith("data:image/png;base64,")); assert.equal(saved[0].anchor.el.fingerprint.tag, "h1")
  await q.getByRole("button", { name: "Desenhar", exact: true }).click()
  await q.mouse.move(350, 590); await q.mouse.down(); await q.mouse.move(660, 590, { steps: 10 }); await q.mouse.move(660, 740, { steps: 8 }); await q.mouse.up()
  await q.getByRole("textbox", { name: "Comentário", exact: true }).fill("Alinhar estes dois blocos.")
  assert.ok(await q.getByRole("button", { name: "Abrir comentário 1", exact: true }).isDisabled(), "other pins wait while a comment is open, so unsaved text is never dropped")
  await q.getByRole("button", { name: "Salvar comentário", exact: true }).click()
  await q.getByRole("textbox", { name: "Comentário", exact: true }).waitFor({ state: "hidden" })
  saved = await notes(); assert.ok(saved.some(n => n.anchor.kind === "draw" && n.shot.points.length > 2))
  // After a scroll, the composer opens at the marker's current position, not where the screenshot was taken.
  await q.evaluate(() => window.scrollBy(0, 160)); await q.locator("html").ariaSnapshot()
  const pinOne = q.getByRole("button", { name: "Abrir comentário 1", exact: true })
  await pinOne.click()
  await q.locator(".ar-composer").evaluate(el => Promise.all(el.getAnimations({subtree:true}).map(a=>a.finished.catch(()=>{}))))
  const pinBox = await pinOne.boundingBox(); const composerBox = await q.locator(".ar-composer").boundingBox()
  assert.ok(Math.abs(composerBox.y - (pinBox.y + pinBox.height / 2)) < 60, `composer follows the live marker (pin ${Math.round(pinBox.y)}, composer ${Math.round(composerBox.y)})`)
  await q.getByRole("button", { name: "Fechar", exact: true }).click()
  await q.getByRole("textbox", { name: "Comentário", exact: true }).waitFor({ state: "hidden" })
  await q.evaluate(() => window.scrollTo(0, 0))
  await q.getByRole("button", { name: "Outro estado", exact: true }).click()
  await q.getByRole("button", { name: "Comentários (0)", exact: true }).waitFor()
  await q.goBack(); await q.getByRole("button", { name: "Comentários (2)", exact: true }).waitFor()
  await q.getByRole("button", { name: "Abrir detalhes", exact: true }).click()
  await q.getByRole("button", { name: "Selecionar elemento", exact: true }).click()
  const box = await q.getByRole("heading", { name: "Detalhes do item", exact: true }).boundingBox()
  await q.mouse.click(box.x + 20, box.y + 15)
  await q.getByRole("textbox", { name: "Comentário", exact: true }).fill("Ajustar o espaçamento do modal.")
  await q.locator(".ar-composer").evaluate(el => Promise.all(el.getAnimations({subtree:true}).map(a=>a.finished.catch(()=>{}))))
  assert.equal(await q.getByRole("textbox", {name: "Comentário", exact: true}).evaluate(el => getComputedStyle(el.parentElement.parentElement).borderTopWidth), "1px", "shared composer keeps its border inside Shadow DOM")
  await q.screenshot({ path: path.join(artifacts, "composer.png") })
  await q.getByRole("button", { name: "Salvar comentário", exact: true }).click()
  await q.getByRole("textbox", { name: "Comentário", exact: true }).waitFor({ state: "hidden" })
  await q.getByRole("button", { name: "Fechar detalhes", exact: true }).click()
  await q.getByRole("toolbar").waitFor()
  saved = await notes(); assert.equal(saved.length, 3); assert.ok(saved.every(n => !!n.shot))
  await q.getByRole("button", { name: "Adicionar pin", exact: true }).click(); await q.mouse.click(200, 390)
  const tabsBeforeMic = context.pages().length
  await q.getByRole("button", { name: "Gravar comentário", exact: true }).click()
  await q.getByRole("button", { name: "Parar e transcrever", exact: true }).waitFor()
  assert.equal(context.pages().length, tabsBeforeMic, "microphone stays in the same tab")
  await new Promise(r => setTimeout(r, 700))
  await q.getByRole("button", { name: "Parar e transcrever", exact: true }).click()
  await q.getByText("Seu áudio está salvo.", { exact: false }).waitFor()
  saved = await notes(); assert.equal(saved.length, 4); assert.ok(saved.some(n => n.audio?.data.startsWith("data:audio/")))
  await q.getByRole("textbox", { name: "Comentário", exact: true }).fill("Gravação preservada mesmo sem sessão de transcrição.")
  await q.getByRole("button", { name: "Salvar comentário", exact: true }).click()
  await q.getByRole("textbox", { name: "Comentário", exact: true }).waitFor({ state: "hidden" })
  await q.getByRole("button", { name: "Abrir detalhes", exact: true }).click()
  await q.getByRole("button", { name: "Comentários (4)", exact: true }).click()
  await q.screenshot({ path: path.join(artifacts, "comments.png") })
  await saveExport("PDF", "review.pdf")
  assert.ok((await fs.readFile(path.join(artifacts, "review.pdf"))).subarray(0, 4).toString() === "%PDF")
  await saveExport("PDF", "review-linked.pdf", { layout: "appendix" })
  const linkedPdf = (await fs.readFile(path.join(artifacts, "review-linked.pdf"))).toString("latin1")
  assert.ok((linkedPdf.match(/\/Subtype \/Link/g) || []).length >= 8, "every marker and comment has a PDF link")
  await saveExport("PNG", "review.png")
  const png = await fs.readFile(path.join(artifacts, "review.png"))
  assert.ok(png.readUInt32BE(20) > 1500, "PNG contains the full page, not only the viewport")
  await saveExport("PNG", "review-images.zip", { grouping: "comment" })
  const pngs = unzipSync(new Uint8Array(await fs.readFile(path.join(artifacts, "review-images.zip")))); assert.equal(Object.keys(pngs).length, 4)
  await saveExport("Pacote completo", "review.zip")
  const zip = unzipSync(new Uint8Array(await fs.readFile(path.join(artifacts, "review.zip"))))
  assert.ok(zip["review.md"]); assert.ok(Object.keys(zip).some(k => k.startsWith("audio/")))
  const backup = JSON.parse(strFromU8(zip["review.json"])); assert.equal(backup.notes.length, 4); assert.equal(backup.captures.length, 1); assert.equal(backup.captures[0].marks.length, 4)
  const library = await context.newPage(); await library.goto(`chrome-extension://${id}/library.html`); await library.locator("body").ariaSnapshot()
  await library.locator('input[type="file"]').setInputFiles(path.join(artifacts, "review.zip"))
  await library.getByText("0 comentários importados ou atualizados.", { exact: false }).waitFor()
  assert.equal((await notes()).length, 4)
  await context.close(); await launch()
  await q.getByRole("button", { name: "Abrir detalhes", exact: true }).click()
  await activate()
  await q.getByRole("button", { name: "Comentários (4)", exact: true }).waitFor()
  await q.getByRole("button", { name: "Navegar", exact: true }).click()
  await q.getByRole("button", { name: "Fechar detalhes", exact: true }).click()
  await q.locator("html").ariaSnapshot()
  await q.getByRole("button", { name: "Exportar revisão", exact: true }).click()
  await q.getByRole("menuitem", { name: "Baixar pacote completo", exact: true }).waitFor()
  await q.keyboard.press("Escape")
  const beforeMove = await notes()
  await q.getByRole("button", { name: "Comentários (4)", exact: true }).click()
  await q.getByRole("button", { name: "Abrir", exact: true }).first().click()
  await q.getByRole("button", { name: "Reposicionar na página", exact: true }).click()
  await q.getByRole("textbox", { name: "Comentário", exact: true }).waitFor({ state: "hidden" })
  await q.getByRole("dialog", { name: "Comentários", exact: true }).waitFor({ state: "hidden" })
  await q.locator(".ar-canvas").click({ position: { x: 500, y: 390 } })
  await q.getByRole("textbox", { name: "Comentário", exact: true }).waitFor()
  await q.getByRole("button", { name: "Salvar comentário", exact: true }).click()
  await q.getByRole("textbox", { name: "Comentário", exact: true }).waitFor({ state: "hidden" })
  const afterMove = await notes()
  assert.deepEqual(afterMove.map(n => n.id).sort(), beforeMove.map(n => n.id).sort())
  assert.equal(afterMove.length, 4)
  await q.setViewportSize({ width: 640, height: 780 }); await q.mouse.move(100, 250)
  const toolbar = await q.getByRole("toolbar").boundingBox(); assert.ok(toolbar.x >= 0 && toolbar.x + toolbar.width <= 640)
  await q.screenshot({ path: path.join(artifacts, "narrow.png") })
  await q.setViewportSize({ width: 1360, height: 900 })
  // Return to a native viewport so captureVisibleTab and CSS coordinates agree.
  await q.close(); q = await context.newPage()
  q.on("pageerror", error => errors.push(error.message))
  await q.route("https://example.com/nested", route => route.fulfill({ contentType: "text/html; charset=utf-8", body: '<!doctype html><html><head><meta charset="utf-8"><title>Página com rolagem interna</title><style>html,body{margin:0;height:100%;overflow:hidden;font:18px Arial}header{height:80px;background:#ddd}.scroller{position:fixed;inset:80px 20px 20px;overflow:auto}section{height:700px;padding:20px;box-sizing:border-box;background:#f4f4f4}section:nth-child(2){background:#e4e4e4}h2{margin:0}</style></head><body><header>Cabeçalho da página</header><main class="scroller"><section><h2>Primeiro bloco</h2></section><section><h2>Segundo bloco</h2></section><section><h2>Último bloco</h2></section></main></body></html>' }))
  await q.goto("https://example.com/nested"); await q.locator("body").ariaSnapshot(); await activate()
  await q.getByRole("heading", {name:"Último bloco",exact:true}).scrollIntoViewIfNeeded()
  const nestedBox = await q.getByRole("heading", {name:"Último bloco",exact:true}).boundingBox()
  await addNote(nestedBox.x + 40, nestedBox.y + 15, "Revisar o último bloco desta página.")
  const scrollBefore = await q.locator(".scroller").evaluate(el => el.scrollTop)
  await q.getByRole("button", {name:"Comentários (1)",exact:true}).click()
  await saveExport("PNG", "nested.png")
  assert.equal(await q.locator(".scroller").evaluate(el => el.scrollTop), scrollBefore, "export restores the original inner scroll")
  const nestedPng = await fs.readFile(path.join(artifacts, "nested.png"))
  assert.ok(nestedPng.readUInt32BE(20) >= 2100, "captures all inner scroll content")
  const lowerContent = await q.evaluate(async encoded => {
    const bitmap = await createImageBitmap(new Blob([Uint8Array.from(atob(encoded), c => c.charCodeAt(0))], { type: "image/png" }))
    const canvas = document.createElement("canvas"); canvas.width = bitmap.width; canvas.height = bitmap.height
    const ctx = canvas.getContext("2d"); ctx.drawImage(bitmap, 0, 0)
    const scale = bitmap.width / 1360
    const pixels = ctx.getImageData(30 * scale, 1490 * scale, 300 * scale, 60 * scale).data
    let dark = 0
    for (let i = 0; i < pixels.length; i += 4) if (pixels[i] < 100 && pixels[i + 1] < 100 && pixels[i + 2] < 100 && pixels[i + 3] > 200) dark++
    return dark
  }, nestedPng.toString("base64"))
  assert.ok(lowerContent > 100, "last inner section is actually rendered, not just an empty tall image")
  assert.deepEqual(errors, [])
  await fs.writeFile(path.join(artifacts, "result.json"), JSON.stringify({ passed: true, checks: ["real activeTab activation", "element capture", "same-tab microphone", "full-page PNG", "clickable PDF links", "export grouping", "inner scroll capture", "scroll restoration", "freehand drawing", "SPA URL isolation", "native dialog", "recording survives transcription failure", "PDF", "PNG", "ZIP and audio", "backup deduplication", "browser restart persistence", "reposition preserves IDs", "narrow window", "no page errors", "pins wait while a comment is open", "composer follows the live marker"] }, null, 2))
  console.log(`22 browser checks passed. Artifacts: ${artifacts}`)
} catch (error) {
  await q?.screenshot({ path: path.join(artifacts, "failure.png") }).catch(() => {})
  await fs.writeFile(path.join(artifacts, "failure.txt"), await q?.locator("html").ariaSnapshot().catch(() => "No page"))
  console.error(`Verification artifacts: ${artifacts}`)
  throw error
} finally { await context?.close(); await fs.rm(profile, { recursive: true, force: true }) }
