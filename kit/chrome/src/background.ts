import { allowedPage, DEFAULT_ENDPOINT, isNote, isPageCapture, validEndpoint, pageKey, type Note, type Settings, type PageCapture } from "./domain"
import { deleteNote, getNote, listNotes, saveNote, getCapture, saveCapture } from "./database"

async function activate(tab: chrome.tabs.Tab) {
  if (!tab.id || !tab.url || !allowedPage(tab.url)) {
    await chrome.action.setBadgeText({ text: "!", tabId: tab.id })
    await chrome.action.setTitle({ title: "Abra uma página http ou https para revisar.", tabId: tab.id })
    return
  }
  try { await chrome.tabs.sendMessage(tab.id, { type: "auis-toggle" }) }
  catch { await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] }) }
  await chrome.action.setBadgeText({ text: "", tabId: tab.id })
}
chrome.action.onClicked.addListener(tab => { void activate(tab).catch(() => chrome.action.setTitle({ tabId: tab.id, title: "O Chrome não permite revisar esta página." })) })
async function routeChanged(details: { tabId: number; frameId: number }) {
  if (details.frameId !== 0) return
  await chrome.tabs.sendMessage(details.tabId, { type: "auis-location" }).catch(() => {})
}
chrome.webNavigation.onHistoryStateUpdated.addListener(d => { void routeChanged(d) })
chrome.webNavigation.onReferenceFragmentUpdated.addListener(d => { void routeChanged(d) })

async function transcribe(noteId: string) {
  const note = await getNote(noteId)
  if (!note?.audio) throw new Error("Gravação não encontrada.")
  const saved = await chrome.storage.local.get("settings")
  const endpoint = (saved.settings as Settings | undefined)?.endpoint || DEFAULT_ENDPOINT
  if (!validEndpoint(endpoint)) throw new Error("Configure um endereço HTTPS de transcrição válido.")
  const origin = new URL(endpoint).origin + "/*"
  if (!await chrome.permissions.contains({ origins: [origin] })) throw new Error("Autorize o serviço em Configurações.")
  const audio = await (await fetch(note.audio.data)).blob()
  const form = new FormData()
  form.append("audio", audio, `comment.${note.audio.mime.includes("mp4") ? "mp4" : "webm"}`)
  const res = await fetch(endpoint, { method: "POST", credentials: "include", body: form, signal: AbortSignal.timeout(90000) })
  if (res.status === 401 || res.status === 403 || res.redirected && res.headers.get("content-type")?.includes("text/html")) throw new Error("Entre no Novah neste perfil do Chrome e tente transcrever novamente. Seu áudio está salvo.")
  const body = await res.json().catch(() => ({}))
  if (!res.ok || typeof body.text !== "string" || !body.text.trim()) throw new Error(body.error || "O serviço não retornou uma transcrição. Seu áudio está salvo.")
  return body.text.trim()
}
async function notify() {
  await chrome.runtime.sendMessage({ type: "auis-changed" }).catch(() => {})
  const tabs = await chrome.tabs.query({})
  await Promise.all(tabs.map(t => t.id ? chrome.tabs.sendMessage(t.id, { type: "auis-changed" }).catch(() => {}) : undefined))
}
let lastCapture = 0
let captureQueue = Promise.resolve()
function capture(sender: chrome.runtime.MessageSender, url: string): Promise<string> {
  const task = captureQueue.then(async () => {
    const tab = sender.tab
    if (!tab?.id || !tab.url || pageKey(tab.url) !== pageKey(url)) throw new Error("A página mudou. Selecione o elemento novamente.")
    const wait = Math.max(0, 600 - (Date.now() - lastCapture))
    if (wait) await new Promise(r => setTimeout(r, wait))
    const current = await chrome.tabs.get(tab.id)
    if (!current.active || current.url !== tab.url) throw new Error("Volte à aba da revisão para capturar a imagem.")
    lastCapture = Date.now()
    return chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" })
  })
  captureQueue = task.then(() => {}, () => {})
  return task
}

chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if (message.channel !== "auis-review" || sender.id !== chrome.runtime.id) return
  void (async () => {
    switch (message.type) {
      case "list": return listNotes()
      case "save": {
        if (!isNote(message.note)) throw new Error("Comentário inválido.")
        await saveNote(message.note); await notify(); return
      }
      case "delete": await deleteNote(String(message.id)); await notify(); return
      case "capture": return capture(sender, String(message.url))
      case "library": return chrome.tabs.create({ url: chrome.runtime.getURL("library.html") + (message.settings ? "?settings=1" : "") })
      case "settings": return (await chrome.storage.local.get("settings")).settings || { endpoint: DEFAULT_ENDPOINT }
      case "settings-save": {
        if (sender.tab && !sender.url?.startsWith(chrome.runtime.getURL(""))) throw new Error("Abra as configurações da extensão.")
        if (!validEndpoint(message.endpoint)) throw new Error("Use uma URL HTTPS válida.")
        await chrome.storage.local.set({ settings: { endpoint: message.endpoint } }); return
      }
      case "transcribe": return transcribe(String(message.id))
      case "captures": return Promise.all((message.keys as string[]).map(key => getCapture(key)))
      case "export": {
        const selected = (await listNotes()).filter(n => Array.isArray(message.ids) && message.ids.includes(n.id))
        if (!selected.length) throw new Error("Selecione pelo menos um comentário.")
        const keys = [...new Set(selected.map(n => n.pageKey))]
        if (sender.tab?.id && sender.url && !sender.url.startsWith(chrome.runtime.getURL(""))) {
          const current = selected.filter(n => n.pageKey === pageKey(sender.url!))
          if (current.length) {
            const result = await chrome.tabs.sendMessage(sender.tab.id, { type: "auis-capture-page", notes: current })
            if (!result?.ok) throw new Error(result?.error || "Não foi possível capturar a página inteira.")
            if (!isPageCapture(result.capture)) throw new Error("A captura ultrapassou o tamanho suportado. Reduza o conteúdo carregado e tente novamente.")
            await saveCapture(result.capture)
          }
        }
        for (const key of keys) {
          const capture = await getCapture(key)
          if (!capture || selected.some(n => n.pageKey === key && !capture.marks.some(m => m.id === n.id))) throw new Error(`Abra ${key}, ative a extensão e exporte pela barra para capturar a página inteira.`)
        }
        const job = crypto.randomUUID()
        await chrome.storage.session.set({ [job]: { ids: message.ids, format: message.format } })
        return chrome.tabs.create({ url: chrome.runtime.getURL(`export.html?job=${job}`) })
      }
      case "import": {
        if (!sender.url?.startsWith(chrome.runtime.getURL(""))) throw new Error("Importe pela biblioteca.")
        if (!Array.isArray(message.notes) || message.notes.length > 1000 || !message.notes.every(isNote)) throw new Error("Backup inválido.")
        if (message.captures !== undefined && (!Array.isArray(message.captures) || message.captures.length > 1000 || !message.captures.every(isPageCapture))) throw new Error("Capturas do backup inválidas.")
        let added = 0
        for (const n of message.notes as Note[]) {
          const current = await getNote(n.id)
          if (!current || n.updatedAt > current.updatedAt) { await saveNote(n); added++ }
        }
        for (const c of (message.captures || []) as PageCapture[]) {
          const current = await getCapture(c.pageKey)
          if (!current || c.capturedAt > current.capturedAt) await saveCapture(c)
        }
        await notify(); return added
      }
      default: throw new Error("Ação não reconhecida.")
    }
  })().then(value => reply({ ok: true, value }), error => reply({ ok: false, error: error instanceof Error ? error.message : "Não foi possível concluir." }))
  return true
})
