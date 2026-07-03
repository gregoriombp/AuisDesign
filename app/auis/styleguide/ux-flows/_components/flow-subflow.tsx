"use client"

import { MarkerType, type Edge, type Node, type NodeProps } from "@xyflow/react"

/* ─────────────────────────────────────────────────────────────────────
 * Inline sub-flow expansion. Instead of navigating away, clicking a purple
 * "outro fluxo" diamond expands the referenced flow's cards INLINE, inside a
 * framed group (like a FigJam frame). Click again to collapse. The expanded
 * cards are a display-only overlay — never part of a saved suggestion.
 * ──────────────────────────────────────────────────────────────────── */

type FlowData = { nodes: Node[]; edges: Edge[] }

// Lazy loaders — dynamic import code-splits each flow; loaded only on expand.
// Register your flows here so "other flow" diamonds can expand them inline:
//   "my-flow": () => import("../my-flow/page").then((m) => ({ nodes: m.NODES, edges: m.EDGES })),
// The flow page must export NODES and EDGES. Empty by default in this
// de-branded snapshot (origin-product flows were removed).
const LOADERS: Record<string, () => Promise<FlowData>> = {}

export function flowSlugFromHref(href: string): string | null {
  const m = href.match(/ux-flows\/([^/?#]+)/)
  return m ? m[1] : null
}

export function isExpandableFlow(slug: string | null): slug is string {
  return !!slug && slug in LOADERS
}

export async function loadFlowData(slug: string): Promise<FlowData | null> {
  const loader = LOADERS[slug]
  if (!loader) return null
  try {
    return await loader()
  } catch (e) {
    console.error("[subflow] load failed:", slug, e)
    return null
  }
}

/* ── Group container node ─────────────────────────────────────────── */

export type SubflowGroupData = {
  label: string
  onOpen: () => void
  onCollapse: () => void
}

export function SubflowGroupNode({ data }: NodeProps<Node<SubflowGroupData>>) {
  return (
    <div
      className="relative h-full w-full rounded-lg border-2 border-dashed border-(--au-purple-300)"
      style={{ background: "color-mix(in srgb, var(--au-purple-100) 55%, transparent)" }}
    >
      <div className="absolute -top-3.5 left-4 flex items-center gap-2 rounded-full bg-(--au-purple-600) px-2.5 py-1 text-white shadow-(--shadow-sm)">
        <svg width="11" height="11" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M3.5 12.5L12.5 3.5M12.5 3.5H6M12.5 3.5V10" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="text-[11px] font-semibold leading-none">{data.label}</span>
        <button
          onClick={(e) => { e.stopPropagation(); data.onOpen() }}
          onPointerDown={(e) => e.stopPropagation()}
          className="text-[10px] font-medium text-white/80 hover:text-white"
          title="Abrir o fluxo completo numa página"
        >
          abrir fluxo →
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); data.onCollapse() }}
          onPointerDown={(e) => e.stopPropagation()}
          className="ml-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full text-white/80 hover:bg-white/20 hover:text-white"
          aria-label="Encolher"
          title="Encolher"
        >
          <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </button>
      </div>
    </div>
  )
}

/* ── Build the expansion (group + prefixed children + bridge edge) ──── */

const HEADER_H = 28
const PAD = 24
const GAP_X = 200
// Rough node footprint so the frame encloses the cards (positions are top-left).
const NODE_W = 240
const NODE_H = 150

export function buildExpansion(
  diamond: Node,
  data: FlowData,
  label: string,
  handlers: { onOpen: () => void; onCollapse: () => void },
): FlowData {
  const src = data.nodes
  if (src.length === 0) return { nodes: [], edges: [] }

  const prefix = `sub:${diamond.id}:`
  const groupId = `${prefix}__group`

  const xs = src.map((n) => n.position.x)
  const ys = src.map((n) => n.position.y)
  const minX = Math.min(...xs)
  const minY = Math.min(...ys)
  const maxX = Math.max(...xs)
  const maxY = Math.max(...ys)

  const groupW = maxX - minX + NODE_W + PAD * 2
  const groupH = maxY - minY + NODE_H + PAD * 2 + HEADER_H
  const groupX = diamond.position.x + GAP_X
  // Anchor the frame top just above the diamond so it grows down-and-right —
  // never up into the parent flow above.
  const groupY = diamond.position.y - 24

  const group: Node = {
    id: groupId,
    type: "subflowGroup",
    position: { x: groupX, y: groupY },
    style: { width: groupW, height: groupH },
    selectable: false,
    draggable: false,
    zIndex: 900,
    data: { label, ...handlers },
  }

  const children: Node[] = src.map((n) => ({
    ...n,
    id: prefix + n.id,
    parentId: groupId,
    extent: "parent" as const,
    selectable: false,
    draggable: false,
    zIndex: 901,
    position: {
      x: n.position.x - minX + PAD,
      y: n.position.y - minY + PAD + HEADER_H,
    },
  }))

  const childEdges: Edge[] = data.edges.map((e) => ({
    ...e,
    id: prefix + e.id,
    source: prefix + e.source,
    target: prefix + e.target,
    selectable: false,
  }))

  // Bridge: diamond → the sub-flow's entry node ("entrada" by convention).
  const entryId = src.some((n) => n.id === "entrada")
    ? prefix + "entrada"
    : children[0]?.id
  const bridge: Edge | null = entryId
    ? {
        id: `${prefix}__bridge`,
        source: diamond.id,
        target: entryId,
        type: "smoothstep",
        animated: true,
        selectable: false,
        style: { stroke: "var(--au-purple-500)", strokeWidth: 1.5, strokeDasharray: "5 3" },
        markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18, color: "var(--au-purple-500)" },
      }
    : null

  return {
    nodes: [group, ...children],
    edges: bridge ? [...childEdges, bridge] : childEdges,
  }
}
