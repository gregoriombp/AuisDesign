# Styleguide page structure — the canonical pattern

> Source of truth for any page in `app/auis/styleguide/`.
> Skills may generate a free-form skeleton; **the agent reorders it to the pattern before applying**.

This is the 2026-05 version. It lives in `_primitives.tsx`; change it there when you change it here.

## Why it exists

Before this convention, every styleguide page chose its own section order
and what to document. Result: devs found the API in one place, anatomy in
another, and a11y/responsive/tokens-consumed didn't exist consistently.

This page fixes **the section order** and **which primitives to use in each
one**. The intent is that a new dev finds the same information in the same
place, whichever component they open.

## Structure of an **individual component** page (15 sections)

Use this pattern for a page that documents **one** specific component
(`AuButton`, `AuPill`, `AuCheckpointChip`, etc.). For a parent page that groups
several implementations of the same family, use the "family hub page" section
below.

The order is fixed. Sections may be **skipped** when they don't apply (e.g. a
purely visual component with no interaction skips `States`, and `Accessibility` gets
shorter). Never **reorder**.

| # | Section | Primitive | When to skip |
|---|---|---|---|
| 1 | PageHero — title and lead | `PageHero` | Never |
| 2 | Tldr — when to use / when not to | `Tldr` | Never |
| 3 | Toc — table of contents (page >400 lines) | `Toc` | Short pages |
| 4 | Anatomy — named parts | `Section` + `Spec` | Trivial component (1 element) |
| 5 | Variants — visual variants | `Section` + `Stage` | Component with no variants |
| 6 | Sizes — densities / scales | `Section` + `Stage` | Component with a single size |
| 7 | States — interactive | `StatesMatrix` | Purely visual component |
| 8 | Composition — real combined usage | `Section` + `Stage` | Leaf component |
| 9 | Responsive — behavior per viewport | `ResponsiveStage` | Component outside layout (e.g. dot, badge) |
| 10 | API — props | `ApiTable` + `PropRow` | Never (even zero props counts as a "—" row) |
| 11 | TokensConsumed — design tokens read | `TokensConsumed` | Never (at least `--fg-*` or `--bg-*`) |
| 12 | Accessibility — ARIA, keyboard, SR | `Section` + `KeyboardTable` | Component with no focus/keyboard |
| 13 | Code — canonical examples | `CodeExample` x3-4 | Never |
| 14 | DoDont — visual rules | `DoDont` | Never |
| 15 | RelatedLinks — contextual navigation | `RelatedLinks` | Never (minimum 2 items) |

## Structure of a **family hub page**

Use it when the sidebar has a parent item with more than one child, for example:

- `Tables` → `AuTable`, `Data table`, `Members table`
- `Modals and dialogs` → `AuModal`, `Connect modal`, `Welcome modal`
- `Navigation` → `AuNavRail`, `AuSidebar`, `AuBreadcrumb`

The hub page exists for quick decisions and visual comparison. It must not
open with "when to use / when not to use" cards; it shows the whole
inventory first.

| # | Section | Primitive | Note |
|---|---|---|---|
| 1 | PageHero | `PageHero` | Explains the family, not a specific item |
| 2 | Toc | `Toc` | Whenever the page has more than 3 sections |
| 3 | Inline inventory | `Section` + real/static previews | Show every child on the same page, without relying on buttons that open overlays |
| 4 | Anatomy / shared patterns | `Section` + `Spec` | Only what holds for the whole family |
| 5 | API of the base item | `ApiTable` + `PropRow` | When there is a base primitive (`AuModal`, `AuTable`) |
| 6 | When to use | HTML table | Minimum columns: component, when to use, when not to use, note |
| 7 | RelatedLinks | `RelatedLinks` | Links to the children's technical subpages |

Hub page rules:

- The parent item is the main entry in the sidebar.
- Each child appears as `children` on the parent item in `navigation.ts`.
- The children's technical subpages may keep existing, but they don't compete
  with the hub in the sidebar as top-level entries.
- Show every child inline in the hub; for modals, don't force the user to
  click a button to understand which modal exists.
- The "when to use / when not to use" decision goes at the end as a table,
  not in a `Tldr` at the top.

## Structure of a **foundation** page (10 sections)

Foundations (color, typography, spacing, grid, motion, iconography, logos…)
document *tokens* and *principles*, not props.

| # | Section | Primitive |
|---|---|---|
| 1 | PageHero | `PageHero` |
| 2 | Principles / When to use what | `Tldr` or a decision table |
| 3 | Toc (optional) | `Toc` |
| 4 | Anatomy / Root unit | `Section` + `Spec` |
| 5 | Catalog / Inventory | `Section` (its own grid) |
| 6 | In context | `Section` |
| 7 | In code | `CodeExample` |
| 8 | Accessibility (when applicable) | `Section` |
| 9 | DoDont | `DoDont` |
| 10 | RelatedLinks | `RelatedLinks` |

## Default imports snippet

```tsx
import {
  PageHero,
  Section,
  Stage,
  Spec,
  Tldr,
  Toc,
  StatesMatrix,
  PropRow,
  ApiTable,
  TokensConsumed,
  ResponsiveStage,
  KeyboardTable,
  CodeExample,
  DoDont,
  RelatedLinks,
} from "../../_primitives"
```

Import **only what you use**. ESLint doesn't block it, but the reviewer will ask.

## Minimal skeleton of a component page

```tsx
export default function FooPage() {
  return (
    <>
      <PageHero title="Foo">
        What Foo is, in 1-2 sentences.
      </PageHero>

      <div className="max-w-[1200px] mx-auto px-10 pb-14 flex flex-col gap-16">
        <Tldr
          use={[<>Item 1</>, <>Item 2</>]}
          dontUse={[<>Item 1</>, <>Item 2</>]}
        />

        <Section id="anatomy" title="Anatomy" lead="…">
          {/* Spec rows with named parts */}
        </Section>

        <Section id="variants" title="Variants" lead="…">
          <Stage label="…"> {/* … */} </Stage>
        </Section>

        <Section id="sizes" title="Sizes" lead="…">
          <Stage label="sm · md · lg"> {/* … */} </Stage>
        </Section>

        <Section id="states" title="States" lead="…">
          <StatesMatrix states={[/* … */]} />
        </Section>

        <Section id="composition" title="Composition" lead="…">
          {/* examples with other components */}
        </Section>

        <Section id="responsive" title="Responsive" lead="…">
          <ResponsiveStage mobile={/* … */} desktop={/* … */} />
        </Section>

        <Section id="api" title="API" lead="…">
          <ApiTable>
            <PropRow prop="…" type="…" def="…" doc="…" />
          </ApiTable>
        </Section>

        <Section id="tokens" title="Tokens consumed" lead="…">
          <TokensConsumed tokens={[
            { token: "--bg-raised", role: "card background", value: "var(--au-white)" },
          ]} />
        </Section>

        <Section id="accessibility" title="Accessibility" lead="…">
          <KeyboardTable rows={[
            { keys: ["Tab"], action: "Move focus" },
          ]} />
        </Section>

        <Section id="code" title="In code" lead="…">
          <CodeExample>{`/* … */`}</CodeExample>
        </Section>

        <Section id="do-dont" title="Do / Don't">
          <DoDont dos={[/* … */]} donts={[/* … */]} />
        </Section>

        <Section id="related" title="See also">
          <RelatedLinks items={[
            { name: "Component X", href: "/auis/styleguide/components/x", description: "…" },
          ]} />
        </Section>
      </div>
    </>
  )
}
```

## Conventions

- **Outer container:** `<div className="max-w-[1200px] mx-auto px-10 pb-14 flex flex-col gap-16">`
- **gap between sections:** `gap-16` (64px)
- **`Section` ids:** kebab-case, semantic (not numbering). Use `id="api"`, not `id="section-9"`.
- **`Section` lead:** one short sentence. It explains **why** the section exists; it does not repeat the title.
- **Language:** follow the product's language (see `PRODUCT_CONTEXT.md`); keep code and technical names in English. Never translate token or component names.
- **Tokens:** **never** hardcode colors, paddings, radius. Always `var(--*)`.
- **<kbd> accessibility:** `KeyboardTable` already handles the styling — just pass the list.
- **Component layer:** the page *structure* is defined here; the *layer*
  (Primitives / Components / Patterns / Domain) where it lands in the sidebar is
  defined in [`component-layers.md`](./component-layers.md). The two go together.

## Living example

The canonical reference page is
[components/buttons/page.tsx](../app/auis/styleguide/components/buttons/page.tsx).
Use it as a mirror when creating a new page.

## Migrating existing pages

The migration is **incremental**: each old page is refactored when its
corresponding component gets touched. There is no race to refactor everything
at once. The pattern in this document applies only to:

1. New pages
2. Existing pages that are being substantially rewritten
