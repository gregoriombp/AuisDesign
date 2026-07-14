// Live Edit variant registry. The Au* components that have variants expose the
// state through a ROOT CLASS in the BEM pattern `au-{x}--{value}`
// (e.g. au-btn--primary, au-btn--lg). So we instrument NO component at all: we
// detect the component from its root class and swap the variant via classList.
// Each axis (variant, size) carries its own options, so switching "variant"
// never touches "size".
//
// Hand-curated from each component's union types + the class families in
// globals.css. The auis-design-system-audit skill can flag drift between this
// registry and the CSS.

export interface VariantOption {
  value: string
  label: string
  /** Class applied; "" = the default option (removes the others, adds nothing). */
  className: string
}

export interface VariantAxis {
  key: string
  label: string
  options: VariantOption[]
}

export interface ComponentSpec {
  component: string
  /** Root class that identifies an instance in the DOM. */
  rootClass: string
  label: string
  axes: VariantAxis[]
}

function opt(prefix: string, value: string, label: string): VariantOption {
  return { value, label, className: value === "default" ? "" : `${prefix}${value}` }
}

// An option that is the component's default and carries NO modifier class, but
// whose prop value is real (e.g. AuModal size="md" → no `au-modal--md`).
function bare(value: string, label: string): VariantOption {
  return { value, label, className: "" }
}

const AU_BTN = "au-btn--"
const AU_CARD = "au-card--"
const AU_PILL = "au-pill--"
const AU_ALERT = "au-alert--"
const AU_PROGRESS = "au-progress--"
const AU_TABS = "au-tabs--"
const AU_TOAST = "au-toast--"
const AU_INPUT = "au-input--"
const AU_SHEET = "au-sheet--"
const AU_MODAL = "au-modal--"

export const COMPONENT_REGISTRY: ComponentSpec[] = [
  {
    component: "AuButton",
    rootClass: "au-btn",
    label: "Button",
    axes: [
      {
        key: "variant",
        label: "Variant",
        options: [
          opt(AU_BTN, "primary", "Primary"),
          opt(AU_BTN, "secondary", "Secondary"),
          opt(AU_BTN, "ghost", "Ghost"),
          opt(AU_BTN, "subtle", "Subtle"),
          opt(AU_BTN, "danger", "Danger"),
          opt(AU_BTN, "ai", "AI"),
          opt(AU_BTN, "ai-spectrum", "AI spectrum"),
          opt(AU_BTN, "ai-outline", "AI outline"),
        ],
      },
      {
        key: "size",
        label: "Size",
        options: [opt(AU_BTN, "sm", "SM"), opt(AU_BTN, "md", "MD"), opt(AU_BTN, "lg", "LG")],
      },
    ],
  },
  {
    component: "AuCard",
    rootClass: "au-card",
    label: "Card",
    axes: [
      {
        key: "variant",
        label: "Variant",
        options: [
          opt(AU_CARD, "default", "Default"),
          opt(AU_CARD, "ai", "AI"),
          opt(AU_CARD, "ai-warm", "AI warm"),
          opt(AU_CARD, "ai-cool", "AI cool"),
        ],
      },
    ],
  },
  {
    component: "AuPill",
    rootClass: "au-pill",
    label: "Pill",
    axes: [
      {
        key: "variant",
        label: "Variant",
        options: [
          opt(AU_PILL, "neutral", "Neutral"),
          opt(AU_PILL, "ai", "AI"),
          opt(AU_PILL, "beta", "Beta"),
          opt(AU_PILL, "draft", "Draft"),
          opt(AU_PILL, "live", "Live"),
          opt(AU_PILL, "warning", "Warning"),
          opt(AU_PILL, "error", "Error"),
        ],
      },
    ],
  },
  {
    component: "AuAlert",
    rootClass: "au-alert",
    label: "Alert",
    axes: [
      {
        key: "variant",
        label: "Variant",
        options: [
          opt(AU_ALERT, "info", "Info"),
          opt(AU_ALERT, "success", "Success"),
          opt(AU_ALERT, "warning", "Warning"),
          opt(AU_ALERT, "danger", "Danger"),
        ],
      },
    ],
  },
  {
    component: "AuProgress",
    rootClass: "au-progress",
    label: "Progress",
    axes: [
      {
        key: "variant",
        label: "Variant",
        options: [
          opt(AU_PROGRESS, "default", "Default"),
          opt(AU_PROGRESS, "success", "Success"),
          opt(AU_PROGRESS, "warning", "Warning"),
          opt(AU_PROGRESS, "danger", "Danger"),
        ],
      },
    ],
  },
  {
    component: "AuTabs",
    rootClass: "au-tabs",
    label: "Tabs",
    axes: [
      {
        key: "variant",
        label: "Variant",
        options: [
          opt(AU_TABS, "segmented", "Segmented"),
          opt(AU_TABS, "standalone", "Standalone"),
          opt(AU_TABS, "underline", "Underline"),
        ],
      },
    ],
  },
  {
    component: "AuToast",
    rootClass: "au-toast",
    label: "Toast",
    axes: [
      {
        key: "variant",
        label: "Variant",
        options: [
          bare("default", "Default"),
          opt(AU_TOAST, "warning", "Warning"),
          opt(AU_TOAST, "error", "Error"),
          opt(AU_TOAST, "ai", "AI"),
        ],
      },
    ],
  },
  {
    component: "AuInput",
    rootClass: "au-input",
    label: "Input",
    axes: [
      {
        key: "density",
        label: "Density",
        options: [bare("default", "Default"), opt(AU_INPUT, "dense", "Dense")],
      },
      {
        key: "mode",
        label: "Mode",
        options: [bare("default", "Default"), opt(AU_INPUT, "search", "Search")],
      },
      {
        key: "state",
        label: "State",
        options: [
          bare("default", "Normal"),
          opt(AU_INPUT, "invalid", "Invalid"),
          opt(AU_INPUT, "disabled", "Disabled"),
        ],
      },
    ],
  },
  {
    component: "AuSheet",
    rootClass: "au-sheet",
    label: "Sheet",
    axes: [
      {
        key: "size",
        label: "Size",
        options: [
          bare("default", "Default"),
          opt(AU_SHEET, "wide", "Wide"),
          opt(AU_SHEET, "xwide", "XWide"),
        ],
      },
    ],
  },
  {
    component: "AuModal",
    rootClass: "au-modal",
    label: "Modal",
    axes: [
      {
        key: "size",
        label: "Size",
        options: [bare("md", "MD"), opt(AU_MODAL, "cockpit", "Cockpit")],
      },
    ],
  },
]

const BY_ROOT = new Map(COMPONENT_REGISTRY.map((s) => [s.rootClass, s]))

/** Walk up from the element to the nearest Au* component instance. */
export function detectComponent(
  el: Element,
): { spec: ComponentSpec; rootEl: Element } | null {
  let node: Element | null = el
  while (node && node !== document.body) {
    for (const cls of Array.from(node.classList)) {
      const spec = BY_ROOT.get(cls)
      if (spec) return { spec, rootEl: node }
    }
    node = node.parentElement
  }
  return null
}

/** Current value of an axis, read from the root's classList (or the default). */
export function currentAxisValue(rootEl: Element, axis: VariantAxis): string | null {
  for (const o of axis.options) {
    if (o.className && rootEl.classList.contains(o.className)) return o.value
  }
  const def = axis.options.find((o) => o.className === "")
  return def ? def.value : null
}

/** Build the payload of a variant swap: remove every class in the axis, add the
 *  chosen one. Self-contained (the applier doesn't need the registry). */
export function buildVariantPayload(axis: VariantAxis, value: string) {
  const chosen = axis.options.find((o) => o.value === value)
  return {
    axis: axis.key,
    value,
    label: chosen?.label,
    remove: axis.options.map((o) => o.className).filter(Boolean),
    add: chosen?.className || "",
  }
}
