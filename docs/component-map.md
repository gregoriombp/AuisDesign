# Component map — where to find the reference in the DS

> **Read this BEFORE creating any component or screen.** This is the
> "I need X → use Y" index of the Auis design system. It tells you **what to import**,
> from **where**, and **when NOT** to use each piece. It is the sibling of
> [`component-layers.md`](./component-layers.md) (taxonomy/layers) and of
> [`navigation.ts`](../app/auis/styleguide/navigation.ts) (live inventory
> + styleguide routes). Here the focus is the **import** and the **when to use**.
>
> Source of truth for the rules: [`AGENTS.md`](../AGENTS.md). If they conflict, AGENTS wins.

## Read this first — the map has two layers

Auis is a **builder**. This repo ships the UI that the builder itself is made of. It does
**not** ship a component catalog for *your* product. Those are two different things, and
collapsing them into one list is exactly how an agent ends up importing a component that
was never here.

| | **Layer A — Auis builder components** | **Layer B — your product's components** |
|---|---|---|
| What | The **21** `Au*` files in `components/ui/` | Whatever you build |
| Does it ship? | **Yes** — it is the tool's own UI | **No — empty on purpose** |
| Why it exists | The Review Bridge, Auis's own mark, and the primitives those stand on | Your product |
| Can I import it? | Yes — freely | — |
| Registered where | Already here (see [Layer A](#layer-a--auis-builder-components-what-ships)) | `/auis/styleguide`, as you add it (see [Layer B](#layer-b--your-products-components-empty-on-purpose)) |

**Layer A is importable and reusable — but its reason for existing is the tool.** Read it as
*"what Auis is made of, which you may reuse"*, not as *"the catalog your product should be
assembled from"*. If you need a pricing table, a payment card, or an integration tile,
Layer A does not have one and never did — that is Layer B, and Layer B is yours to build.

**Layer B ships deliberately empty.** The styleguide gallery
([`navigation.ts`](../app/auis/styleguide/navigation.ts)) is a zeroed template waiting for
**your** components. That is a starting line, not a gap.

## Golden rule (the atomic recipe)

1. **Reuse > extend > create.** Look here and in `components/ui/Au*` before writing
   anything. Only create from scratch if nothing fits and the semantics are
   genuinely new — never duplicate under a new name.
2. **Compose from primitives.** A bigger piece (card, modal, screen) is a *recipe*
   of `Au*` primitives. `AuMentionChip` is literally the `badge` primitive + `Icon` +
   tokens; `AuMentionMenu` is `Icon` + tokens. Neither reimplements a button, an icon,
   or a logo by hand.
3. **Tokens only.** No `#hex`, `w-[37px]`, `rounded-[10px]`. Use the
   [token vocabulary](#token-vocabulary-paste-this-instead-of-hardcoding)
   below. Missing token → report it, don't create it (only the `foundation` skill creates tokens).
4. **Icon = `Icon`.** Material Symbols via `Icon`. Never a raw `<svg>`, never another
   icon lib. `react-icons` only for **brands** that Material Symbols lacks
   (Visa, Mastercard, Amex, Slack, WhatsApp). Auis ships **no** third-party logo registry
   and no brand illustrations — a DS component must never hardcode a mark (see AGENTS.md §4).

---

# Layer A — Auis builder components (what ships)

The 21 `Au*` in `components/ui/`. They exist because the **Auis builder** needed them: the
Review Bridge is built out of them, and the primitives underneath exist to serve it. You may
import and reuse any of them in your own screens — just don't mistake this for a product
catalog.

> **Auis ships no product shell.** There is no dashboard layout, no sidebar, no header, no
> nav rail, no notifications panel — and no AI copilot. Those belonged to the product Auis was
> extracted from, and they were removed: a design-system *builder* has no business shipping a
> finished product's chrome. If your product needs a shell, that is Layer B and it is yours to
> build.

## What each cluster is for

| Cluster | Components | What it powers |
|---|---|---|
| **Review Bridge** | `AuMentionMenu` · `AuMentionChip` | The comment/review layer: `@agent` / `/skill` picker and the chips those commands render as inside comment text. |
| **Brand** | `AuLogo` | Auis's own mark — the builder chrome only. No third-party logos and no illustrations ship: those belong to the product you build. |
| **Primitives & feedback** | The remaining 18 | The bricks the two clusters above stand on. Genuinely generic — this is the part most worth reusing. |

## Shortcut by intent (the fast path)

Every row below resolves to a file that **exists**. If your need isn't here, it is Layer B —
build it (see [Genuinely missing something?](#genuinely-missing-something)).

| I need… | Use | Import | When NOT to use it |
|---|---|---|---|
| Icon | `Icon` | `@/components/ui/Icon` | `<Icon name="..." size={20} />`. Automatic optical default (`wght`/`GRAD`/`opsz`) — don't force `weight={200}` on a small icon. Never a raw `<svg>`. |
| Auis logo / lockup | `AuLogo` | `@/components/ui/AuLogo` | Auis's own mark, for the builder chrome (`/auis/*`). Never render it from a DS component — that component ships inside *your* product. |
| Button | `AuButton` | `@/components/ui/AuButton` | has `intent`/`size`/an `Icon` slot. Don't style a `<button>` by hand. |
| Form field | `AuField` (or `AuInput`) | `@/components/ui/AuInput` | `AuField` (label + error + `framed` variant) and `AuInput` are exported from the **same file**. Use `AuField` when you need a label/error; bare `AuInput` otherwise. |
| Checkbox / toggle / slider | `AuCheckbox` · `AuToggle` · `AuSlider` | `@/components/ui/AuCheckbox` · `@/components/ui/AuToggle` · `@/components/ui/AuSlider` | Don't hand-roll a styled `<input type=checkbox>`. |
| Tag / chip / badge | `AuPill` | `@/components/ui/AuPill` | There is a raw shadcn `badge.tsx` — it is the base of `AuMentionChip`, not for product use. Prefer `AuPill`. |
| Generic card | `AuCard` | `@/components/ui/AuCard` | Sub-exports: `AuCardHeader`/`Title`/`Description`/`Content`/`Footer`/`Action`. For a single metric → `AuStatCard`. |
| Metric card | `AuStatCard` | `@/components/ui/AuStatCard` | Number + delta + icon. Anything richer is a plain `AuCard`. |
| Table | `AuTable` | `@/components/ui/AuTable` | Simple, styled, static table. It has **no** built-in sort/pagination/selection — if you need those, that's a Layer B component you build on top. |
| Modal / dialog | `AuModal` | `@/components/ui/AuModal` | The base for every modal. For a wizard, pass `stepKey` (the body re-animates per step) — don't swap content silently. **Never** hand-roll an overlay. |
| Side panel / drawer | `AuSheet` | `@/components/ui/AuSheet` | The only drawer that ships. Don't hand-roll a `fixed inset-0` panel. |
| Dropdown menu | `AuDropdownMenu` | `@/components/ui/AuDropdownMenu` | **Never** hand-roll a floating menu. |
| Mention menu | `AuMentionMenu` | `@/components/ui/AuMentionMenu` | The `@`/`/` picker of the Review Bridge. It is a mention surface, not a generic dropdown → `AuDropdownMenu`. |
| Mention / skill chip | `AuMentionChip` | `@/components/ui/AuMentionChip` | The `@agent`, `/skill` and `#directive` chips inside Review-Bridge comment text. Not a generic tag → `AuPill`. |
| Tabs | `AuTabs` | `@/components/ui/AuTabs` | |
| Empty state | `AuEmpty` | `@/components/ui/AuEmpty` | Slots: `AuEmptyTitle` / `AuEmptyMedia` / `AuEmptyDescription` / `AuEmptyContent` / `AuEmptyHeader`. |
| Inline alert | `AuAlert` | `@/components/ui/AuAlert` | Persistent, in-flow feedback. Transient feedback → `AuToast`. |
| Toast | `AuToast` | `@/components/ui/AuToast` | Mount `AuToastProvider` at the top of the tree (already done in the root layout). |
| Progress | `AuProgress` | `@/components/ui/AuProgress` | Determinate progress bar. |
| Breadcrumb | `AuBreadcrumb` | `@/components/ui/AuBreadcrumb` | The breadcrumb atom. There is **no** pre-assembled breadcrumbs bar — compose it yourself. |
| Side navigation / app shell / notifications | *(nothing ships)* | — | **Layer B.** Auis ships no sidebar, nav rail, header, dashboard layout, or notifications panel. Build what your product needs on `AuButton` + `Icon` + tokens. |

## Full Layer A inventory (21)

Terse on purpose (name · import `@/components/ui/<Name>` · role). Every name below resolves to
a file in `components/ui/`. Mirrors the taxonomy in
[`component-layers.md`](./component-layers.md).

### Primitives (13 `Au*`, + `Icon`)
`AuButton` button · `AuInput`/`AuField` input/field (same file) · `AuCheckbox` checkbox ·
`AuToggle` switch (+`AuToggleRow`) · `AuSlider` slider · `AuPill` tag/chip ·
`AuProgress` progress · `AuAlert` alert · `AuToast` toast (+`AuToastProvider`) ·
`AuEmpty` empty state (+ slots) · `AuTabs` tabs · `AuDropdownMenu` dropdown ·
`AuBreadcrumb` breadcrumb (atom) · `Icon` base icon.

### Components (5)
`AuCard` card (+ sub-exports) · `AuStatCard` metric · `AuTable` table ·
`AuModal` modal · `AuSheet` drawer.

### Domain (3 — tied to Auis)
`AuMentionMenu` mentions (Review Bridge) · `AuMentionChip` mention/skill chips (Review Bridge) ·
`AuLogo` Auis mark.

There is no infra/layout tier: **Auis ships no application shell.**

---

# Layer B — Your product's components (empty on purpose)

**Nothing ships here yet. That is the design.** Auis was extracted from a private product;
that product's component catalog was deliberately left behind. What you get is the builder
plus a clean, empty styleguide — so the first component in this table is *yours*.

Fill the table as you build. Same shape as Layer A, same "when NOT to use" discipline —
that column is what stops the next agent from duplicating what you just made.

| I need… | Use | Import | When NOT to use it |
|---|---|---|---|
| *(example — not shipped)* A pricing tier table | `AuPricingTable` | `@/components/ui/Au[Name]` | *Placeholder row showing the shape. Delete it when you add your first real component.* For a plain static table → `AuTable` (Layer A). |
| | | | |

## How a component gets into this table

1. **Build it with the [`auis-component`](../skills/design-system/auis-component/SKILL.md)
   skill.** It checks the shadcn registry first, prefers extending an existing primitive over
   building from scratch, and emits the implementation **and** the styleguide showcase in one
   pass. Apply this repo's convention on top (see AGENTS.md §1): `Au` prefix, PascalCase file
   in `components/ui/`, showcase at `app/auis/styleguide/components/au-[name]/page.tsx`.
2. **Register it in the styleguide.** The skill appends the entry to
   [`navigation.ts`](../app/auis/styleguide/navigation.ts). Keep links pointing only at pages
   that exist, or the sidebar 404s.
3. **Add a row here.** The map is the index agents read at step 0. A component that isn't in
   it will get rebuilt by the next agent — `ds:check` flags it as `map-missing`.
4. **Keep it honest with [`auis-audit`](../skills/design-system/auis-audit/SKILL.md).** It
   scans the repo and reports every component that is *used or implemented but missing from
   `/auis/styleguide`* — the exact drift this map exists to prevent. Run it when the gallery
   starts feeling out of date.

> Layer B components are **yours**: they may be domain-bound, business-aware, and as
> specific as your product needs. The [layer taxonomy](./component-layers.md) still applies —
> use it to decide where each one sits in the styleguide sidebar.

---

## Token vocabulary (paste this instead of hardcoding)

Tailwind v4 classes generated from the `@theme` block in `app/globals.css`. Use **these**,
never arbitrary values for color/spacing/radius/shadow/typography.

**Backgrounds:** `bg-canvas` · `bg-surface` · `bg-raised` · `bg-hover` · `bg-muted` ·
`bg-selected` · `bg-pressed` · `bg-inverse`
**Text:** `text-fg-primary` · `text-fg-secondary` · `text-fg-tertiary` ·
`text-fg-muted` · `text-fg-on-inverse`
**Borders:** `border-subtle` · `border-default` · `border-strong` · `border-inverse`
**Accent/semantic:** `accent-brand` (+`-hover`, `-pressed`) · `accent-success` ·
`accent-danger` (+`-hover`, `-pressed`) · `accent-warning` · focus: `ring-focus`
**Radius:** `rounded-xs|sm|md|lg|xl|2xl|full`  ·  **Shadow:** `shadow-xs|sm|md|lg|overlay`
**Motion:** `--dur-fast|base|slow` · `--ease-out|in|au|fluid`
**Typography (size):** `text-3xs`(10) · `text-2xs`(11) · `text-xs`(12) · `text-sm`(14) ·
`text-base`(16) · `text-lg`(18) · `text-xl`(20) · `text-2xl`(24) · `text-3xl`(30). Or the
semantic utilities, which already carry line-height/tracking: `display-{sm…xxl}`, `body-{xs…xl}`,
`caption`, `au-eyebrow`. **Never `text-[Npx]`.**
**Raw palette** (only when you need a specific family): `au-{gray,blue,emerald,
red,purple,teal,amber,pink,lime,slate}-{50…1200}` — e.g. `text-au-blue-700`.

Correct example (from `AuStatCard`): `bg-raised border-subtle text-fg-primary text-fg-tertiary`.

---

## Families (which one to use when)

The "duplicates" you spot are almost always one family with distinct roles. Here is the
yardstick — **for the components that actually ship** (Layer A).

### Cards
| Component | When |
|---|---|
| `AuCard` | Generic card (header/title/description/content/footer/action via sub-exports). **Default.** |
| `AuStatCard` | A single metric: number + delta + icon. |

Anything more specific (a payment card, an integration tile, a pricing card) is **Layer B** —
compose it from `AuCard` + `AuButton` + `Icon`, don't fork `AuCard`.

### Tables
`AuTable` is the only table that ships: simple, static, styled. It carries **no** sort,
pagination, or selection. A data grid with those features is a **Layer B** component — build
it once, register it, and add it to the Layer B table so nobody builds a second one.

### Modals, drawers and menus
| Component | When |
|---|---|
| `AuModal` | The **base** of every modal. Wizard → pass `stepKey`. |
| `AuSheet` | Side panel / drawer. |
| `AuDropdownMenu` | Floating menu. |
| `AuMentionMenu` | The Review Bridge `@`/`/` picker. |

**Never hand-roll an overlay** — see [Motion](#motion) below.

### Inputs
`AuField` (label + error message + `framed` variant) composes `AuInput`. Both are exported
from `@/components/ui/AuInput`. For a standalone input, use `AuInput`.

### Icons
`Icon` (Material Symbols Rounded, automatic optical defaults: visual `size` decoupled from
`opticalSize`, with firmer `weight`/`grade` at small sizes). `fill={1}` is the
active/selected state, not a legibility fix. `react-icons` **only** for brand
marks with no equivalent (Visa/Mastercard/Amex/Slack/WhatsApp). Auis ships **no** component
for third-party app logos — if your product needs them, curate the assets in that product and
pass them in as props (see AGENTS.md §4).

---

## Motion

1. **Global paint (free, already on).** Hover/focus on interactive elements get a smooth
   transition from a `@layer base` rule in `globals.css`. **Don't** add `transition-colors` by
   hand for a plain hover.
2. **Overlays (enter/exit) — free, lives in the component.** `AuModal`, `AuSheet`,
   `AuDropdownMenu`, and `AuToast` animate open **and close** on their own, because they are
   `Au*` built on Radix (`data-state` + `--dur-*`/`--ease-*` tokens, with a
   `prefers-reduced-motion` guard). **Never hand-roll an overlay**
   (`fixed inset-0` + `{open && …}` / `if (!open) return null`): it unmounts instantly and kills
   the close transition. That is exactly why hand-made modals "open but don't close smoothly."
   For a sequential modal (wizard), pass `AuModal`'s `stepKey` prop. `ds:check` flags
   hand-rolled overlays.
3. **Custom motion.** Reach for Tailwind `transition-*`/`duration-*` or the raw
   `var(--dur-*)`/`var(--ease-*)` tokens only for a *custom* motion (transform, opacity, a
   different curve). Never blanket-animate `transform`/`opacity` globally.

---

## shadcn primitives — what's actually here

`components/ui/` ships **24** `.tsx` files: the **21** `Au*`, plus `Icon.tsx`, plus exactly
**two** shadcn primitives — `badge.tsx` and `popover.tsx`. There is no `card.tsx`,
`button.tsx`, `table.tsx`, `chart.tsx` or `calendar.tsx` in this repo, and no `tool-ui/`
subsystem. Don't import one; it isn't there.

- **`badge.tsx`** — the base of `AuMentionChip` (its only consumer). In product code use **`AuPill`**.
- **`popover.tsx`** — sanctioned for direct use (the styleguide flow editor uses it).
- **The 21 `Au*` are not shadcn wrappers today.** Nine of them use `@radix-ui/*` directly
  (`AuButton`, `AuCheckbox`, `AuDropdownMenu`, `AuModal`, `AuProgress`, `AuSheet`, `AuTabs`,
  `AuToggle`, `AuToast`); the rest are hand-rolled in Tailwind + tokens. This is known debt,
  not a pattern to copy — see AGENTS.md §1.
- **New components follow the wrapper flow.** Install the primitive on demand
  (`npx shadcn@latest add [name]` → `components/ui/[name].tsx`, lowercase), then wrap it in
  `components/ui/Au[Name].tsx`. Pages import only `Au[Name]`. `ds:check` warns if a raw
  primitive that has an `Au` wrapper leaks into product code.

---

## Genuinely missing something?

If nothing in **Layer A** fits, you are not missing a component — you are about to write your
first **Layer B** one. That is the expected path, not an exception.

Create it via the [`auis-component`](../skills/design-system/auis-component/SKILL.md) skill
(`Au` prefix, in `components/ui/`, with a showcase + an entry in
[`navigation.ts`](../app/auis/styleguide/navigation.ts)). Then **register it in the
[Layer B table](#layer-b--your-products-components-empty-on-purpose) above** — a component
that isn't in this map gets rebuilt by the next agent.

Run `npm run ds:check` when you're done: it flags a map line pointing at a component that
doesn't exist (`map-broken`) and a component missing from the map (`map-missing`).
