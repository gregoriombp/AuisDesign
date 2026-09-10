"use client"

/* ─────────────────────────────────────────────────────────────────────
 * Golden-eye example (compiled view)
 *
 * Merges three product-neutral journeys into ONE graph, overlaid on the
 * same board:
 *   1. Visual change — project → styleguide → component page → review.
 *   2. Structural change — project → UX flow hub → example flow → review.
 *   3. State coverage — project → state matrix → example screen (opened in
 *      each of its states through `?ge=` deep links) → review.
 *
 * Building blocks (copy them when authoring a real compiled view):
 *   - Dedup — screens shared by scenarios become ONE card, with one dot per
 *     owning scenario (2+ dots = shared screen).
 *   - Focus lenses — "All" + one per scenario. Dims nodes AND edges outside
 *     the scenario and draws its band.
 *   - Click-to-open — clicking a card opens the real screen in a side panel,
 *     with a variant switch when the card lists several states.
 *   - Comment — clicking a card in Comment mode sends the note to the Review
 *     Bridge as a `ux-flow` comment.
 *
 * Self-contained (ReactFlow directly, without the shared FlowDiagram).
 * ──────────────────────────────────────────────────────────────────── */

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  ReactFlow,
  Background,
  Controls,
  Panel,
  Handle,
  Position,
  MarkerType,
  type Edge,
  type Node,
  type NodeChange,
  type NodeProps,
  type ReactFlowInstance,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"

import { Icon } from "@/components/ui/Icon"
import { PageHero, Section } from "../../styleguide/_primitives"
import {
  GoldenEyeCommentComposer,
  GoldenEyeScreenPreview,
} from "../_components/golden-eye-overlays"
import { useGoldenEyeComments } from "../_components/use-golden-eye-comments"
import {
  FlowUpdatesBadge,
  FlowUpdatesHistorySection,
  type FlowUpdate,
} from "../_components/flow-updates"

/* ─── State deep links (?ge=) ───────────────────────────────────────── */
/* The FlowStateDriver (mounted in the root layout) reads `?ge=` and replays
   the click path after hydration — so states that live in useState (modals,
   sheets) get a URL and the card opens the screen ALREADY in that state.
   Grammar: steps separated by `>>`; `t:<text>` clicks the first clickable
   whose text matches; `c:<css>` clicks the selector; `w:<ms>` waits.
   States that a screen exposes through the State Mode registry (`?state=`)
   need no recipe — link the query param directly. */
const ge = (path: string, recipe: string) => `${path}?ge=${encodeURIComponent(recipe)}`

/* ─── Scenarios ─────────────────────────────────────────────────────── */

type Scenario = "visual" | "structural" | "states"
type Focus = Scenario | "all"

const SCENARIO: Record<Scenario, { label: string; color: string }> = {
  visual: { label: "Visual change", color: "var(--au-blue-600)" },
  structural: { label: "Structural change", color: "var(--au-emerald-600)" },
  states: { label: "State coverage", color: "var(--au-purple-600)" },
}
const ALL = Object.keys(SCENARIO) as Scenario[]

const FOCI: { id: Focus; label: string }[] = [
  { id: "all", label: "All" },
  ...ALL.map((s) => ({ id: s, label: SCENARIO[s].label })),
]

/* ─── Node data ─────────────────────────────────────────────────────── */

type ScreenVariant = { label: string; href: string }
type ScreenData = {
  step?: string
  title: string
  note?: string
  href?: string
  variants?: ScreenVariant[]
  scenarios: Scenario[]
  _comments?: number
}
type DecisionData = {
  step?: string
  title: string
  question?: string
  scenarios: Scenario[]
  _comments?: number
}
type SectionData = { title: string; scenario: Scenario }

/* Comment pin — shows on a card when it has notes. */
function CommentPin({ n }: { n: number }) {
  return (
    <span className="absolute -left-2 -top-2 z-20 inline-flex h-5 items-center justify-center gap-0.5 rounded-full border border-(--au-amber-300) bg-(--au-amber-500) px-1.5 text-3xs font-bold text-white shadow-(--shadow-sm)">
      <Icon name="chat_bubble" size={11} />
      {n}
    </span>
  )
}

/* ─── Scenario dots ─────────────────────────────────────────────────── */

function ScenarioDots({ scenarios }: { scenarios: Scenario[] }) {
  return (
    <div className="absolute right-2 top-2 flex gap-1">
      {scenarios.map((s) => (
        <span
          key={s}
          className="inline-block h-2 w-2 rounded-full"
          style={{ background: SCENARIO[s].color }}
          title={SCENARIO[s].label}
        />
      ))}
    </div>
  )
}

/* ─── Handles ───────────────────────────────────────────────────────── */

const SIDES: { id: string; pos: Position }[] = [
  { id: "t", pos: Position.Top },
  { id: "b", pos: Position.Bottom },
  { id: "l", pos: Position.Left },
  { id: "r", pos: Position.Right },
]
function NodeHandles() {
  const cls = "border-0! w-1.5! h-1.5! bg-(--border-strong)!"
  return (
    <>
      {SIDES.map((s) => (
        <Handle key={s.id + "-t"} id={s.id + "-t"} type="target" position={s.pos} style={{ opacity: 0 }} className={cls} />
      ))}
      {SIDES.map((s) => (
        <Handle key={s.id + "-s"} id={s.id + "-s"} type="source" position={s.pos} style={{ opacity: 0 }} className={cls} />
      ))}
    </>
  )
}

/* ─── Renderers ─────────────────────────────────────────────────────── */

function ScreenNode({ data }: NodeProps<Node<ScreenData>>) {
  return (
    <div className="relative w-52 cursor-pointer rounded-lg border border-(--border-default) bg-(--bg-raised) shadow-(--shadow-sm) transition hover:border-(--au-blue-400) hover:shadow-(--shadow-md)">
      <NodeHandles />
      <ScenarioDots scenarios={data.scenarios} />
      {data._comments ? <CommentPin n={data._comments} /> : null}
      <div className="flex flex-col gap-1 px-4 py-3 pr-10">
        {data.step && <span className="au-eyebrow text-(--au-blue-700)">{data.step}</span>}
        <span className="text-sm font-medium leading-tight text-(--fg-primary)">{data.title}</span>
        {data.note && <span className="caption text-(--fg-tertiary)">{data.note}</span>}
        {data.variants && data.variants.length > 1 && (
          <span className="caption inline-flex items-center gap-1 text-(--fg-tertiary)">
            <Icon name="layers" size={12} />
            {data.variants.length} states
          </span>
        )}
      </div>
    </div>
  )
}

function DecisionNode({ data }: NodeProps<Node<DecisionData>>) {
  return (
    <div className="relative flex w-56 flex-col gap-1 rounded-lg border-2 border-dashed border-(--au-amber-400) bg-(--au-amber-100) px-4 py-3 pr-10">
      <NodeHandles />
      <ScenarioDots scenarios={data.scenarios} />
      {data._comments ? <CommentPin n={data._comments} /> : null}
      <span className="au-eyebrow text-(--au-amber-800)">decision</span>
      <span className="text-sm font-medium leading-tight text-(--au-amber-900)">{data.title}</span>
      {data.question && <span className="text-xs leading-snug text-(--au-amber-800)">{data.question}</span>}
    </div>
  )
}

function SectionNode({ data }: NodeProps<Node<SectionData>>) {
  const tint = SCENARIO[data.scenario].color
  return (
    <div
      className="pointer-events-none h-full w-full rounded-2xl"
      style={{
        background: `color-mix(in oklab, ${tint} 6%, transparent)`,
        border: `1.5px dashed color-mix(in oklab, ${tint} 30%, transparent)`,
      }}
    >
      <span
        className="au-eyebrow absolute left-3 top-2.5 rounded-sm px-1.5 py-0.5"
        style={{ color: tint, background: `color-mix(in oklab, ${tint} 12%, transparent)` }}
      >
        {data.title}
      </span>
    </div>
  )
}

const nodeTypes = { screen: ScreenNode, decision: DecisionNode, section: SectionNode }

/* ─── Edges ─────────────────────────────────────────────────────────── */

const base = {
  type: "smoothstep" as const,
  markerEnd: { type: MarkerType.ArrowClosed, width: 15, height: 15 },
  style: { stroke: "var(--border-strong)", strokeWidth: 1.4 },
}
const branch = {
  ...base,
  style: { stroke: "var(--au-amber-500)", strokeWidth: 1.4 },
  markerEnd: { type: MarkerType.ArrowClosed, width: 15, height: 15, color: "var(--au-amber-500)" },
}
const cross = {
  ...base,
  style: { stroke: "var(--au-pink-500)", strokeWidth: 1.4, strokeDasharray: "5 3" },
  markerEnd: { type: MarkerType.ArrowClosed, width: 15, height: 15, color: "var(--au-pink-500)" },
}

/* ─── Merged graph ──────────────────────────────────────────────────── */
/* The project is the only card shared by the 3 scenarios — everything starts
   there. Visual work goes down the left, structural work down the right and
   state coverage runs along the far right as a cross-linked audit; all three
   converge in the review step. */

const EX = 80 // stream: visual change (left)
const TX = 520 // trunk: project + decision + review (centre)
const AX = 960 // stream: structural change (right)
const GX = 1360 // stream: state coverage (far right)

const S = (id: string, x: number, y: number, d: ScreenData): Node => ({ id, type: "screen", position: { x, y }, zIndex: 10, data: d })
const D = (id: string, x: number, y: number, d: DecisionData): Node => ({ id, type: "decision", position: { x, y }, zIndex: 10, data: d })

const VI: Scenario[] = ["visual"]
const ST: Scenario[] = ["structural"]
const SC: Scenario[] = ["states"]
const CHANGE: Scenario[] = ["visual", "structural"]

const STATES_EXAMPLE = "/auis/states/example"

const BASE_NODES: Node[] = [
  /* ═══ TRUNK (shared) ═══ */
  S("project", TX, 0, {
    step: "entry",
    title: "Open a project",
    note: "Every journey starts from a concrete workspace",
    href: "/auis/projects",
    scenarios: ALL,
  }),
  D("d-change", TX - 8, 200, {
    title: "Classify the change",
    question: "Does the structure of the journey change, or only how it looks?",
    scenarios: CHANGE,
  }),
  S("review", TX, 820, {
    step: "end",
    title: "Review the result",
    note: "Comments and suggestions converge in the same approval loop",
    href: "/auis/review-bridge",
    scenarios: ALL,
  }),

  /* ═══ STREAM: visual change (left) ═══ */
  S("styleguide", EX, 420, {
    step: "visual · 01",
    title: "Use the styleguide",
    note: "Foundations first: tokens, typography, spacing",
    href: "/auis/styleguide",
    scenarios: VI,
  }),
  S("component", EX, 600, {
    step: "visual · 02",
    title: "Check the component contract",
    note: "Props, states and tokens consumed by the component you touch",
    href: "/auis/styleguide/components/au-button",
    scenarios: VI,
  }),

  /* ═══ STREAM: structural change (right) ═══ */
  S("hub", AX, 420, {
    step: "structural · 01",
    title: "Map the journey",
    note: "Branches, decisions and terminal states made explicit",
    href: "/auis/ux-flow",
    scenarios: ST,
  }),
  S("flow", AX, 600, {
    step: "structural · 02",
    title: "Open the example flow",
    note: "Suggest a structural change straight from the canvas",
    href: "/auis/ux-flow/example",
    scenarios: ST,
  }),

  /* ═══ STREAM: state coverage (far right · audit) ═══ */
  S("matrix", GX, 200, {
    step: "states · 01",
    title: "State matrix",
    note: "Every registered screen in every state, side by side",
    href: "/auis/states",
    scenarios: SC,
  }),
  S("example-screen", GX, 420, {
    step: "states · 02",
    title: "Example screen, state by state",
    note: "Registry states use ?state=; interaction states use ?ge= recipes",
    href: STATES_EXAMPLE,
    variants: [
      { label: "Default", href: STATES_EXAMPLE },
      { label: "Empty", href: `${STATES_EXAMPLE}?state=empty` },
      { label: "Loading", href: `${STATES_EXAMPLE}?state=loading` },
      { label: "New item (modal)", href: ge(STATES_EXAMPLE, "t:New item") },
      { label: "Details (side panel)", href: ge(STATES_EXAMPLE, "t:Open details") },
    ],
    scenarios: SC,
  }),
  D("d-gap", GX - 8, 620, {
    title: "Any state missing?",
    question: "A screen without an empty, loading or error state is a gap, not a detail.",
    scenarios: SC,
  }),
]

const EDGES: Edge[] = [
  /* Project → the three streams */
  { id: "e1", source: "project", target: "d-change", sourceHandle: "b-s", targetHandle: "t-t", ...base },
  { id: "e2", source: "project", target: "matrix", sourceHandle: "r-s", targetHandle: "l-t", label: "Coverage check", ...cross },

  /* Decision → visual or structural */
  { id: "v1", source: "d-change", target: "styleguide", sourceHandle: "l-s", targetHandle: "t-t", label: "Only the look", ...branch },
  { id: "s1", source: "d-change", target: "hub", sourceHandle: "r-s", targetHandle: "t-t", label: "The structure", ...branch },

  /* Visual — styleguide then component contract, back to review */
  { id: "v2", source: "styleguide", target: "component", sourceHandle: "b-s", targetHandle: "t-t", ...base },
  { id: "v3", source: "component", target: "review", sourceHandle: "b-s", targetHandle: "l-t", label: "Ready for review", ...base },

  /* Structural — hub then flow, back to review */
  { id: "s2", source: "hub", target: "flow", sourceHandle: "b-s", targetHandle: "t-t", ...base },
  { id: "s3", source: "flow", target: "review", sourceHandle: "b-s", targetHandle: "r-t", label: "Suggestion filed", ...base },

  /* States — matrix, example screen, gap decision, review */
  { id: "c1", source: "matrix", target: "example-screen", sourceHandle: "b-s", targetHandle: "t-t", ...base },
  { id: "c2", source: "example-screen", target: "d-gap", sourceHandle: "b-s", targetHandle: "t-t", ...base },
  { id: "c3", source: "d-gap", target: "review", sourceHandle: "b-s", targetHandle: "r-t", label: "Gap becomes a comment", ...cross },
  { id: "c4", source: "d-gap", target: "matrix", sourceHandle: "r-s", targetHandle: "r-t", label: "Covered · next screen", ...cross },
]

const NODE_SCENARIOS: Record<string, Scenario[]> = Object.fromEntries(
  BASE_NODES.map((n) => [n.id, (n.data as ScreenData | DecisionData).scenarios]),
)

/* Band of the focused scenario: bounding box of its nodes. */
const FOOTPRINT = { w: 230, h: 120 }
const PAD = 40
function focusBand(focus: Scenario): Node {
  const members = BASE_NODES.filter((n) => (n.data as ScreenData | DecisionData).scenarios.includes(focus))
  const xs = members.map((n) => n.position.x)
  const ys = members.map((n) => n.position.y)
  const minX = Math.min(...xs) - PAD
  const minY = Math.min(...ys) - PAD
  return {
    id: "band",
    type: "section",
    position: { x: minX, y: minY },
    style: {
      width: Math.max(...xs) + FOOTPRINT.w + PAD - minX,
      height: Math.max(...ys) + FOOTPRINT.h + PAD - minY,
    },
    zIndex: 0,
    selectable: false,
    draggable: false,
    data: { title: SCENARIO[focus].label, scenario: focus },
  }
}

/* ─── Changelog ─────────────────────────────────────────────────────── */

const updates: FlowUpdate[] = [
  {
    date: "2026-09-10",
    summary:
      "Rebuilt as a self-contained compiled view: three scenarios overlaid (visual · structural · state coverage), focus lenses with bands, Move/Comment modes, fullscreen, and state deep links (?state= and ?ge=) on the example screen card.",
    tags: ["flow-rework", "integration"],
  },
  {
    date: "2026-07-16",
    summary: "Added a neutral compiled-flow reference with two focus lenses.",
    tags: ["new-page"],
  },
]

/* ─── Page ──────────────────────────────────────────────────────────── */

export default function ExampleGoldenEyePage() {
  const [focus, setFocus] = useState<Focus>("all")
  const [openScreen, setOpenScreen] = useState<{ title: string; variants: ScreenVariant[] } | null>(null)
  const [screenPreviewOpen, setScreenPreviewOpen] = useState(false)
  const [screenVariant, setScreenVariant] = useState(0)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [commentMode, setCommentMode] = useState(false)
  const { comments, addComment } = useGoldenEyeComments({ flow: "example-golden-eye" })
  const [composer, setComposer] = useState<{ id: string; title: string } | null>(null)
  const [composerOpen, setComposerOpen] = useState(false)
  const [draft, setDraft] = useState("")
  const [sending, setSending] = useState(false)
  /* Positions dragged by the user (override the base layout). */
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>({})
  const rfRef = useRef<ReactFlowInstance | null>(null)

  const nodes = useMemo<Node[]>(() => {
    const dimmed = BASE_NODES.map((n) => {
      const scenarios = (n.data as ScreenData | DecisionData).scenarios
      const dim = focus !== "all" && !scenarios.includes(focus as Scenario)
      return {
        ...n,
        position: positions[n.id] ?? n.position,
        data: { ...n.data, _comments: comments[n.id]?.length },
        className: dim
          ? "opacity-15 saturate-0 transition-all duration-300"
          : "opacity-100 transition-all duration-300",
      }
    })
    return focus === "all" ? dimmed : [focusBand(focus as Scenario), ...dimmed]
  }, [focus, comments, positions])

  /* Persist drags: without this the controlled ReactFlow snaps the card back. */
  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setPositions((prev) => {
      let next = prev
      for (const ch of changes) {
        if (ch.type === "position" && ch.position && ch.id !== "band") {
          next = { ...next, [ch.id]: ch.position }
        }
      }
      return next
    })
  }, [])

  const edges = useMemo<Edge[]>(() => {
    if (focus === "all") return EDGES
    return EDGES.map((e) => {
      const on =
        NODE_SCENARIOS[e.source]?.includes(focus as Scenario) &&
        NODE_SCENARIOS[e.target]?.includes(focus as Scenario)
      return on ? e : { ...e, label: undefined, style: { ...(e.style as object), opacity: 0.1 } }
    })
  }, [focus])

  /* Fullscreen: re-fit on enter/exit + Escape to leave. */
  useEffect(() => {
    const t = setTimeout(() => rfRef.current?.fitView({ padding: 0.08, duration: 200 }), 60)
    return () => clearTimeout(t)
  }, [isFullscreen])
  useEffect(() => {
    if (!isFullscreen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsFullscreen(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [isFullscreen])

  const sendComment = useCallback(async () => {
    if (!composer || !draft.trim()) return
    setSending(true)
    try {
      const saved = await addComment(composer, draft)
      if (saved) setDraft("")
    } catch (error) {
      console.error("[golden-eye-comments] save", error)
    } finally {
      setSending(false)
    }
  }, [addComment, composer, draft])

  /* Focus chips — reused above the canvas and inside fullscreen. */
  const focusTabs = (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="caption mr-1 text-(--fg-tertiary)">Focus:</span>
      {FOCI.map((f) => {
        const on = focus === f.id
        const color = f.id === "all" ? "var(--au-blue-600)" : SCENARIO[f.id as Scenario].color
        return (
          <button
            key={f.id}
            type="button"
            onClick={() => setFocus(f.id)}
            className={
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition " +
              (on
                ? "border-(--au-blue-300) bg-(--au-blue-100) text-(--au-blue-800)"
                : "border-(--border-default) bg-(--bg-raised) text-(--fg-secondary) hover:border-(--au-blue-300) hover:text-(--au-blue-700)")
            }
          >
            {f.id !== "all" && <span className="inline-block h-2 w-2 rounded-full" style={{ background: color }} />}
            {f.label}
          </button>
        )
      })}
    </div>
  )

  return (
    <>
      <PageHero
        title="Golden-eye example"
        trailing={
          <>
            <span className="inline-flex items-center rounded-full border border-(--au-amber-300) bg-(--au-amber-100) px-2 py-0.5 text-2xs font-medium text-(--au-amber-800)">
              compiled view
            </span>
            <FlowUpdatesBadge updates={updates} />
          </>
        }
      >
        Three product-neutral journeys overlaid on one board: a visual change
        (styleguide and component contract), a structural change (UX flow hub and
        example flow) and a state-coverage audit (state matrix and the example
        screen opened in each of its states). Shared screens become one card with a
        dot per scenario. Switch the lens to focus; click a card to open the screen.
      </PageHero>

      {/* Full-width canvas (outside the text column) */}
      <div className="w-full px-10 pb-10">
        <Section
          id="flow"
          title="Compiled flowchart"
          lead="2+ dots on a card = screen shared between scenarios. The lens dims what is outside the focused scenario and draws its band. In Move mode: drag cards and click to open the real screen. In Comment mode: click a card to leave a note. Fullscreen button in the corner."
        >
          {/* Focus tabs */}
          <div className="mb-3">{focusTabs}</div>

          {/* Legend */}
          <div className="caption mb-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-(--fg-tertiary)">
            {ALL.map((s) => (
              <span key={s} className="inline-flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: SCENARIO[s].color }} />
                {SCENARIO[s].label}
              </span>
            ))}
            <span className="text-(--fg-tertiary)">·</span>
            <span>2+ dots = shared card · click opens the screen</span>
          </div>

          <div
            className={
              isFullscreen
                ? "fixed inset-0 z-40 bg-(--bg-canvas) p-3"
                : "overflow-hidden rounded-xl border border-(--border-default) bg-(--bg-canvas)"
            }
            style={isFullscreen ? undefined : { height: 880 }}
          >
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              nodeTypes={nodeTypes}
              fitView
              fitViewOptions={{ padding: 0.08 }}
              minZoom={0.15}
              maxZoom={1.75}
              nodesConnectable={false}
              nodesDraggable={!commentMode}
              proOptions={{ hideAttribution: true }}
              onInit={(inst) => {
                rfRef.current = inst as ReactFlowInstance
              }}
              onNodeClick={(_, node) => {
                const d = node.data as ScreenData
                if (commentMode) {
                  setComposer({ id: node.id, title: d.title })
                  setComposerOpen(true)
                  return
                }
                if (node.type === "screen" && (d.variants?.length || d.href)) {
                  const variants = d.variants?.length ? d.variants : [{ label: d.title, href: d.href! }]
                  setScreenVariant(0)
                  setOpenScreen({ title: d.title, variants })
                  setScreenPreviewOpen(true)
                }
              }}
            >
              <Background color="var(--border-default)" gap={24} size={1.5} />
              <Controls showInteractive={false} />

              {/* Focus — fullscreen only (outside it the chips already sit above the canvas) */}
              {isFullscreen && (
                <Panel position="top-left">
                  <div className="rounded-xl border border-(--border-default) bg-(--bg-raised)/95 px-3 py-2 shadow-(--shadow-md) backdrop-blur">
                    {focusTabs}
                  </div>
                </Panel>
              )}

              {/* Fullscreen (top-right corner) */}
              <Panel position="top-right">
                <button
                  type="button"
                  onClick={() => setIsFullscreen((v) => !v)}
                  title={isFullscreen ? "Exit fullscreen (Esc)" : "Fullscreen"}
                  className="inline-flex items-center gap-1.5 rounded-md border border-(--border-default) bg-(--bg-raised) px-2.5 py-1.5 text-xs font-medium text-(--fg-secondary) shadow-(--shadow-sm) transition hover:border-(--au-blue-300) hover:text-(--au-blue-700)"
                >
                  <Icon name={isFullscreen ? "fullscreen_exit" : "fullscreen"} size={14} />
                  {isFullscreen ? "Exit fullscreen" : "Fullscreen"}
                </button>
              </Panel>

              {/* Move / Comment toolbar (bottom centre) */}
              <Panel position="bottom-center">
                <div className="mb-2 flex items-center gap-1 rounded-full border border-(--border-default) bg-(--bg-raised) p-1 shadow-(--shadow-md)">
                  <button
                    type="button"
                    onClick={() => setCommentMode(false)}
                    aria-pressed={!commentMode}
                    className={
                      "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition " +
                      (!commentMode ? "bg-(--au-blue-100) text-(--au-blue-800)" : "text-(--fg-secondary) hover:bg-(--bg-muted)")
                    }
                  >
                    Move
                  </button>
                  <button
                    type="button"
                    onClick={() => setCommentMode(true)}
                    aria-pressed={commentMode}
                    title="Comment — goes to the Review Bridge, where the agent reads it"
                    className={
                      "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition " +
                      (commentMode ? "bg-(--au-amber-100) text-(--au-amber-800)" : "text-(--fg-secondary) hover:bg-(--bg-muted)")
                    }
                  >
                    Comment
                  </button>
                  {commentMode && <span className="px-2 text-2xs text-(--fg-tertiary)">click a card to leave a note</span>}
                </div>
              </Panel>
            </ReactFlow>
          </div>
        </Section>
      </div>

      {/* Docs — regular text column */}
      <div className="mx-auto flex max-w-6xl flex-col gap-16 px-10 pb-14">
        {/* Compiled scenarios */}
        <Section id="scenarios" title="Compiled scenarios" lead="Each journey overlaid on this map: what it is, where it enters, where it converges.">
          <ul className="flex max-w-3xl flex-col gap-4">
            <li className="flex gap-3">
              <span className="mt-1.5 inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: SCENARIO.visual.color }} />
              <div className="text-(--body-md-size) text-(--fg-secondary)">
                <strong className="text-(--fg-primary)">Visual change.</strong> The decision{" "}
                <em>Classify the change</em> sends look-only work to the styleguide, then to the
                contract of the component being touched (props, states, tokens consumed). Enters
                through the project, <strong>converges in review</strong>.
              </div>
            </li>
            <li className="flex gap-3">
              <span className="mt-1.5 inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: SCENARIO.structural.color }} />
              <div className="text-(--body-md-size) text-(--fg-secondary)">
                <strong className="text-(--fg-primary)">Structural change.</strong> When the journey
                itself changes, the same decision routes to the UX flow hub and then into a flow
                page, where a suggestion can be filed straight from the canvas. Enters through
                the project, converges in review with the suggestion attached.
              </div>
            </li>
            <li className="flex gap-3">
              <span className="mt-1.5 inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: SCENARIO.states.color }} />
              <div className="text-(--body-md-size) text-(--fg-secondary)">
                <strong className="text-(--fg-primary)">State coverage.</strong> A cross-linked
                audit: the state matrix lists every registered screen in every state, and the
                example screen card carries one variant per state — registry states through{" "}
                <code>?state=</code>, interaction states through <code>?ge=</code> recipes replayed
                by the FlowStateDriver. The decision <em>Any state missing?</em> either loops to the
                next screen or turns the gap into a review comment.
              </div>
            </li>
          </ul>
        </Section>

        {/* Shared screens and convergence */}
        <Section id="shared" title="Shared screens and convergence" lead="Why these screens became a single card — and where the scenarios meet again.">
          <ol className="flex max-w-3xl list-decimal flex-col gap-3 pl-5 text-(--body-md-size) text-(--fg-secondary)">
            <li>
              <strong className="text-(--fg-primary)">The project is the only card with 3 dots.</strong>{" "}
              All three scenarios start there: visual, structural and state work are layers of the
              same workspace, not separate routes.
            </li>
            <li>
              <strong className="text-(--fg-primary)">Review is the convergence.</strong> The visual and
              structural streams re-enter <em>Review the result</em> from opposite sides; the coverage
              audit joins with a dashed cross edge because it arrives as a comment, not as a change.
            </li>
            <li>
              <strong className="text-(--fg-primary)">One card, many states.</strong> <em>Example screen,
              state by state</em> is a single card with five variants — the side panel switches
              between them, so the map stays readable while every state stays one click away.
            </li>
            <li>
              <strong className="text-(--fg-primary)">Two gates.</strong> <em>Classify the change</em>{" "}
              separates look from structure; <em>Any state missing?</em> separates a covered screen
              from a gap that needs a comment.
            </li>
          </ol>
        </Section>

        {/* Changelog */}
        <FlowUpdatesHistorySection updates={updates} />
      </div>

      <GoldenEyeScreenPreview
        open={screenPreviewOpen}
        screen={openScreen}
        activeVariant={screenVariant}
        onActiveVariantChange={setScreenVariant}
        onClose={() => setScreenPreviewOpen(false)}
      />

      <GoldenEyeCommentComposer
        open={composerOpen}
        target={composer}
        comments={composer ? comments[composer.id] ?? [] : []}
        draft={draft}
        onDraftChange={setDraft}
        sending={sending}
        onSend={sendComment}
        onClose={() => setComposerOpen(false)}
        placeholder="What is missing here? e.g. 'the error state when saving fails is not mapped'…"
      />
    </>
  )
}
