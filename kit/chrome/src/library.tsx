import * as React from "react"
import { createRoot } from "react-dom/client"
import { ChromePortalProvider } from "@auis/ui/ChromeScope"
import { Button } from "@auis/ui/primitives/Button"
import { Input } from "@auis/ui/primitives/Input"
import { NotesPanel } from "./NotesPanel"
import { request } from "./client"
import { DEFAULT_ENDPOINT, validEndpoint, type Note, type Settings } from "./domain"
import { unzipSync, strFromU8 } from "fflate"
import chromeCss from "@auis/ui/styles/chrome.css"
import css from "./extension.css"

const style = document.createElement("style"); style.textContent = chromeCss + css; document.head.append(style)
const root = document.getElementById("root")!; root.setAttribute("data-auis-ui", "")
const portal = document.createElement("div"); portal.setAttribute("data-auis-ui", ""); document.body.append(portal)
function Library() {
  const [notes, setNotes] = React.useState<Note[]>([])
  const [settings, setSettings] = React.useState(new URLSearchParams(location.search).has("settings"))
  const [endpoint, setEndpoint] = React.useState(DEFAULT_ENDPOINT)
  const [message, setMessage] = React.useState("")
  const [working, setWorking] = React.useState(false)
  const input = React.useRef<HTMLInputElement>(null)
  const refresh = React.useCallback(() => { void request<Note[]>("list").then(setNotes).catch(e => setMessage(e.message)) }, [])
  React.useEffect(() => {
    refresh(); void request<Settings>("settings").then(s => setEndpoint(s.endpoint))
    const change = (m: { type?: string }) => { if (m.type === "auis-changed") refresh() }
    chrome.runtime.onMessage.addListener(change); return () => chrome.runtime.onMessage.removeListener(change)
  }, [refresh])
  async function configure() {
    if (!validEndpoint(endpoint)) { setMessage("Use o endereço HTTPS completo do serviço de transcrição."); return }
    const granted = await chrome.permissions.request({ origins: [new URL(endpoint).origin + "/*"] })
    if (!granted) { setMessage("O endereço não foi autorizado."); return }
    try { await request("settings-save", { endpoint }); setMessage("Serviço salvo. Entre no site neste perfil do Chrome antes de transcrever.") } catch (e) { setMessage((e as Error).message) }
  }
  async function importFile(file?: File) {
    if (!file) return
    setWorking(true); setMessage("")
    try {
      if (file.size > 100 * 1024 * 1024) throw new Error("Importe um pacote de até 100 MB.")
      let json: string
      if (file.name.toLowerCase().endsWith(".zip")) {
        const data = unzipSync(new Uint8Array(await file.arrayBuffer()), { filter: file => file.name === "review.json" && file.originalSize < 150 * 1024 * 1024 })
        if (!data["review.json"]) throw new Error("Este ZIP não contém um backup AuisRewiew.")
        json = strFromU8(data["review.json"])
      } else json = await file.text()
      const parsed = JSON.parse(json)
      if (parsed.app !== "AuisRewiew" || parsed.version !== 1) throw new Error("Formato de backup não reconhecido.")
      const count = await request<number>("import", { notes: parsed.notes, captures: parsed.captures })
      setMessage(`${count} comentários importados ou atualizados. Itens repetidos foram preservados.`); refresh()
    } catch (e) { setMessage((e as Error).message) }
    finally { setWorking(false) }
  }
  return <main className="ar-library"><header className="ar-library-header"><div><h1>AuisRewiew</h1><p className="ar-muted">Suas revisões, página por página.</p></div><div className="ar-row"><Button variant={settings ? "inverse" : "ghost"} iconLeft="settings" onClick={() => setSettings(v => !v)}>Configurações</Button><Button iconLeft="upload" disabled={working} onClick={() => input.current?.click()}>Importar pacote</Button></div></header>
    <input ref={input} type="file" hidden accept=".zip,.json" onChange={e => { void importFile(e.target.files?.[0]); e.target.value = "" }} />
    {settings && <section className="ar-settings"><h2>Transcrição de voz</h2><p>O áudio usa a integração OpenAI do seu serviço. A chave permanece no servidor. A extensão usa sua sessão de login nesse endereço.</p><label className="ar-label" htmlFor="endpoint">Endereço do serviço</label><Input id="endpoint" value={endpoint} onChange={e => setEndpoint(e.target.value)} /><div className="ar-row ar-wrap"><Button variant="primary" onClick={() => void configure()}>Salvar serviço</Button><Button onClick={() => { if (validEndpoint(endpoint)) void chrome.tabs.create({ url: new URL(endpoint).origin }) }}>Abrir site para entrar</Button><Button onClick={() => { void navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => { stream.getTracks().forEach(t => t.stop()); setMessage("Microfone autorizado nesta aba. Nas páginas revisadas, a permissão aparece ao clicar em Gravar comentário.") }).catch(() => setMessage("Permita o microfone nas permissões desta aba e tente novamente.")) }}>Testar microfone nesta aba</Button></div><p className="ar-caption">Comentários e anexos ficam neste perfil do Chrome. Exporte um pacote antes de remover a extensão ou mudar de computador.</p></section>}
    {message && <p className="ar-notice-inline" role="status">{message}</p>}
    <NotesPanel notes={notes} refresh={refresh} onLocate={n => { void chrome.tabs.create({ url: n.url }) }} />
  </main>
}
createRoot(root).render(<ChromePortalProvider container={portal}><Library /></ChromePortalProvider>)
