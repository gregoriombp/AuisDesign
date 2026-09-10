import Link from "next/link"
import type { Metadata } from "next"
import { AuButton } from "@/components/ui/AuButton"
import { AuCard } from "@/components/ui/AuCard"
import {
  AuEmpty,
  AuEmptyContent,
  AuEmptyDescription,
  AuEmptyHeader,
  AuEmptyMedia,
  AuEmptyTitle,
} from "@/components/ui/AuEmpty"
import { Icon } from "@/components/ui/Icon"
import { PageHero, Section } from "../styleguide/_primitives"
import { FLOW_GROUPS, FLOW_META } from "./_data/flow-meta"

export const metadata: Metadata = {
  title: "UX Flows",
  description:
    "Product experience flows: journeys and chained screens, navigable like a prototype.",
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
}

export default function UxFlowIndex() {
  const hasFlows = FLOW_META.length > 0

  return (
    <>
      <PageHero title="UX Flows">
        Each flow connects the product&apos;s screens into a navigable map, prototype
        style. Open one to explore it, comment or suggest changes — {FLOW_META.length}{" "}
        {FLOW_META.length === 1 ? "flow" : "flows"} in {FLOW_GROUPS.length}{" "}
        {FLOW_GROUPS.length === 1 ? "group" : "groups"}, built with the same components
        and tokens as the design system.
      </PageHero>

      <div className="mx-auto flex max-w-7xl flex-col gap-16 px-10 pb-14">
        {!hasFlows ? (
          <AuEmpty>
            <AuEmptyHeader>
              <AuEmptyMedia variant="icon">
                <Icon name="account_tree" size={24} />
              </AuEmptyMedia>
              <AuEmptyTitle>No flows yet</AuEmptyTitle>
              <AuEmptyDescription>
                Run <code>/auis-create-ux-flow</code> with a journey or a step list. The
                skill creates the flow page, registers its metadata and lists it here.
              </AuEmptyDescription>
            </AuEmptyHeader>
            <AuEmptyContent>
              <AuButton asChild variant="secondary" iconLeft="menu_book">
                <Link href="/auis/styleguide">Open the styleguide</Link>
              </AuButton>
            </AuEmptyContent>
          </AuEmpty>
        ) : null}

        {FLOW_GROUPS.map((group) => {
          const flows = FLOW_META.filter((f) => f.group === group)
          if (flows.length === 0) return null
          return (
            <Section
              key={group}
              id={slugify(group)}
              title={group}
              lead={
                group === "Examples"
                  ? "Product-neutral references shipped with Auis. Copy them when authoring a new flow, then remove them from the metadata once your own flows exist."
                  : undefined
              }
            >
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                {flows.map((f) => (
                  <AuCard key={f.slug} interactive className="flex flex-col gap-4 p-6">
                    <div className="flex items-start justify-between">
                      <span className="inline-flex size-11 items-center justify-center rounded-md bg-surface">
                        <Icon name="account_tree" size={24} />
                      </span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <h3 className="m-0 text-xl font-semibold">{f.title}</h3>
                      <p className="m-0 text-sm leading-relaxed text-fg-secondary">
                        {f.description}
                      </p>
                    </div>
                    <div className="mt-auto flex items-center justify-end pt-2">
                      <Link href={`/auis/ux-flow/${f.slug}`} className="no-underline">
                        <AuButton variant="primary" iconRight="arrow_forward">
                          Open
                        </AuButton>
                      </Link>
                    </div>
                  </AuCard>
                ))}
              </div>
            </Section>
          )
        })}

        <Section
          id="authoring"
          title="Authoring a flow"
          lead="Flows are TypeScript pages: nodes and edges live next to the code they describe."
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <AuCard className="p-5">
              <h3 className="text-base font-medium text-fg-primary">1. Describe the journey</h3>
              <p className="mt-2 text-sm leading-relaxed text-fg-secondary">
                Run <code>/auis-create-ux-flow</code> with the steps, decisions and terminal
                states. The skill writes <code>NODES</code> and <code>EDGES</code> into a new
                page under <code>app/auis/ux-flow/&lt;slug&gt;</code>.
              </p>
            </AuCard>
            <AuCard className="p-5">
              <h3 className="text-base font-medium text-fg-primary">2. Review on the canvas</h3>
              <p className="mt-2 text-sm leading-relaxed text-fg-secondary">
                Click a screen to preview its route in the side panel. Use the editor to
                comment on nodes or suggest structural changes — both land in the Review
                Bridge for an agent to resolve.
              </p>
            </AuCard>
            <AuCard className="p-5">
              <h3 className="text-base font-medium text-fg-primary">3. Compile scenarios</h3>
              <p className="mt-2 text-sm leading-relaxed text-fg-secondary">
                When several journeys share screens, run{" "}
                <code>/auis-create-ux-flow-golden-eye</code> to overlay them in one graph
                with a focus lens per scenario and state deep links.
              </p>
            </AuCard>
          </div>
        </Section>
      </div>
    </>
  )
}
