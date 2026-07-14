// Registro de variantes do Live Edit. Os componentes Au* que têm variante
// expõem o estado por uma CLASSE-RAIZ no padrão BEM `au-{x}--{valor}`
// (ex.: au-btn--primary, au-btn--lg). Então NÃO instrumentamos componente
// nenhum: detectamos o componente pela classe-raiz e trocamos a variante via
// classList. Cada eixo (variante, tamanho) carrega suas próprias opções, então
// trocar "variante" nunca mexe em "tamanho".
//
// Curado à mão a partir das union types de cada componente + das famílias de
// classe no globals.css. A skill auis-design-system-audit pode sinalizar
// drift entre este registro e o CSS.

export interface VariantOption {
  value: string
  label: string
  /** Classe aplicada; "" = opção default (remove as outras, não adiciona nada). */
  className: string
}

export interface VariantAxis {
  key: string
  label: string
  options: VariantOption[]
}

export interface ComponentSpec {
  component: string
  /** Classe-raiz que identifica uma instância no DOM. */
  rootClass: string
  label: string
  axes: VariantAxis[]
}

function opt(prefix: string, value: string, label: string): VariantOption {
  return { value, label, className: value === "default" ? "" : `${prefix}${value}` }
}

// Opção que é o default do componente e NÃO carrega classe modificadora, mas
// cujo valor de prop é real (ex.: AuAvatar size="md" → sem `au-avatar--md`).
function bare(value: string, label: string): VariantOption {
  return { value, label, className: "" }
}

const AU_BTN = "au-btn--"
const AU_CARD = "au-card--"
const AU_PILL = "au-pill--"
const AU_ALERT = "au-alert--"
const AU_AVATAR = "au-avatar--"
const AU_PROGRESS = "au-progress--"
const AU_TABS = "au-tabs--"
const AU_TOAST = "au-toast--"
const AU_INPUT = "au-input--"
const AU_SHEET = "au-sheet--"
const AU_MODAL = "au-modal--"
const AU_CHAT = "au-chat--"

export const COMPONENT_REGISTRY: ComponentSpec[] = [
  {
    component: "AuButton",
    rootClass: "au-btn",
    label: "Botão",
    axes: [
      {
        key: "variant",
        label: "Variante",
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
        label: "Tamanho",
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
        label: "Variante",
        options: [
          opt(AU_CARD, "default", "Padrão"),
          opt(AU_CARD, "ai", "AI"),
          opt(AU_CARD, "ai-warm", "AI warm"),
          opt(AU_CARD, "ai-copilot", "AI copilot"),
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
        label: "Variante",
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
        label: "Variante",
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
    component: "AuAvatar",
    rootClass: "au-avatar",
    label: "Avatar",
    axes: [
      {
        key: "size",
        label: "Tamanho",
        // AuAvatarSize = "sm" | "md" | "lg"; "md" é o default e não tem classe
        // (`size !== "md" && au-avatar--${size}`).
        options: [opt(AU_AVATAR, "sm", "SM"), bare("md", "MD"), opt(AU_AVATAR, "lg", "LG")],
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
        label: "Variante",
        options: [
          opt(AU_PROGRESS, "default", "Padrão"),
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
        label: "Variante",
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
        label: "Variante",
        options: [
          bare("default", "Padrão"),
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
        label: "Densidade",
        options: [bare("default", "Padrão"), opt(AU_INPUT, "dense", "Dense")],
      },
      {
        key: "mode",
        label: "Modo",
        options: [bare("default", "Padrão"), opt(AU_INPUT, "search", "Busca")],
      },
      {
        key: "state",
        label: "Estado",
        options: [
          bare("default", "Normal"),
          opt(AU_INPUT, "invalid", "Inválido"),
          opt(AU_INPUT, "disabled", "Desabilitado"),
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
        label: "Tamanho",
        options: [
          bare("default", "Padrão"),
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
        label: "Tamanho",
        options: [bare("md", "MD"), opt(AU_MODAL, "cockpit", "Cockpit")],
      },
    ],
  },
  {
    component: "AuChatBubble",
    rootClass: "au-chat",
    label: "Chat bubble",
    axes: [
      {
        key: "author",
        label: "Autor",
        options: [
          opt(AU_CHAT, "agent", "Agente"),
          opt(AU_CHAT, "user", "Usuário"),
        ],
      },
    ],
  },
]

const BY_ROOT = new Map(COMPONENT_REGISTRY.map((s) => [s.rootClass, s]))

/** Sobe do elemento até achar a instância de componente Au* mais próxima. */
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

/** Valor atual de um eixo, lido da classList do root (ou a opção default). */
export function currentAxisValue(rootEl: Element, axis: VariantAxis): string | null {
  for (const o of axis.options) {
    if (o.className && rootEl.classList.contains(o.className)) return o.value
  }
  const def = axis.options.find((o) => o.className === "")
  return def ? def.value : null
}

/** Monta o payload de uma troca de variante: remove todas as classes do eixo,
 *  adiciona a escolhida. Self-contained (o applier não precisa do registro). */
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
