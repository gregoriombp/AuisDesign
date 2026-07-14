// Live Edit TYPOGRAPHY class registry. Unlike variants (bound to an Au*
// component's root class), these classes apply to ANY text element — scale,
// weight and alignment. Each group is mutually exclusive; swapping happens via
// classList (only classes that exist in the design system).
//
// Curated from the @utility rules in globals.css (body-*/display-*/caption) plus
// standard Tailwind utilities (font-*, text-align). Token-safe by curation: no
// arbitrary classes.

export interface ClassOption {
  value: string
  label: string
  /** Class applied; "" = no class (unused here — every option has one). */
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
    label: "Scale",
    options: [
      { value: "caption", label: "Caption", className: "caption" },
      { value: "body-xs", label: "XS", className: "body-xs" },
      { value: "body-sm", label: "SM", className: "body-sm" },
      { value: "body-md", label: "MD", className: "body-md" },
      { value: "body-lg", label: "LG", className: "body-lg" },
      { value: "body-xl", label: "XL", className: "body-xl" },
      { value: "display-sm", label: "Display SM", className: "display-sm" },
      { value: "display-md", label: "Display MD", className: "display-md" },
      { value: "display-lg", label: "Display LG", className: "display-lg" },
    ],
  },
  {
    key: "weight",
    label: "Weight",
    options: [
      { value: "normal", label: "Normal", className: "font-normal" },
      { value: "medium", label: "Medium", className: "font-medium" },
      { value: "semibold", label: "Semibold", className: "font-semibold" },
      { value: "bold", label: "Bold", className: "font-bold" },
    ],
  },
  {
    key: "align",
    label: "Alignment",
    options: [
      { value: "left", label: "Left", className: "text-left" },
      { value: "center", label: "Center", className: "text-center" },
      { value: "right", label: "Right", className: "text-right" },
    ],
  },
]

/** Current value of a group, read from the classList (or null when none). */
export function currentClassValue(el: Element, group: ClassGroup): string | null {
  for (const o of group.options) {
    if (o.className && el.classList.contains(o.className)) return o.value
  }
  return null
}

/** Payload of a class swap: remove every class in the group, add the chosen one.
 *  Self-contained (the applier doesn't need the registry). */
export function buildClassPayload(group: ClassGroup, value: string) {
  const chosen = group.options.find((o) => o.value === value)
  return {
    group: group.key,
    label: chosen?.label,
    add: chosen?.className ?? "",
    remove: group.options.map((o) => o.className).filter(Boolean),
  }
}
