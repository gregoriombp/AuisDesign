// Registro de classes de TIPOGRAFIA do Live Edit (frente 2). Diferente das
// variantes (presas à classe-raiz de um componente Au*), estas classes valem
// pra QUALQUER elemento de texto — escala, peso e alinhamento. Cada grupo é
// mutuamente exclusivo; trocar via classList (só classes que existem no DS).
//
// Curado das @utility do globals.css (body-*/display-*/caption) + utilitários
// padrão do Tailwind (font-*, text-align). Token-safe por curadoria: nada de
// classe arbitrária.

export interface ClassOption {
  value: string
  label: string
  /** Classe aplicada; "" = sem classe (não usado aqui, todos têm classe). */
  className: string
}

export interface ClassGroup {
  key: string
  label: string
  options: ClassOption[]
}

export const TYPOGRAPHY_GROUPS: ClassGroup[] = [
  {
    key: "scale",
    label: "Escala",
    options: [
      { value: "caption", label: "Caption", className: "caption" },
      { value: "body-xs", label: "XS", className: "body-xs" },
      { value: "body-sm", label: "SM", className: "body-sm" },
      { value: "body-md", label: "MD", className: "body-md" },
      { value: "body-lg", label: "LG", className: "body-lg" },
      { value: "body-xl", label: "XL", className: "body-xl" },
      { value: "display-sm", label: "Disp. SM", className: "display-sm" },
      { value: "display-md", label: "Disp. MD", className: "display-md" },
      { value: "display-lg", label: "Disp. LG", className: "display-lg" },
    ],
  },
  {
    key: "weight",
    label: "Peso",
    options: [
      { value: "normal", label: "Normal", className: "font-normal" },
      { value: "medium", label: "Medium", className: "font-medium" },
      { value: "semibold", label: "Semibold", className: "font-semibold" },
      { value: "bold", label: "Bold", className: "font-bold" },
    ],
  },
  {
    key: "align",
    label: "Alinhamento",
    options: [
      { value: "left", label: "Esq.", className: "text-left" },
      { value: "center", label: "Centro", className: "text-center" },
      { value: "right", label: "Dir.", className: "text-right" },
    ],
  },
]

/** Valor atual de um grupo, lido da classList (ou null se nenhum). */
export function currentClassValue(el: Element, group: ClassGroup): string | null {
  for (const o of group.options) {
    if (o.className && el.classList.contains(o.className)) return o.value
  }
  return null
}

/** Payload de uma troca de classe: remove todas as classes do grupo, adiciona a
 *  escolhida. Self-contained (o applier não precisa do registro). */
export function buildClassPayload(group: ClassGroup, value: string) {
  const chosen = group.options.find((o) => o.value === value)
  return {
    group: group.key,
    label: chosen?.label,
    add: chosen?.className ?? "",
    remove: group.options.map((o) => o.className).filter(Boolean),
  }
}
