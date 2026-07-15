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

// Auis styleguide navigation. Layer A documents the builder itself; append the
// user's Layer B component families after these sections as they are created.
export const navigation: NavSection[] = [
  {
    title: "Introduction",
    items: [
      { name: "Overview", href: "/auis/styleguide" },
    ],
  },
  {
    group: "Foundation",
    title: "Design foundations",
    items: [
      { name: "Color", href: "/auis/styleguide/foundation/color" },
      { name: "Typography", href: "/auis/styleguide/foundation/typography" },
      { name: "Spacing", href: "/auis/styleguide/foundation/spacing" },
      { name: "Radius", href: "/auis/styleguide/foundation/radius" },
      { name: "Shadows", href: "/auis/styleguide/foundation/shadows" },
      { name: "Motion", href: "/auis/styleguide/foundation/motion" },
      { name: "Iconography", href: "/auis/styleguide/foundation/iconography" },
      { name: "Accessibility", href: "/auis/styleguide/foundation/accessibility" },
    ],
  },
  {
    group: "Design system",
    title: "Primitives",
    items: [
      { name: "Button", href: "/auis/styleguide/components/au-button" },
      { name: "Input and field", href: "/auis/styleguide/components/au-input" },
      { name: "Checkbox", href: "/auis/styleguide/components/au-checkbox" },
      { name: "Toggle", href: "/auis/styleguide/components/au-toggle" },
      { name: "Slider", href: "/auis/styleguide/components/au-slider" },
      { name: "Pill", href: "/auis/styleguide/components/au-pill" },
      { name: "Progress", href: "/auis/styleguide/components/au-progress" },
      { name: "Alert", href: "/auis/styleguide/components/au-alert" },
      { name: "Toast", href: "/auis/styleguide/components/au-toast" },
      { name: "Empty state", href: "/auis/styleguide/components/au-empty" },
      { name: "Tabs", href: "/auis/styleguide/components/au-tabs" },
      { name: "Dropdown menu", href: "/auis/styleguide/components/au-dropdown-menu" },
      { name: "Breadcrumb", href: "/auis/styleguide/components/au-breadcrumb" },
      { name: "Icon", href: "/auis/styleguide/components/icon" },
    ],
  },
  {
    group: "Design system",
    title: "Components",
    items: [
      { name: "Card", href: "/auis/styleguide/components/au-card" },
      { name: "Stat card", href: "/auis/styleguide/components/au-stat-card" },
      { name: "Table", href: "/auis/styleguide/components/au-table" },
      { name: "Modal", href: "/auis/styleguide/components/au-modal" },
      { name: "Sheet", href: "/auis/styleguide/components/au-sheet" },
      { name: "Breadcrumbs bar", href: "/auis/styleguide/components/au-breadcrumbs-bar" },
    ],
  },
  {
    group: "Auis",
    title: "UX flows",
    items: [
      { name: "Example flow", href: "/auis/styleguide/ux-flows/example" },
      { name: "Golden-eye example", href: "/auis/styleguide/ux-flows/example-golden-eye" },
    ],
  },
  {
    group: "Auis",
    title: "Builder components",
    items: [
      { name: "Auis logo", href: "/auis/styleguide/components/au-logo" },
      { name: "Mention chip", href: "/auis/styleguide/components/au-mention-chip" },
      { name: "Mention menu", href: "/auis/styleguide/components/au-mention-menu" },
      { name: "About Review Mode", href: "/auis/styleguide/foundation/review-mode" },
      { name: "Inbox", href: "/auis/styleguide/review" },
    ],
  },
]
