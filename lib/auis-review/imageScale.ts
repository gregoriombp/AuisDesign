// Review Mode attachments are written to disk (content-addressed) by the
// serverless bridge and referenced by URL in the JSON — see
// app/api/review-bridge/_images.ts. Here we only prepare the upload: cap the
// longest side + re-encode as JPEG so a UI screenshot never travels as a giant
// PNG/4K image. 1600px @ 0.82 keeps text legible at a fraction of the weight.
const MAX_DIM = 1600
const JPEG_QUALITY = 0.82

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
 * Normalizes the attachment into a lean JPEG: scales down when the longest side
 * exceeds MAX_DIM and ALWAYS re-encodes as JPEG (even images under the cap), so
 * a PNG screenshot does not travel 3-5x heavier than needed. On any failure it
 * returns the original.
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
  const scale = longest > MAX_DIM ? MAX_DIM / longest : 1
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
  const encoded = canvas.toDataURL("image/jpeg", JPEG_QUALITY)
  // If for some reason the JPEG ends up larger than the original (rare, tiny
  // images), keep the smaller of the two.
  return encoded.length < original.length ? encoded : original
}
