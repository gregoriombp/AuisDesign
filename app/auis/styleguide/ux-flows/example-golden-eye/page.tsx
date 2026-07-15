"use client"

import { MarkerType, type Edge, type Node } from "@xyflow/react"

import { AuCard } from "@/components/ui/AuCard"
import { PageHero, Section } from "../../_primitives"
import {
  GoldenEyeDiagram,
  type GoldenNodeData,
  type GoldenScenario,
} from "../_components/golden-eye"
import {
  FlowUpdatesBadge,
  FlowUpdatesHistorySection,
  type FlowUpdate,
} from "../_components/flow-updates"

const SCENARIOS: GoldenScenario[] = [
  { id: "visual", label: "Visual change", color: "var(--au-blue-600)" },
  { id: "structural", label: "Structural change", color: "var(--au-emerald-600)" },
]

const NODES: Node<GoldenNodeData>[] = [
  {
    id: "project",
    type: "screen",
    position: { x: 340, y: 0 },
    data: {
      step: "entry",
      title: "Open a project",
      note: "Both scenarios start from the same workspace.",
      href: "/auis/projects",
      scenarios: ["visual", "structural"],
    },
  },
  {
    id: "decision",
    type: "decision",
    position: { x: 325, y: 180 },
    data: {
      step: "01",
      title: "Classify the change",
      question: "Does the structure of the journey change?",
      scenarios: ["visual", "structural"],
    },
  },
  {
    id: "styleguide",
    type: "screen",
    position: { x: 80, y: 400 },
    data: {
      step: "02a",
      title: "Use the styleguide",
      note: "Review foundations and component contracts.",
      href: "/auis/styleguide",
      scenarios: ["visual"],
    },
  },
  {
    id: "flow",
    type: "screen",
    position: { x: 600, y: 400 },
    data: {
      step: "02b",
      title: "Map the journey",
      note: "Make decisions and terminal states explicit.",
      href: "/auis/ux-flow",
      scenarios: ["structural"],
    },
  },
  {
    id: "review",
    type: "screen",
    position: { x: 340, y: 650 },
    data: {
      step: "03",
      title: "Review the result",
      note: "The scenarios converge in the same approval loop.",
      href: "/auis/review-bridge",
      scenarios: ["visual", "structural"],
    },
  },
]

const base = {
  type: "smoothstep",
  markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18 },
  style: { stroke: "var(--border-strong)", strokeWidth: 1.5 },
}

const EDGES: Edge[] = [
  { id: "project-decision", source: "project", target: "decision", ...base },
  {
    id: "decision-styleguide",
    source: "decision",
    sourceHandle: "left",
    target: "styleguide",
    label: "No",
    ...base,
    style: { stroke: "var(--au-blue-600)", strokeWidth: 1.5 },
  },
  {
    id: "decision-flow",
    source: "decision",
    sourceHandle: "right",
    target: "flow",
    label: "Yes",
    ...base,
    style: { stroke: "var(--au-emerald-600)", strokeWidth: 1.5 },
  },
  { id: "styleguide-review", source: "styleguide", target: "review", ...base },
  { id: "flow-review", source: "flow", target: "review", ...base },
]

const updates: FlowUpdate[] = [
  {
    date: "2026-07-16",
    summary: "Added a neutral compiled-flow reference with two focus lenses.",
    tags: ["new-page"],
  },
]

export default function ExampleGoldenEyePage() {
  return (
    <>
      <PageHero title="Golden-eye example" trailing={<FlowUpdatesBadge updates={updates} />}>
        A compiled, product-neutral view of two journeys that share an entry and
        approval step but diverge in the middle.
      </PageHero>

      <div className="w-full px-10 pb-10">
        <Section
          id="flow"
          title="Compiled flowchart"
          lead="Choose a scenario lens to dim the other path. Two dots identify screens shared by both journeys; click a screen to preview its route."
        >
          <GoldenEyeDiagram scenarios={SCENARIOS} nodes={NODES} edges={EDGES} />
        </Section>
      </div>

      <div className="mx-auto flex max-w-5xl flex-col gap-16 px-10 pb-14">
        <Section
          id="scenarios"
          title="Compiled scenarios"
          lead="Each journey owns one branch and shares the surrounding trunk."
        >
          <div className="grid grid-cols-2 gap-4">
            <AuCard className="p-5">
              <h3 className="text-base font-medium text-fg-primary">Visual change</h3>
              <p className="mt-2 text-sm leading-relaxed text-fg-secondary">Project → styleguide → review.</p>
            </AuCard>
            <AuCard className="p-5">
              <h3 className="text-base font-medium text-fg-primary">Structural change</h3>
              <p className="mt-2 text-sm leading-relaxed text-fg-secondary">Project → UX flow → review.</p>
            </AuCard>
          </div>
        </Section>

        <Section
          id="shared-screens"
          title="Shared screens and convergence"
          lead="The dedup decisions that make this view useful."
        >
          <AuCard className="p-5">
            <p className="text-sm leading-relaxed text-fg-secondary">
              Open a project and Review the result each appear once with two
              scenario dots. The middle steps stay separate because they use
              different builder tools, then converge into one approval loop.
            </p>
          </AuCard>
        </Section>

        <FlowUpdatesHistorySection updates={updates} />
      </div>
    </>
  )
}
