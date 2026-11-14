"use client"

import * as React from "react"
import {
  Background,
  BackgroundVariant,
  Handle,
  MiniMap,
  Panel,
  Position,
  ReactFlow,
  useReactFlow,
  type Edge,
  type Node,
  type ReactFlowProps,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import { cn } from "@/lib/utils"
import { AuButton } from "./AuButton"
import { AuSpinner } from "./AuSpinner"
import { Icon } from "./Icon"

/*
 * AuWorkflowCanvas — a node-and-edge editor surface.
 *
 * Two owners, on purpose:
 *   - React Flow (`@xyflow/react`) owns what the design system has no answer
 *     for: pan and zoom, the dotted grid, handles, the connection lines and the
 *     minimap. Its look is driven through its own `--xy-*` variables, each one
 *     pointed at an Auis token, so the canvas follows light and dark with the
 *     rest of the app.
 *   - Every control a person clicks is an `Au*`: the toolbar, the node bodies,
 *     the zoom buttons. React Flow's `<Controls>` is deliberately not used.
 *
 * The pieces below are presentational. Node data, node types and run logic
 * belong to the screen that composes them. Don't key a custom node type
 * `input`, `output`, `default` or `group`: React Flow paints those with its own
 * frame (fixed width, padding, border) around the Auis card.
 */

/** React Flow's theme hooks, pointed at Auis tokens. */
const CANVAS_THEME = {
  "--xy-edge-stroke": "var(--border-strong)",
  "--xy-edge-stroke-width": "1.5",
  "--xy-edge-stroke-selected": "var(--accent-brand)",
  "--xy-connectionline-stroke": "var(--fg-tertiary)",
  "--xy-connectionline-stroke-width": "1.5",
  "--xy-edge-label-background-color": "var(--bg-raised)",
  "--xy-edge-label-color": "var(--fg-secondary)",
  "--xy-handle-background-color": "var(--bg-raised)",
  "--xy-handle-border-color": "var(--border-strong)",
  "--xy-selection-background-color": "color-mix(in srgb, var(--accent-brand) 6%, transparent)",
  "--xy-selection-border": "1px dashed var(--border-strong)",
  "--xy-minimap-background-color": "var(--bg-raised)",
  "--xy-minimap-mask-background-color": "color-mix(in srgb, var(--bg-muted) 70%, transparent)",
  "--xy-minimap-mask-stroke-color": "var(--border-default)",
  "--xy-minimap-node-background-color": "var(--bg-muted)",
  "--xy-minimap-node-stroke-color": "var(--border-default)",
} as React.CSSProperties

/** Mirrors --dur-base / --dur-slow; React Flow animates the viewport in ms. */
const ZOOM_MS = 180
const FIT_MS = 280

function motionMs(ms: number) {
  if (typeof window === "undefined") return ms
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : ms
}

/* ───────────────────────────── Canvas ───────────────────────────── */

export type AuWorkflowCanvasProps<
  NodeType extends Node = Node,
  EdgeType extends Edge = Edge,
> = Omit<ReactFlowProps<NodeType, EdgeType>, "proOptions" | "colorMode"> & {
  /** Floating controls, centered at the bottom. Usually an `AuWorkflowToolbar`. */
  toolbar?: React.ReactNode
  /** Quiet status line at the bottom left (save state, last run). */
  status?: React.ReactNode
  /** React Flow's minimap, at the bottom right. */
  minimap?: boolean
}

/**
 * The canvas: React Flow with the Auis theme, a dotted grid, and slots for a
 * toolbar, a status line and a minimap. It fills its parent, so give the parent
 * a height. Anything passed as children renders inside React Flow, so extra
 * `<Panel>`s and components that call `useReactFlow()` work there.
 */
export function AuWorkflowCanvas<
  NodeType extends Node = Node,
  EdgeType extends Edge = Edge,
>({
  toolbar,
  status,
  minimap = false,
  className,
  style,
  children,
  ...flow
}: AuWorkflowCanvasProps<NodeType, EdgeType>) {
  return (
    <div
      className={cn("relative h-full w-full bg-(--bg-muted) dark:bg-(--bg-canvas)", className)}
      style={{ ...CANVAS_THEME, ...style }}
    >
      <ReactFlow<NodeType, EdgeType>
        minZoom={0.2}
        maxZoom={2}
        {...flow}
        proOptions={{ hideAttribution: true }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={16}
          size={1.25}
          color="var(--border-strong)"
        />
        {status && (
          <Panel position="bottom-left" className="m-4">
            {status}
          </Panel>
        )}
        {toolbar && (
          <Panel position="bottom-center" className="m-4">
            {toolbar}
          </Panel>
        )}
        {minimap && (
          <MiniMap
            position="bottom-right"
            pannable
            zoomable
            ariaLabel="Canvas overview"
            className="m-4 overflow-hidden rounded-lg border border-(--border-default) shadow-md"
          />
        )}
        {children}
      </ReactFlow>
    </div>
  )
}

/* ───────────────────────────── Toolbar ──────────────────────────── */

export type AuWorkflowToolbarProps = {
  children: React.ReactNode
  className?: string
  "aria-label"?: string
}

/** The floating pill that holds the canvas actions. Children are `AuButton`s. */
export function AuWorkflowToolbar({
  children,
  className,
  "aria-label": ariaLabel = "Canvas tools",
}: AuWorkflowToolbarProps) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn(
        "flex items-center gap-1 rounded-lg border border-(--border-default) bg-(--bg-raised) p-1 shadow-md",
        className,
      )}
    >
      {children}
    </div>
  )
}

/** A thin vertical rule between toolbar groups. */
export function AuWorkflowToolbarDivider() {
  return <span aria-hidden="true" className="mx-1 h-5 w-px bg-(--border-default)" />
}

/**
 * Zoom in, zoom out and fit, as Auis buttons. Must render inside the canvas
 * (the toolbar slot or children), because it drives React Flow's viewport.
 */
export function AuWorkflowViewControls({ fitPadding = 0.2 }: { fitPadding?: number }) {
  const { zoomIn, zoomOut, fitView } = useReactFlow()
  return (
    <>
      <AuButton
        size="sm"
        variant="ghost"
        iconOnly="zoom_in"
        aria-label="Zoom in"
        title="Zoom in"
        onClick={() => zoomIn({ duration: motionMs(ZOOM_MS) })}
      />
      <AuButton
        size="sm"
        variant="ghost"
        iconOnly="zoom_out"
        aria-label="Zoom out"
        title="Zoom out"
        onClick={() => zoomOut({ duration: motionMs(ZOOM_MS) })}
      />
      <AuButton
        size="sm"
        variant="ghost"
        iconOnly="fit_screen"
        aria-label="Fit to screen"
        title="Fit to screen"
        onClick={() => fitView({ padding: fitPadding, duration: motionMs(FIT_MS) })}
      />
    </>
  )
}

/* ────────────────────────────── Node ────────────────────────────── */

export type AuWorkflowNodeStatus = "idle" | "running" | "success" | "error"

export type AuWorkflowNodeProps = {
  /** Material Symbol name for the node's icon tile. */
  icon: string
  title: React.ReactNode
  description?: React.ReactNode
  status?: AuWorkflowNodeStatus
  /** Pass React Flow's `selected` from the node props. */
  selected?: boolean
  /** Show the input handle on the left. */
  target?: boolean
  /** Show the output handle on the right. */
  source?: boolean
  /** Controls above the card, e.g. a small Run button. They scale with the canvas. */
  actions?: React.ReactNode
  /** Usually an `AuWorkflowNodeResults`. */
  footer?: React.ReactNode
  /** The node's body. It is `nodrag`: the node moves from its header. */
  children?: React.ReactNode
  className?: string
}

/* Handles sit level with the header icon (12px padding + half of a 32px tile). */
const HANDLE_CLASS = "size-2.5! rounded-xs! border! top-7!"

function StatusMark({ status }: { status: AuWorkflowNodeStatus }) {
  if (status === "running") return <AuSpinner size="sm" label="Running" />
  if (status === "success")
    return (
      <span role="img" aria-label="Finished" className="flex text-(--accent-success)">
        <Icon name="check_circle" size={16} fill={1} />
      </span>
    )
  if (status === "error")
    return (
      <span role="img" aria-label="Failed" className="flex text-(--accent-danger)">
        <Icon name="error" size={16} fill={1} />
      </span>
    )
  return null
}

/**
 * The node card. Use it inside a React Flow custom node component: it renders
 * React Flow's handles, so it only works on a canvas.
 */
export function AuWorkflowNode({
  icon,
  title,
  description,
  status = "idle",
  selected = false,
  target = false,
  source = false,
  actions,
  footer,
  children,
  className,
}: AuWorkflowNodeProps) {
  return (
    <div className={cn("flex w-72 flex-col gap-2", className)} data-status={status}>
      {actions && <div className="nodrag flex items-center gap-1">{actions}</div>}
      <div
        className={cn(
          "relative rounded-lg border bg-(--bg-raised) text-(--fg-primary) shadow-sm",
          status === "error"
            ? "border-(--accent-danger)"
            : selected
              ? "border-(--accent-brand) shadow-md"
              : "border-(--border-default)",
        )}
      >
        {target && <Handle type="target" position={Position.Left} className={HANDLE_CLASS} />}
        {source && <Handle type="source" position={Position.Right} className={HANDLE_CLASS} />}

        <div className="flex flex-col gap-2 p-3">
          <div className="flex items-center gap-2.5">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-(--border-default) bg-(--bg-raised)">
              <Icon name={icon} size={20} />
            </span>
            <span className="min-w-0 flex-1 truncate text-sm font-medium">{title}</span>
            <StatusMark status={status} />
          </div>
          {description && <p className="m-0 text-xs text-(--fg-tertiary)">{description}</p>}
          {children && <div className="nodrag flex flex-col gap-3 pt-1">{children}</div>}
        </div>

        {footer}
      </div>
    </div>
  )
}

/** A labelled group inside a node body ("Knowledge sources", "Tools"). */
export function AuWorkflowNodeSection({
  label,
  children,
  className,
}: {
  label: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <span className="text-xs text-(--fg-tertiary)">{label}</span>
      {children}
    </div>
  )
}

/** A quiet read-only row: an icon (or any leading element), a value, an optional action. */
export function AuWorkflowNodeRow({
  icon,
  leading,
  trailing,
  children,
  className,
}: {
  icon?: string
  leading?: React.ReactNode
  trailing?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex min-h-8 items-center gap-2 rounded-md bg-(--bg-muted) px-2.5 py-1 text-xs text-(--fg-primary)",
        className,
      )}
    >
      {leading ?? (icon && <Icon name={icon} size={16} className="text-(--fg-secondary)" />)}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {trailing}
    </div>
  )
}

/**
 * The node footer: a "View results" disclosure on the left, run metadata
 * (tokens, time) on the right. It expands in place; it is not an overlay.
 */
export function AuWorkflowNodeResults({
  label = "View results",
  meta,
  empty = "No results yet.",
  defaultOpen = false,
  children,
}: {
  label?: string
  meta?: React.ReactNode
  /** Shown when the disclosure is open and there are no children. */
  empty?: React.ReactNode
  defaultOpen?: boolean
  children?: React.ReactNode
}) {
  const [open, setOpen] = React.useState(defaultOpen)
  const regionId = React.useId()
  return (
    <div className="nodrag border-t border-(--border-subtle)">
      <div className="flex items-center gap-2 py-1 pr-3 pl-1">
        <AuButton
          size="sm"
          variant="ghost"
          iconLeft={open ? "expand_less" : "expand_more"}
          aria-expanded={open}
          aria-controls={regionId}
          onClick={() => setOpen((v) => !v)}
        >
          {label}
        </AuButton>
        {meta && (
          <span className="ml-auto truncate text-2xs text-(--fg-tertiary) tabular-nums">{meta}</span>
        )}
      </div>
      {open && (
        <div id={regionId} className="px-3 pb-3 text-xs text-(--fg-secondary)">
          {children ?? empty}
        </div>
      )}
    </div>
  )
}

/* ────────────────────────────── Note ────────────────────────────── */

export type AuWorkflowNoteTone = "neutral" | "blue" | "amber" | "emerald" | "purple"

/* The tint sits on an opaque raised layer, so the grid never shows through. */
const NOTE_TONE: Record<AuWorkflowNoteTone, string> = {
  neutral: "border-(--border-default)",
  blue: "border-au-blue-500/40 bg-au-blue-500/10",
  amber: "border-au-amber-500/50 bg-au-amber-500/10",
  emerald: "border-au-emerald-500/50 bg-au-emerald-500/10",
  purple: "border-au-purple-500/40 bg-au-purple-500/10",
}

export type AuWorkflowNoteProps = {
  title: React.ReactNode
  /** One short line under the title. */
  children?: React.ReactNode
  tone?: AuWorkflowNoteTone
  selected?: boolean
  className?: string
}

/**
 * A free annotation on the canvas: a section label or a one-line hint. It has
 * no handles and carries no data; register it as its own node type.
 */
export function AuWorkflowNote({
  title,
  children,
  tone = "neutral",
  selected = false,
  className,
}: AuWorkflowNoteProps) {
  return (
    <div className={cn("w-72 rounded-lg bg-(--bg-raised)", className)}>
      <div
        className={cn(
          "rounded-lg border px-4 py-3 text-(--fg-primary)",
          NOTE_TONE[tone],
          selected && "ring-2 ring-(--ring-focus)",
        )}
      >
        <p className="m-0 text-base font-semibold">{title}</p>
        {children && <p className="m-0 mt-1.5 text-xs font-medium text-(--fg-secondary)">{children}</p>}
      </div>
    </div>
  )
}
