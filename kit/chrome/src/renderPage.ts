import type { CaptureRect, Note, PageCapture } from "./domain"
import { loadImage } from "./renderImage"

export type ExportGrouping = "page" | "comment"
export interface ExportPage { capture: PageCapture; notes: Note[] }
export function exportPages(captures: PageCapture[], notes: Note[], grouping: ExportGrouping): ExportPage[] {
  if (grouping === "comment") return notes.map(note => ({ capture: captures.find(c => c.pageKey === note.pageKey)!, notes: [note] }))
  return captures.map(capture => ({ capture, notes: notes.filter(n => n.pageKey === capture.pageKey) })).filter(p => p.notes.length)
}
export function wrapText(ctx: CanvasRenderingContext2D, text: string, width: number): string[] {
  const lines: string[] = []
  for (const paragraph of text.split("\n")) {
    let line = ""
    for (const word of paragraph.split(/\s+/)) {
      if (ctx.measureText(line + " " + word).width > width && line) { lines.push(line); line = "" }
      if (ctx.measureText(word).width > width) {
        for (const char of word) { if (ctx.measureText(line + char).width > width) { lines.push(line); line = "" } line += char }
      } else line += (line ? " " : "") + word
    }
    lines.push(line)
  }
  return lines
}
const overlap = (a: CaptureRect, b: CaptureRect) => Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y))
export function placeCallout(bounds: CaptureRect, width: number, height: number, page: { width: number; height: number }, occupied: CaptureRect[]): CaptureRect {
  const gap = 24, edge = 16
  const candidates = [
    { x: bounds.x + bounds.width + gap, y: bounds.y }, { x: bounds.x - width - gap, y: bounds.y },
    { x: bounds.x, y: bounds.y + bounds.height + gap }, { x: bounds.x, y: bounds.y - height - gap },
  ]
  // Additional positions avoid stacking adjacent comments over each other.
  for (let y = edge; y <= page.height - height - edge; y += Math.max(32, height / 2)) {
    candidates.push({ x: edge, y }, { x: page.width - width - edge, y })
  }
  let best: CaptureRect = { x: edge, y: edge, width, height }, score = Infinity
  for (const p of candidates) {
    const r = { x: Math.max(edge, Math.min(page.width - width - edge, p.x)), y: Math.max(edge, Math.min(page.height - height - edge, p.y)), width, height }
    const value = overlap(r, bounds) * 10 + occupied.reduce((n, other) => n + overlap(r, other) * 100, 0) + Math.hypot(r.x - bounds.x, r.y - bounds.y)
    if (value < score) { best = r; score = value }
  }
  return best
}

/** The full page remains the canvas. Bounds, paths, pins and comment cards are
 * painted on those exact pixels; PDF and PNG share this one renderer. */
export async function renderPage(page: ExportPage, allNotes: Note[], comments: boolean): Promise<HTMLCanvasElement> {
  const { capture, notes } = page
  if (!capture) throw new Error("Capture a página inteira pela barra antes de exportar.")
  const img = await loadImage(capture.data)
  const canvas = document.createElement("canvas"); canvas.width = img.width; canvas.height = img.height
  const ctx = canvas.getContext("2d")!; ctx.drawImage(img, 0, 0)
  const sx = img.width / capture.width, sy = img.height / capture.height
  ctx.scale(sx, sy)
  const styles = getComputedStyle(document.querySelector("[data-auis-ui]") || document.documentElement)
  const token = (key: string, fallback: string) => styles.getPropertyValue(key).trim() || fallback
  const accent = token("--au-blue-600", "Highlight"), ink = token("--auis-fg-primary", "CanvasText"), paper = token("--auis-bg-raised", "Canvas"), border = token("--auis-border-default", "GrayText")
  const used: CaptureRect[] = []
  const marks = capture.marks.filter(m => notes.some(n => n.id === m.id))
  for (const mark of marks) {
    const b = mark.bounds || { x: mark.pin.x - 16, y: mark.pin.y - 16, width: 32, height: 32 }
    ctx.fillStyle = accent; ctx.globalAlpha = .08; ctx.fillRect(b.x, b.y, b.width, b.height); ctx.globalAlpha = 1
    ctx.strokeStyle = accent; ctx.lineWidth = 2; ctx.setLineDash([6, 4]); ctx.strokeRect(b.x, b.y, b.width, b.height); ctx.setLineDash([])
    if (mark.points?.length) { ctx.lineWidth = 3; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.beginPath(); mark.points.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.stroke() }
  }
  if (comments) for (const mark of marks) {
    const note = notes.find(n => n.id === mark.id)!, number = allNotes.findIndex(n => n.id === note.id) + 1
    const width = Math.min(360, capture.width - 32)
    ctx.font = "14px Geist, sans-serif"
    const lines = wrapText(ctx, note.text || "Comentário em áudio. Consulte o pacote completo.", width - 32)
    const height = 54 + lines.length * 21
    if (height > capture.height - 32) throw new Error("Um comentário é longo demais para caber sobre a captura. No PDF, escolha comentários ao final; o pacote completo preserva todo o texto.")
    const bounds = mark.bounds || { x: mark.pin.x, y: mark.pin.y, width: 1, height: 1 }
    const r = placeCallout(bounds, width, height, capture, used); used.push(r)
    ctx.strokeStyle = accent; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(mark.pin.x, mark.pin.y); ctx.lineTo(Math.max(r.x, Math.min(r.x + r.width, mark.pin.x)), Math.max(r.y, Math.min(r.y + r.height, mark.pin.y))); ctx.stroke()
    ctx.shadowColor = border; ctx.shadowBlur = 16; ctx.shadowOffsetY = 5
    ctx.fillStyle = paper; ctx.beginPath(); ctx.roundRect(r.x, r.y, r.width, r.height, 12); ctx.fill()
    ctx.shadowColor = "transparent"; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0
    ctx.strokeStyle = border; ctx.lineWidth = 1; ctx.stroke()
    ctx.fillStyle = accent; ctx.font = "600 12px Geist, sans-serif"; ctx.textBaseline = "top"; ctx.textAlign = "left"; ctx.fillText(`Comentário ${number}`, r.x + 16, r.y + 13)
    ctx.fillStyle = ink; ctx.font = "14px Geist, sans-serif"; lines.forEach((line, i) => ctx.fillText(line, r.x + 16, r.y + 35 + i * 21))
  }
  for (const mark of marks) {
    const number = allNotes.findIndex(n => n.id === mark.id) + 1
    ctx.fillStyle = accent; ctx.beginPath(); ctx.arc(mark.pin.x, mark.pin.y, 13, 0, Math.PI * 2); ctx.fill()
    ctx.strokeStyle = paper; ctx.lineWidth = 2; ctx.stroke()
    ctx.fillStyle = paper; ctx.font = "600 12px Geist, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(String(number), mark.pin.x, mark.pin.y)
  }
  return canvas
}
