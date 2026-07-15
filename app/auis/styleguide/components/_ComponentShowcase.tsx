"use client"

import * as React from "react"
import { PageHero, Section, Stage } from "../_primitives"
import { AuAlert } from "@/components/ui/AuAlert"
import { AuBreadcrumb } from "@/components/ui/AuBreadcrumb"
import { AuBreadcrumbsBar } from "@/components/ui/AuBreadcrumbsBar"
import { AuButton } from "@/components/ui/AuButton"
import {
  AuCard,
  AuCardContent,
  AuCardDescription,
  AuCardFooter,
  AuCardHeader,
  AuCardTitle,
} from "@/components/ui/AuCard"
import { AuCheckbox } from "@/components/ui/AuCheckbox"
import { AuDropdownMenu } from "@/components/ui/AuDropdownMenu"
import {
  AuEmpty,
  AuEmptyContent,
  AuEmptyDescription,
  AuEmptyHeader,
  AuEmptyMedia,
  AuEmptyTitle,
} from "@/components/ui/AuEmpty"
import { AuField, AuInput } from "@/components/ui/AuInput"
import { AuLogo } from "@/components/ui/AuLogo"
import { AuMentionChip } from "@/components/ui/AuMentionChip"
import { AuMentionMenu } from "@/components/ui/AuMentionMenu"
import { AuModal } from "@/components/ui/AuModal"
import { AuPill } from "@/components/ui/AuPill"
import { AuProgress } from "@/components/ui/AuProgress"
import { AuSheet, AuSheetRow } from "@/components/ui/AuSheet"
import { AuSlider } from "@/components/ui/AuSlider"
import { AuStatCard } from "@/components/ui/AuStatCard"
import { AuTable } from "@/components/ui/AuTable"
import { AuTabs } from "@/components/ui/AuTabs"
import { useToast } from "@/components/ui/AuToast"
import { AuToggle, AuToggleRow } from "@/components/ui/AuToggle"
import { Icon } from "@/components/ui/Icon"

export const COMPONENTS = {
  AuAlert: "Persistent, in-flow feedback for information, success, warning, and danger.",
  AuBreadcrumb: "The compact navigation-trail primitive.",
  AuBreadcrumbsBar: "A full-width breadcrumb strip with an optional trailing action.",
  AuButton: "The system button with intent, size, icon, loading, and link composition.",
  AuCard: "The generic content container and its composable slots.",
  AuCheckbox: "A controlled binary or indeterminate selection control.",
  AuDropdownMenu: "A declarative action menu built on the Radix dropdown primitive.",
  AuEmpty: "Composable zero-state content for empty results and first-use moments.",
  AuInput: "Input and field primitives, including search and password affordances.",
  AuLogo: "The Auis builder mark and the configured project-brand renderer.",
  AuMentionChip: "Inline @agent, /skill, and #directive tokens used by Review Mode.",
  AuMentionMenu: "The presentational inline picker used by Review Mode composers.",
  AuModal: "The accessible dialog primitive with enter and exit motion.",
  AuPill: "Compact status and metadata labels.",
  AuProgress: "Determinate progress with semantic variants.",
  AuSheet: "The accessible side-panel primitive with enter and exit motion.",
  AuSlider: "A labeled range input with a filled track.",
  AuStatCard: "A focused KPI card for one value, label, and optional hint.",
  AuTable: "The styled static-table primitive.",
  AuTabs: "Segmented, standalone, and underline tab navigation.",
  AuToast: "Transient feedback dispatched through the global toast provider.",
  AuToggle: "A controlled switch and its labeled row recipe.",
  Icon: "Material Symbols Rounded with optical defaults tuned by size.",
} as const

export type ComponentName = keyof typeof COMPONENTS

const USAGE_IMPORTS: Partial<Record<ComponentName, string>> = {
  AuInput: 'import { AuField, AuInput } from "@/components/ui/AuInput"',
  AuSheet: 'import { AuSheet, AuSheetRow } from "@/components/ui/AuSheet"',
  AuToast: 'import { AuToastProvider, useToast } from "@/components/ui/AuToast"',
  AuToggle: 'import { AuToggle, AuToggleRow } from "@/components/ui/AuToggle"',
}

function Demo({ component }: { component: ComponentName }) {
  const toast = useToast()
  const [checked, setChecked] = React.useState(true)
  const [enabled, setEnabled] = React.useState(true)
  const [slider, setSlider] = React.useState(64)
  const [tab, setTab] = React.useState("overview")
  const [modalOpen, setModalOpen] = React.useState(false)
  const [sheetOpen, setSheetOpen] = React.useState(false)
  const [mention, setMention] = React.useState("codex")

  switch (component) {
    case "AuAlert":
      return (
        <div className="grid w-full grid-cols-2 gap-4">
          <AuAlert variant="info" title="Information">A useful detail that belongs in the flow.</AuAlert>
          <AuAlert variant="success" title="Saved">The change is ready for review.</AuAlert>
          <AuAlert variant="warning" title="Check this">One dependency still needs attention.</AuAlert>
          <AuAlert variant="danger" title="Could not save">Try again or inspect the local queue.</AuAlert>
        </div>
      )
    case "AuBreadcrumb":
      return <AuBreadcrumb items={[{ label: "Projects", href: "#" }, { label: "Checkout", href: "#" }, { label: "Review" }]} separator={<Icon name="chevron_right" size={14} />} />
    case "AuBreadcrumbsBar":
      return <div className="w-full overflow-hidden rounded-lg border border-subtle"><AuBreadcrumbsBar items={[{ label: "Projects", href: "#" }, { label: "Checkout", href: "#" }, "Review"]} trailing={<AuButton size="sm" variant="ghost">Share</AuButton>} /></div>
    case "AuButton":
      return <div className="flex flex-wrap gap-3"><AuButton variant="primary">Primary</AuButton><AuButton variant="secondary">Secondary</AuButton><AuButton variant="ghost" iconLeft="add">Ghost</AuButton><AuButton variant="danger" iconLeft="delete">Danger</AuButton><AuButton variant="ai" iconLeft="auto_awesome">AI action</AuButton><AuButton loading>Loading</AuButton></div>
    case "AuCard":
      return <AuCard className="w-full max-w-xl"><AuCardHeader><AuCardTitle>Review summary</AuCardTitle><AuCardDescription>Everything the team needs before approval.</AuCardDescription></AuCardHeader><AuCardContent><p className="text-sm text-fg-secondary">Three comments resolved and one decision pending.</p></AuCardContent><AuCardFooter><AuButton size="sm" variant="primary">Open review</AuButton></AuCardFooter></AuCard>
    case "AuCheckbox":
      return <label className="flex items-center gap-3 text-sm text-fg-primary"><AuCheckbox checked={checked} onChange={setChecked} label="Include resolved comments" />Include resolved comments</label>
    case "AuDropdownMenu":
      return <AuDropdownMenu aria-label="Example actions" trigger={<AuButton variant="secondary" iconRight="expand_more">Actions</AuButton>} items={[{ id: "open", label: "Open", icon: "open_in_new" }, { id: "duplicate", label: "Duplicate", icon: "content_copy" }, { id: "sep", separator: true }, { id: "delete", label: "Delete", icon: "delete", danger: true }]} />
    case "AuEmpty":
      return <AuEmpty><AuEmptyHeader><AuEmptyMedia variant="icon"><Icon name="search_off" size={24} /></AuEmptyMedia><AuEmptyTitle>No results</AuEmptyTitle><AuEmptyDescription>Try a broader search or clear the active filters.</AuEmptyDescription></AuEmptyHeader><AuEmptyContent><AuButton variant="secondary">Clear filters</AuButton></AuEmptyContent></AuEmpty>
    case "AuInput":
      return <div className="grid w-full grid-cols-2 gap-4"><AuField label="Project name" htmlFor="project-name" helper="Shown in the builder chrome."><AuInput id="project-name" placeholder="Northstar" /></AuField><AuField label="Password" htmlFor="password"><AuInput id="password" type="password" revealable defaultValue="example" /></AuField><AuInput iconLeft="search" placeholder="Search components…" className="col-span-2" /></div>
    case "AuLogo":
      return <div className="flex items-center gap-10"><AuLogo variant="mark" height={40} /><AuLogo variant="wordmark" height={28} /><AuLogo variant="horizontal" height={32} /></div>
    case "AuMentionChip":
      return <div className="flex flex-wrap gap-2"><AuMentionChip tone="inverse" icon="terminal">@codex</AuMentionChip><AuMentionChip tone="purple" icon="bolt">/auis-page</AuMentionChip><AuMentionChip tone="amber" icon="schedule">#now</AuMentionChip></div>
    case "AuMentionMenu":
      return <AuMentionMenu aria-label="Mention example" activeKey={mention} onHover={setMention} onPick={setMention} sections={[{ label: "Agents", entries: [{ key: "codex", label: "@codex", icon: "terminal" }, { key: "claude", label: "@claude", icon: "smart_toy" }] }, { label: "Skills", entries: [{ key: "page", label: "/auis-page", icon: "web" }, { key: "audit", label: "/auis-audit", icon: "fact_check" }] }]} />
    case "AuModal":
      return <><AuButton variant="primary" onClick={() => setModalOpen(true)}>Open modal</AuButton><AuModal open={modalOpen} onClose={() => setModalOpen(false)} title="Confirm change" footer={<div className="flex justify-end gap-2"><AuButton variant="ghost" onClick={() => setModalOpen(false)}>Cancel</AuButton><AuButton variant="primary" onClick={() => setModalOpen(false)}>Confirm</AuButton></div>}><p className="text-sm leading-relaxed text-fg-secondary">The modal owns focus, dismissal, and both sides of the transition.</p></AuModal></>
    case "AuPill":
      return <div className="flex flex-wrap gap-2"><AuPill variant="live">Live</AuPill><AuPill variant="draft">Draft</AuPill><AuPill variant="beta">Beta</AuPill><AuPill variant="warning">Warning</AuPill><AuPill variant="error">Error</AuPill><AuPill variant="ai">AI</AuPill></div>
    case "AuProgress":
      return <div className="grid w-full grid-cols-2 gap-6"><AuProgress label="Default" value={72} /><AuProgress label="Success" value={100} variant="success" /><AuProgress label="Warning" value={58} variant="warning" /><AuProgress label="Danger" value={28} variant="danger" /></div>
    case "AuSheet":
      return <><AuButton variant="primary" onClick={() => setSheetOpen(true)}>Open sheet</AuButton><AuSheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="Component details" meta="AuSheet · default width" footer={<AuButton block variant="primary" onClick={() => setSheetOpen(false)}>Done</AuButton>}><AuSheetRow label="Layer">Component</AuSheetRow><AuSheetRow label="Primitive">Radix Dialog</AuSheetRow><AuSheetRow label="Status">Ready</AuSheetRow></AuSheet></>
    case "AuSlider":
      return <div className="w-full max-w-xl"><AuSlider label="Intensity" min={0} max={100} value={slider} valueDisplay={`${slider}%`} onChange={(event) => setSlider(Number(event.target.value))} help="Use the keyboard arrows for precise changes." /></div>
    case "AuStatCard":
      return <div className="grid w-full grid-cols-2 gap-4"><AuStatCard icon="widgets" label="Components" value="22" hint="Documented in the styleguide" /><AuStatCard icon="auto_awesome" label="Coverage" value="100%" hint="Core Auis surface" variant="ai" /></div>
    case "AuTable":
      return <AuTable><thead><tr><th>Component</th><th>Layer</th><th>Status</th></tr></thead><tbody><tr><td>AuButton</td><td>Primitive</td><td><AuPill variant="live">Ready</AuPill></td></tr><tr><td>AuModal</td><td>Component</td><td><AuPill variant="live">Ready</AuPill></td></tr><tr><td>AuMentionMenu</td><td>Domain</td><td><AuPill variant="beta">Auis</AuPill></td></tr></tbody></AuTable>
    case "AuTabs":
      return <div className="flex w-full flex-col gap-5"><AuTabs aria-label="Example tabs" items={[{ value: "overview", label: "Overview" }, { value: "comments", label: "Comments", count: 4 }, { value: "history", label: "History" }]} value={tab} onChange={setTab} /><p className="text-sm text-fg-secondary">Active value: <code>{tab}</code></p></div>
    case "AuToast":
      return <div className="flex flex-wrap gap-3"><AuButton onClick={() => toast.push({ title: "Saved", description: "The change is ready for review.", variant: "success" })}>Success toast</AuButton><AuButton variant="ai" onClick={() => toast.push({ title: "Agent finished", description: "Inspect the result before approving.", variant: "ai" })}>AI toast</AuButton><AuButton variant="danger" onClick={() => toast.push({ title: "Could not save", variant: "error" })}>Error toast</AuButton></div>
    case "AuToggle":
      return <div className="flex w-full max-w-xl flex-col gap-4"><label className="flex items-center gap-3 text-sm"><AuToggle checked={enabled} onChange={setEnabled} label="Live response" />Live response</label><AuToggleRow title="Auto construct" description="Allow the selected agent to build explicitly queued work." checked={enabled} onChange={setEnabled} /></div>
    case "Icon":
      return <div className="grid grid-cols-6 gap-6">{["home", "palette", "account_tree", "rate_review", "edit", "auto_awesome", "search", "settings", "check_circle", "warning", "error", "more_horiz"].map((name) => <div key={name} className="flex flex-col items-center gap-2 text-xs text-fg-tertiary"><Icon name={name} size={24} /><code>{name}</code></div>)}</div>
  }
}

export function ComponentShowcase({ component }: { component: ComponentName }) {
  return (
    <>
      <PageHero title={component}>{COMPONENTS[component]}</PageHero>
      <div className="mx-auto flex max-w-6xl flex-col gap-16 px-10 pb-14">
        <Section id="preview" title="Preview" lead="Live output from the component that ships in this repository.">
          <Stage label={component} gridClassName="flex min-h-48 w-full items-center justify-center p-8">
            <Demo component={component} />
          </Stage>
        </Section>
        <Section id="usage" title="Usage" lead="Import the Auis wrapper; product pages should not reach through to its primitive.">
          <div className="rounded-lg border border-subtle bg-raised p-6">
            <code className="text-sm text-fg-primary">{USAGE_IMPORTS[component] ?? `import { ${component} } from "@/components/ui/${component}"`}</code>
          </div>
        </Section>
      </div>
    </>
  )
}
