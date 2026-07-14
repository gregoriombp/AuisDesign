// The Live Edit style picker ONLY offers design-system tokens — never a raw
// value. This is the FULL palette, transcribed from globals.css (the source of
// truth): every color ramp (var channel `--au-{family}-{step}`), the semantic
// tokens, radii and shadows. The apply engine validates every value against
// ALLOWED_* before touching the DOM. "Tokens are sacred" by construction.

export interface TokenSwatch {
  /** Token name, e.g. "--au-blue-600". */
  token: string
  /** `var(--token)` — what gets written/persisted (follows dark mode). */
  cssValue: string
  label: string
}

export interface ColorRamp {
  family: string
  label: string
  /** `var(--token)` for the family label's color (a middle step). */
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

// ── Primitive ramps (transcribed from the @theme block in globals.css) ────────
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

// ── Semantic tokens (var channel on :root) ────────────────────────────────────
const SEMANTIC_BG: SemanticGroup = {
  label: "Surfaces",
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
  label: "Text",
  tokens: [
    swatch("--fg-primary", "Primary"),
    swatch("--fg-secondary", "Secondary"),
    swatch("--fg-tertiary", "Tertiary"),
    swatch("--fg-muted", "Muted"),
    swatch("--fg-on-inverse", "On inverse"),
  ],
}
const SEMANTIC_BORDER: SemanticGroup = {
  label: "Borders",
  tokens: [
    swatch("--border-subtle", "Subtle"),
    swatch("--border-default", "Default"),
    swatch("--border-strong", "Strong"),
    swatch("--ring-focus", "Focus ring"),
  ],
}
const SEMANTIC_ACCENT: SemanticGroup = {
  label: "Accents",
  tokens: [
    swatch("--accent-brand", "Brand"),
    swatch("--accent-brand-hover", "Brand hover"),
    swatch("--accent-success", "Success"),
    swatch("--accent-danger", "Danger"),
    swatch("--accent-warning", "Warning"),
  ],
}

// ── Scales (radius / shadow) ──────────────────────────────────────────────────
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
// Spacing scale (padding/margin/gap). A curated subset of the --space-* tokens
// in globals.css — it starts at --space-0 (0px) so "shrink/zero the padding" is
// reachable without leaving the token system.
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
  /** Semantic groups relevant to this property (shortcuts at the top). */
  semantic: SemanticGroup[]
  /** Color properties show ALL the ramps below the semantic tokens. */
  showRamps: boolean
  /** Scale (radius/shadow/spacing). */
  scale?: TokenSwatch[]
}

export const STYLE_PROPERTIES: StyleProperty[] = [
  { prop: "color", label: "Text color", kind: "color", semantic: [SEMANTIC_FG, SEMANTIC_ACCENT], showRamps: true },
  { prop: "background-color", label: "Background", kind: "color", semantic: [SEMANTIC_BG, SEMANTIC_ACCENT], showRamps: true },
  { prop: "border-color", label: "Border", kind: "color", semantic: [SEMANTIC_BORDER, SEMANTIC_ACCENT], showRamps: true },
  { prop: "border-radius", label: "Radius", kind: "radius", semantic: [], showRamps: false, scale: RADIUS_SCALE },
  { prop: "box-shadow", label: "Shadow", kind: "shadow", semantic: [], showRamps: false, scale: SHADOW_SCALE },
  { prop: "padding", label: "Padding", kind: "spacing", semantic: [], showRamps: false, scale: SPACING_SCALE },
  { prop: "margin", label: "Margin", kind: "spacing", semantic: [], showRamps: false, scale: SPACING_SCALE },
  { prop: "gap", label: "Gap", kind: "spacing", semantic: [], showRamps: false, scale: SPACING_SCALE },
]

// ── Allow-lists for the apply engine ─────────────────────────────────────────
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

/** Guard: a style op is only honored when the property is known AND the value is
 *  a valid token for it. Keeps any non-token out of the DOM. */
export function isAllowedStyle(prop: string, cssValue: string): boolean {
  if (COLOR_PROPS.has(prop)) return COLOR_VALUES.has(cssValue)
  if (SPACING_PROPS.has(prop)) return SPACING_VALUES.has(cssValue)
  if (prop === "border-radius") return RADIUS_VALUES.has(cssValue)
  if (prop === "box-shadow") return SHADOW_VALUES.has(cssValue)
  return false
}
