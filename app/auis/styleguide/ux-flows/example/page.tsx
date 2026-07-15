"use client"

import Link from "next/link"
import type { Edge, Node } from "@xyflow/react"

import { AuCard } from "@/components/ui/AuCard"
import { PageHero, Section } from "../../_primitives"
import { branchEdge, edgeBase, FlowDiagram } from "../_components/flow-editor"
import {
  FlowUpdatesBadge,
  FlowUpdatesHistorySection,
  type FlowUpdate,
} from "../_components/flow-updates"

const labelProps = {
  labelStyle: { fill: "var(--fg-secondary)", fontSize: 11, fontWeight: 500 },
  labelBgStyle: { fill: "var(--bg-canvas)" },
  labelBgPadding: [6, 4] as [number, number],
}

export const NODES: Node[] = [
  {
    id: "entry",
    type: "screen",
    position: { x: 280, y: 0 },
    data: {
      step: "entry",
      title: "Open a project",
      href: "/auis/projects",
      note: "Choose the workspace that needs a design decision.",
    },
  },
  {
    id: "choose-path",
    type: "decision",
    position: { x: 260, y: 180 },
    data: {
      step: "01",
      title: "What changes?",
      question: "Is the change visual or structural?",
    },
  },
  {
    id: "visual",
    type: "screen",
    position: { x: 80, y: 400 },
    data: {
      step: "02a",
      title: "Use the styleguide",
      href: "/auis/styleguide",
      note: "Work from foundations and documented components.",
    },
  },
  {
    id: "structural",
    type: "screen",
    position: { x: 480, y: 400 },
    data: {
      step: "02b",
      title: "Map the flow",
      href: "/auis/ux-flow",
      note: "Make branches and terminal states explicit.",
    },
  },
  {
    id: "review",
    type: "screen",
    position: { x: 280, y: 620 },
    data: {
      step: "03",
      title: "Review the result",
      href: "/auis/review-bridge",
      note: "Resolve comments and keep approval with the user.",
    },
  },
]

export const EDGES: Edge[] = [
  { id: "entry-choice", source: "entry", target: "choose-path", ...edgeBase },
  {
    id: "choice-visual",
    source: "choose-path",
    sourceHandle: "left",
    target: "visual",
    label: "Visual",
    ...branchEdge,
    ...labelProps,
  },
  {
    id: "choice-structural",
    source: "choose-path",
    sourceHandle: "right",
    target: "structural",
    label: "Structural",
    ...branchEdge,
    ...labelProps,
  },
  { id: "visual-review", source: "visual", target: "review", ...edgeBase },
  { id: "structural-review", source: "structural", target: "review", ...edgeBase },
]

const screens = [
  {
    step: "entry",
    title: "Open a project",
    href: "/auis/projects",
    purpose: "Starts from a concrete workspace rather than an abstract artifact.",
  },
  {
    step: "02a",
    title: "Use the styleguide",
    href: "/auis/styleguide",
    purpose: "Keeps visual changes connected to foundations and reusable components.",
  },
  {
    step: "02b",
    title: "Map the flow",
    href: "/auis/ux-flow",
    purpose: "Makes structural changes inspectable before implementation.",
  },
  {
    step: "03",
    title: "Review the result",
    href: "/auis/review-bridge",
    purpose: "Closes both branches through the same local approval loop.",
  },
] as const

const updates: FlowUpdate[] = [
  {
    date: "2026-07-16",
    summary: "Added a neutral reference flow for the public Auis workflow.",
    tags: ["new-page"],
  },
]

export default function ExampleFlowPage() {
  return (
    <>
      <PageHero title="Example flow" trailing={<FlowUpdatesBadge updates={updates} />}>
        A small, product-neutral reference for authoring screen nodes, a decision,
        two branches, and a convergence with the real Auis flow editor.
      </PageHero>

      <div className="mx-auto flex max-w-7xl flex-col gap-16 px-10 pb-14">
        <p className="max-w-2xl text-sm leading-relaxed text-fg-secondary">
          This is documentation, not a product journey. Click a screen to preview
          its real builder route in the side panel; use the editor controls to see
          the same comment and suggestion workflow available to new flows.
        </p>

        <Section
          id="flow"
          title="Flowchart"
          lead="Click a screen to open its route in a side panel. Amber arrows mark the two choices before they converge in review."
        >
          <FlowDiagram flow="example" nodes={NODES} edges={EDGES} height={820} />
        </Section>

        <Section
          id="screens"
          title="Every screen"
          lead="The example uses public builder routes, so every preview resolves in a fresh clone."
        >
          <div className="grid grid-cols-2 gap-4">
            {screens.map((screen) => (
              <AuCard key={screen.step} className="flex flex-col gap-3 p-5">
                <div className="flex items-baseline gap-3">
                  <span className="au-eyebrow text-fg-tertiary">{screen.step}</span>
                  <h3 className="text-base font-medium text-fg-primary">{screen.title}</h3>
                </div>
                <p className="text-sm leading-relaxed text-fg-secondary">{screen.purpose}</p>
                <Link href={screen.href} className="mt-auto text-sm font-medium text-fg-primary underline-offset-4 hover:underline">
                  Open route
                </Link>
              </AuCard>
            ))}
          </div>
        </Section>

        <Section
          id="design-notes"
          title="Design decisions"
          lead="Why this is the canonical public template."
        >
          <div className="grid grid-cols-2 gap-4">
            <AuCard className="p-5">
              <h3 className="text-base font-medium text-fg-primary">Small but complete</h3>
              <p className="mt-2 text-sm leading-relaxed text-fg-secondary">
                One decision demonstrates handle-specific branches and convergence without importing a private scenario.
              </p>
            </AuCard>
            <AuCard className="p-5">
              <h3 className="text-base font-medium text-fg-primary">Resolvable links</h3>
              <p className="mt-2 text-sm leading-relaxed text-fg-secondary">
                Every href points at a route shipped by Auis, so the preview drawer has no hidden product dependency.
              </p>
            </AuCard>
          </div>
        </Section>

        <FlowUpdatesHistorySection updates={updates} />
      </div>
    </>
  )
}
