// Measure the pixel position of the caret (or any character offset) inside a
// <textarea>, so an inline picker (the @ / / / # menu) can anchor to it — the
// well-trodden "mirror div" technique. A textarea gives no native caret rect
// (unlike a contentEditable Range), so we clone its text metrics into a hidden
// div, place a marker span at the offset, and read the span's box.
//
// Returns coords relative to the textarea's BORDER box (top-left corner), with
// the element's own scroll already subtracted. Callers add the textarea's
// getBoundingClientRect() to land in viewport space.

const MIRROR_PROPS = [
  "boxSizing",
  "width",
  "borderTopWidth",
  "borderRightWidth",
  "borderBottomWidth",
  "borderLeftWidth",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "fontStyle",
  "fontVariant",
  "fontWeight",
  "fontStretch",
  "fontSize",
  "lineHeight",
  "fontFamily",
  "textAlign",
  "textTransform",
  "textIndent",
  "letterSpacing",
  "wordSpacing",
  "tabSize",
] as const

export interface CaretCoords {
  /** Top of the caret's line, relative to the textarea border box. */
  top: number
  /** Left of the caret, relative to the textarea border box. */
  left: number
  /** Line height (caret height). */
  height: number
}

export function getCaretCoordinates(
  ta: HTMLTextAreaElement,
  position: number,
): CaretCoords {
  const doc = ta.ownerDocument
  const computed = getComputedStyle(ta)
  const mirror = doc.createElement("div")
  const style = mirror.style

  style.position = "absolute"
  style.top = "0"
  style.left = "0"
  style.visibility = "hidden"
  style.whiteSpace = "pre-wrap"
  style.wordWrap = "break-word"
  style.overflow = "hidden"
  // Match the textarea's content width so wrapping lands on the same column.
  style.width = `${ta.clientWidth}px`
  // Copy the text-metric properties. Indexed via a string record because
  // CSSStyleDeclaration's keyof union includes read-only members (length,
  // parentRule); every name in MIRROR_PROPS is a writable camelCase property.
  const styleRecord = style as unknown as Record<string, string>
  const computedRecord = computed as unknown as Record<string, string>
  for (const prop of MIRROR_PROPS) {
    styleRecord[prop] = computedRecord[prop]
  }
  // Width is pinned above; let height grow with content.
  style.height = "auto"

  mirror.textContent = ta.value.slice(0, position)
  const marker = doc.createElement("span")
  // A non-empty marker so trailing newlines/spaces still produce a box.
  marker.textContent = ta.value.slice(position) || "."
  mirror.appendChild(marker)

  doc.body.appendChild(mirror)
  const borderTop = parseFloat(computed.borderTopWidth) || 0
  const borderLeft = parseFloat(computed.borderLeftWidth) || 0
  const lineHeight =
    parseFloat(computed.lineHeight) || marker.offsetHeight || 16
  // offsetTop/Left are measured from the mirror's padding edge, so they already
  // include the copied padding; add the border to reach the border box.
  const top = marker.offsetTop + borderTop - ta.scrollTop
  const left = marker.offsetLeft + borderLeft - ta.scrollLeft
  doc.body.removeChild(mirror)

  return { top, left, height: lineHeight }
}
