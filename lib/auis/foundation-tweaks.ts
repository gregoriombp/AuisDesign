export const FOUNDATION_TWEAK_STORAGE_KEY = "au-foundation-tweaks"
export const FOUNDATION_TWEAK_DRAFT_STORAGE_KEY = "au-foundation-tweak-drafts"
export const FOUNDATION_TWEAK_STYLE_ID = "au-foundation-tweaks-style"

export const FOUNDATION_TWEAK_MODES = ["light", "dark"] as const
export type FoundationTweakMode = (typeof FOUNDATION_TWEAK_MODES)[number]

export const FOUNDATION_TWEAK_CATEGORIES = [
  { value: "color", label: "Cores" },
  { value: "chrome", label: "Chrome" },
  { value: "radius", label: "Raios" },
  { value: "spacing", label: "Espaçamento" },
  { value: "layout", label: "Layout" },
  { value: "type", label: "Tipo" },
  { value: "shadow", label: "Sombras" },
  { value: "motion", label: "Motion" },
] as const

export type FoundationTweakCategory =
  (typeof FOUNDATION_TWEAK_CATEGORIES)[number]["value"]

export type FoundationTweakControlType = "color" | "number" | "shadow" | "choice"

export type FoundationTweakChoice = {
  value: string
  label: string
}

export type FoundationTweakControl = {
  category: FoundationTweakCategory
  token: string
  label: string
  description: string
  type: FoundationTweakControlType
  defaults: Record<FoundationTweakMode, string>
  min?: number
  max?: number
  step?: number
  unit?: "px" | "ms" | "em"
  choices?: FoundationTweakChoice[]
  selector?: string
  cssProperty?: string
}

export type FoundationTweakValueMap = Record<
  FoundationTweakMode,
  Record<string, string>
>

export type FoundationTweakStore = {
  version: 1
  values: FoundationTweakValueMap
}

export type FoundationTweakDraft = {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  values: FoundationTweakValueMap
}

const same = (value: string): Record<FoundationTweakMode, string> => ({
  light: value,
  dark: value,
})

export const FOUNDATION_TWEAK_CONTROLS: FoundationTweakControl[] = [
  {
    category: "color",
    token: "--bg-canvas",
    label: "Canvas",
    description: "Fundo-base das páginas.",
    type: "color",
    defaults: { light: "#ffffff", dark: "#0d0d0d" },
  },
  {
    category: "color",
    token: "--bg-surface",
    label: "Surface",
    description: "Faixas, áreas neutras e fundos secundários.",
    type: "color",
    defaults: { light: "#f9f9f9", dark: "#1a1a1a" },
  },
  {
    category: "color",
    token: "--bg-raised",
    label: "Raised",
    description: "Cards, painéis e superfícies elevadas.",
    type: "color",
    defaults: { light: "#ffffff", dark: "#1a1a1a" },
  },
  {
    category: "color",
    token: "--bg-muted",
    label: "Muted",
    description: "Preenchimentos neutros de baixa ênfase.",
    type: "color",
    defaults: { light: "#f2f2f2", dark: "#2f2f2f" },
  },
  {
    category: "color",
    token: "--bg-inverse",
    label: "Inverse",
    description: "Superfície de alto contraste contra o canvas.",
    type: "color",
    defaults: { light: "#0d0d0d", dark: "#ffffff" },
  },
  {
    category: "color",
    token: "--bg-hover",
    label: "Hover",
    description: "Estado hover de itens interativos.",
    type: "color",
    defaults: { light: "#f9f9f9", dark: "#2f2f2f" },
  },
  {
    category: "color",
    token: "--bg-selected",
    label: "Selected",
    description: "Estado selecionado persistente.",
    type: "color",
    defaults: { light: "#f2f2f2", dark: "#454545" },
  },
  {
    category: "color",
    token: "--fg-primary",
    label: "Texto primário",
    description: "Títulos, comandos e conteúdo principal.",
    type: "color",
    defaults: { light: "#0d0d0d", dark: "#ffffff" },
  },
  {
    category: "color",
    token: "--fg-secondary",
    label: "Texto secundário",
    description: "Descrições e metadados de leitura.",
    type: "color",
    defaults: { light: "#5e5e5e", dark: "#b8b8b8" },
  },
  {
    category: "color",
    token: "--fg-tertiary",
    label: "Texto terciário",
    description: "Eyebrows, captions e informação auxiliar.",
    type: "color",
    defaults: { light: "#999999", dark: "#7a7a7a" },
  },
  {
    category: "color",
    token: "--fg-muted",
    label: "Texto muted",
    description: "Texto de apoio com a menor ênfase legível.",
    type: "color",
    defaults: { light: "#b8b8b8", dark: "#5e5e5e" },
  },
  {
    category: "color",
    token: "--fg-on-inverse",
    label: "Texto inverse",
    description: "Texto usado sobre superfícies inversas.",
    type: "color",
    defaults: { light: "#ffffff", dark: "#0d0d0d" },
  },
  {
    category: "color",
    token: "--border-subtle",
    label: "Borda sutil",
    description: "Separadores discretos e divisões internas.",
    type: "color",
    defaults: { light: "#f2f2f2", dark: "#1a1a1a" },
  },
  {
    category: "color",
    token: "--border-default",
    label: "Borda padrão",
    description: "Contorno de cards, inputs e controles.",
    type: "color",
    defaults: { light: "#e5e5e5", dark: "#2f2f2f" },
  },
  {
    category: "color",
    token: "--border-strong",
    label: "Borda forte",
    description: "Estados ativos ou contraste estrutural.",
    type: "color",
    defaults: { light: "#b8b8b8", dark: "#454545" },
  },
  {
    category: "color",
    token: "--ring-focus",
    label: "Focus ring",
    description: "Anel de foco para navegação por teclado.",
    type: "color",
    defaults: { light: "#2f76e6", dark: "#e4e8ee" },
  },
  {
    category: "color",
    token: "--accent-brand",
    label: "Brand",
    description: "Ação primária e acento institucional.",
    type: "color",
    defaults: { light: "#222a36", dark: "#e4e8ee" },
  },
  {
    category: "color",
    token: "--accent-brand-hover",
    label: "Brand hover",
    description: "Estado hover do acento institucional.",
    type: "color",
    defaults: { light: "#141922", dark: "#f4f6f8" },
  },
  {
    category: "color",
    token: "--accent-success",
    label: "Sucesso",
    description: "Estados concluídos, positivos e confirmados.",
    type: "color",
    defaults: { light: "#22a871", dark: "#5bdf9e" },
  },
  {
    category: "color",
    token: "--accent-danger",
    label: "Perigo",
    description: "Estados destrutivos, críticos e erros.",
    type: "color",
    defaults: { light: "#a82222", dark: "#df5b5b" },
  },
  {
    category: "color",
    token: "--accent-warning",
    label: "Atenção",
    description: "Estados pendentes, alertas e revisão.",
    type: "color",
    defaults: { light: "#e6762f", dark: "#f2a95b" },
  },
  {
    category: "chrome",
    token: "--dark-bg",
    label: "Dark background",
    description: "Fundo principal do shell escuro.",
    type: "color",
    defaults: same("#0d0d0d"),
  },
  {
    category: "chrome",
    token: "--dark-bg-raised",
    label: "Dark raised",
    description: "Painéis elevados dentro do shell escuro.",
    type: "color",
    defaults: same("#1a1a1a"),
  },
  {
    category: "chrome",
    token: "--dark-bg-hover",
    label: "Dark hover",
    description: "Hover em navegação e listas no shell escuro.",
    type: "color",
    defaults: same("#2f2f2f"),
  },
  {
    category: "chrome",
    token: "--dark-fg-primary",
    label: "Dark text primary",
    description: "Texto primário em áreas de chrome escuro.",
    type: "color",
    defaults: same("#ffffff"),
  },
  {
    category: "chrome",
    token: "--dark-fg-secondary",
    label: "Dark text secondary",
    description: "Texto secundário em áreas de chrome escuro.",
    type: "color",
    defaults: same("#b8b8b8"),
  },
  {
    category: "chrome",
    token: "--dark-fg-tertiary",
    label: "Dark text tertiary",
    description: "Metadados e labels dentro do shell escuro.",
    type: "color",
    defaults: same("#7a7a7a"),
  },
  {
    category: "chrome",
    token: "--dark-border",
    label: "Dark border",
    description: "Divisórias e strokes do shell escuro.",
    type: "color",
    defaults: same("#2f2f2f"),
  },
  {
    category: "radius",
    token: "--radius-xs",
    label: "Radius XS",
    description: "Badges e elementos compactos.",
    type: "number",
    defaults: same("6px"),
    min: 0,
    max: 16,
    step: 1,
    unit: "px",
  },
  {
    category: "radius",
    token: "--radius-sm",
    label: "Radius SM",
    description: "Controles pequenos.",
    type: "number",
    defaults: same("8px"),
    min: 0,
    max: 20,
    step: 1,
    unit: "px",
  },
  {
    category: "radius",
    token: "--radius-md",
    label: "Radius MD",
    description: "Inputs e selects.",
    type: "number",
    defaults: same("10px"),
    min: 0,
    max: 24,
    step: 1,
    unit: "px",
  },
  {
    category: "radius",
    token: "--radius-lg",
    label: "Radius LG",
    description: "Cards e painéis.",
    type: "number",
    defaults: same("12px"),
    min: 0,
    max: 32,
    step: 1,
    unit: "px",
  },
  {
    category: "radius",
    token: "--radius-xl",
    label: "Radius XL",
    description: "Modais e cards grandes.",
    type: "number",
    defaults: same("16px"),
    min: 0,
    max: 40,
    step: 1,
    unit: "px",
  },
  {
    category: "radius",
    token: "--radius-2xl",
    label: "Radius 2XL",
    description: "Containers principais e áreas hero.",
    type: "number",
    defaults: same("24px"),
    min: 0,
    max: 56,
    step: 1,
    unit: "px",
  },
  {
    category: "spacing",
    token: "--space-2",
    label: "Space 2",
    description: "Espaçamento micro entre controles.",
    type: "number",
    defaults: same("8px"),
    min: 4,
    max: 20,
    step: 1,
    unit: "px",
  },
  {
    category: "spacing",
    token: "--space-3",
    label: "Space 3",
    description: "Respiro compacto entre label e conteúdo.",
    type: "number",
    defaults: same("12px"),
    min: 6,
    max: 28,
    step: 1,
    unit: "px",
  },
  {
    category: "spacing",
    token: "--space-4",
    label: "Space 4",
    description: "Espaçamento base de UI.",
    type: "number",
    defaults: same("16px"),
    min: 8,
    max: 36,
    step: 1,
    unit: "px",
  },
  {
    category: "spacing",
    token: "--space-6",
    label: "Space 6",
    description: "Gaps de cards e seções internas.",
    type: "number",
    defaults: same("24px"),
    min: 12,
    max: 56,
    step: 1,
    unit: "px",
  },
  {
    category: "spacing",
    token: "--space-8",
    label: "Space 8",
    description: "Separação entre blocos.",
    type: "number",
    defaults: same("32px"),
    min: 16,
    max: 72,
    step: 1,
    unit: "px",
  },
  {
    category: "spacing",
    token: "--space-12",
    label: "Space 12",
    description: "Margens largas e respiro de tela.",
    type: "number",
    defaults: same("48px"),
    min: 24,
    max: 96,
    step: 1,
    unit: "px",
  },
  {
    category: "layout",
    token: "--content-narrow",
    label: "Content narrow",
    description: "Largura máxima de páginas de leitura e forms.",
    type: "number",
    defaults: same("720px"),
    min: 560,
    max: 960,
    step: 8,
    unit: "px",
  },
  {
    category: "layout",
    token: "--content-default",
    label: "Content default",
    description: "Largura máxima de páginas mistas.",
    type: "number",
    defaults: same("1200px"),
    min: 960,
    max: 1360,
    step: 8,
    unit: "px",
  },
  {
    category: "layout",
    token: "--content-wide",
    label: "Content wide",
    description: "Largura máxima para telas densas e dashboards.",
    type: "number",
    defaults: same("1440px"),
    min: 1200,
    max: 1720,
    step: 8,
    unit: "px",
  },
  {
    category: "layout",
    token: "--content-px",
    label: "Page padding",
    description: "Padding horizontal interno de containers.",
    type: "number",
    defaults: same("40px"),
    min: 24,
    max: 72,
    step: 4,
    unit: "px",
  },
  {
    category: "layout",
    token: "--content-gutter",
    label: "Content gutter",
    description: "Gap padrão entre cards e blocos.",
    type: "number",
    defaults: same("24px"),
    min: 12,
    max: 56,
    step: 4,
    unit: "px",
  },
  {
    category: "layout",
    token: "--space-18",
    label: "Space 18",
    description: "Respiro máximo usado em layouts maiores.",
    type: "number",
    defaults: same("72px"),
    min: 48,
    max: 120,
    step: 4,
    unit: "px",
  },
  {
    category: "type",
    token: "--display-md-size",
    label: "Display MD",
    description: "Display para momentos hero e editoriais.",
    type: "number",
    defaults: same("64px"),
    min: 44,
    max: 88,
    step: 1,
    unit: "px",
  },
  {
    category: "type",
    token: "--display-sm-size",
    label: "Display SM",
    description: "Display compacto para destaques de produto.",
    type: "number",
    defaults: same("48px"),
    min: 36,
    max: 72,
    step: 1,
    unit: "px",
  },
  {
    category: "type",
    token: "--h1-size",
    label: "H1",
    description: "Título principal de página.",
    type: "number",
    defaults: same("40px"),
    min: 28,
    max: 64,
    step: 1,
    unit: "px",
  },
  {
    category: "type",
    token: "--h2-size",
    label: "H2",
    description: "Título de seção.",
    type: "number",
    defaults: same("32px"),
    min: 22,
    max: 48,
    step: 1,
    unit: "px",
  },
  {
    category: "type",
    token: "--h3-size",
    label: "H3",
    description: "Subtítulo e hierarquia intermediária.",
    type: "number",
    defaults: same("28px"),
    min: 20,
    max: 40,
    step: 1,
    unit: "px",
  },
  {
    category: "type",
    token: "--h4-size",
    label: "H4",
    description: "Títulos internos de cards e painéis.",
    type: "number",
    defaults: same("24px"),
    min: 18,
    max: 34,
    step: 1,
    unit: "px",
  },
  {
    category: "type",
    token: "--h5-size",
    label: "H5",
    description: "Títulos compactos de blocos menores.",
    type: "number",
    defaults: same("20px"),
    min: 16,
    max: 28,
    step: 1,
    unit: "px",
  },
  {
    category: "type",
    token: "--h6-size",
    label: "H6",
    description: "Headings de menor hierarquia.",
    type: "number",
    defaults: same("18px"),
    min: 14,
    max: 24,
    step: 1,
    unit: "px",
  },
  {
    category: "type",
    token: "--body-lg-size",
    label: "Body LG",
    description: "Texto de destaque e leitura ampla.",
    type: "number",
    defaults: same("18px"),
    min: 15,
    max: 24,
    step: 1,
    unit: "px",
  },
  {
    category: "type",
    token: "--body-md-size",
    label: "Body MD",
    description: "Texto padrão de produto.",
    type: "number",
    defaults: same("16px"),
    min: 13,
    max: 20,
    step: 1,
    unit: "px",
  },
  {
    category: "type",
    token: "--body-sm-size",
    label: "Body SM",
    description: "Metadados, descrições e labels.",
    type: "number",
    defaults: same("14px"),
    min: 11,
    max: 18,
    step: 1,
    unit: "px",
  },
  {
    category: "type",
    token: "--body-xs-size",
    label: "Body XS",
    description: "Captions, hints e microcopy.",
    type: "number",
    defaults: same("12px"),
    min: 10,
    max: 15,
    step: 1,
    unit: "px",
  },
  {
    category: "type",
    token: "--mono-md-size",
    label: "Mono MD",
    description: "Código e tokens em tamanho padrão.",
    type: "number",
    defaults: same("14px"),
    min: 11,
    max: 18,
    step: 1,
    unit: "px",
  },
  {
    category: "type",
    token: "--mono-sm-size",
    label: "Mono SM",
    description: "Código compacto, IDs e snippets curtos.",
    type: "number",
    defaults: same("12px"),
    min: 10,
    max: 15,
    step: 1,
    unit: "px",
  },
  {
    category: "type",
    token: "rule-au-eyebrow-transform",
    label: "Eyebrow uppercase",
    description: "Controla se `.au-eyebrow` força all caps.",
    type: "choice",
    defaults: same("uppercase"),
    choices: [
      { value: "uppercase", label: "All caps" },
      { value: "none", label: "Normal" },
      { value: "capitalize", label: "Capitalize" },
    ],
    selector: ".au-eyebrow",
    cssProperty: "text-transform",
  },
  {
    category: "type",
    token: "rule-au-eyebrow-tracking",
    label: "Eyebrow tracking",
    description: "Espaçamento entre letras do micro-label.",
    type: "number",
    defaults: same("0.12em"),
    min: 0,
    max: 0.2,
    step: 0.005,
    unit: "em",
    selector: ".au-eyebrow",
    cssProperty: "letter-spacing",
  },
  {
    category: "type",
    token: "rule-au-eyebrow-weight",
    label: "Eyebrow weight",
    description: "Peso tipográfico dos labels pequenos.",
    type: "number",
    defaults: same("700"),
    min: 300,
    max: 800,
    step: 100,
    selector: ".au-eyebrow",
    cssProperty: "font-weight",
  },
  {
    category: "type",
    token: "rule-heading-weight",
    label: "Heading weight",
    description: "Peso padrão de `h1` a `h6`.",
    type: "number",
    defaults: same("500"),
    min: 300,
    max: 800,
    step: 100,
    selector: "h1, h2, h3, h4, h5, h6",
    cssProperty: "font-weight",
  },
  {
    category: "type",
    token: "rule-heading-tracking",
    label: "Heading tracking",
    description: "Tracking base dos headings.",
    type: "number",
    defaults: same("-0.01em"),
    min: -0.06,
    max: 0.04,
    step: 0.005,
    unit: "em",
    selector: "h1, h2, h3, h4, h5, h6",
    cssProperty: "letter-spacing",
  },
  {
    category: "type",
    token: "rule-h1-tracking",
    label: "H1 tracking",
    description: "Ajuste fino de letter-spacing do H1.",
    type: "number",
    defaults: same("-0.02em"),
    min: -0.08,
    max: 0.04,
    step: 0.005,
    unit: "em",
    selector: "h1",
    cssProperty: "letter-spacing",
  },
  {
    category: "type",
    token: "rule-h2-tracking",
    label: "H2 tracking",
    description: "Ajuste fino de letter-spacing do H2.",
    type: "number",
    defaults: same("-0.015em"),
    min: -0.08,
    max: 0.04,
    step: 0.005,
    unit: "em",
    selector: "h2",
    cssProperty: "letter-spacing",
  },
  {
    category: "type",
    token: "rule-display-weight",
    label: "Display weight",
    description: "Peso das utilities `.display-*`.",
    type: "number",
    defaults: same("300"),
    min: 200,
    max: 700,
    step: 100,
    selector:
      ".display-xxl, .display-xl, .display-lg, .display-md, .display-sm",
    cssProperty: "font-weight",
  },
  {
    category: "type",
    token: "rule-display-tracking",
    label: "Display tracking",
    description: "Espaçamento entre letras das utilities `.display-*`.",
    type: "number",
    defaults: same("-0.025em"),
    min: -0.08,
    max: 0.04,
    step: 0.005,
    unit: "em",
    selector:
      ".display-xxl, .display-xl, .display-lg, .display-md, .display-sm",
    cssProperty: "letter-spacing",
  },
  {
    category: "type",
    token: "rule-body-weight",
    label: "Body weight",
    description: "Peso padrão das utilities `.body-*`.",
    type: "number",
    defaults: same("400"),
    min: 300,
    max: 700,
    step: 100,
    selector: ".body-xl, .body-lg, .body-md, .body-sm, .body-xs",
    cssProperty: "font-weight",
  },
  {
    category: "type",
    token: "rule-body-md-line-height",
    label: "Body MD line-height",
    description: "Altura de linha da leitura padrão.",
    type: "number",
    defaults: same("1.55"),
    min: 1.25,
    max: 1.8,
    step: 0.05,
    selector: ".body-md",
    cssProperty: "line-height",
  },
  {
    category: "type",
    token: "rule-body-sm-tracking",
    label: "Body SM tracking",
    description: "Letter-spacing em textos auxiliares.",
    type: "number",
    defaults: same("0em"),
    min: -0.03,
    max: 0.08,
    step: 0.005,
    unit: "em",
    selector: ".body-sm",
    cssProperty: "letter-spacing",
  },
  {
    category: "shadow",
    token: "--shadow-xs",
    label: "Shadow XS",
    description: "Sombra quase plana para micro elevação.",
    type: "shadow",
    defaults: same("0 1px 2px rgba(0, 0, 0, 0.06)"),
  },
  {
    category: "shadow",
    token: "--shadow-sm",
    label: "Shadow SM",
    description: "Elevação padrão de cards sutis.",
    type: "shadow",
    defaults: same(
      "0 2px 4px rgba(0, 0, 0, 0.06), 0 1px 2px rgba(0, 0, 0, 0.04)",
    ),
  },
  {
    category: "shadow",
    token: "--shadow-md",
    label: "Shadow MD",
    description: "Dropdowns, popovers e painéis destacados.",
    type: "shadow",
    defaults: same(
      "0 4px 12px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0, 0, 0, 0.04)",
    ),
  },
  {
    category: "shadow",
    token: "--shadow-lg",
    label: "Shadow LG",
    description: "Cards altos, modais e superfícies dominantes.",
    type: "shadow",
    defaults: same(
      "0 12px 32px rgba(0, 0, 0, 0.1), 0 4px 8px rgba(0, 0, 0, 0.04)",
    ),
  },
  {
    category: "shadow",
    token: "--shadow-overlay",
    label: "Shadow overlay",
    description: "Overlays e diálogos acima da página.",
    type: "shadow",
    defaults: same("0 24px 64px rgba(0, 0, 0, 0.18)"),
  },
  {
    category: "motion",
    token: "--dur-fast",
    label: "Fast",
    description: "Microinterações e hover.",
    type: "number",
    defaults: same("120ms"),
    min: 80,
    max: 240,
    step: 10,
    unit: "ms",
  },
  {
    category: "motion",
    token: "--dur-base",
    label: "Base",
    description: "Transições padrão de componentes.",
    type: "number",
    defaults: same("180ms"),
    min: 120,
    max: 360,
    step: 10,
    unit: "ms",
  },
  {
    category: "motion",
    token: "--dur-slow",
    label: "Slow",
    description: "Entrada de painéis, overlays e fluxos.",
    type: "number",
    defaults: same("280ms"),
    min: 180,
    max: 560,
    step: 10,
    unit: "ms",
  },
]

export const FOUNDATION_TWEAK_ALLOWED_TOKENS = FOUNDATION_TWEAK_CONTROLS.filter(
  (control) => !control.selector && !control.cssProperty,
).map((control) => control.token)

export const FOUNDATION_TWEAK_RULE_CONTROLS = FOUNDATION_TWEAK_CONTROLS.filter(
  (control) => control.selector && control.cssProperty,
).map((control) => ({
  token: control.token,
  selector: control.selector as string,
  cssProperty: control.cssProperty as string,
}))

const SAFE_VALUE_PATTERN = /^[#(),.%\w\s-]+$/

export function isSafeFoundationTweakValue(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length < 140 &&
    SAFE_VALUE_PATTERN.test(value)
  )
}

function isRuleControl(control: FoundationTweakControl) {
  return Boolean(control.selector && control.cssProperty)
}

function scopeSelectorForMode(selector: string, mode: FoundationTweakMode) {
  if (mode === "light") return selector

  return selector
    .split(",")
    .map((part) => `.dark ${part.trim()}`)
    .join(", ")
}

export function createDefaultFoundationTweakValues(): FoundationTweakValueMap {
  return FOUNDATION_TWEAK_MODES.reduce((acc, mode) => {
    acc[mode] = {}
    for (const control of FOUNDATION_TWEAK_CONTROLS) {
      acc[mode][control.token] = control.defaults[mode]
    }
    return acc
  }, {} as FoundationTweakValueMap)
}

export function mergeFoundationTweakValues(
  input: unknown,
): FoundationTweakValueMap {
  const merged = createDefaultFoundationTweakValues()
  const source =
    input &&
    typeof input === "object" &&
    "values" in input &&
    input.values &&
    typeof input.values === "object"
      ? input.values
      : input

  if (!source || typeof source !== "object") return merged

  for (const mode of FOUNDATION_TWEAK_MODES) {
    const modeValues = (source as Partial<FoundationTweakValueMap>)[mode]
    if (!modeValues || typeof modeValues !== "object") continue

    for (const control of FOUNDATION_TWEAK_CONTROLS) {
      const next = modeValues[control.token]
      if (isSafeFoundationTweakValue(next)) {
        merged[mode][control.token] = next
      }
    }
  }

  return merged
}

export function buildFoundationTweaksCss(
  values: FoundationTweakValueMap,
  options: { changedOnly?: boolean } = {},
): string {
  const defaults = createDefaultFoundationTweakValues()

  const variableBlocks = FOUNDATION_TWEAK_MODES.map((mode) => {
    const lines = FOUNDATION_TWEAK_CONTROLS.flatMap((control) => {
      if (isRuleControl(control)) return []
      const value = values[mode]?.[control.token]
      if (!isSafeFoundationTweakValue(value)) return []
      if (options.changedOnly && value === defaults[mode][control.token]) {
        return []
      }
      return [`  ${control.token}: ${value};`]
    })

    if (lines.length === 0) return ""
    return `${mode === "light" ? ":root" : ".dark"} {\n${lines.join("\n")}\n}`
  })

  const ruleBlocks = FOUNDATION_TWEAK_MODES.flatMap((mode) => {
    const rules = new Map<string, string[]>()

    for (const control of FOUNDATION_TWEAK_CONTROLS) {
      if (!isRuleControl(control)) continue

      const value = values[mode]?.[control.token]
      if (!isSafeFoundationTweakValue(value)) continue
      if (options.changedOnly && value === defaults[mode][control.token]) {
        continue
      }

      const selector = scopeSelectorForMode(control.selector as string, mode)
      const lines = rules.get(selector) ?? []
      lines.push(`  ${control.cssProperty}: ${value};`)
      rules.set(selector, lines)
    }

    return Array.from(rules.entries()).map(
      ([selector, lines]) => `${selector} {\n${lines.join("\n")}\n}`,
    )
  })

  return [...variableBlocks, ...ruleBlocks].filter(Boolean).join("\n\n")
}

export function countFoundationTweakChanges(
  values: FoundationTweakValueMap,
): number {
  const defaults = createDefaultFoundationTweakValues()
  return FOUNDATION_TWEAK_MODES.reduce((count, mode) => {
    return (
      count +
      FOUNDATION_TWEAK_CONTROLS.filter(
        (control) => values[mode]?.[control.token] !== defaults[mode][control.token],
      ).length
    )
  }, 0)
}
