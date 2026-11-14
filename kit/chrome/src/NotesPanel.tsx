import * as React from "react"
import { Button } from "@auis/ui/primitives/Button"
import { Input } from "@auis/ui/primitives/Input"
import { Icon } from "@auis/ui/primitives/Icon"
import { Modal } from "@auis/ui/primitives/Modal"
import { request } from "./client"
import { pageKey, reviewPrompt, type Note } from "./domain"
import { NoteEditor } from "./NoteEditor"
import { markedScreenshot } from "./renderImage"

export function NotesPanel({ notes, url, onLocate, onReanchor, refresh }: { notes: Note[]; url?: string; onLocate?: (n: Note) => void; onReanchor?: (n: Note) => void; refresh: () => void }) {
  const [scope, setScope] = React.useState(url ? "page" : "all")
  const [query, setQuery] = React.useState("")
  const [status, setStatus] = React.useState("open")
  const [selected, setSelected] = React.useState<Note | null>(null)
  const [deleting, setDeleting] = React.useState<Note | null>(null)
  const [error, setError] = React.useState("")
  const [feedback, setFeedback] = React.useState("")
  const [preview, setPreview] = React.useState("")
  React.useEffect(() => {
    let cancelled = false; setPreview("")
    if (selected?.shot) void markedScreenshot(selected, 1).then(canvas => { if (!cancelled) setPreview(canvas.toDataURL("image/png")) }).catch(() => {})
    return () => { cancelled = true }
  }, [selected])
  const filtered = notes.filter(n => (!url || scope === "all" || (scope === "site" ? new URL(n.url).origin === new URL(url).origin : n.pageKey === pageKey(url))) && (status === "all" || n.status === status) && `${n.text} ${n.title} ${n.url}`.toLowerCase().includes(query.toLowerCase())).sort((a, b) => a.createdAt - b.createdAt)
  async function action(fn: () => Promise<unknown>) { setError(""); try { await fn(); refresh() } catch (e) { setError((e as Error).message) } }
  async function exportNotes(format: string) { await action(() => request("export", { ids: filtered.map(n => n.id), format })) }
  return <div className="ar-panel">
    <div className="ar-row ar-filters">{url && <label>Mostrar<select value={scope} onChange={e => setScope(e.target.value)}><option value="page">Esta página</option><option value="site">Este site</option><option value="all">Todos os sites</option></select></label>}<label>Estado<select value={status} onChange={e => setStatus(e.target.value)}><option value="open">Abertos</option><option value="resolved">Resolvidos</option><option value="all">Todos</option></select></label></div>
    <Input iconLeft="search" aria-label="Buscar comentários" placeholder="Buscar comentário ou página" value={query} onChange={e => setQuery(e.target.value)} />
    <div className="ar-row ar-between"><span className="ar-muted">{filtered.length} {filtered.length === 1 ? "comentário" : "comentários"}</span><span className="ar-caption">Armazenamento local</span></div>
    {error && <p role="alert" className="ar-error">{error}</p>}
    {feedback && <p role="status" className="ar-muted">{feedback}</p>}
    {!filtered.length && <div className="ar-empty"><Icon name="chat_bubble_outline" size={28} /><h3>Nenhum comentário aqui</h3><p>Selecione um elemento, coloque um pin ou desenhe sobre a página para começar.</p></div>}
    <div className="ar-note-list">{filtered.map((n, i) => <article className="ar-note" key={n.id}>
      <div className="ar-row ar-between"><span className="ar-target"><span className="ar-number">{i + 1}</span>{n.context.target?.label || n.context.target?.tag || "Região"}</span><span className="ar-caption">{new Date(n.createdAt).toLocaleDateString("pt-BR")}</span></div>
      <p className="ar-note-text">{n.text || "Comentário em áudio"}</p><p className="ar-caption ar-ellipsis">{new URL(n.url).hostname}{new URL(n.url).pathname}</p>
      {n.audio && <audio controls preload="none" src={n.audio.data} aria-label={`Áudio do comentário ${i + 1}`} />}
      <div className="ar-row ar-wrap"><Button size="sm" variant="ghost" iconLeft="open_in_full" onClick={() => setSelected(n)}>Abrir</Button>{onLocate && <Button size="sm" variant="ghost" iconOnly="my_location" aria-label={`Localizar comentário ${i + 1}`} onClick={() => onLocate(n)} />}<Button size="sm" variant="ghost" iconOnly={n.status === "open" ? "check" : "undo"} aria-label={n.status === "open" ? `Resolver comentário ${i + 1}` : `Reabrir comentário ${i + 1}`} onClick={() => void action(() => request("save", { note: { ...n, status: n.status === "open" ? "resolved" : "open", updatedAt: Date.now() } }))} /><Button size="sm" variant="ghost" iconOnly="delete" aria-label={`Excluir comentário ${i + 1}`} onClick={() => setDeleting(n)} /></div>
    </article>)}</div>
    <div className="ar-export"><p className="ar-label">Exportar esta seleção</p><div className="ar-row ar-wrap"><Button size="sm" variant="primary" iconLeft="content_copy" disabled={!filtered.length} onClick={() => void action(async () => { await navigator.clipboard.writeText(reviewPrompt(filtered)); setFeedback("Prompt copiado. Baixe o pacote para incluir imagens e áudios.") })}>Copiar para o Claude</Button><Button size="sm" disabled={!filtered.length} onClick={() => void exportNotes("pdf")}>PDF</Button><Button size="sm" disabled={!filtered.length} onClick={() => void exportNotes("png")}>PNG</Button><Button size="sm" disabled={!filtered.length} onClick={() => void exportNotes("zip")}>Pacote completo</Button></div></div>
    <Modal open={!!selected} onClose={() => setSelected(null)} title="Comentário" size="lg" zIndex={2147483647}>
      {selected && <div className="ar-detail"><p className="ar-caption ar-break">{selected.url}</p>{preview && <img className="ar-preview" src={preview} alt="Captura da página com o comentário marcado" />}{onReanchor && <Button variant="ghost" size="sm" iconLeft="my_location" onClick={() => { onReanchor(selected); setSelected(null) }}>Reposicionar na página</Button>}<NoteEditor key={selected.id} note={selected} onSaved={() => { setSelected(null); refresh() }} onCancel={() => setSelected(null)} /></div>}
    </Modal>
    <Modal open={!!deleting} onClose={() => setDeleting(null)} title="Excluir comentário?" size="sm" zIndex={2147483647} footer={<div className="ar-row"><Button onClick={() => setDeleting(null)}>Cancelar</Button><Button variant="danger" onClick={() => void action(async () => { await request("delete", { id: deleting?.id }); setDeleting(null) })}>Excluir</Button></div>}><p>O comentário, a captura e o áudio serão removidos deste Chrome. Exporte um pacote antes se quiser manter uma cópia.</p></Modal>
  </div>
}
