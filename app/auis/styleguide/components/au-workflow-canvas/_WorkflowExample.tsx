"use client"

import * as React from "react"
import {
  addEdge,
  useEdgesState,
  useNodesState,
  useReactFlow,
  useStore,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  type NodeProps,
  type XYPosition,
} from "@xyflow/react"
import { AuBreadcrumb } from "@/components/ui/AuBreadcrumb"
import { AuButton } from "@/components/ui/AuButton"
import { AuCheckbox } from "@/components/ui/AuCheckbox"
import { AuDropdownMenu } from "@/components/ui/AuDropdownMenu"
import {
  AuEmpty,
  AuEmptyDescription,
  AuEmptyHeader,
  AuEmptyMedia,
  AuEmptyTitle,
} from "@/components/ui/AuEmpty"
import { AuPill } from "@/components/ui/AuPill"
import { AuSegmented } from "@/components/ui/AuSegmented"
import { AuSheet } from "@/components/ui/AuSheet"
import { AuTabs } from "@/components/ui/AuTabs"
import { AuTextarea } from "@/components/ui/AuTextarea"
import { useToast } from "@/components/ui/AuToast"
import { AuToggle, AuToggleRow } from "@/components/ui/AuToggle"
import {
  AuWorkflowCanvas,
  AuWorkflowNode,
  AuWorkflowNodeResults,
  AuWorkflowNodeRow,
  AuWorkflowNodeSection,
  AuWorkflowNote,
  AuWorkflowToolbar,
  AuWorkflowToolbarDivider,
  AuWorkflowViewControls,
  type AuWorkflowNodeStatus,
  type AuWorkflowNoteTone,
} from "@/components/ui/AuWorkflowCanvas"
import { Icon } from "@/components/ui/Icon"
import { cn } from "@/lib/utils"

/* ─────────────────────────── Demo data ─────────────────────────── */

type TextInputNode = Node<{ text: string }, "textInput">
type FilesNode = Node<{ exposed: boolean }, "files">
type AgentNode = Node<{ model: string; sources: string[]; tools: string[] }, "agent">
type OutputNode = Node<{ text: string }, "result">
type NoteNode = Node<{ title: string; body?: string; tone: AuWorkflowNoteTone }, "note">
type ExampleNode = TextInputNode | FilesNode | AgentNode | OutputNode | NoteNode
type ExampleKind = NonNullable<ExampleNode["type"]>

const MODELS = ["Fast model", "Balanced model", "Reasoning model"]
const SOURCE_OPTIONS = ["Help center", "Product docs", "Refund policy"]
const TOOL_OPTIONS = ["Web search", "Create ticket", "Send email"]

const INITIAL_NODES: ExampleNode[] = [
  { id: "note-message", type: "note", position: { x: 0, y: 0 }, data: { title: "User message", tone: "blue" } },
  { id: "input", type: "textInput", position: { x: 0, y: 100 }, data: { text: "What can you help me with?" } },
  { id: "note-files", type: "note", position: { x: 0, y: 380 }, data: { title: "Uploaded files", tone: "purple" } },
  { id: "files", type: "files", position: { x: 0, y: 480 }, data: { exposed: true } },
  {
    id: "note-agent",
    type: "note",
    position: { x: 400, y: -8 },
    data: { title: "AI assistant", body: "Press Run to try it.", tone: "amber" },
  },
  {
    id: "agent",
    type: "agent",
    position: { x: 400, y: 100 },
    data: { model: MODELS[0], sources: [], tools: [] },
  },
  {
    id: "note-output",
    type: "note",
    position: { x: 800, y: 4 },
    data: { title: "Output", body: "What the person sees.", tone: "emerald" },
  },
  { id: "output", type: "result", position: { x: 800, y: 100 }, data: { text: "" } },
]

const INITIAL_EDGES: Edge[] = [
  { id: "input-agent", source: "input", target: "agent" },
  { id: "files-agent", source: "files", target: "agent" },
  { id: "agent-output", source: "agent", target: "output" },
]

const ADDABLE: { kind: ExampleKind; label: string; icon: string }[] = [
  { kind: "textInput", label: "Text input", icon: "edit_note" },
  { kind: "files", label: "Files", icon: "description" },
  { kind: "agent", label: "AI agent", icon: "smart_toy" },
  { kind: "result", label: "Output", icon: "output" },
  { kind: "note", label: "Note", icon: "sticky_note_2" },
]

function freshNode(kind: ExampleKind, id: string, position: XYPosition): ExampleNode {
  switch (kind) {
    case "textInput":
      return { id, type: kind, position, data: { text: "" } }
    case "files":
      return { id, type: kind, position, data: { exposed: false } }
    case "agent":
      return { id, type: kind, position, data: { model: MODELS[0], sources: [], tools: [] } }
    case "result":
      return { id, type: kind, position, data: { text: "" } }
    case "note":
      return { id, type: kind, position, data: { title: "New note", tone: "neutral" } }
  }
}

function countTokens(text: string) {
  return Math.max(1, Math.round(text.trim().split(/\s+/).filter(Boolean).length * 1.3))
}

function answerFor(prompt: string) {
  return [
    "Here is what I can do in this flow:",
    "- Answer questions from the connected sources",
    "- Read the files people attach",
    "- Call the tools you add to the agent",
    "",
    `You asked: “${prompt}”`,
  ].join("\n")
}

/* ─────────────────────────── Run state ─────────────────────────── */

type RunState = {
  statuses: Record<string, AuWorkflowNodeStatus>
  meta: Record<string, string>
  running: boolean
  run: () => void
  clear: () => void
}

const RunContext = React.createContext<RunState | null>(null)

function useRun() {
  const ctx = React.useContext(RunContext)
  if (!ctx) throw new Error("useRun must be used inside the workflow example")
  return ctx
}

/* ─────────────────────────── Node types ────────────────────────── */

function RunSplit() {
  const { run, clear, running } = useRun()
  return (
    <>
      <AuButton size="sm" variant="secondary" iconLeft="play_arrow" disabled={running} onClick={run}>
        Run
      </AuButton>
      <AuDropdownMenu
        aria-label="Run options"
        trigger={
          <AuButton size="sm" variant="secondary" iconOnly="expand_more" aria-label="Run options" disabled={running} />
        }
        items={[
          { id: "run", label: "Run the flow", icon: "play_arrow", onSelect: run },
          { id: "clear", label: "Clear results", icon: "restart_alt", onSelect: clear },
        ]}
      />
    </>
  )
}

function TextInputNodeView({ id, data, selected }: NodeProps<TextInputNode>) {
  const { updateNodeData } = useReactFlow<ExampleNode>()
  const { statuses, meta } = useRun()
  const done = statuses[id] === "success"
  return (
    <AuWorkflowNode
      icon="edit_note"
      title="Text input"
      description="The message that starts the flow."
      source
      selected={selected}
      status={statuses[id]}
      actions={<RunSplit />}
      footer={
        <AuWorkflowNodeResults meta={meta[id]}>
          {done ? <span>Sent {countTokens(data.text)} tokens to the agent.</span> : undefined}
        </AuWorkflowNodeResults>
      }
    >
      <AuTextarea
        className="nowheel"
        aria-label="Message"
        rows={3}
        placeholder="Type a message"
        value={data.text}
        onChange={(event) => updateNodeData(id, { text: event.target.value })}
      />
    </AuWorkflowNode>
  )
}

function FilesNodeView({ id, data, selected }: NodeProps<FilesNode>) {
  const { updateNodeData } = useReactFlow<ExampleNode>()
  const { statuses, meta } = useRun()
  return (
    <AuWorkflowNode
      icon="description"
      title="Files"
      description="Lets people attach a PDF, a document or a spreadsheet."
      source
      selected={selected}
      status={statuses[id]}
      actions={<RunSplit />}
      footer={<AuWorkflowNodeResults meta={meta[id]} />}
    >
      <AuWorkflowNodeRow
        leading={
          <AuCheckbox
            checked={data.exposed}
            onChange={(next) => updateNodeData(id, { exposed: next })}
            label="Exposed as input"
          />
        }
      >
        Exposed as input
      </AuWorkflowNodeRow>
      <AuWorkflowNodeRow icon="draft">No test files uploaded</AuWorkflowNodeRow>
    </AuWorkflowNode>
  )
}

function PickList({
  label,
  icon,
  addIcon,
  addLabel,
  values,
  options,
  onChange,
}: {
  label: string
  icon: string
  addIcon: string
  addLabel: string
  values: string[]
  options: string[]
  onChange: (next: string[]) => void
}) {
  const next = options.find((option) => !values.includes(option))
  return (
    <AuWorkflowNodeSection label={label}>
      {values.map((value) => (
        <AuWorkflowNodeRow
          key={value}
          icon={icon}
          className="pr-0.5"
          trailing={
            <AuButton
              size="sm"
              variant="ghost"
              iconOnly="close"
              aria-label={`Remove ${value}`}
              onClick={() => onChange(values.filter((v) => v !== value))}
            />
          }
        >
          {value}
        </AuWorkflowNodeRow>
      ))}
      <AuButton
        size="sm"
        variant="secondary"
        block
        iconLeft={addIcon}
        disabled={!next}
        onClick={() => next && onChange([...values, next])}
      >
        {addLabel}
      </AuButton>
    </AuWorkflowNodeSection>
  )
}

function AgentNodeView({ id, data, selected }: NodeProps<AgentNode>) {
  const { updateNodeData } = useReactFlow<ExampleNode>()
  const { statuses, meta } = useRun()
  return (
    <AuWorkflowNode
      icon="smart_toy"
      title="AI agent"
      description="Answers with the model, sources and tools below."
      target
      source
      selected={selected}
      status={statuses[id]}
      footer={<AuWorkflowNodeResults meta={meta[id]} />}
    >
      <AuDropdownMenu
        aria-label="Model"
        trigger={
          <AuButton size="sm" variant="subtle" block iconLeft="stacks" iconRight="expand_more">
            {data.model}
          </AuButton>
        }
        items={MODELS.map((model) => ({
          id: model,
          label: model,
          checked: model === data.model,
          onSelect: () => updateNodeData(id, { model }),
        }))}
      />
      <PickList
        label="Knowledge sources"
        icon="menu_book"
        addIcon="database"
        addLabel="Add knowledge sources"
        values={data.sources}
        options={SOURCE_OPTIONS}
        onChange={(sources) => updateNodeData(id, { sources })}
      />
      <PickList
        label="Tools"
        icon="handyman"
        addIcon="build"
        addLabel="Add tools"
        values={data.tools}
        options={TOOL_OPTIONS}
        onChange={(tools) => updateNodeData(id, { tools })}
      />
    </AuWorkflowNode>
  )
}

function FormattedAnswer({ text }: { text: string }) {
  const blocks: React.ReactNode[] = []
  let bullets: string[] = []
  const flush = () => {
    if (bullets.length === 0) return
    blocks.push(
      <ul key={`ul-${blocks.length}`} className="m-0 flex list-disc flex-col gap-0.5 pl-4">
        {bullets.map((b) => (
          <li key={b}>{b}</li>
        ))}
      </ul>,
    )
    bullets = []
  }
  for (const line of text.split("\n")) {
    if (line.startsWith("- ")) {
      bullets.push(line.slice(2))
      continue
    }
    flush()
    if (line.trim()) blocks.push(<p key={`p-${blocks.length}`} className="m-0">{line}</p>)
  }
  flush()
  return <div className="flex flex-col gap-2">{blocks}</div>
}

function OutputNodeView({ id, data, selected }: NodeProps<OutputNode>) {
  const { updateNodeData } = useReactFlow<ExampleNode>()
  const { statuses, meta } = useRun()
  const toast = useToast()
  const [view, setView] = React.useState<"formatted" | "text">("formatted")
  const empty = <span className="text-(--fg-muted)">Run the flow to see the answer.</span>

  async function copy() {
    try {
      await navigator.clipboard.writeText(data.text)
      toast.push({ title: "Output copied", variant: "success" })
    } catch {
      toast.push({ title: "Could not copy", description: "The browser blocked the clipboard.", variant: "error" })
    }
  }

  return (
    <AuWorkflowNode
      icon="output"
      title="Output"
      description="Shows the result as text."
      target
      selected={selected}
      status={statuses[id]}
      footer={<AuWorkflowNodeResults meta={meta[id]} />}
    >
      <div className="flex items-center gap-1">
        <AuSegmented
          size="sm"
          ariaLabel="Output view"
          options={[
            { value: "formatted", label: "Formatted" },
            { value: "text", label: "Text" },
          ]}
          value={view}
          onChange={setView}
        />
        <span className="flex-1" />
        <AuButton
          size="sm"
          variant="ghost"
          iconOnly="content_copy"
          aria-label="Copy output"
          title="Copy output"
          disabled={!data.text}
          onClick={copy}
        />
        <AuButton
          size="sm"
          variant="ghost"
          iconOnly="delete"
          aria-label="Clear output"
          title="Clear output"
          disabled={!data.text}
          onClick={() => updateNodeData(id, { text: "" })}
        />
      </div>
      {view === "text" ? (
        <AuTextarea
          className="nowheel"
          aria-label="Output text"
          readOnly
          rows={6}
          resize="none"
          placeholder="Run the flow to see the answer."
          value={data.text}
        />
      ) : (
        <div
          aria-live="polite"
          className="nowheel max-h-44 min-h-28 overflow-y-auto rounded-md border border-(--border-default) bg-(--bg-raised) px-3 py-2 text-sm text-(--fg-primary)"
        >
          {data.text ? <FormattedAnswer text={data.text} /> : empty}
        </div>
      )}
    </AuWorkflowNode>
  )
}

function NoteNodeView({ data, selected }: NodeProps<NoteNode>) {
  return (
    <AuWorkflowNote tone={data.tone} title={data.title} selected={selected}>
      {data.body}
    </AuWorkflowNote>
  )
}

const nodeTypes = {
  textInput: TextInputNodeView,
  files: FilesNodeView,
  agent: AgentNodeView,
  // Not "output": React Flow styles its built-in input/output/default/group types.
  result: OutputNodeView,
  note: NoteNodeView,
}

/* ──────────────────────────── Toolbar ──────────────────────────── */

function CanvasTools({
  onAdd,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  minimap,
  onToggleMinimap,
}: {
  onAdd: (kind: ExampleKind, position: XYPosition) => void
  onUndo: () => void
  onRedo: () => void
  canUndo: boolean
  canRedo: boolean
  minimap: boolean
  onToggleMinimap: () => void
}) {
  const { getViewport } = useReactFlow()
  const width = useStore((s) => s.width)
  const height = useStore((s) => s.height)
  const toast = useToast()

  function addAtCenter(kind: ExampleKind) {
    const { x, y, zoom } = getViewport()
    // Centre of the visible area, in flow coordinates, minus half a node.
    onAdd(kind, { x: (width / 2 - x) / zoom - 144, y: (height / 2 - y) / zoom - 80 })
  }

  return (
    <AuWorkflowToolbar>
      <AuButton
        size="sm"
        variant="ai-outline"
        iconLeft="auto_awesome"
        onClick={() =>
          toast.push({
            title: "Ask AI is not connected here",
            description: "Wire this button to your own assistant.",
            variant: "ai",
          })
        }
      >
        Ask AI
      </AuButton>
      <AuDropdownMenu
        aria-label="Add a node"
        side="top"
        align="center"
        trigger={
          <AuButton size="sm" variant="primary" iconLeft="add">
            Add
          </AuButton>
        }
        items={ADDABLE.map((item) => ({
          id: item.kind,
          label: item.label,
          icon: item.icon,
          onSelect: () => addAtCenter(item.kind),
        }))}
      />
      <AuWorkflowToolbarDivider />
      <AuButton size="sm" variant="ghost" iconOnly="undo" aria-label="Undo" title="Undo" disabled={!canUndo} onClick={onUndo} />
      <AuButton size="sm" variant="ghost" iconOnly="redo" aria-label="Redo" title="Redo" disabled={!canRedo} onClick={onRedo} />
      <AuWorkflowToolbarDivider />
      <AuWorkflowViewControls />
      <AuWorkflowToolbarDivider />
      <AuButton
        size="sm"
        variant={minimap ? "subtle" : "ghost"}
        iconOnly="map"
        aria-label="Minimap"
        aria-pressed={minimap}
        title={minimap ? "Hide minimap" : "Show minimap"}
        onClick={onToggleMinimap}
      />
    </AuWorkflowToolbar>
  )
}

/* ──────────────────────────── The screen ───────────────────────── */

const VIEWS = [
  { value: "workflow", label: "Workflow" },
  { value: "interface", label: "Interface" },
  { value: "analytics", label: "Analytics" },
]

const RAIL = [
  { key: "search", icon: "search", label: "Search nodes" },
  { key: "inputs", icon: "download", label: "Inputs" },
  { key: "outputs", icon: "upload", label: "Outputs" },
  { key: "agents", icon: "smart_toy", label: "Agents" },
  { key: "triggers", icon: "bolt", label: "Triggers" },
  { key: "code", icon: "code", label: "Code" },
  { key: "tools", icon: "build", label: "Tools" },
]

type Snapshot = { nodes: ExampleNode[]; edges: Edge[] }

/**
 * A full workflow editor screen, composed from Au* and AuWorkflowCanvas. This
 * is showcase data, not part of the pattern: copy what you need.
 */
export function WorkflowExample() {
  const toast = useToast()
  const [nodes, setNodes, onNodesChangeBase] = useNodesState<ExampleNode>(INITIAL_NODES)
  const [edges, setEdges, onEdgesChangeBase] = useEdgesState<Edge>(INITIAL_EDGES)
  const [past, setPast] = React.useState<Snapshot[]>([])
  const [future, setFuture] = React.useState<Snapshot[]>([])
  const [statuses, setStatuses] = React.useState<Record<string, AuWorkflowNodeStatus>>({})
  const [meta, setMeta] = React.useState<Record<string, string>>({})
  const [running, setRunning] = React.useState(false)
  const [view, setView] = React.useState("workflow")
  const [rail, setRail] = React.useState("agents")
  const [autosave, setAutosave] = React.useState(true)
  const [settingsOpen, setSettingsOpen] = React.useState(false)
  const [snap, setSnap] = React.useState(false)
  const [minimap, setMinimap] = React.useState(false)
  const timers = React.useRef<number[]>([])
  const counter = React.useRef(0)

  React.useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), [])

  // Structural changes (add, connect, delete) are undoable; moving a node is not.
  const commit = React.useCallback(() => {
    setPast((p) => [...p.slice(-29), { nodes, edges }])
    setFuture([])
  }, [nodes, edges])

  const onNodesChange = React.useCallback(
    (changes: NodeChange<ExampleNode>[]) => {
      if (changes.some((c) => c.type === "remove")) commit()
      onNodesChangeBase(changes)
    },
    [commit, onNodesChangeBase],
  )

  const onEdgesChange = React.useCallback(
    (changes: EdgeChange<Edge>[]) => {
      if (changes.some((c) => c.type === "remove")) commit()
      onEdgesChangeBase(changes)
    },
    [commit, onEdgesChangeBase],
  )

  const onConnect = React.useCallback(
    (connection: Connection) => {
      commit()
      setEdges((eds) => addEdge(connection, eds))
    },
    [commit, setEdges],
  )

  function addNode(kind: ExampleKind, position: XYPosition) {
    commit()
    counter.current += 1
    const node = freshNode(kind, `${kind}-${counter.current}`, position)
    setNodes((ns) => [...ns.map((n) => ({ ...n, selected: false })), { ...node, selected: true }])
  }

  function undo() {
    const prev = past.at(-1)
    if (!prev) return
    setPast((p) => p.slice(0, -1))
    setFuture((f) => [{ nodes, edges }, ...f])
    setNodes(prev.nodes)
    setEdges(prev.edges)
  }

  function redo() {
    const next = future[0]
    if (!next) return
    setFuture((f) => f.slice(1))
    setPast((p) => [...p, { nodes, edges }])
    setNodes(next.nodes)
    setEdges(next.edges)
  }

  const clear = React.useCallback(() => {
    timers.current.forEach((t) => window.clearTimeout(t))
    timers.current = []
    setRunning(false)
    setStatuses({})
    setMeta({})
    setEdges((es) => es.map((e) => ({ ...e, animated: false })))
    setNodes((ns) => ns.map((n) => (n.type === "result" ? { ...n, data: { text: "" } } : n)))
  }, [setEdges, setNodes])

  const run = React.useCallback(() => {
    timers.current.forEach((t) => window.clearTimeout(t))
    const ids = (kind: ExampleKind) => nodes.filter((n) => n.type === kind).map((n) => n.id)
    const inputs = [...ids("textInput"), ...ids("files")]
    const agents = ids("agent")
    const outputs = ids("result")
    const firstInput = nodes.find((n): n is TextInputNode => n.type === "textInput")
    const prompt = firstInput?.data.text.trim() || "Hello"
    const tokens = countTokens(prompt)
    const pick = (list: string[], status: AuWorkflowNodeStatus) =>
      Object.fromEntries(list.map((id) => [id, status]))

    setRunning(true)
    setStatuses({ ...pick(inputs, "success"), ...pick(agents, "running") })
    setMeta(Object.fromEntries(inputs.map((id) => [id, `${tokens} tokens · 0.00 s`])))
    setEdges((es) => es.map((e) => ({ ...e, animated: true })))

    timers.current = [
      window.setTimeout(() => {
        setStatuses((s) => ({ ...s, ...pick(agents, "success"), ...pick(outputs, "running") }))
        setMeta((m) => ({ ...m, ...Object.fromEntries(agents.map((id) => [id, `${tokens + 118} tokens · 1.10 s`])) }))
      }, 1100),
      window.setTimeout(() => {
        const answer = answerFor(prompt)
        setStatuses((s) => ({ ...s, ...pick(outputs, "success") }))
        setMeta((m) => ({ ...m, ...Object.fromEntries(outputs.map((id) => [id, `${countTokens(answer)} tokens · 0.20 s`])) }))
        setNodes((ns) => ns.map((n) => (n.type === "result" ? { ...n, data: { text: answer } } : n)))
        setEdges((es) => es.map((e) => ({ ...e, animated: false })))
        setRunning(false)
      }, 1700),
    ]
  }, [nodes, setEdges, setNodes])

  const runState = React.useMemo<RunState>(
    () => ({ statuses, meta, running, run, clear }),
    [statuses, meta, running, run, clear],
  )

  return (
    <RunContext.Provider value={runState}>
      <div className="@container flex h-180 w-full flex-col overflow-hidden rounded-xl border border-(--border-default) bg-(--bg-raised)">
        <header className="flex h-12 shrink-0 items-center gap-3 border-b border-(--border-subtle) px-3">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-(--bg-inverse) text-(--fg-on-inverse)">
            <Icon name="account_tree" size={16} />
          </span>
          {/* The header sheds detail as the frame narrows: breadcrumb, then tabs, then the quiet controls. */}
          <div className="hidden min-w-0 @4xl:block">
            <AuBreadcrumb
              items={[
                { label: <span className="inline-flex items-center gap-1.5"><Icon name="folder" size={16} />Personal</span> },
                { label: "Support assistant", current: true },
              ]}
            />
          </div>
          <div className="hidden flex-1 justify-center @2xl:flex">
            <AuTabs aria-label="Workflow views" items={VIEWS} value={view} onChange={setView} />
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-1.5">
            <div className="hidden items-center gap-1.5 @3xl:flex">
              <AuPill variant="live">v1</AuPill>
              <AuToggle checked={autosave} onChange={setAutosave} label="Auto-save" />
              <AuButton size="sm" variant="ghost" iconOnly="settings" aria-label="Canvas settings" title="Canvas settings" onClick={() => setSettingsOpen(true)} />
              <AuButton
                size="sm"
                variant="ghost"
                iconOnly="save"
                aria-label="Save draft"
                title="Save draft"
                onClick={() => toast.push({ title: "Draft saved", variant: "success" })}
              />
            </div>
            <AuButton size="sm" variant="secondary" iconLeft="play_arrow" loading={running} onClick={run}>
              Run
            </AuButton>
            <AuDropdownMenu
              aria-label="Publish"
              align="end"
              trigger={
                <AuButton size="sm" variant="primary" iconRight="expand_more">
                  Publish
                </AuButton>
              }
              items={[
                {
                  id: "publish",
                  label: "Publish this version",
                  icon: "rocket_launch",
                  onSelect: () => toast.push({ title: "Published v1", variant: "success" }),
                },
                {
                  id: "new",
                  label: "Publish as v2",
                  icon: "new_releases",
                  onSelect: () => toast.push({ title: "Published v2", variant: "success" }),
                },
              ]}
            />
            <AuDropdownMenu
              aria-label="More actions"
              align="end"
              trigger={<AuButton size="sm" variant="ghost" iconOnly="more_horiz" aria-label="More actions" />}
              items={[
                { id: "clear", label: "Clear results", icon: "restart_alt", onSelect: clear },
                {
                  id: "reset",
                  label: "Reset the example",
                  icon: "history",
                  onSelect: () => {
                    clear()
                    setNodes(INITIAL_NODES)
                    setEdges(INITIAL_EDGES)
                    setPast([])
                    setFuture([])
                  },
                },
              ]}
            />
          </div>
        </header>

        <div className="flex min-h-0 flex-1">
          <nav
            aria-label="Workflow sections"
            className="flex w-12 shrink-0 flex-col items-center gap-1 border-r border-(--border-subtle) py-2"
          >
            {RAIL.map((item) => (
              <AuButton
                key={item.key}
                size="sm"
                variant={rail === item.key ? "subtle" : "ghost"}
                iconOnly={item.icon}
                aria-label={item.label}
                aria-current={rail === item.key ? "true" : undefined}
                title={item.label}
                onClick={() => setRail(item.key)}
              />
            ))}
            <span className="flex-1" />
            <AuButton size="sm" variant="ghost" iconOnly="help" aria-label="Help" title="Help" />
          </nav>

          <div className="min-w-0 flex-1">
            {view === "workflow" ? (
              <AuWorkflowCanvas<ExampleNode, Edge>
                aria-label="Workflow canvas"
                nodes={nodes}
                edges={edges}
                nodeTypes={nodeTypes}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                fitView
                fitViewOptions={{ padding: 0.22 }}
                snapToGrid={snap}
                snapGrid={[16, 16]}
                // Embedded in a scrolling docs page: let the wheel scroll the page.
                zoomOnScroll={false}
                preventScrolling={false}
                minimap={minimap}
                status={
                  <span className="flex items-center gap-2 text-xs text-(--fg-tertiary)">
                    <span
                      aria-hidden="true"
                      className={cn("size-2 rounded-full", autosave ? "bg-(--accent-success)" : "bg-(--fg-muted)")}
                    />
                    {autosave ? (
                      <span>
                        Draft saved <span className="text-(--fg-secondary)">just now</span>
                      </span>
                    ) : (
                      "Auto-save is off"
                    )}
                  </span>
                }
                toolbar={
                  <CanvasTools
                    onAdd={addNode}
                    onUndo={undo}
                    onRedo={redo}
                    canUndo={past.length > 0}
                    canRedo={future.length > 0}
                    minimap={minimap}
                    onToggleMinimap={() => setMinimap((v) => !v)}
                  />
                }
              />
            ) : (
              <div className="flex h-full items-center justify-center bg-(--bg-muted) dark:bg-(--bg-canvas)">
                <AuEmpty>
                  <AuEmptyHeader>
                    <AuEmptyMedia variant="icon">
                      <Icon name="construction" size={24} />
                    </AuEmptyMedia>
                    <AuEmptyTitle>Not part of this example</AuEmptyTitle>
                    <AuEmptyDescription>Only the Workflow view is built here.</AuEmptyDescription>
                  </AuEmptyHeader>
                </AuEmpty>
              </div>
            )}
          </div>
        </div>
      </div>

      <AuSheet
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        title="Canvas settings"
        meta="Applies to this canvas only"
        footer={
          <AuButton block variant="primary" onClick={() => setSettingsOpen(false)}>
            Done
          </AuButton>
        }
      >
        <div className="flex flex-col gap-3">
          <AuToggleRow
            title="Snap to grid"
            description="Nodes land on the 16 px grid when you drop them."
            checked={snap}
            onChange={setSnap}
          />
          <AuToggleRow
            title="Show minimap"
            description="An overview in the corner you can drag to move around."
            checked={minimap}
            onChange={setMinimap}
          />
        </div>
      </AuSheet>
    </RunContext.Provider>
  )
}

/* ───────────────────────── States canvas ───────────────────────── */

type StateNode = Node<{ status: AuWorkflowNodeStatus; selected?: boolean; meta?: string }, "state">
type ToneNode = Node<{ tone: AuWorkflowNoteTone }, "tone">

function StateNodeView({ data }: NodeProps<StateNode>) {
  const label = data.selected ? "selected" : data.status
  return (
    <AuWorkflowNode
      icon="smart_toy"
      title={`status="${data.status}"`}
      description={data.selected ? "selected, idle" : `The ${label} state.`}
      target
      source
      status={data.status}
      selected={data.selected}
      footer={<AuWorkflowNodeResults meta={data.meta} />}
    />
  )
}

function ToneNodeView({ data }: NodeProps<ToneNode>) {
  return (
    <AuWorkflowNote tone={data.tone} title={`tone="${data.tone}"`}>
      A section label or a one-line hint.
    </AuWorkflowNote>
  )
}

const stateNodeTypes = { state: StateNodeView, tone: ToneNodeView }

const STATE_NODES: (StateNode | ToneNode)[] = [
  { id: "idle", type: "state", position: { x: 0, y: 0 }, data: { status: "idle" } },
  { id: "selected", type: "state", position: { x: 340, y: 0 }, data: { status: "idle", selected: true } },
  { id: "running", type: "state", position: { x: 680, y: 0 }, data: { status: "running", meta: "Running…" } },
  { id: "success", type: "state", position: { x: 1020, y: 0 }, data: { status: "success", meta: "131 tokens · 1.10 s" } },
  { id: "error", type: "state", position: { x: 1360, y: 0 }, data: { status: "error", meta: "Timed out · 30.0 s" } },
  ...(["neutral", "blue", "amber", "emerald", "purple"] as const).map(
    (tone, i): ToneNode => ({ id: `tone-${tone}`, type: "tone", position: { x: i * 340, y: 220 }, data: { tone } }),
  ),
]

const STATE_EDGES: Edge[] = [
  { id: "s1", source: "idle", target: "selected" },
  { id: "s2", source: "selected", target: "running", animated: true },
  { id: "s3", source: "running", target: "success" },
  { id: "s4", source: "success", target: "error" },
]

/** Every node status and note tone on one read-only canvas. */
export function WorkflowStatesExample() {
  return (
    <div className="h-96 w-full overflow-hidden rounded-lg border border-(--border-default)">
      <AuWorkflowCanvas<StateNode | ToneNode, Edge>
        aria-label="Node states"
        nodes={STATE_NODES}
        edges={STATE_EDGES}
        nodeTypes={stateNodeTypes}
        fitView
        fitViewOptions={{ padding: 0.08 }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnDrag={false}
        zoomOnScroll={false}
        zoomOnPinch={false}
        zoomOnDoubleClick={false}
        preventScrolling={false}
      />
    </div>
  )
}
