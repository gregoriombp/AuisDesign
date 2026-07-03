/**
 * Carregador de nós/arestas dos flows — ZEROED.
 *
 * Cada página de flow no styleguide (`/auis/styleguide/ux-flows/<slug>/page.tsx`)
 * exporta `NODES`/`EDGES`. Os flows de exemplo do produto de origem foram removidos;
 * registre aqui `slug → { nodes, edges }` conforme criar flows (ex.: via
 * `auis-create-ux-flow`). Só esta rota importa daqui, então só ela bundla o @xyflow/react.
 */
import type { Edge, Node } from "@xyflow/react"

export type FlowData = { nodes: Node[]; edges: Edge[] }

const FLOW_DATA: Record<string, FlowData> = {}

export function getFlowData(slug: string): FlowData | undefined {
  return FLOW_DATA[slug]
}
