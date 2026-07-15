import type { NavSection } from "../styleguide/navigation"
import { FLOW_GROUPS, FLOW_META } from "./_data/flow-meta"

export const uxFlowNavigation: NavSection[] = [
  {
    title: "Introduction",
    items: [{ name: "Overview", href: "/auis/ux-flow" }],
  },
  ...FLOW_GROUPS.map((group) => ({
    group: "Flows",
    title: group,
    items: FLOW_META.filter((flow) => flow.group === group).map((flow) => ({
      name: flow.title,
      href: `/auis/ux-flow/${flow.slug}`,
    })),
  })),
]
