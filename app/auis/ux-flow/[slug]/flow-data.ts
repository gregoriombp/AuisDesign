/**
 * Node/edge loader for the flows — ZEROED.
 *
 * Every flow page in the styleguide (`/auis/styleguide/ux-flows/<slug>/page.tsx`)
 * exports `NODES`/`EDGES`. The origin product's sample flows were removed;
 * register `slug → { nodes, edges }` here as you create flows (e.g. via
 * `auis-create-ux-flow`). Only this route imports from here, so only it bundles
 * @xyflow/react.
 */
import type { Edge, Node } from "@xyflow/react"

export type FlowData = { nodes: Node[]; edges: Edge[] }

const FLOW_DATA: Record<string, FlowData> = {}

export function getFlowData(slug: string): FlowData | undefined {
  return FLOW_DATA[slug]
}
