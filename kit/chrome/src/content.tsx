import * as React from "react"
import { createRoot } from "react-dom/client"
import { ChromePortalProvider } from "@auis/ui/ChromeScope"
import { Button } from "@auis/ui/primitives/Button"
import { Sheet } from "@auis/ui/primitives/Sheet"
import { DropdownMenu } from "@auis/ui/primitives/DropdownMenu"
import { Popover, PopoverAnchor, PopoverContent } from "@auis/ui/primitives/Popover"
import { captureElementAnchor, captureDrawAnchor, resolveAnchoredElement, resolveDrawPoints } from "@auis/core/elementAnchor"
import { buildReviewCommentContext, shortLabelFor } from "@auis/core/elementContext"
import { elementBelowOverlayAt, getContentScroll, invalidatePrimaryScrollCache } from "@auis/core/scrollOffset"
import type { ReviewAnchor, ReviewPoint } from "@auis/core/types"
import { HOST_ID, OVERLAY, pageKey, reviewPrompt, type Mode, type Note } from "./domain"
import { request } from "./client"
import { NotesPanel } from "./NotesPanel"
import { NoteEditor } from "./NoteEditor"
import { captureFullPage } from "./fullPageCapture"
import chromeCss from "@auis/ui/styles/chrome.css"
import extensionCss from "./extension.css"

const existing = document.getElementById(HOST_ID)
if (existing) existing.remove()
const host = document.createElement("div")
host.id = HOST_ID; host.setAttribute(OVERLAY, "")
// The host is the only node exposed to the website. UI and portals share a root.
host.style.cssText = "all:initial!important;position:fixed!important;inset:0!important;z-index:2147483646!important;pointer-events:none!important;display:block!important;width:100vw!important;height:100vh!important;margin:0!important;padding:0!important;border:0!important;"
host.popover = "manual"
document.documentElement.appendChild(host)
host.showPopover()
function syncNativeLayer() {
  const modal = [...document.querySelectorAll("dialog:modal")].at(-1)
  const parent = modal || document.documentElement
  if (host.parentElement !== parent) { host.hidePopover(); parent.appendChild(host); host.showPopover() }
  else if (!host.matches(":popover-open")) host.showPopover()
}
syncNativeLayer()
const shadow = host.attachShadow({ mode: "open" })
const style = document.createElement("style"); style.textContent = chromeCss + extensionCss
const mount = document.createElement("div"); mount.setAttribute("data-auis-ui", ""); mount.setAttribute(OVERLAY, "")
const portal = document.createElement("div"); portal.setAttribute("data-auis-ui", ""); portal.setAttribute(OVERLAY, ""); portal.style.pointerEvents = "auto"
shadow.append(style, mount, portal)
for (const [family, file] of [["Geist", "geist.woff2"], ["Material Symbols Rounded", "symbols.woff2"]]) {
  const font = new FontFace(family, `url(${chrome.runtime.getURL(`fonts/${file}`)})`)
  void font.load().then(f => document.fonts.add(f)).catch(() => {})
}

/** Where a note's marker sits in the viewport right now, or null when its target is gone. */
function markerPoint(n: Note): { x: number; y: number; points?: ReviewPoint[] } | null {
  const target = resolveAnchoredElement(n.anchor, { strict: true })
  const rect = target?.getBoundingClientRect()
  if (n.anchor.el && (!rect || rect.width === 0 || rect.height === 0)) return null
  const scroll = getContentScroll()
  if (n.anchor.kind === "pin") return { x: rect && n.anchor.el ? rect.x + rect.width * n.anchor.el.fx : n.anchor.position.x - scroll.x, y: rect && n.anchor.el ? rect.y + rect.height * n.anchor.el.fy : n.anchor.position.y - scroll.y }
  const points = n.anchor.el ? resolveDrawPoints(n.anchor.el) : n.anchor.path.points.map(p => ({ x: p.x - scroll.x, y: p.y - scroll.y }))
  if (!points?.length) return null
  return { x: points.reduce((s, p) => s + p.x, 0) / points.length, y: points.reduce((s, p) => s + p.y, 0) / points.length, points }
}

function App() {
  const [active, setActive] = React.useState(true)
  const [mode, setMode] = React.useState<Mode>("magic")
  const [url, setUrl] = React.useState(location.href)
  const [notes, setNotes] = React.useState<Note[]>([])
  const [pending, setPending] = React.useState<Note | null>(null)
  const [relocating, setRelocating] = React.useState<Note | null>(null)
  const [sheet, setSheet] = React.useState(false)
  const [exportMenu, setExportMenu] = React.useState(false)
  const [error, setError] = React.useState("")
  const [busy, setBusy] = React.useState(false)
  const [hover, setHover] = React.useState<{ rect: DOMRect; label: string } | null>(null)
  const [tick, setTick] = React.useState(0)
  const [stroke, setStroke] = React.useState<ReviewPoint[]>([])
  const canvas = React.useRef<HTMLCanvasElement>(null)
  const drawing = React.useRef<ReviewPoint[] | null>(null)
  const refresh = React.useCallback(() => { void request<Note[]>("list").then(setNotes).catch(e => setError(e.message)) }, [])
  const pageNotes = notes.filter(n => n.pageKey === pageKey(url) && n.status === "open").sort((a, b) => a.createdAt - b.createdAt)
  const closeComposer = React.useCallback(() => { setPending(null); setMode("cursor"); refresh() }, [refresh])
  // The listener is registered once. Re-registering on every URL change used to tear it
  // down mid-capture, and Chrome could then drop the pending reply to the export request.
  const urlRef = React.useRef(location.href)
  React.useEffect(() => {
    refresh()
    const updateUrl = () => {
      if (location.href === urlRef.current) return
      urlRef.current = location.href
      setUrl(location.href); setPending(null); setMode("cursor"); setHover(null); invalidatePrimaryScrollCache(); refresh()
    }
    const messages = (m: { type?: string; notes?: Note[] }, _sender: chrome.runtime.MessageSender, reply: (value: unknown) => void) => {
      if (m.type === "auis-toggle") setActive(v => !v)
      if (m.type === "auis-location") updateUrl()
      if (m.type === "auis-changed") refresh()
      if (m.type === "auis-capture-page") {
        setBusy(true); setError("")
        void captureFullPage(m.notes || []).then(capture => reply({ ok: true, capture }), error => { setError(error.message); reply({ ok: false, error: error.message }) }).finally(() => setBusy(false))
        return true
      }
    }
    chrome.runtime.onMessage.addListener(messages)
    window.addEventListener("popstate", updateUrl); window.addEventListener("hashchange", updateUrl)
    return () => { chrome.runtime.onMessage.removeListener(messages); window.removeEventListener("popstate", updateUrl); window.removeEventListener("hashchange", updateUrl) }
  }, [refresh])
  React.useEffect(() => {
    if (!active) return
    syncNativeLayer()
    let frame = 0
    const update = () => { if (!frame) frame = requestAnimationFrame(() => { frame = 0; syncNativeLayer(); setTick(t => t + 1) }) }
    const observer = new MutationObserver(update); observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "style", "hidden", "open"] })
    window.addEventListener("resize", update); document.addEventListener("scroll", update, true)
    return () => { observer.disconnect(); cancelAnimationFrame(frame); window.removeEventListener("resize", update); document.removeEventListener("scroll", update, true) }
  }, [active])
  React.useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (!active || e.composedPath().includes(host)) return
      if (e.key === "Escape") { setMode("cursor"); setHover(null); setStroke([]); setRelocating(null); drawing.current = null }
    }
    window.addEventListener("keydown", key)
    return () => window.removeEventListener("keydown", key)
  }, [active])
  const positioned = pageNotes.map((n, i) => {
    const point = markerPoint(n)
    return point && { note: n, number: i + 1, ...point }
  }).filter(v => v !== null)
  React.useEffect(() => {
    const el = canvas.current; if (!el) return
    const dpr = devicePixelRatio; el.width = innerWidth * dpr; el.height = innerHeight * dpr
    const ctx = el.getContext("2d")!; ctx.scale(dpr, dpr)
    ctx.strokeStyle = getComputedStyle(mount).getPropertyValue("--au-blue-600").trim(); ctx.lineWidth = 3; ctx.lineCap = "round"; ctx.lineJoin = "round"
    for (const pts of [...positioned.map(p => p.points).filter(Boolean), stroke]) {
      if (!pts?.length) continue
      ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.stroke()
    }
  // Positions are DOM-derived; tick covers resize, scroll and content changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notes, url, stroke, tick, active])

  async function annotate(point: ReviewPoint, points?: ReviewPoint[]) {
    if (busy) return
    const originalUrl = location.href
    setBusy(true); setHover(null); setError("")
    const scroll = getContentScroll()
    const anchor: ReviewAnchor = points ? { kind: "draw", path: { points: points.map(p => ({ x: p.x + scroll.x, y: p.y + scroll.y })), strokeColorToken: "var(--au-blue-600)", strokeWidth: 3 }, centroid: { x: point.x + scroll.x, y: point.y + scroll.y }, el: captureDrawAnchor(points) || undefined } : { kind: "pin", position: { x: point.x + scroll.x, y: point.y + scroll.y }, el: captureElementAnchor(point.x, point.y) || undefined }
    const context = buildReviewCommentContext(anchor); context.pageUrl = originalUrl
    // A repositioned note keeps its previous capture until a new one succeeds.
    const note: Note = { id: crypto.randomUUID(), version: 1, text: "", status: "open", createdAt: Date.now(), ...relocating, url: originalUrl, pageKey: pageKey(originalUrl), title: document.title, updatedAt: Date.now(), anchor, context, shot: relocating?.shot }
    try {
      host.style.setProperty("visibility", "hidden", "important")
      await new Promise<void>(r => requestAnimationFrame(() => requestAnimationFrame(() => r())))
      const data = await request<string>("capture", { url: originalUrl })
      note.shot = { data, width: innerWidth, height: innerHeight, pin: point, points }
    } catch (e) { setError(`Captura indisponível: ${(e as Error).message} ${relocating?.shot ? "O comentário mantém a captura anterior." : "O comentário ainda pode ser salvo."}`) }
    finally { host.style.removeProperty("visibility"); setBusy(false); setStroke([]); setMode("cursor") }
    if (pageKey(location.href) !== pageKey(originalUrl)) { setError("A página mudou. Selecione o elemento novamente."); return }
    setRelocating(null); setPending(note)
  }
  function locate(note: Note) {
    if (note.pageKey !== pageKey(location.href)) { window.location.assign(note.url); return }
    const el = resolveAnchoredElement(note.anchor, { strict: true })
    if (!el || !el.getBoundingClientRect().height) { setError("Elemento não encontrado neste estado. Abra a nota para ver a captura ou reabra o modal correspondente."); return }
    setSheet(false); el.scrollIntoView({ block: "center", behavior: "smooth" }); setPending(note)
  }
  const capturing = active && mode !== "cursor" && !pending && !sheet && !busy
  // The composer follows the marker as it is now (after a scroll, a resize or locate()),
  // not where it was when the screenshot was taken.
  const pin = (pending && (positioned.find(p => p.note.id === pending.id) || markerPoint(pending))) || pending?.shot?.pin || { x: innerWidth / 2, y: innerHeight / 2 }
  if (!active) return <Button className="ar-collapsed" variant="inverse" size="sm" iconLeft="chat_bubble_outline" onClick={() => setActive(true)}>AuisRewiew</Button>
  return <>
    <canvas ref={canvas} className="ar-canvas" aria-label={capturing ? "Área de anotação" : undefined} style={{ pointerEvents: capturing ? "auto" : "none", cursor: mode === "draw" ? "crosshair" : "default" }}
      onPointerDown={e => { e.stopPropagation(); if (!capturing) return; const p = { x: e.clientX, y: e.clientY }; if (mode === "draw") { drawing.current = [p]; setStroke([p]); e.currentTarget.setPointerCapture(e.pointerId) } else void annotate(p) }}
      onPointerMove={e => { const p = { x: e.clientX, y: e.clientY }; if (drawing.current) { drawing.current.push(p); setStroke([...drawing.current]); return } if (mode === "magic") { const el = elementBelowOverlayAt(p.x, p.y); setHover(el && el !== document.body && el !== document.documentElement ? { rect: el.getBoundingClientRect(), label: shortLabelFor(el) } : null) } }}
      onPointerLeave={() => setHover(null)}
      onPointerCancel={() => { drawing.current = null; setStroke([]) }}
      onPointerUp={e => { e.stopPropagation(); const pts = drawing.current; drawing.current = null; if (pts && pts.length > 2) void annotate({ x: pts.reduce((s, p) => s + p.x, 0) / pts.length, y: pts.reduce((s, p) => s + p.y, 0) / pts.length }, pts); else setStroke([]) }} />
    {hover && mode === "magic" && !pending && !busy && <div className="ar-highlight" style={{ left: hover.rect.x, top: hover.rect.y, width: hover.rect.width, height: hover.rect.height }}><span>{hover.label}</span></div>}
    {/* While a comment is open, the other pins wait: switching would drop its unsaved text, attachments or recording. */}
    {positioned.map(p => <Button key={p.note.id} size="sm" className="ar-pin" variant="primary" aria-label={`Abrir comentário ${p.number}`} style={{ left: p.x, top: p.y }} disabled={busy || (!!pending && pending.id !== p.note.id)} title={pending && pending.id !== p.note.id ? "Salve ou cancele o comentário aberto primeiro." : undefined} onClick={() => setPending(p.note)}>{p.number}</Button>)}
    <div className="ar-toolbar" role="toolbar" aria-label="AuisRewiew"><img className="ar-toolbar-logo" src={chrome.runtime.getURL("icon48.png")} alt="AuisRewiew" /><span className="ar-divider" />
      {([{ id: "cursor", icon: "arrow_selector_tool", label: "Navegar" }, { id: "draw", icon: "draw", label: "Desenhar" }, { id: "pin", icon: "location_on", label: "Adicionar pin" }, { id: "magic", icon: "auto_awesome", label: "Selecionar elemento" }] as const).map(tool => <Button key={tool.id} size="sm" className={mode === "magic" && tool.id === "magic" ? "ar-magic-active" : undefined} variant={mode === tool.id ? "inverse" : "ghost"} iconOnly={tool.icon} iconSize={16} iconWeight="auto" iconFill={mode === tool.id && tool.id === "magic" ? 1 : 0} title={tool.label} aria-label={tool.label} aria-pressed={mode === tool.id} disabled={!!pending || busy} onClick={() => { setMode(tool.id); setHover(null) }} />)}
      <span className="ar-divider" /><Button size="sm" variant={sheet ? "inverse" : "ghost"} iconLeft="forum" iconSize={16} disabled={!!pending || busy} aria-label={`Comentários (${pageNotes.length})`} onClick={() => { setSheet(true); setMode("cursor") }}>{pageNotes.length || null}</Button>
      <DropdownMenu side="top" align="end" open={exportMenu} onOpenChange={setExportMenu} trigger={<Button size="sm" variant="ghost" disabled={!!pending || busy || !pageNotes.length} iconOnly="ios_share" iconSize={16} aria-label="Exportar revisão" title="Exportar revisão" />} items={[
        { id: "heading", isLabel: true, label: `${pageNotes.length} comentários desta página` },
        { id: "copy", label: "Copiar para o Claude", icon: "content_copy", onSelect: () => { void navigator.clipboard.writeText(reviewPrompt(pageNotes)).then(() => setError("Prompt copiado. Inclua as imagens do pacote ao compartilhar."), () => setError("Não foi possível copiar. Tente pela biblioteca.")) } },
        ...[{ id: "pdf", label: "Baixar PDF" }, { id: "png", label: "Baixar PNG" }, { id: "zip", label: "Baixar pacote completo" }].map(item => ({ ...item, icon: "download", onSelect: () => { void request("export", { ids: pageNotes.map(n => n.id), format: item.id }).catch(e => setError(e.message)) } })),
      ]} />
      <span className="ar-divider" /><Button size="sm" variant="ghost" disabled={!!pending || busy} iconOnly="close" iconSize={16} aria-label="Recolher AuisRewiew" onClick={() => { closeComposer(); setActive(false) }} /></div>
    {error && <div className="ar-notice" role="alert"><span>{error}</span><Button size="sm" variant="ghost" iconOnly="close" aria-label="Fechar aviso" onClick={() => setError("")} /></div>}
    {busy && <div className="ar-notice" role="status">Capturando a página…</div>}
    {relocating && !busy && <div className="ar-notice" role="status">Selecione o novo elemento para este comentário. Escape cancela.</div>}
    <Popover open={!!pending} onOpenChange={open => { if (!open) closeComposer() }}><PopoverAnchor asChild><span style={{ position: "fixed", left: Math.min(innerWidth - 24, Math.max(24, pin.x)), top: Math.min(innerHeight - 100, Math.max(24, pin.y)), width: 1, height: 1 }} /></PopoverAnchor><PopoverContent className="ar-composer" side={pin.y > innerHeight * .6 ? "top" : "bottom"} align="center" sideOffset={16} collisionPadding={8} onInteractOutside={e => e.preventDefault()} onEscapeKeyDown={e => e.preventDefault()}>{pending && <NoteEditor key={pending.id} note={pending} onSaved={closeComposer} onCancel={closeComposer} />}</PopoverContent></Popover>
    <Sheet open={sheet} onClose={() => setSheet(false)} title="Comentários" meta={document.title} zIndex={2147483646} footer={<Button size="sm" variant="ghost" iconLeft="folder_open" onClick={() => void request("library")}>Biblioteca e configurações</Button>}><NotesPanel notes={notes} url={url} refresh={refresh} onLocate={locate} onReanchor={note => { setSheet(false); setRelocating(note); setMode("magic") }} /></Sheet>
  </>
}
createRoot(mount).render(<ChromePortalProvider container={portal}><App /></ChromePortalProvider>)
