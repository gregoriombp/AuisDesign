// Review Mode attachments are stored as base64 data URLs INSIDE the comment,
// which travels through the review-bridge (JSON/SSE) and, in local mode, lands
// in localStorage (~5MB total). We keep the resolution HIGH but cap the longest
// side so a 4K/Retina screenshot doesn't blow past the storage budget. Images
// already under the cap pass through untouched (no re-encode), preserving the
// sharpness of text.
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
 * Reads the file at full resolution; only resizes when the longest side exceeds
 * MAX_DIM (keeping the aspect ratio). Below that it returns the original intact.
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
