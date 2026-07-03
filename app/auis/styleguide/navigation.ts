export interface NavItem {
  name: string
  href: string
  /** Hidden search terms that should route to this canonical page. */
  aliases?: string[]
  children?: NavItem[]
}

export interface NavSection {
  /** Optional super-category. Consecutive sections that share the same `group`
   *  render under one bigger heading — a tier above the section title. */
  group?: string
  title: string
  items: NavItem[]
}

// Auis — styleguide navigation (ZEROED template).
//
// The origin design system's catalog (~90 component showcases + foundation/brand
// pages) was intentionally NOT extracted — it belonged to the source product.
// Populate this as you build YOUR design system:
//   • `auis-foundation` bootstraps the foundations (color, type, spacing, …)
//   • `auis-component`  adds a component + its showcase + an entry here
//
// Keep links pointing only to pages that actually exist, or the sidebar 404s.
export const navigation: NavSection[] = [
  {
    title: "Introdução",
    items: [
      { name: "Visão geral", href: "/auis/styleguide" },
    ],
  },
  {
    group: "Auis",
    title: "Review Mode",
    items: [
      { name: "Sobre o Review Mode", href: "/auis/styleguide/foundation/review-mode" },
      { name: "Inbox", href: "/auis/styleguide/review" },
    ],
  },

  // ── Populate below as you build (templates) ──────────────────────────────
  //
  // Foundations (via `auis-foundation`):
  // {
  //   group: "Base",
  //   title: "Foundations",
  //   items: [
  //     { name: "Cor", href: "/auis/styleguide/foundation/color" },
  //     { name: "Tipografia", href: "/auis/styleguide/foundation/typography" },
  //   ],
  // },
  //
  // Components (each `auis-component` run appends one entry):
  // {
  //   group: "Design System",
  //   title: "Componentes",
  //   items: [
  //     { name: "Button", href: "/auis/styleguide/components/au-button" },
  //   ],
  // },
]
