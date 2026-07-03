"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MarkerType,
  Panel,
  Position,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import { AuButton } from "@/components/ui/AuButton"
import { AuPill } from "@/components/ui/AuPill"
import { AuSheet } from "@/components/ui/AuSheet"
import { Icon } from "@/components/ui/Icon"
import type { Project, ProjectScreen } from "../_data/projects"

const COL_W = 300
const ROW_H = 132

const HANDLE: React.CSSProperties = { width: 7, height: 7, border: 0, background: "var(--border-strong)" }
const HANDLE_BRANCH: React.CSSProperties = { width: 7, height: 7, border: 0, background: "var(--au-amber-500)" }

type ShotData = {
  name: string
  step: string
  thumbnail: string
  built: boolean
}

/** Nó-tela: o screenshot do Figma como nó do fluxo. */
function ShotNode({ data }: NodeProps) {
  const d = data as unknown as ShotData
  return (
    <div className="w-[208px] rounded-xl border border-(--border-default) bg-(--bg-raised) p-1.5 shadow-sm">
      <Handle type="target" position={Position.Left} id="l" style={HANDLE} />
      <Handle type="target" position={Position.Top} id="t" style={HANDLE_BRANCH} />
      <div className="relative aspect-video w-full overflow-hidden rounded-md border border-(--border-subtle) bg-(--bg-surface)">
        <Image
          src={d.thumbnail}
          alt={d.name}
          fill
          sizes="208px"
          className="object-cover object-top"
        />
        {d.built && (
          <span className="absolute right-1 top-1">
            <AuPill variant="live">No repo</AuPill>
          </span>
        )}
      </div>
      <div className="flex items-center gap-1.5 px-1 pt-1.5 pb-0.5">
        <span className="truncate text-[11px] font-medium text-(--fg-primary)">
          {d.name}
        </span>
        <span className="ml-auto shrink-0 text-[10px] text-(--fg-tertiary)">
          {d.step}
        </span>
      </div>
      <Handle type="source" position={Position.Right} id="r" style={HANDLE} />
      <Handle type="source" position={Position.Bottom} id="b" style={HANDLE_BRANCH} />
    </div>
  )
}

const nodeTypes = { shot: ShotNode }

function stepNum(step: string): number {
  const m = step.match(/(\d+)/)
  return m ? parseInt(m[1], 10) : 999
}

export function ProjectFlow({ project }: { project: Project }) {
  const [openId, setOpenId] = React.useState<string | null>(null)

  const { initialNodes, initialEdges } = React.useMemo(() => {
    const screens = [...project.screens].sort((a, b) => a.order - b.order)

    // Colunas por etapa (Tela 01..N), linhas = ordem dentro da etapa.
    const steps = Array.from(new Set(screens.map((s) => s.step))).sort(
      (a, b) => stepNum(a) - stepNum(b),
    )
    const colOf = new Map(steps.map((s, i) => [s, i]))
    const rowCursor = new Map<string, number>()

    const initialNodes: Node[] = screens.map((s) => {
      const col = colOf.get(s.step) ?? 0
      const row = rowCursor.get(s.step) ?? 0
      rowCursor.set(s.step, row + 1)
      return {
        id: s.id,
        type: "shot",
        position: { x: col * COL_W, y: row * ROW_H },
        data: {
          name: s.name,
          step: s.step,
          thumbnail: s.thumbnail,
          built: s.status === "built",
        } satisfies ShotData,
      }
    })

    const initialEdges: Edge[] = (project.edges ?? []).map((e, i) => {
      const branch = !!e.branch
      const color = branch ? "var(--au-amber-500)" : "var(--border-strong)"
      return {
        id: `e-${i}`,
        source: e.source,
        target: e.target,
        sourceHandle: branch ? "b" : "r",
        targetHandle: branch ? "t" : "l",
        type: "smoothstep",
        markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16, color },
        style: { stroke: color, strokeWidth: 1.5 },
      }
    })

    return { initialNodes, initialEdges }
  }, [project])

  const [nodes, , onNodesChange] = useNodesState(initialNodes)
  const [edges, , onEdgesChange] = useEdgesState(initialEdges)

  const current = openId
    ? project.screens.find((s) => s.id === openId) ?? null
    : null

  const figmaDeepLink = (s: ProjectScreen) =>
    `https://www.figma.com/design/${project.figmaFileKey}?node-id=${s.figmaNodeId.replace(":", "-")}`

  return (
    <>
      <div className="h-[760px] w-full overflow-hidden rounded-2xl border border-(--border-default) bg-(--bg-canvas)">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={(_, node) => setOpenId(node.id)}
          fitView
          fitViewOptions={{ padding: 0.15 }}
          minZoom={0.1}
          proOptions={{ hideAttribution: true }}
          nodesConnectable={false}
          edgesFocusable={false}
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
          <Controls showInteractive={false} />
          <Panel position="top-left">
            <div className="flex flex-col gap-1.5 rounded-xl border border-(--border-default) bg-(--bg-raised) px-3 py-2 text-[11px] text-(--fg-secondary)">
              <span className="inline-flex items-center gap-2">
                <span className="h-px w-5 bg-(--border-strong)" /> fluxo (etapa → etapa)
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="h-px w-5 bg-(--au-amber-500)" /> branch (mesma etapa)
              </span>
              <span className="text-(--fg-tertiary)">
                Conexões inferidas dos conectores do Figma
              </span>
            </div>
          </Panel>
        </ReactFlow>
      </div>

      <AuSheet
        open={openId !== null}
        onClose={() => setOpenId(null)}
        size="xwide"
        title={current?.name}
        meta={current ? `${current.step} · ${current.section}` : undefined}
      >
        {current && (
          <div className="flex flex-col gap-4">
            <div className="w-full overflow-hidden rounded-lg border border-(--border-subtle) bg-(--bg-surface)">
              <Image
                src={current.thumbnail}
                alt={current.name}
                width={current.w}
                height={current.h}
                className="h-auto w-full"
              />
            </div>
            <div className="flex items-center justify-between gap-3 text-xs text-(--fg-tertiary)">
              <a
                href={figmaDeepLink(current)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-(--fg-secondary) no-underline hover:text-(--fg-primary)"
              >
                Ver no Figma <Icon name="open_in_new" size={14} />
              </a>
              {current.status === "built" && current.builtRoute && (
                <Link href={current.builtRoute} className="no-underline">
                  <AuButton variant="secondary" size="sm" iconRight="open_in_new">
                    Ver no repo
                  </AuButton>
                </Link>
              )}
            </div>
          </div>
        )}
      </AuSheet>
    </>
  )
}
