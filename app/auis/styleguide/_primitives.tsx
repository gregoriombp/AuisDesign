import * as React from "react"
import { CodeHighlight } from "./_highlight"
import { LayerBadge } from "./_LayerBadge"

export function PageHero({
  title,
  trailing,
  children,
}: {
  title: React.ReactNode
  /** Optional slot rendered to the right of the title (e.g. status badge). */
  trailing?: React.ReactNode
  children?: React.ReactNode
}) {
  return (
    <header className="au-hero">
      <div className="au-hero__inner">
        <div className="flex items-baseline gap-3 flex-wrap">
          <h1 className="au-hero__title">{title}</h1>
          <LayerBadge />
          {trailing}
        </div>
        {children && <p className="au-hero__lead">{children}</p>}
      </div>
    </header>
  )
}

export function Section({
  id,
  title,
  lead,
  children,
}: {
  id: string
  title: string
  lead?: string
  children: React.ReactNode
}) {
  return (
    <section id={id} className="scroll-mt-16">
      <div className="mb-6">
        <h2 className="m-0">{title}</h2>
        {lead && (
          <p className="text-(--body-md-size) text-(--fg-secondary) mt-2 max-w-2xl">
            {lead}
          </p>
        )}
      </div>
      {children}
    </section>
  )
}

export function Stage({
  label,
  hint,
  children,
  dark,
  gridClassName,
}: {
  label: string
  hint?: string
  children: React.ReactNode
  dark?: boolean
  gridClassName?: string
}) {
  return (
    <div className="rounded-lg border border-(--border-subtle) bg-(--bg-raised) overflow-hidden">
      <div className="px-5 py-3 border-b border-(--border-subtle) flex items-baseline justify-between">
        <div>
          <div className="text-sm font-medium text-(--fg-primary)">
            {label}
          </div>
          {hint && <div className="caption mt-0.5">{hint}</div>}
        </div>
      </div>
      <div
        className={
          "p-8 " +
          (gridClassName ?? "flex flex-wrap items-center gap-3")
        }
        style={
          dark
            ? {
                backgroundColor: "var(--dark-bg)",
                color: "var(--dark-fg-primary)",
              }
            : undefined
        }
      >
        {children}
      </div>
    </div>
  )
}

export function Spec({
  k,
  v,
  d,
}: {
  k: string
  v: string
  d?: string
}) {
  return (
    <div>
      <div className="au-eyebrow mb-1">{k}</div>
      <div className="mono text-sm text-(--fg-primary)">{v}</div>
      {d && <div className="caption mt-1">{d}</div>}
    </div>
  )
}

export function PropRow({
  prop,
  type,
  def,
  doc,
}: {
  prop: string
  type: string
  def?: string
  doc: string
}) {
  return (
    <tr className="border-b border-(--border-subtle) last:border-b-0 align-top">
      <td className="py-3 pr-4 mono text-sm text-(--fg-primary) whitespace-nowrap">
        {prop}
      </td>
      <td className="py-3 pr-4 mono text-xs text-(--au-blue-700) whitespace-normal">
        {type}
      </td>
      <td className="py-3 pr-4 mono text-xs text-(--fg-tertiary) whitespace-nowrap">
        {def ?? "—"}
      </td>
      <td className="py-3 text-sm text-(--fg-secondary)">{doc}</td>
    </tr>
  )
}

export function ApiTable({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-(--border-subtle) bg-(--bg-raised) p-6 overflow-x-auto">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-(--border-subtle)">
            <th className="pb-2 au-eyebrow">prop</th>
            <th className="pb-2 au-eyebrow">type</th>
            <th className="pb-2 au-eyebrow">default</th>
            <th className="pb-2 au-eyebrow">doc</th>
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}

export function CodeExample({
  label = "example",
  lang = "tsx",
  children,
}: {
  label?: string
  lang?: "tsx" | "ts" | "css" | "text"
  children: string
}) {
  return (
    <div className="mt-4">
      <div className="au-eyebrow mb-2">{label}</div>
      <CodeHighlight lang={lang}>{children}</CodeHighlight>
    </div>
  )
}

export function DoDont({
  dos,
  donts,
}: {
  dos: React.ReactNode[]
  donts: React.ReactNode[]
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="rounded-lg border border-(--au-emerald-300) bg-(--au-emerald-100) p-5">
        <div className="au-eyebrow mb-2 text-(--au-emerald-800)">do</div>
        <ul className="body-sm m-0 pl-4 list-disc flex flex-col gap-1 text-(--au-emerald-900)">
          {dos.map((d, i) => (
            <li key={i}>{d}</li>
          ))}
        </ul>
      </div>
      <div className="rounded-lg border border-(--au-red-300) bg-(--au-red-100) p-5">
        <div className="au-eyebrow mb-2 text-(--au-red-800)">
          don&apos;t
        </div>
        <ul className="body-sm m-0 pl-4 list-disc flex flex-col gap-1 text-(--au-red-900)">
          {donts.map((d, i) => (
            <li key={i}>{d}</li>
          ))}
        </ul>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────
 * New primitives from the canonical pattern (2026-05).
 * Docs: docs/styleguide-page-structure.md
 * ──────────────────────────────────────────────────────────────────── */

/**
 * Tldr — block at the top of the page, right after PageHero, saying in two
 * columns "when to use" vs "when not to use". Shortens the time to a decision
 * for the developer. Always use it, except on short foundation pages.
 */
export function Tldr({
  use,
  dontUse,
}: {
  use: React.ReactNode[]
  dontUse: React.ReactNode[]
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="rounded-lg border border-(--au-blue-200) bg-(--au-blue-100) p-5">
        <div className="au-eyebrow mb-2 text-(--au-blue-800)">
          when to use
        </div>
        <ul className="body-sm m-0 pl-4 list-disc flex flex-col gap-1 text-(--au-blue-900)">
          {use.map((d, i) => (
            <li key={i}>{d}</li>
          ))}
        </ul>
      </div>
      <div className="rounded-lg border border-(--border-default) bg-(--bg-surface) p-5">
        <div className="au-eyebrow mb-2 text-(--fg-secondary)">
          when not to use
        </div>
        <ul className="body-sm m-0 pl-4 list-disc flex flex-col gap-1 text-(--fg-primary)">
          {dontUse.map((d, i) => (
            <li key={i}>{d}</li>
          ))}
        </ul>
      </div>
    </div>
  )
}

export type StateName =
  | "default"
  | "hover"
  | "focus"
  | "active"
  | "disabled"
  | "loading"
  | "error"
  | "selected"

/**
 * StatesMatrix — grid with an automatic label per state. Each cell gets a demo
 * already in the described state (use the real component's props/classes to
 * force the state; don't invent CSS).
 */
export function StatesMatrix({
  states,
  columns = 3,
  dark,
}: {
  states: Array<{ name: StateName | string; node: React.ReactNode; note?: string }>
  columns?: 2 | 3 | 4
  dark?: boolean
}) {
  const cols =
    columns === 2
      ? "md:grid-cols-2"
      : columns === 4
        ? "md:grid-cols-2 lg:grid-cols-4"
        : "md:grid-cols-3"
  return (
    <div className={"grid grid-cols-1 gap-4 " + cols}>
      {states.map((s, i) => (
        <div
          key={i}
          className="rounded-lg border border-(--border-subtle) overflow-hidden flex flex-col"
          style={{
            background: dark ? "var(--dark-bg)" : "var(--bg-raised)",
          }}
        >
          <div className="px-4 py-2 border-b border-(--border-subtle) bg-(--bg-raised) flex items-center justify-between">
            <span className="au-eyebrow">{s.name}</span>
          </div>
          <div className="flex-1 p-6 flex items-center justify-center min-h-[88px]">
            {s.node}
          </div>
          {s.note && (
            <div className="px-4 py-2 border-t border-(--border-subtle) bg-(--bg-raised) caption">
              {s.note}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

/**
 * TokensConsumed — list of the design tokens (CSS vars) the component reads from
 * context. Each row: token, role (what it does inside the component), default
 * (the current value or alias).
 */
export function TokensConsumed({
  tokens,
}: {
  tokens: Array<{ token: string; role: string; value?: string }>
}) {
  return (
    <div className="rounded-lg border border-(--border-subtle) bg-(--bg-raised) p-6 overflow-x-auto">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-(--border-subtle)">
            <th className="pb-2 au-eyebrow">token</th>
            <th className="pb-2 au-eyebrow">role</th>
            <th className="pb-2 au-eyebrow">value / alias</th>
          </tr>
        </thead>
        <tbody>
          {tokens.map((t, i) => (
            <tr
              key={i}
              className="border-b border-(--border-subtle) last:border-b-0 align-top"
            >
              <td className="py-3 pr-4 mono text-sm text-(--fg-primary) whitespace-nowrap">
                {t.token}
              </td>
              <td className="py-3 pr-4 text-sm text-(--fg-secondary)">
                {t.role}
              </td>
              <td className="py-3 mono text-xs text-(--fg-tertiary) whitespace-nowrap">
                {t.value ?? "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/**
 * ResponsiveStage — three viewports side by side (mobile · tablet · desktop) to
 * show how the component reflows. Each frame has chrome with its width.
 */
export function ResponsiveStage({
  mobile,
  tablet,
  desktop,
  label,
  hint,
}: {
  mobile: React.ReactNode
  tablet?: React.ReactNode
  desktop: React.ReactNode
  label?: string
  hint?: string
}) {
  const frame = (width: number, node: React.ReactNode, name: string) => (
    <div className="rounded-lg border border-(--border-subtle) bg-(--bg-raised) overflow-hidden flex flex-col">
      <div className="px-4 py-2 border-b border-(--border-subtle) flex items-baseline justify-between">
        <span className="au-eyebrow">{name}</span>
        <code className="mono text-[10px] text-(--fg-tertiary)">
          {width}px
        </code>
      </div>
      <div className="p-4 bg-(--bg-surface) flex justify-center">
        <div
          className="bg-(--bg-raised) border border-(--border-subtle) rounded-md overflow-hidden"
          style={{ width: "100%", maxWidth: width }}
        >
          {node}
        </div>
      </div>
    </div>
  )
  return (
    <div className="rounded-lg border border-(--border-subtle) bg-(--bg-raised) overflow-hidden">
      {(label || hint) && (
        <div className="px-5 py-3 border-b border-(--border-subtle)">
          {label && (
            <div className="text-sm font-medium text-(--fg-primary)">
              {label}
            </div>
          )}
          {hint && <div className="caption mt-0.5">{hint}</div>}
        </div>
      )}
      <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-4">
        {frame(375, mobile, "mobile")}
        {frame(768, tablet ?? mobile, "tablet")}
        {frame(1280, desktop, "desktop")}
      </div>
    </div>
  )
}

/**
 * KeyboardTable — keyboard shortcuts the component supports. Use it in the
 * Accessibility section. Key on the left as a `kbd`, action on the right.
 */
export function KeyboardTable({
  rows,
}: {
  rows: Array<{ keys: string[]; action: string }>
}) {
  return (
    <div className="rounded-lg border border-(--border-subtle) bg-(--bg-raised) p-6 overflow-x-auto">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-(--border-subtle)">
            <th className="pb-2 au-eyebrow w-1/3">key</th>
            <th className="pb-2 au-eyebrow">action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr
              key={i}
              className="border-b border-(--border-subtle) last:border-b-0 align-top"
            >
              <td className="py-3 pr-4 whitespace-nowrap">
                <span className="inline-flex flex-wrap gap-1">
                  {r.keys.map((k, j) => (
                    <kbd
                      key={j}
                      className="mono text-xs px-2 py-0.5 rounded-sm border border-(--border-default) bg-(--bg-surface) text-(--fg-primary)"
                    >
                      {k}
                    </kbd>
                  ))}
                </span>
              </td>
              <td className="py-3 text-sm text-(--fg-secondary)">
                {r.action}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/**
 * RelatedLinks — grid of cards at the end of the page linking to other related
 * components or foundations. Closes the contextual navigation loop.
 */
export function RelatedLinks({
  items,
}: {
  items: Array<{ name: string; href: string; description: string }>
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {items.map((item) => (
        <a
          key={item.href}
          href={item.href}
          className="rounded-lg border border-(--border-subtle) bg-(--bg-raised) p-5 flex flex-col gap-2 no-underline transition-colors hover:border-(--border-default) hover:bg-(--bg-hover)"
        >
          <div className="text-sm font-medium text-(--fg-primary)">
            {item.name}
          </div>
          <p className="caption m-0">{item.description}</p>
          <span className="mono text-[10px] text-(--au-blue-700) mt-1">
            {item.href} →
          </span>
        </a>
      ))}
    </div>
  )
}

/**
 * Toc — inline table of contents built from the section ids. Use it on long
 * pages (>400 lines), right after PageHero/Tldr. Each item is an anchor.
 */
export function Toc({
  items,
}: {
  items: Array<{ id: string; label: string }>
}) {
  return (
    <nav
      aria-label="Table of contents"
      className="rounded-lg border border-(--border-subtle) bg-(--bg-raised) p-5"
    >
      <div className="au-eyebrow mb-3">on this page</div>
      <ol className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-1 list-decimal pl-5 text-sm text-(--fg-secondary)">
        {items.map((i) => (
          <li key={i.id}>
            <a
              href={`#${i.id}`}
              className="text-(--fg-primary) no-underline hover:text-(--au-blue-700)"
            >
              {i.label}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  )
}
