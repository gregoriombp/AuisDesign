import { resolveAnchoredElement, resolveDrawPoints } from "@auis/core/elementAnchor"
import { findPrimaryScrollContainer } from "@auis/core/scrollOffset"
import type { ReviewPoint } from "@auis/core/types"
import { request } from "./client"
import { HOST_ID, pageKey, type CaptureMark, type Note, type PageCapture } from "./domain"

const settle = async () => {
  await new Promise(r => setTimeout(r, 140))
  await new Promise<void>(r => requestAnimationFrame(() => requestAnimationFrame(() => r())))
}
const image = (src: string): Promise<HTMLImageElement> => new Promise((resolve, reject) => {
  const img = new Image(); img.onload = () => resolve(img); img.onerror = () => reject(new Error("Não foi possível montar a captura.")); img.src = src
})
let capturing = false

/** Scrolls and stitches actual browser pixels. Never reconstructs a website's DOM
 * into a picture. All scroll/style changes are restored even when capture fails. */
export async function captureFullPage(notes: Note[]): Promise<PageCapture> {
  if (capturing) throw new Error("Uma captura já está em andamento. Aguarde a conclusão.")
  const url = location.href
  const host = document.getElementById(HOST_ID)
  const root = document.scrollingElement as HTMLElement || document.documentElement
  const inner = root.scrollHeight <= innerHeight + 2 ? findPrimaryScrollContainer() : null
  const scroller = inner || root
  const original = { x: scroller.scrollLeft, y: scroller.scrollTop, windowX: scrollX, windowY: scrollY }
  const savedStyles: { el: HTMLElement; name: string; value: string; priority: string }[] = []
  const change = (el: HTMLElement, name: string, value: string) => {
    savedStyles.push({ el, name, value: el.style.getPropertyValue(name), priority: el.style.getPropertyPriority(name) }); el.style.setProperty(name, value, "important")
  }
  const viewport = { width: innerWidth, height: innerHeight }
  const scroll = async (x: number, y: number) => { scroller.scrollTo({ left: x, top: y, behavior: "instant" }); await settle(); if (location.href !== url) throw new Error("A página mudou durante a captura. Tente novamente.") }
  capturing = true
  try {
    if (host) change(host, "visibility", "hidden")
    for (const overlay of document.querySelectorAll<HTMLElement>("[data-auis-review],[data-auis-dot]")) {
      if (overlay !== host) change(overlay, "visibility", "hidden")
    }
    change(scroller, "scroll-behavior", "auto"); change(scroller, "scroll-snap-type", "none"); change(scroller, "overflow-anchor", "none")
    await document.fonts.ready
    const maxHeight = 30000
    const frame = inner ? inner.getBoundingClientRect() : { x: 0, y: 0, width: viewport.width, height: viewport.height }
    const sliceHeight = Math.min(frame.height, viewport.height - Math.max(0, frame.y))
    if (sliceHeight <= 0) throw new Error("A área rolável não está visível. Abra a página e tente novamente.")
    if (scroller.scrollHeight > maxHeight) throw new Error("Esta página tem mais de 30.000 pixels. Reduza o conteúdo carregado antes de exportar.")
    // Warm one bounded pass for lazy-loaded content, then measure its final size.
    const initialHeight = scroller.scrollHeight
    for (let y = 0; y < initialHeight; y += sliceHeight) await scroll(0, y)
    await scroll(0, 0)
    const contentHeight = scroller.scrollHeight
    const contentWidth = inner ? viewport.width : Math.max(root.scrollWidth, viewport.width)
    const extra = inner ? contentHeight - frame.height : 0
    const height = inner ? viewport.height + extra : Math.max(contentHeight, viewport.height)
    if (height > maxHeight || contentWidth > 12000) throw new Error("A página excede o tamanho de captura suportado. Reduza o conteúdo carregado e tente novamente.")
    const scale = Math.min(devicePixelRatio || 1, 2, 16000 / height, Math.sqrt(60000000 / (contentWidth * height)))
    const canvas = document.createElement("canvas"); canvas.width = Math.ceil(contentWidth * scale); canvas.height = Math.ceil(height * scale)
    const ctx = canvas.getContext("2d")!
    ctx.fillStyle = "Canvas"; ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = getComputedStyle(document.documentElement).backgroundColor; ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = getComputedStyle(document.body).backgroundColor; ctx.fillRect(0, 0, canvas.width, canvas.height)
    const map = (p: ReviewPoint, el?: Element | null): ReviewPoint => {
      if (!inner) return { x: p.x + scrollX, y: p.y + scrollY }
      return { x: p.x, y: inner.contains(el || null) ? p.y + inner.scrollTop : p.y >= frame.y + frame.height ? p.y + extra : p.y }
    }
    const marks: CaptureMark[] = []
    const missing: string[] = []
    for (const note of notes) {
      const el = resolveAnchoredElement(note.anchor, { strict: true })
      const rect = el?.getBoundingClientRect()
      if (note.anchor.el && (!el || !rect?.width || !rect?.height)) { missing.push(note.text.slice(0, 50) || note.id); continue }
      const bounds = rect ? { ...map(rect, el), width: rect.width, height: rect.height } : note.shot?.bounds
      if (note.anchor.kind === "draw") {
        const pts = note.anchor.el ? resolveDrawPoints(note.anchor.el)?.map(p => map(p, el)) : note.anchor.path.points
        if (!pts?.length) { missing.push(note.id); continue }
        const minX = Math.min(...pts.map(p => p.x)), minY = Math.min(...pts.map(p => p.y))
        marks.push({ id: note.id, points: pts, pin: { x: pts.reduce((s, p) => s + p.x, 0) / pts.length, y: pts.reduce((s, p) => s + p.y, 0) / pts.length }, bounds: { x: minX, y: minY, width: Math.max(...pts.map(p => p.x)) - minX, height: Math.max(...pts.map(p => p.y)) - minY } })
      } else {
        const pin = rect && note.anchor.el ? map({ x: rect.x + rect.width * note.anchor.el.fx, y: rect.y + rect.height * note.anchor.el.fy }, el) : note.anchor.position
        marks.push({ id: note.id, pin, bounds: bounds || { x: pin.x - 16, y: pin.y - 16, width: 32, height: 32 } })
      }
    }
    if (missing.length) throw new Error(`Abra o estado da página que contém estas marcações antes de exportar: ${missing.join("; ")}. As notas continuam salvas.`)
    const fixed = [...document.querySelectorAll<HTMLElement>("body *")].filter(el => el !== inner && !el.contains(inner) && !el.closest(`[data-auis-review]`) && (["fixed", "sticky"].includes(getComputedStyle(el).position) || el.matches("dialog:modal,[popover]:popover-open")))
    const screenshot = async () => image(await request<string>("capture", { url }))
    let first = true
    for (let y = 0; y < contentHeight; y += sliceHeight) {
      for (let x = 0; x < contentWidth; x += viewport.width) {
        await scroll(inner ? 0 : x, y)
        if (innerWidth !== viewport.width || innerHeight !== viewport.height) throw new Error("O tamanho da janela mudou. Tente capturar novamente.")
        const actualY = scroller.scrollTop, actualX = scroller.scrollLeft
        if (Math.abs(actualY - Math.min(y, scroller.scrollHeight - scroller.clientHeight)) > 3) throw new Error("Não foi possível rolar a página inteira. Feche o bloqueio de rolagem e tente novamente.")
        const shot = await screenshot()
        const sx = shot.width / viewport.width, sy = sx
        if (Math.abs(shot.height / sx - viewport.height) > 2) throw new Error("A captura do Chrome difere da janela emulada. Desative a emulação de dispositivo e capture novamente.")
        if (inner) {
          if (first) {
            ctx.drawImage(shot, 0, 0, shot.width, shot.height, 0, 0, viewport.width * scale, viewport.height * scale)
            const bottom = frame.y + frame.height
            if (bottom < viewport.height) ctx.drawImage(shot, 0, bottom * sy, shot.width, (viewport.height - bottom) * sy, 0, (bottom + extra) * scale, viewport.width * scale, (viewport.height - bottom) * scale)
          }
          const offsetY = y - actualY
          const h = Math.min(sliceHeight - offsetY, contentHeight - y)
          ctx.drawImage(shot, frame.x * sx, (frame.y + offsetY) * sy, frame.width * sx, h * sy, frame.x * scale, (frame.y + y) * scale, frame.width * scale, h * scale)
        } else {
          const offsetX = x - actualX, offsetY = y - actualY
          const w = Math.min(viewport.width - offsetX, contentWidth - x), h = Math.min(viewport.height - offsetY, height - y)
          ctx.drawImage(shot, offsetX * sx, offsetY * sy, w * sx, h * sy, x * scale, y * scale, w * scale, h * scale)
        }
        if (first) { for (const el of fixed) change(el, "visibility", "hidden"); first = false }
      }
    }
    // If an infinite feed grew while capturing, do not present a partial result as full.
    if (scroller.scrollHeight > contentHeight + 4) throw new Error("O site carregou mais conteúdo durante a captura. Tente novamente quando a página estabilizar.")
    let data = canvas.toDataURL("image/png")
    if (data.length > 45000000) data = canvas.toDataURL("image/jpeg", .94)
    return { pageKey: pageKey(url), url, title: document.title, capturedAt: Date.now(), data, width: contentWidth, height, marks }
  } finally {
    capturing = false
    for (const item of savedStyles.reverse()) {
      if (item.value) item.el.style.setProperty(item.name, item.value, item.priority)
      else item.el.style.removeProperty(item.name)
    }
    scroller.scrollTo({ left: original.x, top: original.y, behavior: "instant" })
    if (inner) window.scrollTo({ left: original.windowX, top: original.windowY, behavior: "instant" })
  }
}
