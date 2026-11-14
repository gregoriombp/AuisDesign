import type { Note } from "./domain"
export function loadImage(src: string): Promise<HTMLImageElement> { return new Promise((resolve, reject) => { const image = new Image(); image.onload = () => resolve(image); image.onerror = () => reject(new Error("Não foi possível ler uma captura.")); image.src = src }) }
export async function markedScreenshot(note: Note, number: number): Promise<HTMLCanvasElement> {
  const shot = note.shot
  if (!shot) throw new Error("Sem captura para este comentário.")
  const image = await loadImage(shot.data)
  const canvas = document.createElement("canvas"); canvas.width = image.width; canvas.height = image.height
  const ctx = canvas.getContext("2d")!
  ctx.drawImage(image, 0, 0)
  const sx = image.width / shot.width, sy = image.height / shot.height
  const style = getComputedStyle(document.querySelector("[data-auis-ui]") || document.documentElement)
  const ink = style.getPropertyValue("--au-blue-600").trim() || "Highlight"
  const paper = style.getPropertyValue("--au-white").trim() || "Canvas"
  ctx.strokeStyle = ink; ctx.lineWidth = 3 * sx; ctx.lineJoin = "round"; ctx.lineCap = "round"
  if (shot.points?.length) { ctx.beginPath(); shot.points.forEach((p, i) => i ? ctx.lineTo(p.x * sx, p.y * sy) : ctx.moveTo(p.x * sx, p.y * sy)); ctx.stroke() }
  const x = shot.pin.x * sx, y = shot.pin.y * sy
  ctx.beginPath(); ctx.arc(x, y, 14 * sx, 0, Math.PI * 2); ctx.fillStyle = ink; ctx.fill(); ctx.strokeStyle = paper; ctx.lineWidth = 2 * sx; ctx.stroke()
  ctx.fillStyle = paper; ctx.font = `600 ${13 * sx}px Geist, sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(String(number), x, y)
  return canvas
}
