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

const AW_BTN = "au-btn--"
const AW_CARD = "au-card--"
const AW_PILL = "au-pill--"
const AW_ALERT = "au-alert--"
const AW_AVATAR = "au-avatar--"
const AW_PROGRESS = "au-progress--"
const AW_TABS = "au-tabs--"
const AW_TOAST = "au-toast--"
const AW_INPUT = "au-input--"
const AW_SHEET = "au-sheet--"
const AW_MODAL = "au-modal--"
const AW_CHAT = "au-chat--"

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
          opt(AW_BTN, "primary", "Primary"),
          opt(AW_BTN, "secondary", "Secondary"),
          opt(AW_BTN, "ghost", "Ghost"),
          opt(AW_BTN, "subtle", "Subtle"),
          opt(AW_BTN, "danger", "Danger"),
          opt(AW_BTN, "ai", "AI"),
          opt(AW_BTN, "ai-spectrum", "AI spectrum"),
          opt(AW_BTN, "ai-outline", "AI outline"),
        ],
      },
      {
        key: "size",
        label: "Tamanho",
        options: [opt(AW_BTN, "sm", "SM"), opt(AW_BTN, "md", "MD"), opt(AW_BTN, "lg", "LG")],
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
          opt(AW_CARD, "default", "Padrão"),
          opt(AW_CARD, "ai", "AI"),
          opt(AW_CARD, "ai-warm", "AI warm"),
          opt(AW_CARD, "ai-copilot", "AI copilot"),
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
          opt(AW_PILL, "neutral", "Neutral"),
          opt(AW_PILL, "ai", "AI"),
          opt(AW_PILL, "beta", "Beta"),
          opt(AW_PILL, "draft", "Draft"),
          opt(AW_PILL, "live", "Live"),
          opt(AW_PILL, "warning", "Warning"),
          opt(AW_PILL, "error", "Error"),
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
          opt(AW_ALERT, "info", "Info"),
          opt(AW_ALERT, "success", "Success"),
          opt(AW_ALERT, "warning", "Warning"),
          opt(AW_ALERT, "danger", "Danger"),
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
        options: [opt(AW_AVATAR, "sm", "SM"), bare("md", "MD"), opt(AW_AVATAR, "lg", "LG")],
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
          opt(AW_PROGRESS, "default", "Padrão"),
          opt(AW_PROGRESS, "success", "Success"),
          opt(AW_PROGRESS, "warning", "Warning"),
          opt(AW_PROGRESS, "danger", "Danger"),
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
          opt(AW_TABS, "segmented", "Segmented"),
          opt(AW_TABS, "standalone", "Standalone"),
          opt(AW_TABS, "underline", "Underline"),
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
          opt(AW_TOAST, "warning", "Warning"),
          opt(AW_TOAST, "error", "Error"),
          opt(AW_TOAST, "ai", "AI"),
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
        options: [bare("default", "Padrão"), opt(AW_INPUT, "dense", "Dense")],
      },
      {
        key: "mode",
        label: "Modo",
        options: [bare("default", "Padrão"), opt(AW_INPUT, "search", "Busca")],
      },
      {
        key: "state",
        label: "Estado",
        options: [
          bare("default", "Normal"),
          opt(AW_INPUT, "invalid", "Inválido"),
          opt(AW_INPUT, "disabled", "Desabilitado"),
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
          opt(AW_SHEET, "wide", "Wide"),
          opt(AW_SHEET, "xwide", "XWide"),
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
        options: [bare("md", "MD"), opt(AW_MODAL, "cockpit", "Cockpit")],
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
          opt(AW_CHAT, "agent", "Agente"),
          opt(AW_CHAT, "user", "Usuário"),
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
