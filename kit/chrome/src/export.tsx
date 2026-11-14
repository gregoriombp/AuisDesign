import * as React from "react"
import { createRoot } from "react-dom/client"
import { Button } from "@auis/ui/primitives/Button"
import { zipSync, strToU8 } from "fflate"
import { jsPDF } from "jspdf"
import { request } from "./client"
import { reviewPrompt, type Note, type PageCapture } from "./domain"
import { exportPages, renderPage, type ExportGrouping, type ExportPage } from "./renderPage"
import chromeCss from "@auis/ui/styles/chrome.css"
import css from "./extension.css"

const style = document.createElement("style"); style.textContent = chromeCss + css; document.head.append(style)
const root = document.getElementById("root")!; root.setAttribute("data-auis-ui", "")
const asBytes = (url: string) => Uint8Array.from(atob(url.split(",")[1]), c => c.charCodeAt(0))
function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob), a = document.createElement("a"); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 60000)
}
async function canvasBlob(canvas: HTMLCanvasElement): Promise<Blob> { return new Promise((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error("Não foi possível gerar a imagem.")), "image/png")) }

export async function createReviewPdf(pages: ExportPage[], notes: Note[], appendix: boolean): Promise<Blob> {
  let doc: jsPDF | undefined
  const linked: { page: number; markId: string; x: number; y: number; radius: number }[] = []
  for (const page of pages) {
    const canvas = await renderPage(page, notes, !appendix)
    // A PDF page follows the full screenshot's aspect ratio, not an A4 report.
    const width = Math.min(210, 4500 * page.capture.width / page.capture.height)
    const height = width * page.capture.height / page.capture.width
    const orientation = height >= width ? "portrait" : "landscape"
    if (!doc) doc = new jsPDF({ unit: "mm", format: [width, height], orientation })
    else doc.addPage([width, height], orientation)
    doc.addImage(canvas.toDataURL("image/jpeg", .94), "JPEG", 0, 0, width, height)
    const index = doc.getNumberOfPages(), factor = width / page.capture.width
    for (const note of page.notes) {
      const mark = page.capture.marks.find(m => m.id === note.id)
      if (mark) linked.push({ page: index, markId: note.id, x: mark.pin.x * factor, y: mark.pin.y * factor, radius: 16 * factor })
    }
  }
  if (!doc) throw new Error("Nenhuma página para exportar.")
  doc.setProperties({ title: "AuisRewiew — revisão de páginas", creator: "AuisRewiew" })
  if (appendix) {
    const destinations = new Map<string, number>()
    for (const [i, note] of notes.entries()) {
      doc.addPage("a4", "portrait"); const start = doc.getNumberOfPages(); destinations.set(note.id, start)
      let y = 24
      const text = (value: string, size = 11) => {
        doc!.setFontSize(size)
        for (const line of doc!.splitTextToSize(value, 174) as string[]) {
          if (y > 274) { doc!.addPage("a4", "portrait"); y = 24 }
          doc!.text(line, 18, y); y += size * .48 + 1
        }
        y += 6
      }
      text(`Comentário ${i + 1}`, 18); text(note.title, 12); text(note.url, 9)
      text(note.text || "Comentário em áudio. O original está no pacote completo.")
      const source = linked.find(link => link.markId === note.id)
      if (source) {
        if (y > 272) { doc.addPage("a4", "portrait"); y = 24 }
        doc.setFontSize(10); doc.text("Voltar à marcação", 18, y); doc.link(18, y - 4, 48, 8, { pageNumber: source.page, top: Math.max(0, source.y - 20) })
      }
    }
    // Destinations are known only after long comments have been paginated.
    for (const link of linked) {
      doc.setPage(link.page)
      doc.link(Math.max(0, link.x - link.radius), Math.max(0, link.y - link.radius), link.radius * 2, link.radius * 2, { pageNumber: destinations.get(link.markId)! })
    }
  }
  return doc.output("blob")
}

function ExportApp() {
  const [notes, setNotes] = React.useState<Note[]>([])
  const [captures, setCaptures] = React.useState<PageCapture[]>([])
  const [format, setFormat] = React.useState("zip")
  const [grouping, setGrouping] = React.useState<ExportGrouping>("page")
  const [layout, setLayout] = React.useState("overlay")
  const [message, setMessage] = React.useState("Preparando sua revisão…")
  const [busy, setBusy] = React.useState(false)
  const [preview, setPreview] = React.useState("")
  const [previewIndex, setPreviewIndex] = React.useState(0)
  const pages = React.useMemo(() => exportPages(captures, notes, grouping), [captures, notes, grouping])
  React.useEffect(() => {
    void (async () => {
      const job = new URLSearchParams(location.search).get("job")
      const saved = (job ? (await chrome.storage.session.get(job))[job] : null) as { ids: string[]; format: string } | null
      if (!saved) throw new Error("Esta exportação expirou. Abra uma nova pela biblioteca.")
      const all = await request<Note[]>("list")
      const selected = all.filter(n => saved.ids.includes(n.id)).sort((a, b) => a.createdAt - b.createdAt)
      const shots = await request<(PageCapture | undefined)[]>("captures", { keys: [...new Set(selected.map(n => n.pageKey))] })
      if (shots.some(c => !c)) throw new Error("Abra a página e exporte pela barra para obter uma captura inteira.")
      setCaptures(shots as PageCapture[]); setNotes(selected); setFormat(saved.format); setMessage("A página inteira foi capturada. Escolha como mostrar os comentários.")
    })().catch(e => setMessage(e.message))
  }, [])
  React.useEffect(() => {
    let cancelled = false; setPreview("")
    const page = pages[Math.min(previewIndex, pages.length - 1)]
    if (page) void document.fonts.ready.then(() => renderPage(page, notes, format !== "pdf" || layout === "overlay")).then(canvas => { if (!cancelled) setPreview(canvas.toDataURL("image/png")) }).catch(e => { if (!cancelled) setMessage(e.message) })
    return () => { cancelled = true }
  }, [pages, notes, previewIndex, layout, format])
  async function generate() {
    setBusy(true); setMessage("Gerando arquivo…")
    try {
      const basename = `AuisRewiew-${new Date().toISOString().slice(0, 10)}`
      if (format === "pdf") download(await createReviewPdf(pages, notes, layout === "appendix"), basename + ".pdf")
      else {
        const files: Record<string, Uint8Array> = {}
        if (format === "zip") {
          files["review.md"] = strToU8(reviewPrompt(notes))
          files["review.json"] = strToU8(JSON.stringify({ app: "AuisRewiew", version: 1, exportedAt: Date.now(), notes, captures }))
          files["README.txt"] = strToU8("AuisRewiew\n\nAs páginas inteiras, áreas delimitadas e comentários estão em pages. As capturas de referência por nota estão em images. Os áudios estão em audio. Envie review.md e as imagens à pessoa ou IA que fará a revisão. Importe este ZIP na biblioteca da extensão para restaurar notas e capturas.\n")
          for (const note of notes) {
            if (note.shot) files[`images/${note.id}.png`] = asBytes(note.shot.data)
            if (note.audio) files[`audio/${note.id}.${note.audio.mime.includes("mp4") ? "mp4" : "webm"}`] = asBytes(note.audio.data)
            for (const [j, src] of (note.images || []).entries()) files[`attachments/${note.id}-${j + 1}.${src.startsWith("data:image/png") ? "png" : src.startsWith("data:image/webp") ? "webp" : "jpg"}`] = asBytes(src)
          }
        }
        for (const [i, page] of pages.entries()) {
          const blob = await canvasBlob(await renderPage(page, notes, true))
          if (format === "png" && pages.length === 1) { download(blob, basename + ".png"); setMessage("PNG da página inteira gerado."); return }
          files[`pages/${String(i + 1).padStart(3, "0")}.png`] = new Uint8Array(await blob.arrayBuffer())
        }
        download(new Blob([new Uint8Array(zipSync(files, { level: 3 }))], { type: "application/zip" }), basename + ".zip")
      }
      setMessage("Arquivo gerado. Confira os downloads do Chrome.")
    } catch (e) { setMessage((e as Error).message) }
    finally { setBusy(false) }
  }
  return <main className="ar-library"><header className="ar-library-header"><div><h1>Exportar revisão</h1><p className="ar-muted">{notes.length} comentários · {captures.length} {captures.length === 1 ? "página inteira" : "páginas inteiras"}</p></div><Button variant="primary" iconLeft="download" disabled={!pages.length || busy || !preview} loading={busy} onClick={() => void generate()}>Baixar {format === "zip" ? "pacote completo" : format.toUpperCase()}</Button></header>
    <div className="ar-export-options"><label>Agrupar comentários<select aria-label="Agrupar comentários" value={grouping} onChange={e => { setGrouping(e.target.value as ExportGrouping); setPreviewIndex(0) }}><option value="page">Todos sobre a mesma página</option><option value="comment">Uma página inteira por comentário</option></select></label>
      {format === "pdf" && <label>Comentários no PDF<select aria-label="Comentários no PDF" value={layout} onChange={e => setLayout(e.target.value)}><option value="overlay">Comentários sobre a captura</option><option value="appendix">Bolinhas clicáveis e comentários ao final</option></select></label>}
      {pages.length > 1 && <label>Prévia<select aria-label="Página da prévia" value={Math.min(previewIndex, pages.length - 1)} onChange={e => setPreviewIndex(Number(e.target.value))}>{pages.map((p, i) => <option key={i} value={i}>{i + 1}. {p.capture.title}</option>)}</select></label>}
    </div><p className="ar-notice-inline" role="status">{message}</p>{preview && <img className="ar-full-preview" src={preview} alt="Prévia da página inteira com áreas delimitadas e comentários" />}
  </main>
}
createRoot(root).render(<ExportApp />)
