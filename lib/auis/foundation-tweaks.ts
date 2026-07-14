export const FOUNDATION_TWEAK_STORAGE_KEY = "au-foundation-tweaks"
export const FOUNDATION_TWEAK_DRAFT_STORAGE_KEY = "au-foundation-tweak-drafts"
export const FOUNDATION_TWEAK_STYLE_ID = "au-foundation-tweaks-style"

export const FOUNDATION_TWEAK_MODES = ["light", "dark"] as const
export type FoundationTweakMode = (typeof FOUNDATION_TWEAK_MODES)[number]

export const FOUNDATION_TWEAK_CATEGORIES = [
  { value: "color", label: "Colors" },
  { value: "chrome", label: "Chrome" },
  { value: "radius", label: "Radii" },
  { value: "spacing", label: "Spacing" },
  { value: "layout", label: "Layout" },
  { value: "type", label: "Type" },
  { value: "shadow", label: "Shadows" },
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
    description: "Base background of every page.",
    type: "color",
    defaults: { light: "#ffffff", dark: "#0d0d0d" },
  },
  {
    category: "color",
    token: "--bg-surface",
    label: "Surface",
    description: "Bands, neutral areas and secondary backgrounds.",
    type: "color",
    defaults: { light: "#f9f9f9", dark: "#1a1a1a" },
  },
  {
    category: "color",
    token: "--bg-raised",
    label: "Raised",
    description: "Cards, panels and raised surfaces.",
    type: "color",
    defaults: { light: "#ffffff", dark: "#1a1a1a" },
  },
  {
    category: "color",
    token: "--bg-muted",
    label: "Muted",
    description: "Low-emphasis neutral fills.",
    type: "color",
    defaults: { light: "#f2f2f2", dark: "#2f2f2f" },
  },
  {
    category: "color",
    token: "--bg-inverse",
    label: "Inverse",
    description: "High-contrast surface against the canvas.",
    type: "color",
    defaults: { light: "#0d0d0d", dark: "#ffffff" },
  },
  {
    category: "color",
    token: "--bg-hover",
    label: "Hover",
    description: "Hover state of interactive items.",
    type: "color",
    defaults: { light: "#f9f9f9", dark: "#2f2f2f" },
  },
  {
    category: "color",
    token: "--bg-selected",
    label: "Selected",
    description: "Persistent selected state.",
    type: "color",
    defaults: { light: "#f2f2f2", dark: "#454545" },
  },
  {
    category: "color",
    token: "--fg-primary",
    label: "Primary text",
    description: "Headings, commands and primary content.",
    type: "color",
    defaults: { light: "#0d0d0d", dark: "#ffffff" },
  },
  {
    category: "color",
    token: "--fg-secondary",
    label: "Secondary text",
    description: "Descriptions and reading metadata.",
    type: "color",
    defaults: { light: "#5e5e5e", dark: "#b8b8b8" },
  },
  {
    category: "color",
    token: "--fg-tertiary",
    label: "Tertiary text",
    description: "Eyebrows, captions and supporting information.",
    type: "color",
    defaults: { light: "#999999", dark: "#7a7a7a" },
  },
  {
    category: "color",
    token: "--fg-muted",
    label: "Muted text",
    description: "Supporting text at the lowest legible emphasis.",
    type: "color",
    defaults: { light: "#b8b8b8", dark: "#5e5e5e" },
  },
  {
    category: "color",
    token: "--fg-on-inverse",
    label: "Inverse text",
    description: "Text used on inverse surfaces.",
    type: "color",
    defaults: { light: "#ffffff", dark: "#0d0d0d" },
  },
  {
    category: "color",
    token: "--border-subtle",
    label: "Subtle border",
    description: "Quiet separators and internal divisions.",
    type: "color",
    defaults: { light: "#f2f2f2", dark: "#1a1a1a" },
  },
  {
    category: "color",
    token: "--border-default",
    label: "Default border",
    description: "Outline of cards, inputs and controls.",
    type: "color",
    defaults: { light: "#e5e5e5", dark: "#2f2f2f" },
  },
  {
    category: "color",
    token: "--border-strong",
    label: "Strong border",
    description: "Active states or structural contrast.",
    type: "color",
    defaults: { light: "#b8b8b8", dark: "#454545" },
  },
  {
    category: "color",
    token: "--ring-focus",
    label: "Focus ring",
    description: "Focus ring for keyboard navigation.",
    type: "color",
    defaults: { light: "#2f76e6", dark: "#e4e8ee" },
  },
  {
    category: "color",
    token: "--accent-brand",
    label: "Brand",
    description: "Primary action and brand accent.",
    type: "color",
    defaults: { light: "#222a36", dark: "#e4e8ee" },
  },
  {
    category: "color",
    token: "--accent-brand-hover",
    label: "Brand hover",
    description: "Hover state of the brand accent.",
    type: "color",
    defaults: { light: "#141922", dark: "#f4f6f8" },
  },
  {
    category: "color",
    token: "--accent-success",
    label: "Success",
    description: "Completed, positive and confirmed states.",
    type: "color",
    defaults: { light: "#22a871", dark: "#5bdf9e" },
  },
  {
    category: "color",
    token: "--accent-danger",
    label: "Danger",
    description: "Destructive states, critical states and errors.",
    type: "color",
    defaults: { light: "#a82222", dark: "#df5b5b" },
  },
  {
    category: "color",
    token: "--accent-warning",
    label: "Warning",
    description: "Pending states, alerts and review.",
    type: "color",
    defaults: { light: "#e6762f", dark: "#f2a95b" },
  },
  {
    category: "chrome",
    token: "--dark-bg",
    label: "Dark background",
    description: "Main background of the dark shell.",
    type: "color",
    defaults: same("#0d0d0d"),
  },
  {
    category: "chrome",
    token: "--dark-bg-raised",
    label: "Dark raised",
    description: "Raised panels inside the dark shell.",
    type: "color",
    defaults: same("#1a1a1a"),
  },
  {
    category: "chrome",
    token: "--dark-bg-hover",
    label: "Dark hover",
    description: "Hover on navigation and lists in the dark shell.",
    type: "color",
    defaults: same("#2f2f2f"),
  },
  {
    category: "chrome",
    token: "--dark-fg-primary",
    label: "Dark text primary",
    description: "Primary text in dark chrome areas.",
    type: "color",
    defaults: same("#ffffff"),
  },
  {
    category: "chrome",
    token: "--dark-fg-secondary",
    label: "Dark text secondary",
    description: "Secondary text in dark chrome areas.",
    type: "color",
    defaults: same("#b8b8b8"),
  },
  {
    category: "chrome",
    token: "--dark-fg-tertiary",
    label: "Dark text tertiary",
    description: "Metadata and labels inside the dark shell.",
    type: "color",
    defaults: same("#7a7a7a"),
  },
  {
    category: "chrome",
    token: "--dark-border",
    label: "Dark border",
    description: "Dividers and strokes of the dark shell.",
    type: "color",
    defaults: same("#2f2f2f"),
  },
  {
    category: "radius",
    token: "--radius-xs",
    label: "Radius XS",
    description: "Badges and compact elements.",
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
    description: "Small controls.",
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
    description: "Inputs and selects.",
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
    description: "Cards and panels.",
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
    description: "Modals and large cards.",
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
    description: "Primary containers and hero areas.",
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
    description: "Micro spacing between controls.",
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
    description: "Compact breathing room between label and content.",
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
    description: "Base UI spacing.",
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
    description: "Gaps between cards and inner sections.",
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
    description: "Separation between blocks.",
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
    description: "Wide margins and screen breathing room.",
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
    description: "Max width for reading pages and forms.",
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
    description: "Max width for mixed pages.",
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
    description: "Max width for dense screens and dashboards.",
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
    description: "Inner horizontal padding of containers.",
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
    description: "Default gap between cards and blocks.",
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
    description: "Maximum breathing room used in larger layouts.",
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
    description: "Display for hero and editorial moments.",
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
    description: "Compact display for product highlights.",
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
    description: "Main page title.",
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
    description: "Section title.",
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
    description: "Subtitle and intermediate hierarchy.",
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
    description: "Inner titles of cards and panels.",
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
    description: "Compact titles of smaller blocks.",
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
    description: "Lowest-hierarchy headings.",
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
    description: "Emphasis text and comfortable reading.",
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
    description: "Default product text.",
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
    description: "Metadata, descriptions and labels.",
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
    description: "Captions, hints and microcopy.",
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
    description: "Code and tokens at the default size.",
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
    description: "Compact code, IDs and short snippets.",
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
    description: "Controls whether `.au-eyebrow` forces all caps.",
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
    description: "Letter spacing of the micro-label.",
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
    description: "Type weight of the small labels.",
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
    description: "Default weight of `h1` through `h6`.",
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
    description: "Base tracking of the headings.",
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
    description: "Fine-tunes the H1 letter-spacing.",
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
    description: "Fine-tunes the H2 letter-spacing.",
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
    description: "Weight of the `.display-*` utilities.",
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
    description: "Letter spacing of the `.display-*` utilities.",
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
    description: "Default weight of the `.body-*` utilities.",
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
    description: "Line height of the default reading size.",
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
    description: "Letter spacing on supporting text.",
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
    description: "Almost-flat shadow for micro elevation.",
    type: "shadow",
    defaults: same("0 1px 2px rgba(0, 0, 0, 0.06)"),
  },
  {
    category: "shadow",
    token: "--shadow-sm",
    label: "Shadow SM",
    description: "Default elevation of subtle cards.",
    type: "shadow",
    defaults: same(
      "0 2px 4px rgba(0, 0, 0, 0.06), 0 1px 2px rgba(0, 0, 0, 0.04)",
    ),
  },
  {
    category: "shadow",
    token: "--shadow-md",
    label: "Shadow MD",
    description: "Dropdowns, popovers and floating panels.",
    type: "shadow",
    defaults: same(
      "0 4px 12px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0, 0, 0, 0.04)",
    ),
  },
  {
    category: "shadow",
    token: "--shadow-lg",
    label: "Shadow LG",
    description: "Tall cards, modals and dominant surfaces.",
    type: "shadow",
    defaults: same(
      "0 12px 32px rgba(0, 0, 0, 0.1), 0 4px 8px rgba(0, 0, 0, 0.04)",
    ),
  },
  {
    category: "shadow",
    token: "--shadow-overlay",
    label: "Shadow overlay",
    description: "Overlays and dialogs above the page.",
    type: "shadow",
    defaults: same("0 24px 64px rgba(0, 0, 0, 0.18)"),
  },
  {
    category: "motion",
    token: "--dur-fast",
    label: "Fast",
    description: "Micro-interactions and hover.",
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
    description: "Default component transitions.",
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
    description: "Entrance of panels, overlays and flows.",
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
