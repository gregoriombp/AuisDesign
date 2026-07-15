"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent } from "react"
import {
  addEdge,
  Background,
  BackgroundVariant,
  ControlButton,
  Controls,
  Handle,
  MarkerType,
  Panel,
  Position,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
  type NodeProps,
  type ReactFlowInstance,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"

import { useRouter } from "next/navigation"

import { AuSheet } from "@/components/ui/AuSheet"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  CommentNode,
  commentMarkerNode,
  FlowCommentComposer,
  FlowCommentThread,
  useFlowComments,
  type CommentTarget,
  type ScreenPoint,
} from "./flow-comments"
import {
  buildExpansion,
  flowSlugFromHref,
  isExpandableFlow,
  loadFlowData,
  SubflowGroupNode,
} from "./flow-subflow"
import type { ReviewComment } from "@/components/auis-review/types"

/* ─────────────────────────────────────────────────────────────────────
 * Suggestions API — same-origin route (app/api/flow-suggestions) backed by
 * flow-bridge/data/*.json. No separate server, no token, no setup: the editor
 * always works, and Claude reads the suggestions straight from the repo file.
 * ──────────────────────────────────────────────────────────────────── */

const SUGGESTIONS_API = "/api/flow-suggestions"

/* ─────────────────────────────────────────────────────────────────────
 * Shared types
 * ──────────────────────────────────────────────────────────────────── */

export type ScreenData = {
  step: string
  title: string
  href: string
  note?: string
}

export type DecisionData = {
  step: string
  title: string
  question: string
}

export type SuggestionStatus = "open" | "in_review" | "applied" | "discarded"

export type SuggestionActor = {
  kind: "agent" | "user"
  id: string
  name: string
}

export type Suggestion = {
  id: string
  schemaVersion: 1
  flow: string
  description: string
  createdAt: number
  updatedAt: number
  authorName?: string
  status: SuggestionStatus
  resolution?: { actor: SuggestionActor; at: number; summary: string }
  nodes: Node[]
  edges: Edge[]
}

const USER_ACTOR: SuggestionActor = { kind: "user", id: "user", name: "User" }

/* ─────────────────────────────────────────────────────────────────────
 * Editor context — lets nodes know if we're in edit mode and how to
 * trigger the inline edit modal from inside their own UI.
 * ──────────────────────────────────────────────────────────────────── */

type EditorCtx = {
  mode: "view" | "edit"
  /** Patch a node's data inline (title/step/note/question/href). */
  onUpdateNodeData: (id: string, patch: Partial<ScreenData & DecisionData>) => void
  onPreviewScreen: (data: ScreenData) => void
  /** A just-added node id — its title auto-enters edit so you can type at once. */
  autoEditId: string | null
}

const FlowEditorContext = createContext<EditorCtx>({
  mode: "view",
  onUpdateNodeData: () => {},
  onPreviewScreen: () => {},
  autoEditId: null,
})

/* ─────────────────────────────────────────────────────────────────────
 * InlineText — FigJam-style on-canvas editing. Double-click any card text to
 * edit it in place. `nodrag`/`nopan` so editing never drags the node or pans.
 * ──────────────────────────────────────────────────────────────────── */

function InlineText({
  value,
  mode,
  onCommit,
  multiline = false,
  placeholder,
  className = "",
  inputClassName = "",
  autoEdit = false,
}: {
  value: string
  mode: "view" | "edit"
  onCommit: (next: string) => void
  multiline?: boolean
  placeholder?: string
  className?: string
  inputClassName?: string
  /** Start in edit mode (used to auto-focus a just-added card). */
  autoEdit?: boolean
}) {
  // Initial editing state derived from autoEdit (no prop→state sync effect).
  const [editing, setEditing] = useState(autoEdit)
  const [draft, setDraft] = useState(value)
  const inputRef = useRef<HTMLInputElement>(null)
  const areaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!editing) return
    const el = multiline ? areaRef.current : inputRef.current
    el?.focus()
    el?.select()
  }, [editing, multiline])

  const startEditing = () => {
    setDraft(value)
    setEditing(true)
  }

  if (mode !== "edit") {
    return value ? <span className={className}>{value}</span> : null
  }

  const commit = () => {
    setEditing(false)
    const next = draft.trim()
    if (next !== value) onCommit(next)
  }

  if (!editing) {
    return (
      <span
        className={`${className} cursor-text rounded-xs -mx-1 px-1 hover:bg-(--au-blue-100)`}
        onDoubleClick={(e) => { e.stopPropagation(); startEditing() }}
        title="Double-click to edit"
      >
        {value || <span className="italic text-(--fg-tertiary)">{placeholder ?? "…"}</span>}
      </span>
    )
  }

  const onKeyDown = (e: ReactKeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault()
      e.stopPropagation()
      setDraft(value)
      setEditing(false)
      return
    }
    if (e.key === "Enter" && (!multiline || e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      commit()
      return
    }
    e.stopPropagation()
  }
  const cls = `nodrag nopan w-full rounded-xs border border-(--au-blue-400) bg-(--bg-canvas) px-1 py-0.5 outline-hidden ${inputClassName}`

  return multiline ? (
    <textarea
      ref={areaRef}
      value={draft}
      rows={2}
      placeholder={placeholder}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={onKeyDown}
      onPointerDown={(e) => e.stopPropagation()}
      className={`${cls} resize-none`}
    />
  ) : (
    <input
      ref={inputRef}
      type="text"
      value={draft}
      placeholder={placeholder}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={onKeyDown}
      onPointerDown={(e) => e.stopPropagation()}
      className={cls}
    />
  )
}

/* LinkPopover — the one "technical" field (prototype route) tucked into a
 * subtle shadcn popover, so the card stays about the writing. */
function LinkPopover({ href, onCommit }: { href: string; onCommit: (next: string) => void }) {
  const [val, setVal] = useState(href)
  const linked = !!href && href !== "#"
  return (
    <Popover onOpenChange={(open) => { if (open) setVal(href) }}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          title={linked ? `Link: ${href}` : "Set link (prototype route)"}
          className={`nodrag absolute right-1.5 top-1.5 inline-flex h-5 w-5 items-center justify-center rounded-sm border bg-(--bg-raised) transition ${linked ? "border-(--au-blue-300) text-(--au-blue-700)" : "border-(--border-default) text-(--fg-tertiary) hover:border-(--au-blue-400) hover:text-(--au-blue-700)"}`}
        >
          <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6.8 9.2l2.4-2.4M7 4.6l1-1a2.4 2.4 0 013.4 3.4l-1 1M9 11.4l-1 1a2.4 2.4 0 01-3.4-3.4l1-1" />
          </svg>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-64 p-2.5"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <label className="text-[11px] font-medium text-(--fg-secondary)">Link (prototype route)</label>
        <input
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onBlur={() => onCommit(val.trim() || "#")}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); onCommit(val.trim() || "#") }
            e.stopPropagation()
          }}
          placeholder="/route or #"
          className="nodrag mt-1 w-full rounded-sm border border-(--border-default) bg-(--bg-canvas) px-2 py-1 text-xs outline-hidden focus:border-(--au-blue-400)"
        />
      </PopoverContent>
    </Popover>
  )
}

/* ─────────────────────────────────────────────────────────────────────
 * Node renderers
 * ──────────────────────────────────────────────────────────────────── */

export function ScreenNode({ id, data }: NodeProps<Node<ScreenData>>) {
  const { mode, onUpdateNodeData, autoEditId } = useContext(FlowEditorContext)
  const editing = mode === "edit"
  const cursor = mode === "view" ? "cursor-pointer" : ""
  return (
    <div className={`relative block w-[200px] rounded-lg border border-(--border-default) bg-(--bg-raised) shadow-(--shadow-sm) hover:border-(--au-blue-400) hover:shadow-(--shadow-md) transition ${cursor}`}>
      <Handle type="target" position={Position.Top} className="bg-(--au-blue-500)! border-0! w-2! h-2!" />
      <div className="px-4 py-3 flex flex-col gap-1">
        <InlineText value={data.step} mode={mode} onCommit={(v) => onUpdateNodeData(id, { step: v })} placeholder="step" className="au-eyebrow text-(--au-blue-700)" inputClassName="au-eyebrow text-(--au-blue-700)" />
        <InlineText value={data.title} mode={mode} onCommit={(v) => onUpdateNodeData(id, { title: v })} placeholder="Screen title" className="text-sm font-medium text-(--fg-primary) leading-tight" inputClassName="text-sm font-medium text-(--fg-primary)" autoEdit={autoEditId === id} />
        {(editing || data.note) && (
          <InlineText value={data.note ?? ""} mode={mode} multiline onCommit={(v) => onUpdateNodeData(id, { note: v })} placeholder="Description…" className="caption text-(--fg-tertiary)" inputClassName="caption text-(--fg-tertiary)" />
        )}
      </div>
      <Handle type="source" position={Position.Bottom} className="bg-(--au-blue-500)! border-0! w-2! h-2!" />
      {/* Side outputs — invisible, they only anchor edges that leave sideways. */}
      <Handle id="left"  type="source" position={Position.Left}  style={{ opacity: 0 }} className="w-2! h-2! border-0!" />
      <Handle id="right" type="source" position={Position.Right} style={{ opacity: 0 }} className="w-2! h-2! border-0!" />
      {editing && <LinkPopover href={data.href} onCommit={(v) => onUpdateNodeData(id, { href: v })} />}
    </div>
  )
}

export function DecisionNode({ id, data }: NodeProps<Node<DecisionData>>) {
  const { mode, onUpdateNodeData, autoEditId } = useContext(FlowEditorContext)
  const hCls = "bg-(--au-amber-500)! border-0! w-2! h-2!"
  return (
    <div className="relative w-[240px] rounded-lg border-2 border-dashed border-(--au-amber-400) bg-(--au-amber-100) px-4 py-3 flex flex-col gap-1">
      <Handle type="target" position={Position.Top} className={hCls} />
      <span className="au-eyebrow text-(--au-amber-800)">
        decision · <InlineText value={data.step} mode={mode} onCommit={(v) => onUpdateNodeData(id, { step: v })} placeholder="step" className="text-(--au-amber-800)" inputClassName="au-eyebrow text-(--au-amber-800)" />
      </span>
      <InlineText value={data.title} mode={mode} onCommit={(v) => onUpdateNodeData(id, { title: v })} placeholder="Decision title" className="text-sm font-medium text-(--au-amber-900) leading-tight" inputClassName="text-sm font-medium text-(--au-amber-900)" autoEdit={autoEditId === id} />
      <InlineText value={data.question} mode={mode} multiline onCommit={(v) => onUpdateNodeData(id, { question: v })} placeholder="What condition does the flow evaluate here?" className="text-xs text-(--au-amber-800) leading-snug" inputClassName="text-xs text-(--au-amber-800)" />
      <Handle id="left"   type="source" position={Position.Left}   className={hCls} />
      <Handle id="bottom" type="source" position={Position.Bottom} className={hCls} />
      <Handle id="right"  type="source" position={Position.Right}  className={hCls} />
    </div>
  )
}

/**
 * CrossFlowNode — purple diamond marking the jump to ANOTHER flow. In view mode,
 * clicking it EXPANDS that flow inline (see flow-subflow). In edit mode the title
 * is editable and the link (the target flow's route) lives in the popover.
 */
export function CrossFlowNode({ id, data }: NodeProps<Node<ScreenData>>) {
  const { mode, onUpdateNodeData, autoEditId } = useContext(FlowEditorContext)
  const editing = mode === "edit"
  const cursor = mode === "view" ? "cursor-pointer" : ""
  return (
    <div className={`group relative w-[184px] h-[150px] ${cursor}`}>
      <Handle type="target" position={Position.Top} className="bg-(--au-purple-500)! border-0! w-2! h-2! z-20!" />
      <div className="absolute left-1/2 top-1/2 h-[106px] w-[106px] -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-md border-2 border-(--au-purple-400) bg-(--au-purple-100) shadow-(--shadow-sm) transition group-hover:border-(--au-purple-500) group-hover:bg-(--au-purple-150) group-hover:shadow-(--shadow-md)" />
      <div className={`absolute inset-0 flex flex-col items-center justify-center gap-0.5 px-6 text-center ${editing ? "" : "pointer-events-none"}`}>
        <span className="au-eyebrow inline-flex items-center gap-1 text-(--au-purple-700)">
          <svg width="11" height="11" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M3.5 12.5L12.5 3.5M12.5 3.5H6M12.5 3.5V10" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          other flow
        </span>
        <InlineText value={data.title} mode={mode} onCommit={(v) => onUpdateNodeData(id, { title: v })} placeholder="Flow name" className="text-[13px] font-semibold leading-tight text-(--au-purple-900)" inputClassName="text-[13px] font-semibold text-(--au-purple-900) text-center" autoEdit={autoEditId === id} />
      </div>
      <Handle type="source" position={Position.Bottom} className="bg-(--au-purple-500)! border-0! w-2! h-2! z-20!" />
      {editing && <LinkPopover href={data.href} onCommit={(v) => onUpdateNodeData(id, { href: v })} />}
    </div>
  )
}

export const nodeTypes = { screen: ScreenNode, decision: DecisionNode, crossflow: CrossFlowNode, comment: CommentNode, subflowGroup: SubflowGroupNode }

/* ─────────────────────────────────────────────────────────────────────
 * Edge styling — exported so flow pages can keep using the same look
 * even when they author edges directly.
 * ──────────────────────────────────────────────────────────────────── */

export const edgeBase: Partial<Edge> = {
  type: "smoothstep",
  animated: false,
  markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18 },
  style: { stroke: "var(--border-strong)", strokeWidth: 1.5 },
}

export const branchEdge: Partial<Edge> = {
  ...edgeBase,
  style: { stroke: "var(--au-amber-500)", strokeWidth: 1.5 },
  markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18, color: "var(--au-amber-500)" },
}

// Purple dashed edge — marks the transition to another flow (connects to/from a CrossFlowNode).
export const crossEdge: Partial<Edge> = {
  ...edgeBase,
  style: { stroke: "var(--au-purple-500)", strokeWidth: 1.5, strokeDasharray: "5 3" },
  markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18, color: "var(--au-purple-500)" },
}

/* ─────────────────────────────────────────────────────────────────────
 * Suggestions hook — talks to the same-origin /api/flow-suggestions route
 * ──────────────────────────────────────────────────────────────────── */

type BridgeError = "network" | "unknown"

function useFlowSuggestions(flow: string) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<BridgeError | null>(null)

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`${SUGGESTIONS_API}?flow=${encodeURIComponent(flow)}`, {
        cache: "no-store",
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as { suggestions: Suggestion[] }
      setSuggestions(data.suggestions ?? [])
      setError(null)
    } catch (e) {
      console.error("flow-suggestions refresh", e)
      setError("network")
    } finally {
      setLoaded(true)
    }
  }, [flow])

  useEffect(() => { void refresh() }, [refresh])

  const create = useCallback(
    async (description: string, nodes: Node[], edges: Edge[]): Promise<Suggestion | null> => {
      try {
        const res = await fetch(SUGGESTIONS_API, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ flow, description, nodes, edges }),
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = (await res.json()) as { suggestion: Suggestion }
        setSuggestions((prev) => [data.suggestion, ...prev])
        return data.suggestion
      } catch (e) {
        console.error("flow-suggestions create", e)
        setError("network")
        return null
      }
    },
    [flow],
  )

  const transition = useCallback(
    async (
      id: string,
      kind: "apply" | "discard" | "reject",
      actor: SuggestionActor = USER_ACTOR,
    ): Promise<boolean> => {
      try {
        const body =
          kind === "reject"
            ? { transition: "reject" }
            : { transition: kind, actor }
        const res = await fetch(`${SUGGESTIONS_API}/${encodeURIComponent(id)}`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        await refresh()
        return true
      } catch (e) {
        console.error("flow-suggestions transition", e)
        setError("network")
        return false
      }
    },
    [refresh],
  )

  return { suggestions, loaded, error, refresh, create, transition }
}

/* ─────────────────────────────────────────────────────────────────────
 * Status pill — compact label for a suggestion's lifecycle state
 * ──────────────────────────────────────────────────────────────────── */

function StatusPill({ status }: { status: SuggestionStatus }) {
  const map: Record<SuggestionStatus, { label: string; bg: string; fg: string; border: string }> = {
    open: { label: "open", bg: "var(--au-amber-100)", fg: "var(--au-amber-900)", border: "var(--au-amber-300)" },
    in_review: { label: "in review", bg: "var(--au-blue-100)", fg: "var(--au-blue-800)", border: "var(--au-blue-200)" },
    applied: { label: "applied", bg: "var(--bg-muted)", fg: "var(--fg-secondary)", border: "var(--border-default)" },
    discarded: { label: "discarded", bg: "var(--bg-muted)", fg: "var(--fg-tertiary)", border: "var(--border-default)" },
  }
  const s = map[status]
  return (
    <span
      className="inline-flex items-center rounded-sm border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide"
      style={{ background: s.bg, color: s.fg, borderColor: s.border }}
    >
      {s.label}
    </span>
  )
}

/* ─────────────────────────────────────────────────────────────────────
 * FlowDiagram — full editor wrapping ReactFlow
 * ──────────────────────────────────────────────────────────────────── */

let nodeIdCounter = 1
function nextNodeId() {
  return `n-${Date.now().toString(36)}-${(nodeIdCounter++).toString(36)}`
}

const NEW_SCREEN_DATA: ScreenData = {
  step: "new",
  title: "New screen",
  href: "#",
  note: "Describe what this screen is for.",
}

const NEW_DECISION_DATA: DecisionData = {
  step: "?",
  title: "New decision",
  question: "What condition does the flow evaluate here?",
}

const NEW_CROSSFLOW_DATA: ScreenData = {
  step: "→ flow",
  title: "Other flow",
  href: "/auis/styleguide/ux-flows/",
  note: "Jump to another flow in the styleguide.",
}

/* ─────────────────────────────────────────────────────────────────────
 * History snapshot + auto-layout helpers
 * ──────────────────────────────────────────────────────────────────── */

type FlowSnapshot = { nodes: Node[]; edges: Edge[] }

function cloneSnapshot(s: FlowSnapshot): FlowSnapshot {
  return {
    nodes: s.nodes.map((n) => structuredClone(n)),
    edges: s.edges.map((e) => structuredClone(e)),
  }
}

// Simple top-to-bottom BFS layout. Roots (no incoming edges) sit at y=0;
// each child sits one level below its parent. Siblings spread horizontally.
function autoLayout(nodes: Node[], edges: Edge[]): Node[] {
  if (nodes.length === 0) return nodes

  const children = new Map<string, string[]>()
  const incoming = new Map<string, number>()
  for (const n of nodes) {
    children.set(n.id, [])
    incoming.set(n.id, 0)
  }
  for (const e of edges) {
    children.get(e.source)?.push(e.target)
    incoming.set(e.target, (incoming.get(e.target) ?? 0) + 1)
  }

  const level = new Map<string, number>()
  const roots = nodes.filter((n) => (incoming.get(n.id) ?? 0) === 0)
  const seeds = roots.length > 0 ? roots : [nodes[0]]
  const queue: { id: string; lvl: number }[] = seeds.map((n) => ({ id: n.id, lvl: 0 }))
  while (queue.length > 0) {
    const { id, lvl } = queue.shift()!
    const cur = level.get(id)
    if (cur !== undefined && cur >= lvl) continue
    level.set(id, lvl)
    for (const child of children.get(id) ?? []) {
      queue.push({ id: child, lvl: lvl + 1 })
    }
  }

  // Isolated nodes (no path from any root) → park them below the deepest level.
  const maxLvl = level.size > 0 ? Math.max(...Array.from(level.values())) : 0
  for (const n of nodes) {
    if (!level.has(n.id)) level.set(n.id, maxLvl + 2)
  }

  const byLevel = new Map<number, string[]>()
  for (const [id, lvl] of level) {
    if (!byLevel.has(lvl)) byLevel.set(lvl, [])
    byLevel.get(lvl)!.push(id)
  }

  const GAP_X = 280
  const GAP_Y = 180
  const CX = 400
  const positions = new Map<string, { x: number; y: number }>()
  for (const [lvl, ids] of byLevel) {
    const count = ids.length
    ids.forEach((id, i) => {
      positions.set(id, {
        x: CX + (i - (count - 1) / 2) * GAP_X,
        y: lvl * GAP_Y,
      })
    })
  }

  return nodes.map((n) => ({ ...n, position: positions.get(n.id) ?? n.position }))
}

// Strips ReactFlow-internal flags (selected, dragging, etc.) so the prompt
// JSON stays focused on the structural fields Claude needs.
function cleanForPrompt(nodes: Node[], edges: Edge[]) {
  const cleanNodes = nodes.map((n) => ({
    id: n.id,
    type: n.type,
    position: { x: Math.round(n.position.x), y: Math.round(n.position.y) },
    data: n.data,
  }))
  const cleanEdges = edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    ...(e.sourceHandle ? { sourceHandle: e.sourceHandle } : {}),
    ...(e.targetHandle ? { targetHandle: e.targetHandle } : {}),
    ...(e.label ? { label: e.label } : {}),
  }))
  return { nodes: cleanNodes, edges: cleanEdges }
}

export function FlowDiagram({
  flow,
  nodes: canonicalNodes,
  edges: canonicalEdges,
  height = 800,
}: {
  flow: string
  nodes: Node[]
  edges: Edge[]
  height?: number
}) {
  const router = useRouter()
  const [editNodes, setEditNodes, onEditNodesChange] = useNodesState(canonicalNodes)
  const [editEdges, setEditEdges, onEditEdgesChange] = useEdgesState(canonicalEdges)

  // View-mode dragging: separate state so anyone can rearrange the cards without
  // persisting — a refresh restarts from the canonical nodes (default layout).
  const [viewNodes, , onViewNodesChange] = useNodesState(canonicalNodes)

  const [editMode, setEditMode] = useState(false)
  const [previewSugg, setPreviewSugg] = useState<Suggestion | null>(null)
  const [showSave, setShowSave] = useState(false)
  const [showReview, setShowReview] = useState(false)
  const [showPromptModal, setShowPromptModal] = useState(false)
  const [desc, setDesc] = useState("")
  const [autoEditId, setAutoEditId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [previewScreen, setPreviewScreen] = useState<ScreenData | null>(null)
  const [confirmFlow, setConfirmFlow] = useState<{ title: string; href: string } | null>(null)
  const [snapEnabled, setSnapEnabled] = useState(true)
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [historyLength, setHistoryLength] = useState(0)

  const historyRef = useRef<FlowSnapshot[]>([])
  const skipPushRef = useRef(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // "Fullscreen" = a CSS overlay (NOT the native Fullscreen API). The native API
  // hides everything outside the fullscreened element — including body-portaled
  // overlays (the screen-preview drawer) — which would break the toolbar,
  // comments and modals. A fixed inset-0 panel keeps the whole app working and
  // feels like an embedded canvas.
  const rfRef = useRef<ReactFlowInstance | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)

  const toggleFullscreen = useCallback(() => setIsFullscreen((v) => !v), [])

  // Re-fit the graph after the canvas resizes into/out of fullscreen.
  useEffect(() => {
    const id = requestAnimationFrame(() => rfRef.current?.fitView({ padding: 0.12 }))
    return () => cancelAnimationFrame(id)
  }, [isFullscreen])

  // ESC exits fullscreen (but let focused inputs handle their own Escape).
  useEffect(() => {
    if (!isFullscreen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return
      setIsFullscreen(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [isFullscreen])

  const { suggestions, error, create, transition } = useFlowSuggestions(flow)

  // FigJam-style comments on the canvas — persisted to the review-bridge
  // (origin: "ux-flow"), so they also show in Review Mode with a chip.
  const { comments: flowComments, refresh: refreshComments } = useFlowComments(flow)
  const [commentMode, setCommentMode] = useState(false)
  const [pendingComment, setPendingComment] = useState<{ target: CommentTarget; at: ScreenPoint } | null>(null)
  const [openThread, setOpenThread] = useState<{ commentId: string; at: ScreenPoint } | null>(null)

  // Inline sub-flow expansion: diamond node id → its expanded { nodes, edges }.
  const [expansions, setExpansions] = useState<Record<string, { nodes: Node[]; edges: Edge[] }>>({})
  // Mirror in a ref so the (stable) click handler always reads the latest map —
  // avoids a stale closure re-expanding an already-open diamond.
  const expansionsRef = useRef(expansions)
  useEffect(() => { expansionsRef.current = expansions }, [expansions])

  const collapseSubflow = useCallback((id: string) => {
    setExpansions((prev) => {
      if (!prev[id]) return prev
      const next = { ...prev }
      delete next[id]
      return next
    })
  }, [])

  const toggleSubflow = useCallback(
    async (diamond: Node) => {
      const id = diamond.id
      if (expansionsRef.current[id]) {
        collapseSubflow(id)
        return
      }
      const data = diamond.data as ScreenData
      const slug = flowSlugFromHref(data.href || "")
      // Unknown / non-registered flow → keep the old behaviour (navigate).
      if (!isExpandableFlow(slug)) {
        if (data.href && data.href !== "#") setConfirmFlow({ title: data.title, href: data.href })
        return
      }
      const loaded = await loadFlowData(slug)
      if (!loaded) {
        if (data.href && data.href !== "#") setConfirmFlow({ title: data.title, href: data.href })
        return
      }
      const expansion = buildExpansion(diamond, loaded, data.title, {
        onOpen: () => setConfirmFlow({ title: data.title, href: data.href }),
        onCollapse: () => collapseSubflow(id),
      })
      setExpansions((prev) => (prev[id] ? prev : { ...prev, [id]: expansion }))
      // Gently pan to frame the diamond + its new sub-flow frame (deferred so
      // they get measured first). maxZoom keeps it from zooming in too hard.
      const groupId = `sub:${id}:__group`
      window.setTimeout(
        () =>
          rfRef.current?.fitView({
            nodes: [{ id }, { id: groupId }],
            padding: 0.28,
            duration: 500,
            maxZoom: 1,
          }),
        120,
      )
    },
    [collapseSubflow],
  )

  const onUpdateNodeData = useCallback(
    (nodeId: string, patch: Partial<ScreenData & DecisionData>) => {
      setEditNodes((nodes) =>
        nodes.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, ...patch } } : n)),
      )
    },
    [setEditNodes],
  )
  const onPreviewScreen = useCallback((data: ScreenData) => setPreviewScreen(data), [])
  const ctxValue = useMemo<EditorCtx>(
    () => ({ mode: editMode ? "edit" : "view", onUpdateNodeData, onPreviewScreen, autoEditId }),
    [editMode, onUpdateNodeData, onPreviewScreen, autoEditId],
  )

  const onNodeClick = useCallback(
    (event: ReactMouseEvent, node: Node) => {
      // Comment marker → open its thread.
      if (node.type === "comment") {
        const c = (node.data as { comment?: ReviewComment }).comment
        if (c) setOpenThread({ commentId: c.id, at: { x: event.clientX, y: event.clientY } })
        return
      }
      // Sub-flow group frame: its header buttons handle open/collapse — ignore body clicks.
      if (node.type === "subflowGroup") return
      // Nodes inside an expanded sub-flow are display-only (top-level screens still preview).
      if (node.parentId) {
        if (!commentMode && !editMode && !previewSugg && node.type === "screen") {
          setPreviewScreen(node.data as ScreenData)
        }
        return
      }
      // Comment mode → anchor a new comment to the clicked node (top-right corner).
      if (commentMode) {
        const w = node.type === "decision" ? 240 : node.type === "crossflow" ? 184 : 200
        setPendingComment({
          target: {
            nodeId: node.id,
            nodeLabel: (node.data as { title?: string }).title,
            position: { x: node.position.x + w - 14, y: node.position.y - 14 },
          },
          at: { x: event.clientX, y: event.clientY },
        })
        return
      }
      if (editMode || previewSugg) return
      // Diamond → expand/collapse the referenced flow inline (instead of navigating).
      if (node.type === "crossflow") {
        void toggleSubflow(node)
        return
      }
      if (node.type !== "screen") return
      const data = node.data as ScreenData
      const href = data.href || ""
      if ((event.metaKey || event.ctrlKey) && href && href !== "#" && !/^https?:/i.test(href)) {
        window.open(href, "_blank")
        return
      }
      setPreviewScreen(data)
    },
    [editMode, previewSugg, commentMode, toggleSubflow],
  )

  // Comment mode: clicking empty canvas drops a free comment at that flow coord.
  const onPaneClick = useCallback(
    (event: ReactMouseEvent) => {
      if (!commentMode) return
      // First click dismisses an open popover; next click drops a new comment.
      if (pendingComment || openThread) {
        setPendingComment(null)
        setOpenThread(null)
        return
      }
      const flowPos = rfRef.current?.screenToFlowPosition({ x: event.clientX, y: event.clientY })
      if (!flowPos) return
      setPendingComment({
        target: { position: flowPos },
        at: { x: event.clientX, y: event.clientY },
      })
    },
    [commentMode, pendingComment, openThread],
  )

  const enterCommentMode = useCallback(() => {
    setCommentMode(true)
    setPendingComment(null)
    setOpenThread(null)
  }, [])

  const exitCommentMode = useCallback(() => {
    setCommentMode(false)
    setPendingComment(null)
    setOpenThread(null)
  }, [])

  const resetHistory = useCallback((snap: FlowSnapshot) => {
    historyRef.current = [cloneSnapshot(snap)]
    setHistoryIndex(0)
    setHistoryLength(1)
  }, [])

  const pushHistory = useCallback((snap: FlowSnapshot) => {
    setHistoryIndex((idx) => {
      const truncated = historyRef.current.slice(0, idx + 1)
      const next = [...truncated, cloneSnapshot(snap)].slice(-50)
      historyRef.current = next
      setHistoryLength(next.length)
      return next.length - 1
    })
  }, [])

  function enterEdit() {
    skipPushRef.current = true
    setCommentMode(false)
    setPendingComment(null)
    setOpenThread(null)
    setEditNodes(canonicalNodes.map((n) => ({ ...n })))
    setEditEdges(canonicalEdges.map((e) => ({ ...e })))
    setPreviewSugg(null)
    setEditMode(true)
    resetHistory({ nodes: canonicalNodes, edges: canonicalEdges })
  }

  function cancelEdit() {
    setEditNodes(canonicalNodes.map((n) => ({ ...n })))
    setEditEdges(canonicalEdges.map((e) => ({ ...e })))
    setAutoEditId(null)
    setEditMode(false)
    historyRef.current = []
    setHistoryIndex(-1)
    setHistoryLength(0)
  }

  function addNode(kind: "screen" | "decision" | "crossflow") {
    const baseX = 200 + Math.random() * 200
    const baseY = 200 + Math.random() * 200
    const data =
      kind === "decision" ? { ...NEW_DECISION_DATA }
      : kind === "crossflow" ? { ...NEW_CROSSFLOW_DATA }
      : { ...NEW_SCREEN_DATA }
    const node: Node = { id: nextNodeId(), type: kind, position: { x: baseX, y: baseY }, data }
    setEditNodes((nodes) => [...nodes, node])
    setAutoEditId(node.id)
  }

  const onConnect = useCallback(
    (params: Connection) => {
      setEditEdges((edges) =>
        addEdge(
          {
            ...params,
            type: "smoothstep",
            markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18, color: "var(--au-blue-500)" },
            style: { stroke: "var(--au-blue-500)", strokeWidth: 1.5, strokeDasharray: "4 3" },
          },
          edges,
        ),
      )
    },
    [setEditEdges],
  )

  async function confirmSave() {
    if (!desc.trim()) return
    setSaving(true)
    const created = await create(desc.trim(), editNodes, editEdges)
    setSaving(false)
    if (created) {
      setDesc("")
      setShowSave(false)
      setEditMode(false)
      setEditNodes(canonicalNodes.map((n) => ({ ...n })))
      setEditEdges(canonicalEdges.map((e) => ({ ...e })))
    }
  }

  function viewSugg(s: Suggestion) {
    setPreviewSugg(s)
    setEditMode(false)
    setShowReview(false)
  }

  const undo = useCallback(() => {
    if (historyIndex <= 0) return
    const prev = historyRef.current[historyIndex - 1]
    skipPushRef.current = true
    setEditNodes(prev.nodes.map((n) => structuredClone(n)))
    setEditEdges(prev.edges.map((e) => structuredClone(e)))
    setHistoryIndex(historyIndex - 1)
  }, [historyIndex, setEditNodes, setEditEdges])

  const redo = useCallback(() => {
    if (historyIndex >= historyLength - 1) return
    const next = historyRef.current[historyIndex + 1]
    skipPushRef.current = true
    setEditNodes(next.nodes.map((n) => structuredClone(n)))
    setEditEdges(next.edges.map((e) => structuredClone(e)))
    setHistoryIndex(historyIndex + 1)
  }, [historyIndex, historyLength, setEditNodes, setEditEdges])

  const applyAutoLayout = useCallback(() => {
    setEditNodes((prev) => autoLayout(prev, editEdges))
  }, [editEdges, setEditNodes])

  const duplicateSelected = useCallback(() => {
    const selected = editNodes.filter((n) => n.selected)
    if (selected.length === 0) return
    const dupes = selected.map((n) => ({
      ...structuredClone(n),
      id: nextNodeId(),
      position: { x: n.position.x + 40, y: n.position.y + 40 },
      selected: true,
    }))
    setEditNodes((prev) => [
      ...prev.map((n) => ({ ...n, selected: false })),
      ...dupes,
    ])
  }, [editNodes, setEditNodes])

  // Remove the selected card(s) and any edge touching them. Mirrors the
  // Backspace/Delete shortcut, but exposed as a visible toolbar button so the
  // capability is discoverable while building a suggestion.
  const deleteSelected = useCallback(() => {
    const ids = new Set(editNodes.filter((n) => n.selected).map((n) => n.id))
    if (ids.size === 0) return
    setEditNodes((prev) => prev.filter((n) => !ids.has(n.id)))
    setEditEdges((prev) => prev.filter((e) => !ids.has(e.source) && !ids.has(e.target)))
  }, [editNodes, setEditNodes, setEditEdges])

  const selectedCount = editMode ? editNodes.filter((n) => n.selected).length : 0

  const canUndo = editMode && historyIndex > 0
  const canRedo = editMode && historyIndex >= 0 && historyIndex < historyLength - 1

  // Debounced history push — captures the latest editNodes/editEdges 250ms
  // after the last change. skipPushRef short-circuits the push triggered by
  // an undo/redo (which itself called setEditNodes/setEditEdges).
  useEffect(() => {
    if (!editMode) return
    if (skipPushRef.current) {
      skipPushRef.current = false
      return
    }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      pushHistory({ nodes: editNodes, edges: editEdges })
    }, 250)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [editNodes, editEdges, editMode, pushHistory])

  // Keyboard shortcuts — only active in edit mode and when not typing.
  useEffect(() => {
    if (!editMode) return
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return
      }
      const cmd = e.metaKey || e.ctrlKey
      const key = e.key.toLowerCase()
      if (cmd && !e.shiftKey && key === "z") {
        e.preventDefault()
        undo()
      } else if (cmd && ((e.shiftKey && key === "z") || key === "y")) {
        e.preventDefault()
        redo()
      } else if (cmd && key === "d") {
        e.preventDefault()
        duplicateSelected()
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [editMode, undo, redo, duplicateSelected])


  const displayNodes = editMode ? editNodes : previewSugg ? previewSugg.nodes : viewNodes
  const displayEdges = editMode ? editEdges : previewSugg ? previewSugg.edges : canonicalEdges

  // Overlays render only in the live view (never while editing/previewing a
  // suggestion) so they never leak into a saved suggestion's node/edge set.
  const overlaysOn = !editMode && !previewSugg
  const commentMarkers = overlaysOn ? flowComments.map(commentMarkerNode) : []
  const expansionNodes = overlaysOn ? Object.values(expansions).flatMap((e) => e.nodes) : []
  const expansionEdges = overlaysOn ? Object.values(expansions).flatMap((e) => e.edges) : []
  // Order matters: each sub-flow group node must precede its children (ReactFlow
  // parent-before-child rule); buildExpansion already returns [group, ...children].
  const renderedNodes = [...displayNodes, ...expansionNodes, ...commentMarkers]
  const renderedEdges = expansionEdges.length > 0 ? [...displayEdges, ...expansionEdges] : displayEdges
  const threadComment = openThread
    ? flowComments.find((c) => c.id === openThread.commentId) ?? null
    : null

  const errorMessage =
    error === "network"
      ? "Could not save the suggestion — check that the server (npm run dev) is running."
      : null

  return (
    <FlowEditorContext.Provider value={ctxValue}>
      <div className={isFullscreen ? "fixed inset-0 z-40 bg-(--bg-canvas)" : "relative"}>
        <div
          className={
            isFullscreen
              ? "overflow-hidden"
              : "rounded-lg border border-(--border-subtle) overflow-hidden"
          }
          style={{ backgroundColor: "var(--bg-muted)", height: isFullscreen ? "100vh" : height }}
        >
          <ReactFlow
            nodes={renderedNodes}
            edges={renderedEdges}
            nodeTypes={nodeTypes}
            onInit={(instance) => { rfRef.current = instance }}
            onNodesChange={editMode ? onEditNodesChange : previewSugg ? undefined : onViewNodesChange}
            onEdgesChange={editMode ? onEditEdgesChange : undefined}
            onConnect={editMode ? onConnect : undefined}
            onNodeClick={onNodeClick}
            onPaneClick={commentMode ? onPaneClick : undefined}
            nodesDraggable={editMode || (!previewSugg && !commentMode)}
            nodesConnectable={editMode}
            elementsSelectable={editMode}
            deleteKeyCode={editMode ? ["Backspace", "Delete"] : null}
            multiSelectionKeyCode={editMode ? ["Meta", "Control"] : null}
            selectionKeyCode={editMode ? "Shift" : null}
            snapToGrid={editMode && snapEnabled}
            snapGrid={[20, 20]}
            fitView
            fitViewOptions={{ padding: 0.12 }}
            proOptions={{ hideAttribution: true }}
            minZoom={0.3}
            maxZoom={1.5}
            style={{ background: "var(--bg-muted)" }}
          >
            <Background variant={BackgroundVariant.Dots} gap={24} size={1.5} color="var(--border-default)" />
            <Controls showInteractive={false}>
              <ControlButton
                onClick={toggleFullscreen}
                title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
                aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
              >
                {isFullscreen ? (
                  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 7H9V2" />
                    <path d="M9 7l5-5" />
                    <path d="M2 9h5v5" />
                    <path d="M7 9l-5 5" />
                  </svg>
                ) : (
                  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 2h5v5" />
                    <path d="M14 2 9 7" />
                    <path d="M7 14H2V9" />
                    <path d="M2 14l5-5" />
                  </svg>
                )}
              </ControlButton>
            </Controls>

            {!editMode && !previewSugg && suggestions.length > 0 && (
              <Panel position="top-right">
                <button
                  onClick={() => setShowReview(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-(--au-amber-100) border border-(--au-amber-300) text-xs font-medium text-(--au-amber-800) hover:bg-(--au-amber-200) transition shadow-(--shadow-sm)"
                >
                  <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-(--au-amber-500) text-white text-[10px] font-bold">
                    {suggestions.length}
                  </span>
                  {suggestions.length === 1 ? "suggestion" : "suggestions"}
                </button>
              </Panel>
            )}

            {/* FigJam-style central toolbar — lives inside the canvas so it also
                shows in fullscreen. Lifted above the global Review dot, which
                also docks bottom-center. Move / Comment / Suggest edit. */}
            {!editMode && !previewSugg && (
              <Panel position="bottom-center" className="bottom-16!">

                <div className="flex items-center gap-1 rounded-full bg-(--bg-raised) border border-(--border-default) shadow-(--shadow-md) px-1.5 py-1.5">
                  <button
                    onClick={exitCommentMode}
                    aria-pressed={!commentMode}
                    title="Move / navigate"
                    className={
                      !commentMode
                        ? "h-8 w-8 inline-flex items-center justify-center rounded-full bg-(--au-blue-100) text-(--au-blue-700) transition"
                        : "h-8 w-8 inline-flex items-center justify-center rounded-full text-(--fg-secondary) hover:bg-(--bg-muted) transition"
                    }
                  >
                    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M8 2.5v11M2.5 8h11M8 2.5 6 4.5M8 2.5l2 2M8 13.5l-2-2M8 13.5l2-2M2.5 8l2-2M2.5 8l2 2M13.5 8l-2-2M13.5 8l-2 2" />
                    </svg>
                  </button>
                  <button
                    onClick={commentMode ? exitCommentMode : enterCommentMode}
                    aria-pressed={commentMode}
                    title="Comment (FigJam style) — goes to the review with a UX Flow chip"
                    className={
                      commentMode
                        ? "h-8 w-8 inline-flex items-center justify-center rounded-full bg-(--au-purple-600) text-white transition"
                        : "h-8 w-8 inline-flex items-center justify-center rounded-full text-(--fg-secondary) hover:bg-(--bg-muted) transition"
                    }
                  >
                    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M2.5 3.5h11v7h-7l-3 2.5z" />
                    </svg>
                  </button>
                  <span className="w-px h-5 bg-(--border-default) mx-0.5" />
                  <button
                    onClick={enterEdit}
                    title="Suggest edit"
                    className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-medium text-(--fg-secondary) hover:bg-(--bg-muted) hover:text-(--au-blue-700) transition"
                  >
                    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11.5 1.5l3 3-9 9H2.5v-3l9-9z" />
                    </svg>
                    Suggest edit
                  </button>
                </div>
              </Panel>
            )}

            {editMode && (
              <Panel position="bottom-center" className="bottom-16!">
                <div className="flex items-center gap-1.5 rounded-full border border-(--border-default) bg-(--bg-raised) px-2 py-1.5 text-xs shadow-(--shadow-md)">
                  <button onClick={() => addNode("screen")} className="rounded-full border border-(--au-blue-200) bg-(--au-blue-100) px-2.5 py-1 font-medium text-(--au-blue-800) transition hover:bg-(--au-blue-200)">
                    + Screen
                  </button>
                  <button onClick={() => addNode("decision")} className="rounded-full border border-(--au-amber-300) bg-(--au-amber-100) px-2.5 py-1 font-medium text-(--au-amber-900) transition hover:bg-(--au-amber-200)">
                    + Decision
                  </button>
                  <button onClick={() => addNode("crossflow")} className="rounded-full border border-(--au-purple-200) bg-(--au-purple-100) px-2.5 py-1 font-medium text-(--au-purple-800) transition hover:bg-(--au-purple-150)">
                    + Other flow
                  </button>

                  <span className="mx-0.5 h-4 w-px bg-(--border-default)" />

                  <button onClick={undo} disabled={!canUndo} title="Undo (⌘Z)" aria-label="Undo" className="rounded-full px-2 py-1 text-(--fg-secondary) transition hover:bg-(--bg-muted) hover:text-(--fg-primary) disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent">↶</button>
                  <button onClick={redo} disabled={!canRedo} title="Redo (⌘⇧Z)" aria-label="Redo" className="rounded-full px-2 py-1 text-(--fg-secondary) transition hover:bg-(--bg-muted) hover:text-(--fg-primary) disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent">↷</button>

                  <button
                    onClick={() => setSnapEnabled((v) => !v)}
                    title={snapEnabled ? "Snap on" : "Snap off"}
                    className={
                      snapEnabled
                        ? "rounded-full border border-(--au-blue-200) bg-(--au-blue-100) px-2 py-1 font-medium text-(--au-blue-800) transition"
                        : "rounded-full border border-transparent px-2 py-1 text-(--fg-secondary) transition hover:bg-(--bg-muted)"
                    }
                  >
                    Snap
                  </button>
                  <button onClick={applyAutoLayout} title="Rearrange the cards into columns" className="rounded-full border border-transparent px-2 py-1 text-(--fg-secondary) transition hover:bg-(--bg-muted) hover:text-(--fg-primary)">
                    Arrange
                  </button>

                  <span className="mx-0.5 h-4 w-px bg-(--border-default)" />

                  <button
                    onClick={duplicateSelected}
                    disabled={selectedCount === 0}
                    title="Duplicate selected (⌘D)"
                    className="rounded-full border border-transparent px-2 py-1 text-(--fg-secondary) transition hover:bg-(--bg-muted) hover:text-(--fg-primary) disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
                  >
                    Duplicate
                  </button>
                  <button
                    onClick={deleteSelected}
                    disabled={selectedCount === 0}
                    title="Delete selected (Delete)"
                    className="rounded-full border border-transparent px-2 py-1 font-medium text-(--au-red-700) transition hover:bg-(--au-red-100) disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
                  >
                    Delete{selectedCount > 1 ? ` (${selectedCount})` : ""}
                  </button>

                  <span className="mx-0.5 h-4 w-px bg-(--border-default)" />

                  <button onClick={cancelEdit} className="rounded-full px-2.5 py-1 text-(--fg-secondary) transition hover:bg-(--bg-muted)">Cancel</button>
                  <button onClick={() => setShowSave(true)} className="rounded-full bg-(--au-blue-600) px-3 py-1 font-medium text-white transition hover:bg-(--au-blue-700)">Save</button>
                </div>
              </Panel>
            )}

            {previewSugg && (
              <Panel position="top-center">
                <div className="flex items-center gap-3 bg-(--bg-raised) border border-(--border-default) rounded-md px-4 py-2 text-sm shadow-(--shadow-md)">
                  <span className="text-(--fg-tertiary) text-xs uppercase tracking-wide font-medium">Suggestion</span>
                  <code className="text-[10px] font-mono px-1.5 py-0.5 rounded-sm bg-(--bg-muted) text-(--fg-secondary)">{previewSugg.id}</code>
                  <StatusPill status={previewSugg.status} />
                  <span className="text-(--fg-primary) font-medium max-w-xs truncate">{previewSugg.description}</span>
                  <span className="text-(--fg-tertiary)">·</span>
                  <button onClick={() => setPreviewSugg(null)} className="text-(--au-blue-700) font-medium hover:underline whitespace-nowrap">Back to the official flow</button>
                </div>
              </Panel>
            )}
          </ReactFlow>
        </div>

        {errorMessage && (
          <p className="mt-2 text-xs text-(--au-red-700)">{errorMessage}</p>
        )}
      </div>

      {showSave && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => !saving && setShowSave(false)}>
          <div className="bg-(--bg-raised) rounded-lg border border-(--border-subtle) shadow-(--shadow-lg) w-full max-w-md mx-4 p-6 flex flex-col gap-4" onClick={(e) => e.stopPropagation()}>
            <div>
              <h2 className="text-base font-semibold text-(--fg-primary) m-0">Save suggestion</h2>
              <p className="text-sm text-(--fg-secondary) mt-1 m-0">Describe what changes in this flow. Claude reads this to understand the intent behind the edit.</p>
            </div>
            <textarea
              className="w-full rounded-md border border-(--border-default) bg-(--bg-canvas) px-3 py-2 text-sm text-(--fg-primary) placeholder:text-(--fg-tertiary) focus:outline-hidden focus:border-(--au-blue-400) resize-none"
              placeholder="E.g. added an account lock after 5 invalid attempts…"
              rows={3} value={desc} onChange={(e) => setDesc(e.target.value)} autoFocus
            />
            <div className="flex items-center justify-between gap-2">
              <button
                onClick={() => { setShowSave(false); setShowPromptModal(true) }}
                disabled={saving}
                className="text-xs font-medium text-(--fg-tertiary) underline-offset-2 hover:text-(--au-blue-700) hover:underline disabled:opacity-40"
              >
                or copy a prompt for the chat
              </button>
              <div className="flex gap-2">
                <button onClick={() => setShowSave(false)} disabled={saving} className="px-4 py-2 rounded-md border border-(--border-default) text-sm font-medium text-(--fg-secondary) hover:bg-(--bg-muted) transition disabled:opacity-40">Cancel</button>
                <button onClick={confirmSave} disabled={!desc.trim() || saving} className="px-4 py-2 rounded-md bg-(--au-blue-600) text-white text-sm font-medium hover:bg-(--au-blue-700) disabled:opacity-40 disabled:cursor-not-allowed transition">
                  {saving ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showReview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowReview(false)}>
          <div className="bg-(--bg-raised) rounded-lg border border-(--border-subtle) shadow-(--shadow-lg) w-full max-w-lg mx-4 p-6 flex flex-col gap-4 max-h-[80vh]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-(--fg-primary) m-0">
                Suggestions
                <span className="ml-2 inline-flex items-center justify-center w-5 h-5 rounded-full bg-(--au-amber-500) text-white text-[10px] font-bold align-middle">{suggestions.length}</span>
              </h2>
              <button onClick={() => setShowReview(false)} className="text-(--fg-tertiary) hover:text-(--fg-primary) text-lg leading-none">×</button>
            </div>
            <p className="text-xs text-(--fg-secondary) m-0 -mt-2">
              Suggestions are saved in the repo (<code className="text-[10px] font-mono">flow-bridge/data/suggestions.json</code>). Send the ID to Claude in the chat (<em>&quot;evaluate suggestion X of flow {flow}&quot;</em>) and it will propose how to apply it. Approving archives it; rejecting sends it back to open.
            </p>
            <ul className="flex flex-col gap-3 overflow-y-auto m-0 p-0 list-none">
              {suggestions.map((s) => (
                <li key={s.id} className="rounded-md border border-(--border-subtle) bg-(--bg-canvas) p-4 flex flex-col gap-2">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <code className="text-[10px] font-mono px-1.5 py-0.5 rounded-sm bg-(--bg-muted) text-(--fg-secondary)">{s.id}</code>
                    <StatusPill status={s.status} />
                    <span className="caption text-(--fg-tertiary)">
                      {/* en-GB keeps the day-before-month ordering used across the app. */}
                      {new Date(s.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <p className="m-0 text-sm font-medium text-(--fg-primary) leading-snug">{s.description}</p>
                  {s.resolution && (
                    <p className="m-0 caption text-(--fg-tertiary) italic">{s.resolution.summary}</p>
                  )}
                  <div className="flex gap-2 mt-1 flex-wrap">
                    <button onClick={() => viewSugg(s)} className="px-3 py-1.5 rounded-sm bg-(--au-blue-600) text-white text-xs font-medium hover:bg-(--au-blue-700) transition">View</button>
                    <button
                      onClick={() => navigator.clipboard?.writeText(`evaluate suggestion ${s.id} of flow ${flow}`)}
                      className="px-3 py-1.5 rounded-sm border border-(--border-default) text-xs font-medium text-(--fg-secondary) hover:bg-(--bg-muted) transition"
                    >
                      Copy prompt
                    </button>
                    {s.status === "in_review" && (
                      <>
                        <button
                          onClick={() => void transition(s.id, "apply")}
                          className="px-3 py-1.5 rounded-sm bg-(--au-emerald-700) text-white text-xs font-medium hover:bg-(--au-emerald-800) transition"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => void transition(s.id, "reject")}
                          className="px-3 py-1.5 rounded-sm border border-(--border-default) text-xs font-medium text-(--fg-secondary) hover:bg-(--bg-muted) transition"
                        >
                          Reject
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => void transition(s.id, "discard")}
                      className="px-3 py-1.5 rounded-sm border border-(--border-default) text-xs font-medium text-(--fg-secondary) hover:bg-(--bg-muted) transition"
                    >
                      Discard
                    </button>
                  </div>
                </li>
              ))}
              {suggestions.length === 0 && (
                <li className="text-sm text-(--fg-tertiary) text-center py-6">No active suggestions.</li>
              )}
            </ul>
          </div>
        </div>
      )}


      {showPromptModal && (
        <CopyPromptModal
          flow={flow}
          nodes={editMode ? editNodes : canonicalNodes}
          edges={editMode ? editEdges : canonicalEdges}
          onClose={() => setShowPromptModal(false)}
        />
      )}

      {confirmFlow && (
        <FlowConfirmModal
          target={confirmFlow}
          onCancel={() => setConfirmFlow(null)}
          onConfirm={() => {
            const href = confirmFlow.href
            setConfirmFlow(null)
            router.push(href)
          }}
        />
      )}

      <ScreenPreviewDrawer
        screen={previewScreen}
        onClose={() => setPreviewScreen(null)}
      />

      {pendingComment && (
        <FlowCommentComposer
          flow={flow}
          target={pendingComment.target}
          at={pendingComment.at}
          onClose={() => setPendingComment(null)}
          onSaved={() => {
            setPendingComment(null)
            void refreshComments()
          }}
        />
      )}

      {threadComment && openThread && (
        <FlowCommentThread
          comment={threadComment}
          at={openThread.at}
          onClose={() => setOpenThread(null)}
          onChanged={() => void refreshComments()}
        />
      )}
    </FlowEditorContext.Provider>
  )
}

/* ─────────────────────────────────────────────────────────────────────
 * FlowConfirmModal — confirmation before jumping to another flow. Opens when you
 * click a CrossFlowNode (purple diamond); confirming navigates to the other flow.
 * ──────────────────────────────────────────────────────────────────── */

function FlowConfirmModal({
  target,
  onCancel,
  onConfirm,
}: {
  target: { title: string; href: string }
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onCancel}>
      <div
        className="bg-(--bg-raised) rounded-lg border border-(--border-subtle) shadow-(--shadow-lg) w-full max-w-md mx-4 p-6 flex flex-col gap-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3.5">
          <span className="shrink-0 mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-md bg-(--au-purple-100) text-(--au-purple-700)">
            <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M3.5 12.5L12.5 3.5M12.5 3.5H6M12.5 3.5V10" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <div className="flex flex-col gap-1">
            <h2 className="text-base font-semibold text-(--fg-primary) m-0">Go to another flow?</h2>
            <p className="text-sm text-(--fg-secondary) m-0 leading-relaxed">
              You will leave this flow and open the{" "}
              <b className="font-medium text-(--fg-primary)">{target.title}</b> flow.
              You can come back at any time.
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-md border border-(--border-default) text-sm font-medium text-(--fg-secondary) hover:bg-(--bg-muted) transition"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-(--au-purple-600) text-white text-sm font-medium hover:bg-(--au-purple-700) transition"
          >
            Go to {target.title}
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────
 * CopyPromptModal — produces a copy-pasteable prompt with the flow's
 * NODES/EDGES embedded as JSON. Two modes: ask Claude to apply the
 * edit to this flow's page.tsx, or to scaffold the product routes
 * from the flow's screen nodes.
 * ──────────────────────────────────────────────────────────────────── */

function CopyPromptModal({
  flow,
  nodes,
  edges,
  onClose,
}: {
  flow: string
  nodes: Node[]
  edges: Edge[]
  onClose: () => void
}) {
  const [mode, setMode] = useState<"flow-update" | "product-routes">("flow-update")
  const [copied, setCopied] = useState(false)

  const prompt = useMemo(() => {
    const clean = cleanForPrompt(nodes, edges)
    if (mode === "flow-update") {
      return [
        `Please update the \`${flow}\` flow in the styleguide with the structure below.`,
        ``,
        `File: \`app/auis/styleguide/ux-flows/${flow}/page.tsx\``,
        `- Replace the \`NODES\` and \`EDGES\` arrays with the JSON below`,
        `- Keep the rest of the page (PageHero, Section, screen list, design decisions)`,
        `- For edges, choose between \`edgeBase\` (gray line) and \`branchEdge\` (amber line) from context — outputs of a \`decision\` node become \`branchEdge\``,
        `- Add an entry at the top of the \`updates\` array describing the change`,
        ``,
        `NODES:`,
        "```json",
        JSON.stringify(clean.nodes, null, 2),
        "```",
        ``,
        `EDGES:`,
        "```json",
        JSON.stringify(clean.edges, null, 2),
        "```",
      ].join("\n")
    }

    const screens = clean.nodes.filter((n) => n.type === "screen")
    const screenList = screens
      .map((s) => {
        const data = s.data as ScreenData
        return `- \`${data.href}\` — ${data.title}${data.note ? ` — ${data.note}` : ""}`
      })
      .join("\n")

    return [
      `Please scaffold the real product routes based on the \`${flow}\` flow.`,
      ``,
      `For every "screen" node whose href starts with \`/\` (an internal product route):`,
      `- Create \`app/<href>/page.tsx\` with the app layout and the screen title`,
      `- Reuse existing styleguide components; only create new components as a last resort`,
      `- Don't create pages for "decision" nodes — they are logic points only`,
      ``,
      `Screens to create:`,
      screenList || "(no screen with an internal href found)",
      ``,
      `Full flow (JSON for context):`,
      "```json",
      JSON.stringify({ flow, ...clean }, null, 2),
      "```",
    ].join("\n")
  }, [flow, nodes, edges, mode])

  async function copy() {
    try {
      await navigator.clipboard.writeText(prompt)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // clipboard blocked — silently ignore
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-(--bg-raised) rounded-lg border border-(--border-subtle) shadow-(--shadow-lg) w-full max-w-xl mx-4 flex flex-col max-h-[85vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 pb-0 flex flex-col gap-1.5">
          <h2 className="text-base font-semibold text-(--fg-primary) m-0">Copy a prompt for Claude</h2>
          <p className="text-sm text-(--fg-secondary) m-0 leading-relaxed">
            Paste it into the chat with Claude. The node and edge JSON goes inside the prompt.
          </p>
        </div>

        <div className="px-6 pt-4 flex flex-col gap-2">
          <span className="text-xs font-medium text-(--fg-secondary) uppercase tracking-wide">What should Claude do?</span>
          <div className="flex flex-col gap-1.5">
            <label
              className={
                mode === "flow-update"
                  ? "flex items-start gap-2.5 cursor-pointer p-3 rounded-md border border-(--au-blue-400) bg-(--au-blue-100) transition"
                  : "flex items-start gap-2.5 cursor-pointer p-3 rounded-md border border-(--border-default) hover:bg-(--bg-muted) transition"
              }
            >
              <input
                type="radio"
                checked={mode === "flow-update"}
                onChange={() => setMode("flow-update")}
                className="mt-0.5"
              />
              <span className="flex flex-col gap-0.5">
                <span className="text-sm font-medium text-(--fg-primary)">Update this flow in the styleguide</span>
                <span className="text-xs text-(--fg-secondary) leading-snug">
                  Replaces <code className="font-mono text-[10px] px-1 py-0.5 rounded bg-(--bg-muted)">NODES</code> and <code className="font-mono text-[10px] px-1 py-0.5 rounded bg-(--bg-muted)">EDGES</code> in this flow&apos;s <code className="font-mono text-[10px] px-1 py-0.5 rounded bg-(--bg-muted)">page.tsx</code> and adds an entry to <code className="font-mono text-[10px] px-1 py-0.5 rounded bg-(--bg-muted)">updates</code>.
                </span>
              </span>
            </label>

            <label
              className={
                mode === "product-routes"
                  ? "flex items-start gap-2.5 cursor-pointer p-3 rounded-md border border-(--au-blue-400) bg-(--au-blue-100) transition"
                  : "flex items-start gap-2.5 cursor-pointer p-3 rounded-md border border-(--border-default) hover:bg-(--bg-muted) transition"
              }
            >
              <input
                type="radio"
                checked={mode === "product-routes"}
                onChange={() => setMode("product-routes")}
                className="mt-0.5"
              />
              <span className="flex flex-col gap-0.5">
                <span className="text-sm font-medium text-(--fg-primary)">Create the product routes</span>
                <span className="text-xs text-(--fg-secondary) leading-snug">
                  Scaffolds <code className="font-mono text-[10px] px-1 py-0.5 rounded bg-(--bg-muted)">app/&lt;href&gt;/page.tsx</code> for each screen. Decisions don&apos;t become pages.
                </span>
              </span>
            </label>
          </div>
        </div>

        <details className="px-6 pt-4">
          <summary className="cursor-pointer text-xs font-medium text-(--fg-secondary) hover:text-(--fg-primary) select-none">
            Prompt preview
          </summary>
          <pre className="mt-2 text-[10px] leading-relaxed bg-(--bg-canvas) border border-(--border-subtle) rounded-sm p-3 max-h-48 overflow-auto whitespace-pre-wrap wrap-break-word font-mono text-(--fg-secondary)">
            {prompt}
          </pre>
        </details>

        <div className="mt-4 p-4 px-6 flex justify-end gap-2 border-t border-(--border-subtle) bg-(--bg-canvas)">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-md border border-(--border-default) text-sm font-medium text-(--fg-secondary) hover:bg-(--bg-muted) transition"
          >
            Close
          </button>
          <button
            onClick={copy}
            className="px-4 py-2 rounded-md bg-(--au-blue-600) text-white text-sm font-medium hover:bg-(--au-blue-700) transition"
          >
            {copied ? "Copied" : "Copy prompt"}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────
 * ScreenPreviewDrawer — opens the screen's href in an iframe inside an
 * AuSheet (wide). Clicking a screen card in the diagram opens this. For
 * empty hrefs ("#" or "") it shows a "no prototype" message. External
 * URLs open in a new tab instead of the iframe.
 * ──────────────────────────────────────────────────────────────────── */

function isExternal(href: string): boolean {
  return /^https?:\/\//i.test(href)
}

function ScreenPreviewDrawer({
  screen,
  onClose,
}: {
  screen: ScreenData | null
  onClose: () => void
}) {
  const open = !!screen
  const href = screen?.href ?? ""
  const hasPrototype = href.length > 0 && href !== "#"
  const external = hasPrototype && isExternal(href)

  return (
    <AuSheet
      open={open}
      onClose={onClose}
      size="xwide"
      title={screen?.title ?? ""}
      meta={
        screen ? (
          <span className="flex items-baseline gap-2 flex-wrap">
            <span className="au-eyebrow text-(--au-blue-700)">{screen.step}</span>
            {hasPrototype && (
              <span className="text-xs text-(--fg-tertiary)">{href}</span>
            )}
            {hasPrototype && !external && (
              <a
                href={href}
                className="text-xs font-medium text-(--au-blue-700) hover:text-(--au-blue-800) no-underline hover:underline"
              >
                Open as a full page →
              </a>
            )}
          </span>
        ) : undefined
      }
    >
      {!hasPrototype ? (
        <div className="flex flex-col items-center justify-center text-center gap-2 py-12">
          <p className="m-0 text-sm font-medium text-(--fg-primary)">No prototype yet</p>
          <p className="m-0 text-sm text-(--fg-secondary) max-w-sm leading-relaxed">
            This screen has no link to a navigable prototype yet. Add an href in the
            edit suggestion once the prototype exists.
          </p>
        </div>
      ) : external ? (
        <div className="flex flex-col items-center justify-center text-center gap-3 py-12">
          <p className="m-0 text-sm font-medium text-(--fg-primary)">External link</p>
          <p className="m-0 text-sm text-(--fg-secondary) max-w-sm leading-relaxed">
            This step points to an address outside the platform. Open it in a new tab to
            see it.
          </p>
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className="px-3 py-1.5 rounded-md bg-(--au-blue-600) text-white text-xs font-medium hover:bg-(--au-blue-700) transition no-underline"
          >
            Open in a new tab ↗
          </a>
        </div>
      ) : (
        <div className="w-full h-full rounded-md border border-(--border-subtle) overflow-hidden bg-(--bg-canvas)">
          <iframe
            key={href}
            src={href}
            title={screen?.title ?? "Preview"}
            className="block w-full h-full border-0"
          />
        </div>
      )}
    </AuSheet>
  )
}
