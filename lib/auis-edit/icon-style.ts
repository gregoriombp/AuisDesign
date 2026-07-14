// Overrides the optical axes of a Material Symbols icon in Live Edit. <Icon>
// writes `font-variation-settings: 'FILL' f, 'wght' w, 'GRAD' g, 'opsz' o`
// inline; the `iconStyle` op rewrites that string. Parse/build live here so the
// applier and the inspector speak the same language.

export type IconVariation = {
  fill: number
  weight: number
  grade: number
  opticalSize: number
}

const AXIS_BY_TAG: Record<string, keyof IconVariation> = {
  FILL: "fill",
  wght: "weight",
  GRAD: "grade",
  opsz: "opticalSize",
}

/** Read the axes from a `font-variation-settings` string. Missing fields are left out. */
export function parseIconVariationString(raw: string): Partial<IconVariation> {
  const out: Partial<IconVariation> = {}
  for (const m of raw.matchAll(/['"](FILL|wght|GRAD|opsz)['"]\s+(-?\d+(?:\.\d+)?)/g)) {
    const key = AXIS_BY_TAG[m[1]]
    if (key) out[key] = Number(m[2])
  }
  return out
}

/** Current variation of an icon in the DOM, with sane defaults (FILL 0, opsz from font-size). */
export function readIconVariation(el: Element): IconVariation {
  const html = el as HTMLElement
  const fontSize = parseFloat(html.style.fontSize) || 20
  const base: IconVariation = {
    fill: 0,
    weight: 400,
    grade: 0,
    opticalSize: Math.min(48, Math.max(20, Math.round(fontSize))),
  }
  return { ...base, ...parseIconVariationString(html.style.fontVariationSettings || "") }
}

/** Build the `font-variation-settings` string from the 4 axes. */
export function buildIconVariation(v: IconVariation): string {
  return `'FILL' ${v.fill}, 'wght' ${v.weight}, 'GRAD' ${v.grade}, 'opsz' ${v.opticalSize}`
}

/** Axis-wise equality (robust to the quotes/spaces the browser normalizes). */
export function iconVariationMatches(raw: string, v: IconVariation): boolean {
  const cur = parseIconVariationString(raw)
  return (
    cur.fill === v.fill &&
    cur.weight === v.weight &&
    cur.grade === v.grade &&
    cur.opticalSize === v.opticalSize
  )
}

// Scales offered in the inspector.
export const ICON_WEIGHTS = [200, 300, 400, 500, 600, 700] as const
export const ICON_GRADES: { value: number; label: string }[] = [
  { value: -25, label: "Low" },
  { value: 0, label: "Normal" },
  { value: 200, label: "High" },
]
