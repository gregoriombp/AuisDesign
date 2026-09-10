/**
 * Lightweight metadata for the UX flows — the single source for the sidebar
 * (`../navigation.ts`), the hub gallery (`../page.tsx`) and for flow titles
 * outside the hub (e.g. the Review Bridge suggestions panel).
 *
 * Deliberately does NOT import the flow pages (they pull `@xyflow/react`
 * through the FlowDiagram) — strings only, so the gallery and external
 * consumers keep light bundles.
 *
 * Add one entry per flow page under `app/auis/ux-flow/<slug>/page.tsx`. The
 * `auis-create-ux-flow` and `auis-create-ux-flow-golden-eye` skills register
 * the entry for you.
 */

export type FlowGroup = "Examples" | (string & {})

export type FlowMeta = {
  slug: string
  title: string
  description: string
  group: FlowGroup
}

export const FLOW_META: FlowMeta[] = [
  {
    slug: "example",
    title: "Example flow",
    description:
      "A small, product-neutral reference: screen nodes, one decision, two branches and a convergence — with the real flow editor, comments and suggestions.",
    group: "Examples",
  },
  {
    slug: "example-golden-eye",
    title: "Golden-eye example",
    description:
      "Two journeys compiled into a single graph with a focus lens per scenario, shared-screen dots, click-to-open previews and state deep links.",
    group: "Examples",
  },
]

export const FLOW_GROUPS: FlowGroup[] = ["Examples"]

export function getFlowMeta(slug: string): FlowMeta | undefined {
  return FLOW_META.find((f) => f.slug === slug)
}
