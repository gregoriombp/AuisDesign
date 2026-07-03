// O picker de estilo do Live Edit SÓ oferece tokens do design system — nunca um
// valor cru. Aqui está a paleta COMPLETA, transcrita do globals.css (fonte de
// verdade): todas as rampas de cor (canal var `--au-{família}-{step}`), os
// tokens semânticos, raios e sombras. O apply engine valida todo valor contra
// ALLOWED_* antes de tocar o DOM. "Tokens são sagrados" por construção.

export interface TokenSwatch {
  /** Nome do token, ex.: "--au-blue-600". */
  token: string
  /** `var(--token)` — o que é gravado/persistido (segue dark mode). */
  cssValue: string
  label: string
}

export interface ColorRamp {
  family: string
  label: string
  /** `var(--token)` da cor do rótulo da família (um step médio). */
  swatch: string
  swatches: TokenSwatch[]
}

export interface SemanticGroup {
  label: string
  tokens: TokenSwatch[]
}

function swatch(token: string, label: string): TokenSwatch {
  return { token, cssValue: `var(${token})`, label }
}

// ── Rampas primitivas (transcritas do @theme do globals.css) ──────────────────
const RAMP_STEPS: Record<string, { label: string; steps: number[] }> = {
  gray: { label: "Gray", steps: [25, 50, 100, 150, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1100, 1200] },
  slate: { label: "Slate", steps: [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1200] },
  blue: { label: "Blue", steps: [100, 150, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1100, 1200] },
  emerald: { label: "Emerald", steps: [100, 150, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1100, 1200] },
  teal: { label: "Teal", steps: [100, 200, 400, 500, 600, 700, 900] },
  lime: { label: "Lime", steps: [100, 200, 400, 500, 600, 700, 900, 1200] },
  amber: { label: "Amber", steps: [100, 150, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1100, 1200] },
  red: { label: "Red", steps: [100, 150, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1100, 1200] },
  pink: { label: "Pink", steps: [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1200] },
  purple: { label: "Purple", steps: [100, 150, 200, 300, 400, 500, 600, 700, 800, 900, 1000] },
}

export const COLOR_RAMPS: ColorRamp[] = Object.entries(RAMP_STEPS).map(
  ([family, { label, steps }]) => ({
    family,
    label,
    swatch: `var(--au-${family}-${steps[Math.floor(steps.length / 2)]})`,
    swatches: steps.map((s) => swatch(`--au-${family}-${s}`, `${label} ${s}`)),
  }),
)

// ── Semânticos (canal var no :root) ───────────────────────────────────────────
const SEMANTIC_BG: SemanticGroup = {
  label: "Superfícies",
  tokens: [
    swatch("--bg-canvas", "Canvas"),
    swatch("--bg-surface", "Surface"),
    swatch("--bg-raised", "Raised"),
    swatch("--bg-muted", "Muted"),
    swatch("--bg-hover", "Hover"),
    swatch("--bg-selected", "Selected"),
    swatch("--bg-inverse", "Inverse"),
  ],
}
const SEMANTIC_FG: SemanticGroup = {
  label: "Texto",
  tokens: [
    swatch("--fg-primary", "Primário"),
    swatch("--fg-secondary", "Secundário"),
    swatch("--fg-tertiary", "Terciário"),
    swatch("--fg-muted", "Muted"),
    swatch("--fg-on-inverse", "On inverse"),
  ],
}
const SEMANTIC_BORDER: SemanticGroup = {
  label: "Bordas",
  tokens: [
    swatch("--border-subtle", "Sutil"),
    swatch("--border-default", "Padrão"),
    swatch("--border-strong", "Forte"),
    swatch("--ring-focus", "Focus ring"),
  ],
}
const SEMANTIC_ACCENT: SemanticGroup = {
  label: "Acentos",
  tokens: [
    swatch("--accent-brand", "Brand"),
    swatch("--accent-brand-hover", "Brand hover"),
    swatch("--accent-success", "Sucesso"),
    swatch("--accent-danger", "Perigo"),
    swatch("--accent-warning", "Atenção"),
  ],
}

// ── Escalas (raio / sombra) ───────────────────────────────────────────────────
const RADIUS_SCALE: TokenSwatch[] = [
  swatch("--radius-xs", "XS"),
  swatch("--radius-sm", "SM"),
  swatch("--radius-md", "MD"),
  swatch("--radius-lg", "LG"),
  swatch("--radius-xl", "XL"),
  swatch("--radius-2xl", "2XL"),
  swatch("--radius-full", "Full"),
]
const SHADOW_SCALE: TokenSwatch[] = [
  swatch("--shadow-xs", "XS"),
  swatch("--shadow-sm", "SM"),
  swatch("--shadow-md", "MD"),
  swatch("--shadow-lg", "LG"),
  swatch("--shadow-overlay", "Overlay"),
]
// Escala de espaçamento (padding/margin/gap). Subconjunto curado dos --space-*
// do globals.css — começa em --space-0 (0px, "Nenhum") pra dar conta de
// "reduzir/zerar padding" sem sair do token.
const SPACING_SCALE: TokenSwatch[] = [
  swatch("--space-0", "0"),
  swatch("--space-1", "4"),
  swatch("--space-2", "8"),
  swatch("--space-3", "12"),
  swatch("--space-4", "16"),
  swatch("--space-6", "24"),
  swatch("--space-8", "32"),
  swatch("--space-12", "48"),
]

export interface StyleProperty {
  prop: string
  label: string
  kind: "color" | "radius" | "shadow" | "spacing"
  /** Grupos semânticos relevantes pra esta propriedade (atalhos no topo). */
  semantic: SemanticGroup[]
  /** Propriedades de cor mostram TODAS as rampas embaixo dos semânticos. */
  showRamps: boolean
  /** Escala (raio/sombra/espaçamento). */
  scale?: TokenSwatch[]
}

export const STYLE_PROPERTIES: StyleProperty[] = [
  { prop: "color", label: "Cor do texto", kind: "color", semantic: [SEMANTIC_FG, SEMANTIC_ACCENT], showRamps: true },
  { prop: "background-color", label: "Fundo", kind: "color", semantic: [SEMANTIC_BG, SEMANTIC_ACCENT], showRamps: true },
  { prop: "border-color", label: "Borda", kind: "color", semantic: [SEMANTIC_BORDER, SEMANTIC_ACCENT], showRamps: true },
  { prop: "border-radius", label: "Raio", kind: "radius", semantic: [], showRamps: false, scale: RADIUS_SCALE },
  { prop: "box-shadow", label: "Sombra", kind: "shadow", semantic: [], showRamps: false, scale: SHADOW_SCALE },
  { prop: "padding", label: "Padding", kind: "spacing", semantic: [], showRamps: false, scale: SPACING_SCALE },
  { prop: "margin", label: "Margem", kind: "spacing", semantic: [], showRamps: false, scale: SPACING_SCALE },
  { prop: "gap", label: "Gap", kind: "spacing", semantic: [], showRamps: false, scale: SPACING_SCALE },
]

// ── Allow-lists pro apply engine ──────────────────────────────────────────────
const COLOR_VALUES = new Set<string>([
  ...COLOR_RAMPS.flatMap((r) => r.swatches.map((s) => s.cssValue)),
  ...[SEMANTIC_BG, SEMANTIC_FG, SEMANTIC_BORDER, SEMANTIC_ACCENT].flatMap((g) =>
    g.tokens.map((t) => t.cssValue),
  ),
])
const RADIUS_VALUES = new Set(RADIUS_SCALE.map((t) => t.cssValue))
const SHADOW_VALUES = new Set(SHADOW_SCALE.map((t) => t.cssValue))
const SPACING_VALUES = new Set(SPACING_SCALE.map((t) => t.cssValue))

const COLOR_PROPS = new Set(["color", "background-color", "border-color"])
const SPACING_PROPS = new Set(["padding", "margin", "gap"])

/** Guarda: uma op de estilo só é honrada se a propriedade for conhecida E o
 *  valor for um token válido pra ela. Defende o DOM de qualquer não-token. */
export function isAllowedStyle(prop: string, cssValue: string): boolean {
  if (COLOR_PROPS.has(prop)) return COLOR_VALUES.has(cssValue)
  if (SPACING_PROPS.has(prop)) return SPACING_VALUES.has(cssValue)
  if (prop === "border-radius") return RADIUS_VALUES.has(cssValue)
  if (prop === "box-shadow") return SHADOW_VALUES.has(cssValue)
  return false
}
