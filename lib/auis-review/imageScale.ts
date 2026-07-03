// Anexos do Review Mode são guardados como data URL base64 DENTRO do comentário,
// que trafega no review-bridge (JSON/SSE) e, no modo local, cai no localStorage
// (~5MB no total). Mantemos resolução ALTA, mas com um teto no maior lado pra um
// screenshot 4K/Retina não estourar o storage. Imagens já dentro do teto passam
// intactas (sem reencode), preservando a nitidez de texto.
const MAX_DIM = 2400
const JPEG_QUALITY = 0.92

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

/**
 * Lê o arquivo em alta resolução; só redimensiona se o maior lado passar de
 * MAX_DIM (mantendo proporção). Abaixo disso devolve o original intacto.
 */
export async function fileToHighResDataUrl(file: File): Promise<string> {
  const original = await fileToDataUrl(file)
  if (typeof document === "undefined") return original
  let img: HTMLImageElement
  try {
    img = await loadImage(original)
  } catch {
    return original
  }
  const longest = Math.max(img.naturalWidth, img.naturalHeight)
  if (longest <= MAX_DIM) return original

  const scale = MAX_DIM / longest
  const w = Math.round(img.naturalWidth * scale)
  const h = Math.round(img.naturalHeight * scale)
  const canvas = document.createElement("canvas")
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext("2d")
  if (!ctx) return original
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = "high"
  ctx.drawImage(img, 0, 0, w, h)
  return canvas.toDataURL("image/jpeg", JPEG_QUALITY)
}
