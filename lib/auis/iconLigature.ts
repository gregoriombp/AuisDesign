// Icons are Material Symbols rendered by ligature: the icon name is the text
// of the span. So the `textContent` of a button that carries an icon comes out
// glued — "deleteRemove", "editEdit procedure", "Agentexpand_more" — and
// anything that reads labels from text inherits that noise.
//
// Two real failures start here: the \b boundary of the destructive-action guard
// does not match in "deleteRemove" (nothing separates "delete" from "Remove"),
// and the landmark trail records "Section: Agentexpand_more".

/** Ligature glued at the start: lowercase/underscore run followed by an uppercase letter. */
const LEADING_LIGATURE = /^[a-z][a-z_]*(?=[A-ZÀ-Ý])/
/** Ligature glued at the end, after a lowercase/accented letter. */
const TRAILING_LIGATURE = /(?<=[a-zà-ý])(?:expand_more|expand_less|arrow_drop_down|close|check|more_horiz|more_vert|chevron_right|chevron_left)$/

/** Readable label: no icon ligature, collapsed whitespace, trimmed. */
export function stripIconLigature(raw: string): string {
  const flat = (raw ?? "").replace(/\s+/g, " ").trim()
  if (!flat) return ""
  const head = flat.replace(LEADING_LIGATURE, "")
  const clean = head.replace(TRAILING_LIGATURE, "").trim()
  // A label that IS only the ligature ("edit", "close") has nothing to clean —
  // return it as is, otherwise it becomes an empty string and the caller loses
  // the only clue it had.
  return clean || flat
}
