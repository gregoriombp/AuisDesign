/**
 * Lightweight metadata for the styleguide's UX flows (ZEROED).
 *
 * The origin product's sample flows were removed. This is the engine's API with
 * an empty list — populate it as you create flows (e.g. via
 * `auis-create-ux-flow` / `auis-pg-create-flow`), adding an entry here and the
 * flow-data in `[slug]/flow-data.ts`.
 *
 * `screens` = screen count ("screen" nodes); `updatedAt` = last update.
 */

export type FlowGroup = string

export type FlowMeta = {
  slug: string
  title: string
  description: string
  group: FlowGroup
  /** Canvas height used on the styleguide page — reused in the viewer. */
  height: number
  /** Screens ("screen" nodes) in the flow. */
  screens: number
  /** Last update recorded in the page's `updates[]`. */
  updatedAt: string
}

export const FLOW_META: FlowMeta[] = []

export const FLOW_GROUPS: FlowGroup[] = []

export function getFlowMeta(slug: string): FlowMeta | undefined {
  return FLOW_META.find((f) => f.slug === slug)
}
