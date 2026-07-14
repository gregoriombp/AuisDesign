# Component map — where to find the reference in the DS

> **Read this BEFORE creating any component or screen.** This is the
> "I need X → use Y" index of the Auis design system. It tells you **what to import**,
> from **where**, and **when NOT** to use each piece. It is the sibling of
> [`component-layers.md`](./component-layers.md) (taxonomy/layers) and of
> [`navigation.ts`](../app/auis/styleguide/navigation.ts) (live inventory
> + styleguide routes). Here the focus is the **import** and the **when to use**.
>
> Source of truth for the rules: [`AGENTS.md`](../AGENTS.md). If they conflict, AGENTS wins.

## Golden rule (the atomic recipe)

1. **Reuse > extend > create.** Look here and in `components/ui/Au*` before writing
   anything. Only create from scratch if nothing fits and the semantics are
   genuinely new — never duplicate under a new name.
2. **Compose from primitives.** A bigger piece (card, modal, screen) is a *recipe*
   of `Au*` primitives. An `AuGroupCard` uses `AuButton` + `Icon` + `AuAvatar` — it does not
   reimplement button, icon, or avatar by hand.
3. **Tokens only.** No `#hex`, `w-[37px]`, `rounded-[10px]`. Use the
   [token vocabulary](#token-vocabulary-paste-this-instead-of-hardcoding)
   below. Missing token → report it, don't create it (only the `foundation` skill creates tokens).
4. **Icon = `Icon`.** Material Symbols via `Icon`. Never a raw `<svg>`, never another
   icon lib. `react-icons` only for **brands** that Material Symbols lacks
   (Visa, Mastercard, Amex, Slack, WhatsApp). An **app/integration logo** (Google,
   Chrome, Pipedrive…) is not an `Icon` — it is `AuBrandLogo`, curated from Iconify `logos`
   (see AGENTS.md §4).

---

## Shortcut by intent (the fast path)

| I need… | Use | Import | Watch out |
|---|---|---|---|
| Icon | `Icon` | `@/components/ui/Icon` | `<Icon name="..." size={20} />`. Automatic optical default (`wght`/`GRAD`/`opsz`) — don't force `weight={200}` on a small icon. Never a raw `<svg>`. |
| App / integration logo | `AuBrandLogo` | `@/components/ui/AuBrandLogo` | 3rd-party mark (Google, Chrome, Pipedrive…). Curate it from Iconify `logos` → `markSrc`. **Not** an `Icon`. See AGENTS.md §4. |
| Button | `AuButton` | `@/components/ui/AuButton` | has `intent`/`size`/an `Icon` slot. Don't style a `<button>` by hand. |
| Form field | `AuField` (or `AuInput`) | `@/components/ui/AuInput` | `AuField` (label + error + `framed` variant) and `AuInput` come from the same file. |
| Select | `AuSelect` | `@/components/ui/AuSelect` | |
| Checkbox / toggle / slider | `AuCheckbox` · `AuToggle` · `AuSlider` | `@/components/ui/Au{Checkbox,Toggle,Slider}` | **don't** use the `fluid/*` equivalents directly (see [Motion](#motion-two-layers)). |
| Tag / chip / badge | `AuPill` | `@/components/ui/AuPill` | there is a `badge.tsx` (shadcn) and a `fluid/badge` — prefer `AuPill`. |
| Generic card | `AuCard` | `@/components/ui/AuCard` | **don't** use `components/ui/card.tsx` (raw shadcn primitive). See [families](#cards). |
| Metric card | `AuStatCard` | `@/components/ui/AuStatCard` | number + delta + icon. |
| Simple table | `AuTable` | `@/components/ui/AuTable` | data w/ sort/pagination/selection → `DataTable`. See [families](#tables). |
| Modal / dialog | `AuModal` | `@/components/ui/AuModal` | the base. Ready-made variants: Connect/Welcome/Contact channel/Add integration. |
| Side panel / drawer | `AuSheet` | `@/components/ui/AuSheet` | |
| Dropdown menu | `AuDropdownMenu` | `@/components/ui/AuDropdownMenu` | |
| Tabs | `AuTabs` | `@/components/ui/AuTabs` | |
| Accordion / disclosure | `AuAccordion` | `@/components/ui/AuAccordion` | several sections in one bordered group; already animates expand/collapse + chevron. |
| Light disclosure / "show more" | `AuCollapsible` | `@/components/ui/AuCollapsible` | one expandable row/section (trigger + meta), lighter than the accordion; already animates. **Never** hand-roll it. |
| Calendar / date picker | `Calendar` | `@/components/ui/calendar` | shadcn primitive sanctioned for direct use. For a date-range picker, compose with `Popover` + `AuButton`; don't create a ceremonial `AuCalendar`. |
| Avatar | `AuAvatar` | `@/components/ui/AuAvatar` | group: `AuAvatarGroup` (same file). |
| Empty state | `AuEmpty` | `@/components/ui/AuEmpty` | slots: `AuEmptyTitle`/`Media`/`Description`/`Content`. |
| Inline alert | `AuAlert` | `@/components/ui/AuAlert` | |
| Toast | `AuToast` | `@/components/ui/AuToast` | `AuToastProvider` at the top of the tree. |
| Skeleton / loading | `AuSkeleton` | `@/components/ui/AuSkeleton` | |
| Progress | `AuProgress` | `@/components/ui/AuProgress` | |
| Status dot | `AuStatusDot` | `@/components/ui/AuStatusDot` | |
| Breadcrumb | `AuBreadcrumb` / `AuBreadcrumbsBar` | `@/components/ui/Au{Breadcrumb,BreadcrumbsBar}` | atom vs. full bar. |
| Page header | `AuPageHeader` | `@/components/ui/AuPageHeader` | |
| Side navigation | `AuNavRail` / `AuNavList` | `@/components/ui/Au{NavRail,NavList}` | rail = rail with groups; list = plain list. |
| Chart | `AuChart` | `@/components/ui/AuChart` | recharts wrapper. Don't import recharts directly in the page. |
| Chat composer | `AuInputMessage` | `@/components/ui/AuInputMessage` | already the entry point into Fluid. |
| Reasoning steps | `AuThinkingSteps` | `@/components/ui/AuThinkingSteps` | same. |
| Dashboard layout | `AuDashboardLayout` | `@/components/ui/AuDashboardLayout` | already injects sidebar/header. |

> Didn't find it here? Check the [full inventory by layer](#full-inventory-by-layer)
> before concluding it's missing — it probably already exists.

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
**Typography (size):** `text-3xs`(10) · `text-2xs`(11) · `text-xs`(12) · `text-sm`(14) ·
`text-base`(16) · `text-lg`(18) · `text-xl`(20) · `text-2xl`(24) · `text-3xl`(30). Or the
semantic utilities, which already carry line-height/tracking: `display-{sm…xxl}`, `body-{xs…xl}`,
`caption`, `au-eyebrow`. **Never `text-[Npx]`.**
**Raw palette** (only when you need a specific family): `au-{gray,blue,emerald,
red,purple,teal,amber,pink,lime,slate}-{50…1200}` — e.g. `text-au-blue-700`.

Correct example (from `AuStatCard`): `bg-raised border-subtle text-fg-primary text-fg-tertiary`.

---

## Families (which one to use when)

The "duplicates" you spot are almost always one family with distinct roles.
Here is the yardstick.

### Cards
| Component | When |
|---|---|
| `AuCard` | generic card (header/title/description/content/footer/action via sub-exports). **Default.** |
| `AuStatCard` | a single metric: number + delta + icon. |
| `AuGroupCard` | list/grid item with avatar + actions. |
| `AuIntegrationCard` | integration catalog/state (domain). |
| `AuPaymentMethodCard` | saved payment card (billing). |
| `AuCardBrand` | just the card brand (Visa/Amex…). |
| `card.tsx` (lowercase) | **raw shadcn primitive — don't use it directly.** It exists only as a base; consume `AuCard`. |

### Tables
| Component | When |
|---|---|
| `AuTable` | simple, static, styled table. **Default.** |
| `DataTable` (`@/components/tool-ui/data-table`) | data with sort, pagination, selection, configurable columns. |
| `AuMembersTable` | members/permissions table (person/selection/text cells ready to go). |
| `table.tsx` (lowercase) | **raw shadcn primitive.** The default is `AuTable`/`DataTable`; the raw one is only acceptable in a rich domain table they don't cover (e.g. `KnowledgeBaseTable`), never for a simple table. |

### Modals and dialogs
| Component | When |
|---|---|
| `AuModal` | the **base** of every modal. |
| `AuConnectModal` · `AuWelcomeModal` · `AuContactChannelModal` · `AuAddIntegrationModal` | ready-made flows — reuse them before assembling a new one on top of `AuModal`. |

### Inputs
`AuField` (label + error message + `framed` variant) composes `AuInput`. For a
standalone input, use `AuInput`. Select = `AuSelect`.

### Icons
`Icon` (Material Symbols Rounded, automatic optical defaults: visual `size` decoupled from
`opticalSize`, with firmer `weight`/`grade` at small sizes). `fill={1}` is the
active/selected state, not a legibility fix. `react-icons` **only** for brand
marks with no equivalent (Visa/Mastercard/Amex/Slack/WhatsApp). `lucide-react` only
shows up inside generated shadcn primitives — don't pull it into product code.

### shadcn primitives: direct use vs. Au wrapper

The lowercase files in `components/ui/*.tsx` are shadcn primitives (CLI-generated),
wired to your tokens by a *compat layer* in `globals.css` — so they already
render with Auis colors. **They are not duplicates to delete.** The rule:

- **Has an Au wrapper → use the wrapper, never the raw primitive:** `card`→`AuCard`,
  `button`→`AuButton`, `badge`→`AuPill`, `dropdown-menu`→`AuDropdownMenu`.
  `ds:check` warns if one of these leaks into product code.
- **Sanctioned for direct use** (no Au wrapper, low customization): `tooltip`,
  `popover`, `collapsible`, `separator`, `calendar`, `accordion`. Importing them
  directly is OK — we don't create a ceremonial wrapper just to rename something.
- **Special cases:** `chart` has the `AuChart` helper layer (palette +
  `awChartConfig()`) — use the helpers, don't recreate the palette. Table: simple →
  `AuTable`; rich (sort/pagination) → `DataTable`; the raw `table` is left to the adapters.
- **`tool-ui/` is a vendored subsystem** (data-table, stats-display) that consumes the
  primitives via `_adapter.tsx`. Don't migrate its internals to `Au*`.

---

## Motion: two layers

1. **Global paint (free, already on).** Hover/focus on interactive elements
   get a smooth transition from a `@layer base` rule in `globals.css`. **Don't**
   add `transition-colors` by hand for a plain hover.
2. **Fluid (spring physics).** The **Fluid kit** (`components/ui/fluid/`) brings rich
   motion with framer-motion, mapped to the Auis tokens. It is in **preview ("leva 1")**.
3. **Overlays (enter/exit) — free, lives in the component.** Modals, sheets,
   dropdowns, toasts, and accordions animate open **and close** on their own
   because they are `Au*` on top of Radix (`data-state` + `--dur-*`/`--ease-*` tokens, with a
   `prefers-reduced-motion` guard). **Never hand-roll an overlay**
   (`fixed inset-0` + `{open && …}` / `if (!open) return null`): it unmounts instantly
   and kills the close transition. Use `AuModal` (sequential wizard: `stepKey`
   prop), `AuSheet`, `AuDropdownMenu`, `AuToast`, `AuAccordion`. `BaseModal`
   is **deprecated** → `AuModal`. `ds:check` flags hand-rolled overlays.

**Fluid rule:** the `fluid/*` primitives (`switch`, `slider`, `checkbox-group`,
`dialog`, `dropdown`, `accordion`, `badge`, `tooltip`) **duplicate** the `Au*` ones and are
preview — **don't import them directly**; use the `Au*` equivalent. Fluid's sanctioned
entry point is the 3 already-promoted components:
**`AuInputMessage`**, **`AuThinkingSteps`**, **`AuAskUserQuestions`** (chat/agent
surfaces). Folding the motors into the `Au*` (leva 2) is future work.

---

## Full inventory by layer

Terse on purpose (name · import `@/components/ui/<Name>` · role). Mirrors the
taxonomy in [`component-layers.md`](./component-layers.md).

### Primitives
`AuButton` button · `AuInput`/`AuField` input/field · `AuSelect` select ·
`AuCheckbox` checkbox · `AuToggle` switch · `AuSlider` slider · `AuPill` tag/chip ·
`AuAvatar` avatar (+group) · `AuStatusDot` status · `AuProgress` progress ·
`AuSkeleton` loading · `AuAlert` alert · `AuBreadcrumb` breadcrumb (atom) ·
`AuTabs` tabs · `AuDropdownMenu` dropdown · `AuAccordion` accordion ·
`AuCollapsible` light disclosure · `AuEmpty` empty state ·
`AuFileIcon` file icon · `AuChannelIcon` channel icon ·
`AuDropzone` upload · `AuTransition` transition · `AuToast` toast · `Icon` base icon ·
`AuBrowserIcon` browser icon · `AuPlanIcon` plan icon · `AuRadialProgress`
radial progress · `AuTrendDelta` trend delta · `AuAuditTypeBadge` event badge.

### Components
`AuCard` card · `AuStatCard` metric · `AuGroupCard` item with actions ·
`AuPaymentMethodCard`/`AuCardBrand` payment · `AuTable`/`AuMembersTable` table ·
`AuModal` (+`AuConnectModal`/`AuWelcomeModal`/`AuContactChannelModal`/`AuAddIntegrationModal`)
modals · `AuSheet` drawer · `AuNavList`/`AuNavRail` navigation · `AuOptionList` options ·
`AuListGroup` collapsible group · `AuPageHeader` header · `AuNotificationsPanel`
notifications · `AuChatBubble` chat bubble · `AuInputMessage` composer ·
`AuThinkingSteps` reasoning · `AuAskUserQuestions` interview · `AuChart` chart ·
`AuShortcutTile` shortcut · `AuNavTree` navigation tree ·
`AuBeams`/`AuDotTunnel` decorative backgrounds.

### Patterns
`AuOnboardingShell` onboarding shell · `AuOnboardingTimeline` timeline ·
`AuPasswordSetup` password setup · `AuBackupCodes` backup codes ·
`AuQrPlaceholder` QR.

### Domain (tied to Auis)
`AuIntegrationCard` integration · `AuSpecialistsPair`/`AuAgentCore`/`AuUserAgentOrb`/
`AuCortexSynthesis` agent visuals · `AuCapabilityTile` capability ·
`AuBrandLogo`/`AuLogo`/`AuBrandIllustration` brand · `AuAdditionalPlanBanner` plan ·
`AuCheckpointChip` checkpoint · `AuMentionMenu` mentions · `AuAgentAvatar` agent avatar ·
`AuToolCallCard` tool/integration call · `AuAgentRunTrace` agent run timeline ·
`AuSourceChip` Memory Base citation/grounding · `AuAgentStatusBadge` agent lifecycle.

### Domain — Billing
`AuConsumptionBar` consumption bar · `AuCostBreakdown` cost breakdown ·
`AuInvoiceForecastCard` next-invoice forecast · `AuInvoiceRow` invoice row ·
`AuPlanSummaryCard` plan summary · `AuPaymentMethodRow` payment method (list
item) · `AuPaymentMethodChip` payment method (inline/link).

### Infra / layout (consumed by others, don't use directly in a page)
`AuThemeProvider` · `AuDashboardLayout` · `AuSidebar` · `AuHeader` · `AuNavRail`
(chrome) · `AuNeuralPattern` · `AuMemoryBaseLogo` · `AuCopilotDrawer`.

---

## Genuinely missing something?

If nothing above fits **and** the semantics are new, then create it — via the
[`auis-new-component`](../.claude/skills/auis-new-component/SKILL.md) skill
(`Au` prefix, in `components/ui/`, with a showcase + an entry in `navigation.ts`).
Register the new piece **here** too. Run `npm run ds:check` when you're done.
