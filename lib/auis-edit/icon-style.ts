// Override das axes ópticas de um ícone Material Symbols no Live Edit. O <Icon>
// escreve `font-variation-settings: 'FILL' f, 'wght' w, 'GRAD' g, 'opsz' o`
// inline; a op `iconStyle` reescreve essa string. Parse/build ficam aqui pra o
// applier e o inspetor falarem a mesma língua.

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

/** Lê as axes de uma string `font-variation-settings`. Campos ausentes ficam de fora. */
export function parseIconVariationString(raw: string): Partial<IconVariation> {
  const out: Partial<IconVariation> = {}
  for (const m of raw.matchAll(/['"](FILL|wght|GRAD|opsz)['"]\s+(-?\d+(?:\.\d+)?)/g)) {
    const key = AXIS_BY_TAG[m[1]]
    if (key) out[key] = Number(m[2])
  }
  return out
}

/** Variação atual de um ícone no DOM, com defaults sãos (FILL 0, opsz pelo font-size). */
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

/** Monta a string `font-variation-settings` a partir das 4 axes. */
export function buildIconVariation(v: IconVariation): string {
  return `'FILL' ${v.fill}, 'wght' ${v.weight}, 'GRAD' ${v.grade}, 'opsz' ${v.opticalSize}`
}

/** Igualdade por axes (robusta a aspas/espaços que o browser normaliza). */
export function iconVariationMatches(raw: string, v: IconVariation): boolean {
  const cur = parseIconVariationString(raw)
  return (
    cur.fill === v.fill &&
    cur.weight === v.weight &&
    cur.grade === v.grade &&
    cur.opticalSize === v.opticalSize
  )
}

// Escalas oferecidas no inspetor.
export const ICON_WEIGHTS = [200, 300, 400, 500, 600, 700] as const
export const ICON_GRADES: { value: number; label: string }[] = [
  { value: -25, label: "Baixo" },
  { value: 0, label: "Normal" },
  { value: 200, label: "Alto" },
]
