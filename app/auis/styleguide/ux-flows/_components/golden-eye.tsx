"use client"

import * as React from "react"
import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  Panel,
  Position,
  ReactFlow,
  useNodesState,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"

import { AuSheet } from "@/components/ui/AuSheet"
import { Icon } from "@/components/ui/Icon"

export type GoldenScenario = {
  id: string
  label: string
  color: string
}

export type GoldenNodeData = {
  step?: string
  title: string
  note?: string
  question?: string
  href?: string
  scenarios: string[]
}

type GoldenNode = Node<GoldenNodeData>

const ScenarioContext = React.createContext<Record<string, GoldenScenario>>({})

function ScenarioDots({ ids }: { ids: string[] }) {
  const scenarios = React.useContext(ScenarioContext)
  return (
    <span className="flex items-center gap-1" aria-label={ids.map((id) => scenarios[id]?.label ?? id).join(", ")}>
      {ids.map((id) => (
        <span
          key={id}
          className="h-2 w-2 rounded-full border border-raised"
          style={{ background: scenarios[id]?.color ?? "var(--fg-tertiary)" }}
          title={scenarios[id]?.label ?? id}
        />
      ))}
    </span>
  )
}

function NodeHandles() {
  return (
    <>
      <Handle type="target" position={Position.Top} id="top" />
      <Handle type="source" position={Position.Bottom} id="bottom" />
      <Handle type="target" position={Position.Left} id="left-target" />
      <Handle type="source" position={Position.Left} id="left" />
      <Handle type="target" position={Position.Right} id="right-target" />
      <Handle type="source" position={Position.Right} id="right" />
    </>
  )
}

function ScreenNode({ data }: NodeProps<GoldenNode>) {
  return (
    <div className="w-52 rounded-lg border border-default bg-raised p-4 shadow-sm">
      <NodeHandles />
      <div className="flex items-center justify-between gap-3">
        <span className="au-eyebrow text-fg-tertiary">{data.step}</span>
        <ScenarioDots ids={data.scenarios} />
      </div>
      <div className="mt-2 text-sm font-semibold text-fg-primary">{data.title}</div>
      {data.note ? <div className="mt-1 text-xs leading-relaxed text-fg-secondary">{data.note}</div> : null}
    </div>
  )
}

function DecisionNode({ data }: NodeProps<GoldenNode>) {
  return (
    <div className="w-60 rounded-lg border border-dashed border-warning bg-raised p-4 shadow-sm">
      <NodeHandles />
      <div className="flex items-center justify-between gap-3">
        <span className="au-eyebrow text-fg-tertiary">{data.step}</span>
        <ScenarioDots ids={data.scenarios} />
      </div>
      <div className="mt-2 text-sm font-semibold text-fg-primary">{data.title}</div>
      {data.question ? <div className="mt-1 text-xs leading-relaxed text-fg-secondary">{data.question}</div> : null}
    </div>
  )
}

const nodeTypes = { screen: ScreenNode, decision: DecisionNode }

export function GoldenEyeDiagram({
  scenarios,
  nodes: canonicalNodes,
  edges,
  height = 820,
}: {
  scenarios: GoldenScenario[]
  nodes: GoldenNode[]
  edges: Edge[]
  height?: number
}) {
  const [focus, setFocus] = React.useState<string>("all")
  const [nodes, , onNodesChange] = useNodesState(canonicalNodes)
  const [preview, setPreview] = React.useState<GoldenNodeData | null>(null)
  const [fullscreen, setFullscreen] = React.useState(false)

  const scenarioMap = React.useMemo(
    () => Object.fromEntries(scenarios.map((scenario) => [scenario.id, scenario])),
    [scenarios],
  )
  const memberships = React.useMemo(
    () => new Map(nodes.map((node) => [node.id, node.data.scenarios])),
    [nodes],
  )
  const renderedNodes = React.useMemo(
    () => nodes.map((node) => ({
      ...node,
      className: focus === "all" || node.data.scenarios.includes(focus)
        ? "opacity-100"
        : "opacity-20 saturate-0",
    })),
    [focus, nodes],
  )
  const renderedEdges = React.useMemo(
    () => edges.map((edge) => {
      const active = focus === "all" || (
        memberships.get(edge.source)?.includes(focus) &&
        memberships.get(edge.target)?.includes(focus)
      )
      return active ? edge : { ...edge, label: undefined, style: { ...edge.style, opacity: 0.12 } }
    }),
    [edges, focus, memberships],
  )

  React.useEffect(() => {
    if (!fullscreen) return
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFullscreen(false)
    }
    window.addEventListener("keydown", close)
    return () => window.removeEventListener("keydown", close)
  }, [fullscreen])

  return (
    <ScenarioContext.Provider value={scenarioMap}>
      <div className={fullscreen ? "fixed inset-0 z-40 bg-canvas p-6" : "relative"}>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setFocus("all")}
            className={focus === "all" ? "rounded-full bg-inverse px-3 py-1.5 text-xs font-medium text-fg-on-inverse" : "rounded-full border border-default bg-raised px-3 py-1.5 text-xs font-medium text-fg-secondary"}
          >
            All scenarios
          </button>
          {scenarios.map((scenario) => (
            <button
              key={scenario.id}
              type="button"
              onClick={() => setFocus(scenario.id)}
              className={focus === scenario.id ? "flex items-center gap-2 rounded-full bg-inverse px-3 py-1.5 text-xs font-medium text-fg-on-inverse" : "flex items-center gap-2 rounded-full border border-default bg-raised px-3 py-1.5 text-xs font-medium text-fg-secondary"}
            >
              <span className="h-2 w-2 rounded-full" style={{ background: scenario.color }} />
              {scenario.label}
            </button>
          ))}
        </div>

        <div className="overflow-hidden rounded-lg border border-subtle" style={{ height: fullscreen ? "calc(100vh - 96px)" : height }}>
          <ReactFlow
            nodes={renderedNodes}
            edges={renderedEdges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onNodeClick={(_, node) => {
              if (node.type === "screen") setPreview(node.data as GoldenNodeData)
            }}
            fitView
            fitViewOptions={{ padding: 0.16 }}
            minZoom={0.35}
            maxZoom={1.5}
            proOptions={{ hideAttribution: true }}
            style={{ background: "var(--bg-muted)" }}
          >
            <Background variant={BackgroundVariant.Dots} gap={24} size={1.5} color="var(--border-default)" />
            <Controls showInteractive={false} />
            <Panel position="top-right">
              <button
                type="button"
                onClick={() => setFullscreen((value) => !value)}
                className="flex h-9 w-9 items-center justify-center rounded-md border border-default bg-raised text-fg-primary shadow-sm"
                aria-label={fullscreen ? "Exit fullscreen" : "Enter fullscreen"}
              >
                <Icon name={fullscreen ? "fullscreen_exit" : "fullscreen"} size={18} />
              </button>
            </Panel>
          </ReactFlow>
        </div>
      </div>

      <AuSheet
        open={preview !== null}
        onClose={() => setPreview(null)}
        title={preview?.title}
        meta="Golden-eye screen preview"
        size="xwide"
      >
        {preview?.href && preview.href !== "#" ? (
          <iframe className="h-full min-h-screen w-full border-0" src={preview.href} title={preview.title} />
        ) : (
          <div className="flex min-h-64 flex-col items-center justify-center gap-3 text-center">
            <Icon name="web_asset_off" size={28} className="text-fg-tertiary" />
            <p className="text-sm text-fg-secondary">No prototype is linked to this screen yet.</p>
          </div>
        )}
      </AuSheet>
    </ScenarioContext.Provider>
  )
}
