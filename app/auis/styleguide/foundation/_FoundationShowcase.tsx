import { PageHero, Section, Stage } from "../_primitives"
import { AuButton } from "@/components/ui/AuButton"
import { AuCard } from "@/components/ui/AuCard"
import { Icon } from "@/components/ui/Icon"

export const FOUNDATIONS = {
  color: "Semantic surfaces, text, borders, accents, and state colors.",
  typography: "One Geist-based voice with named display, body, caption, and code roles.",
  spacing: "A compact four-pixel rhythm expressed through the standard utility scale.",
  radius: "A restrained radius scale from compact controls to large containers.",
  shadows: "Five elevation levels for raised surfaces, overlays, and transient UI.",
  motion: "Fast, base, and slow durations with one fluid product curve.",
  iconography: "Material Symbols Rounded with optical defaults controlled by Icon.",
  accessibility: "Focus, contrast, semantics, reduced motion, and keyboard expectations.",
} as const

export type FoundationName = keyof typeof FOUNDATIONS

const COLORS = [
  ["Canvas", "--bg-canvas"],
  ["Surface", "--bg-surface"],
  ["Raised", "--bg-raised"],
  ["Muted", "--bg-muted"],
  ["Hover", "--bg-hover"],
  ["Selected", "--bg-selected"],
  ["Inverse", "--bg-inverse"],
  ["Brand", "--accent-brand"],
  ["Success", "--accent-success"],
  ["Warning", "--accent-warning"],
  ["Danger", "--accent-danger"],
] as const

function FoundationDemo({ foundation }: { foundation: FoundationName }) {
  if (foundation === "color") {
    return (
      <div className="grid w-full grid-cols-4 gap-4">
        {COLORS.map(([label, token]) => (
          <div key={token} className="overflow-hidden rounded-lg border border-subtle bg-raised">
            <div className="h-24 border-b border-subtle" style={{ background: `var(${token})` }} />
            <div className="p-3">
              <div className="text-sm font-medium text-fg-primary">{label}</div>
              <code className="text-2xs text-fg-tertiary">{token}</code>
            </div>
          </div>
        ))}
      </div>
    )
  }
  if (foundation === "typography") {
    return (
      <div className="flex w-full flex-col gap-8">
        <div><code className="text-2xs text-fg-tertiary">display-xl</code><p className="display-xl">Design in the codebase.</p></div>
        <div><code className="text-2xs text-fg-tertiary">display-md</code><p className="display-md">One source of truth.</p></div>
        <div><code className="text-2xs text-fg-tertiary">body-lg</code><p className="body-lg max-w-3xl text-fg-secondary">Auis keeps the design system, product screens, flows, and review loop close enough to evolve together.</p></div>
        <div><code className="text-2xs text-fg-tertiary">body-sm · caption · mono</code><p className="body-sm text-fg-secondary">Body small for supporting copy.</p><p className="caption">Caption for metadata.</p><code className="mono text-sm">const sourceOfTruth = &quot;code&quot;</code></div>
      </div>
    )
  }
  if (foundation === "spacing") {
    const spaces = [["1", "w-1"], ["2", "w-2"], ["3", "w-3"], ["4", "w-4"], ["6", "w-6"], ["8", "w-8"], ["12", "w-12"], ["16", "w-16"]] as const
    return <div className="flex w-full flex-col gap-4">{spaces.map(([label, width]) => <div key={label} className="flex items-center gap-4"><code className="w-16 text-xs text-fg-tertiary">{label}</code><div className={`h-4 rounded-sm bg-brand ${width}`} /></div>)}</div>
  }
  if (foundation === "radius") {
    return <div className="grid w-full grid-cols-4 gap-4">{["rounded-xs", "rounded-sm", "rounded-md", "rounded-lg", "rounded-xl", "rounded-2xl", "rounded-full"].map((radius) => <div key={radius} className={`flex h-28 items-center justify-center border border-strong bg-surface ${radius}`}><code className="text-xs text-fg-secondary">{radius}</code></div>)}</div>
  }
  if (foundation === "shadows") {
    return <div className="grid w-full grid-cols-5 gap-6">{["shadow-xs", "shadow-sm", "shadow-md", "shadow-lg", "shadow-overlay"].map((shadow) => <div key={shadow} className={`flex h-32 items-end rounded-xl bg-raised p-4 ${shadow}`}><code className="text-xs text-fg-secondary">{shadow}</code></div>)}</div>
  }
  if (foundation === "motion") {
    return <div className="grid w-full grid-cols-3 gap-6">{[["Fast", "duration-au-fast"], ["Base", "duration-au-base"], ["Slow", "duration-au-slow"]].map(([label, duration]) => <button key={label} type="button" className={`group rounded-xl border border-subtle bg-raised p-6 text-left transition-transform ease-fluid hover:-translate-y-2 ${duration}`}><Icon name="motion_photos_on" size={28} /><span className="mt-6 block text-sm font-medium text-fg-primary">{label}</span><code className="text-2xs text-fg-tertiary">{duration}</code></button>)}</div>
  }
  if (foundation === "iconography") {
    return <div className="grid w-full grid-cols-6 gap-8">{["home", "widgets", "palette", "account_tree", "rate_review", "edit", "search", "settings", "check_circle", "warning", "error", "auto_awesome"].map((name) => <div key={name} className="flex flex-col items-center gap-3"><Icon name={name} size={28} /><code className="text-2xs text-fg-tertiary">{name}</code></div>)}</div>
  }
  return (
    <div className="grid w-full grid-cols-2 gap-4">
      {[
        ["Keyboard first", "Every interactive control has a visible focus state and a meaningful tab order."],
        ["Semantic HTML", "Buttons remain buttons, navigation remains navigation, and headings preserve hierarchy."],
        ["Reduced motion", "Enter, exit, and hover motion respects prefers-reduced-motion."],
        ["No color-only meaning", "Icons, text, and state labels reinforce semantic colors."],
      ].map(([title, description]) => (
        <AuCard key={title} className="flex gap-4 p-5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted"><Icon name="check" size={18} /></span>
          <div><h3 className="text-sm font-semibold text-fg-primary">{title}</h3><p className="mt-1 text-sm leading-relaxed text-fg-secondary">{description}</p></div>
        </AuCard>
      ))}
      <div className="col-span-2 flex items-center gap-3 rounded-lg border border-subtle bg-raised p-5">
        <AuButton variant="primary">Tab to focus me</AuButton>
        <span className="text-sm text-fg-secondary">Focus rings use the system focus token.</span>
      </div>
    </div>
  )
}

export function FoundationShowcase({ foundation }: { foundation: FoundationName }) {
  return (
    <>
      <PageHero title={foundation[0].toUpperCase() + foundation.slice(1)}>{FOUNDATIONS[foundation]}</PageHero>
      <div className="mx-auto flex max-w-6xl flex-col gap-16 px-10 pb-14">
        <Section id="system" title="System" lead="Live values from the foundation currently loaded by Auis.">
          <Stage label={foundation} gridClassName="flex min-h-64 w-full items-center p-8">
            <FoundationDemo foundation={foundation} />
          </Stage>
        </Section>
        <Section id="authority" title="Token authority" lead="Foundation changes are reviewed system changes, not page-level styling decisions.">
          <div className="rounded-lg border border-subtle bg-raised p-6 text-sm leading-relaxed text-fg-secondary">
            Use <code>/auis-design-system-foundation</code> for the initial system or <code>/auis-foundation-update</code> for an additive update. Other work consumes these values without creating new tokens.
          </div>
        </Section>
      </div>
    </>
  )
}
