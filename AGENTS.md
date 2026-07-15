# AGENTS.md

Conventions for any AI Agent (Claude Code, Codex, Cursor, etc.) working in this repository. **This is the single source of truth — read it before starting.** It holds the complete rules; `CLAUDE.md` is a thin pointer back here (Claude Code auto-loads `CLAUDE.md` and lands on these same rules). **Keep every rule HERE — never add rules to `CLAUDE.md`**, so the two can never diverge.

> For product context (what Auis is, voice, vocabulary) see `PRODUCT_CONTEXT.md`. For styleguide page structure see `docs/`. The conventions, tokens, stack rules and skills below are authoritative.
>
> **Before building anything, open [`docs/component-map.md`](docs/component-map.md)** — the index of "I need X → use Y → import path → when not to". It has **two layers**, and the distinction matters: **Layer A** is the 21 `Au*` in `components/ui/` — the UI the **Auis builder itself** is made of (the Review Bridge, Auis's own mark, and the primitives those stand on). They are importable and reusable, but they are not a catalog for your product. Auis ships **no application shell and no AI copilot** — no dashboard layout, sidebar, header, nav rail, or notifications panel. **Layer B** — your product's own components — **ships empty on purpose**; you populate it with the `auis-component` skill. So the map is the fastest way to find the right `Au*` **and** to see, honestly, when a thing doesn't exist yet and you have to build it.
>
> Continuing the design-system cleanup? Read [`docs/ds-cleanup-plan.md`](docs/ds-cleanup-plan.md) (what's done, what's left, how to resume) and run `npm run ds:check` for the live debt count.

## Context hygiene for agents

- Treat this file as the highest-priority repo instruction. `CLAUDE.md` only
  redirects here.
- External memories (`~/.claude/.../memory/MEMORY.md`, Cursor memories, chat
  summaries) are advisory only. If they conflict with this repo, this file wins.
- Use current repo docs over external memories. Current local development is
  loopback-only, and the active Auis surfaces are listed in `AUIS.md`.
- Do not scan ignored/generated folders for product context: `.next/`,
  `.agents/`, `.claude/worktrees/`, `node_modules/`,
  `review-bridge/data/`, and `flow-bridge/data/`.
- Keep new instructions short and canonical. Prefer updating this file or
  `PRODUCT_CONTEXT.md` over creating new memory/docs files.

## Hard rules

### 1. `Au` prefix on every new design system component

Every design system component **must** start with `Au`. No exceptions within the DS scope.

**Required pattern:**

| Item | Convention |
|---|---|
| File name | `Au[Name].tsx` (PascalCase) |
| Export name | `export function Au[Name](...)` or `export const Au[Name] = ...` |
| Official destination | `/components/ui/Au[Name].tsx` |
| Official showcase | `/app/auis/styleguide/components/au-[name]/page.tsx` |
| Navigation entry | `navigation.ts` with descriptive `name` (e.g. `"Dropdown Menu"`) and `href: "/auis/styleguide/components/au-[name]"` |

> **Showcase href convention:** Legacy components (built before this rule) live at
> `/auis/styleguide/components/[name]/` (e.g. `buttons/`, `cards/`). New components
> go to `/auis/styleguide/components/au-[name]/`. **Never rename existing showcase
> folders** — doing so breaks live routes. The `name` field in `navigation.ts` uses
> descriptive labels, not the raw `Au[Name]` identifier.

> **Styleguide family hubs:** when a component family has more than one concrete
> implementation or variant page (for example `Tables` → `AuTable`, `Data table`,
> `Members table`; `Modals and dialogs` → `AuModal`, `Connect modal`, `Welcome modal`),
> keep one parent entry in the sidebar and list the concrete items as
> `children` in `navigation.ts`. The parent page must show all concrete items
> inline before long API guidance. Put "when to use / when not to use" guidance
> near the end as a table, not as top-of-page cards. Do not create duplicate
> top-level sidebar entries for family members.

**Correct examples:**

```
components/ui/AuButton.tsx
components/ui/AuCard.tsx
components/ui/AuMentionChip.tsx
app/auis/styleguide/components/au-dropdown-menu/page.tsx
```

**Wrong examples (do not do this):**

```
components/Button.tsx                    ← the `components/` root is not the DS zone
components/ui/button.tsx                 ← this is the shadcn primitive, not the DS wrapper
components/ui/MyButton.tsx               ← no prefix
components/ui/au-button.tsx              ← file must be PascalCase
```

**`Au[Name]` wraps a shadcn primitive — going forward.** (Reality today: of the **29**
`Au*` that ship, exactly one wraps a lowercase primitive (`AuMentionChip` → `badge.tsx`);
9 use `@radix-ui/*` directly (`AuButton`, `AuCheckbox`, `AuDropdownMenu`, `AuModal`,
`AuProgress`, `AuSheet`, `AuTabs`, `AuToggle`, `AuToast`); the rest are hand-rolled in
Tailwind + tokens. Treat "wraps a primitive" as the target for NEW components and as on-touch
debt for existing ones — open any `Au*` before assuming it's a thin wrapper.)

The flow for new components:

1. **Look up the shadcn primitive** via MCP (`search_items_in_registries`, `view_items_in_registries`, `get_item_examples_from_registries`).
2. **Install** with `npx shadcn@latest add [name]`. The primitive lands in `components/ui/[name].tsx` (lowercase, CLI-generated).
3. **Create `components/ui/Au[Name].tsx`** next to it, importing the primitive. Apply Auis tokens, add brand variants (intents, sizes, ai-gradient, `Icon` slot, etc.).
4. Pages and features import **only `Au[Name]`**, never the raw primitive directly.
5. Showcase at `app/auis/styleguide/components/au-[name]/page.tsx` + entry in `navigation.ts`.

**Current repo state (known debt):**

shadcn is already initialized (`components.json` exists, `@radix-ui/*` packages are installed), but only **two** primitives are actually vendored today: `components/ui/badge.tsx` and `components/ui/popover.tsx`. There is no `button.tsx`, `card.tsx`, `table.tsx`, `chart.tsx` or `calendar.tsx` in this repo — **don't import one, it isn't there; install it first.** The existing `Au*` components were built before the decision to adopt shadcn — they use Radix directly or are hand-rolled in Tailwind. **This is known debt.** When you touch one of them:

1. Install the corresponding shadcn primitive (`npx shadcn@latest add [name]`) — it lands at `components/ui/[name].tsx` (lowercase).
2. Refactor the `Au[Name].tsx` to import and wrap the primitive.
3. Preserve the existing props API to avoid breaking pages that already use it.

New components from now on follow the correct flow from day one (primitive + wrapper).

### 2. Tokens are sacred

- Token authority: only `auis-design-system-foundation` (bootstrap from a reference) and `auis-foundation-update` (incremental, additive, reviewed) may create or change tokens. Any other skill, prompt, or manual edit **must not** add new tokens to `globals.css` (the `@theme` block or `:root`).
- Forbidden: `bg-[#hex]`, `text-[#hex]`, `p-[Npx]`, `border-[#hex]`, `rounded-[Npx]`, or any Tailwind arbitrary value for color / spacing / radius / shadow / typography.
- Allowed: Tailwind classes that reference existing tokens (`bg-primary`, `text-fg-primary`, `border-border`, `rounded-lg`, `shadow-sm`, etc.) and CSS variables (`var(--bg-canvas)`, `var(--accent-brand)`).
- If a token genuinely does not exist and the work requires it, **report it in the output** instead of creating it — the foundation skill is the only one authorized to extend the token set.

### 3. Components before code — compose, don't recreate

- **Step 0: open [`docs/component-map.md`](docs/component-map.md)** — the "I need X →
  use Y → import" index. It names the canonical component, the near-duplicates to avoid
  (which card, which table), and — just as important — it is explicit about what **does not
  exist**. Read its two layers: **Layer A** (the 21 `Au*` that ship — the builder's own UI)
  and **Layer B** (your product's components — empty until you build them). If your need
  isn't in Layer A, it is a Layer B component and you build it; don't guess an import.
  This is the single biggest lever against agents rebuilding what already exists — and
  against agents importing what was never here.
- Then check, in order:
  1. `/components/ui/Au*` (official — 31 components)
  2. `/components/ui/*.tsx` lowercase (shadcn primitives — only `badge.tsx` and
     `popover.tsx` ship today; check if an `Au` wrapper exists before importing one)
- **Reuse > extend > create.** Extend or wrap an existing component when it's close;
  build from scratch *only* when nothing fits and the semantics are genuinely new.
  Never duplicate an existing component under a new name.
- **Compose from primitives (the recipe rule).** A bigger piece is a *recipe* of `Au*`
  primitives: a card / modal / page uses `AuButton` + `Icon` + `AuInput` — it does
  **not** re-implement a button, icon, or input inline, and never drops a raw `<svg>`
  or hardcoded glyph where `Icon` belongs. Dependency direction is one-way (see
  `docs/component-layers.md`): higher layers consume lower ones, never the reverse.

### 4. Stack & scope gotchas

- **Tailwind v4.** This repo is Tailwind **v4** (`@import "tailwindcss"` + `@theme` in `app/globals.css`; there is **no `tailwind.config.ts`**). Tokens live in the `@theme` block + `:root` CSS vars in `globals.css`. Enter/exit animations come from `tw-animate-css` (not `tailwindcss-animate`); container queries are core (no plugin). Dark mode is `@custom-variant dark` + the `.dark` class. PostCSS uses `@tailwindcss/postcss` (no autoprefixer — Lightning CSS handles prefixing). The `.claude/` dir is excluded from content-scan via `@source not`.
- **Icons.** Material Symbols Rounded via `components/ui/Icon.tsx` is the product/DS default. `Icon` uses optical defaults: visual `size` stays on the 12/16/20/24/28/32 scale, `opsz` clamps to 20..48, and small glyphs get firmer automatic `weight`/`grade` so they stay legible. Pass explicit `weight`, `grade`, `opticalSize` or `fill` only for a deliberate semantic/visual reason; `fill={1}` means active/selected, not "make it visible". Material Symbols is the **only** icon source in this repo — there is no icon-pack dependency for brand marks (`react-icons` is **not** installed; don't add it). Brand marks Material Symbols lacks (Visa/Mastercard/Slack/WhatsApp…) are third-party assets: per the "no brand assets ship with Auis" rule below, they belong to the product's own asset dir and get passed in as props, not pulled from an icon pack in `components/ui/`. `lucide-react` only leaks in via CLI-generated shadcn primitives — don't reach for it in product code. **Never hand-roll a raw `<svg>` or hardcode a glyph for an icon — go through `Icon`** (raw `<svg>` is reserved for Auis's own mark — `AuLogo` — and for a genuinely custom animated visual, should you build one; `ds:check` allowlists `*Logo.tsx` and `Icon.tsx` only).
- **No brand assets ship with Auis.** The only mark that *ships* in `public/` is `auis-wordmark.svg` (Auis's own, rendered by `AuLogo` in the builder chrome under `/auis/*`). The user's own logo lands in `public/assets/brand/` at runtime when they seed their brand through `/auis/welcome` (→ `/api/setup`, materialized by `auis-brand`) — that is the *product's* mark, not the builder's. There is **no** third-party logo registry and **no** brand-illustration set — those belong to the product you build with Auis, not to the builder. A design-system component in `components/ui/` must never hardcode a logo, and nothing in the repo may reference an asset that isn't in `public/`. If the product you're building needs third-party marks, curate them in that product's own asset dir and pass them in as props.
- **Motion is on by default — don't hand-roll it per element.** Interactive elements (`a, button, input, select, textarea, summary, label, [role=button|tab|menuitem|option|switch|checkbox|radio]`) get a smooth paint transition for free via a `@layer base` rule in `globals.css` (color/background/border/shadow/outline/decoration/fill/stroke at `--dur-fast`/`--ease-out`, with a `prefers-reduced-motion` guard). So a plain hover never needs `transition-colors` added by hand. Because it's in `@layer base`, component classes (`.au-btn`, `.au-card`…) and Tailwind `transition-*`/`duration-*` utilities both still override it — reach for those (or `var(--dur-*)`/`var(--ease-*)`) only for a *custom* motion (transform, opacity, a different curve/duration). Never blanket-animate `transform`/`opacity` globally — they're reserved for enter animations.
- **Overlays / suspended UI = always the `Au*` primitive, never hand-rolled.** Modal/dialog → `AuModal`; drawer / side panel → `AuSheet`; dropdown → `AuDropdownMenu`; mention → `AuMentionMenu`; toast → `AuToast`; popover → the sanctioned `popover` primitive. These carry **both enter AND exit** motion for free via Radix `data-state` + the motion tokens (`--dur-*`/`--ease-*`), with a `prefers-reduced-motion` guard. **Never hand-roll an overlay** (`fixed inset-0` + `{open && …}` or `if (!open) return null`): a raw conditional mount **unmounts instantly**, which kills the close transition — that's exactly why hand-made modals "open but don't close smoothly". For a **sequential modal** (wizard), pass `AuModal`'s `stepKey` prop (the body re-animates per step) instead of swapping content silently. `ds:check` flags hand-rolled overlays. There is **no** accordion/disclosure or tooltip primitive in this repo — if you need one, build it (Layer B) rather than hand-rolling an overlay inline.
- **No emoji.** Do not add emoji to product UI, styleguide documentation, generated diagrams, or agent-facing docs unless the user explicitly asks for one or a source asset already contains it.
- **Feature modules are out of DS scope.** App-feature folders under `components/` (today: `components/auis-review/`, `components/auis-edit/`, `components/auis/`) are NOT DS components — they *consume* `Au*` but are not themselves prefixed/wrapped/showcased. Don't rename them to `Au*` or migrate them.
- **Desktop-only.** The product has no mobile. Don't add mobile/tablet breakpoints or flag "missing responsiveness" — small screens are out of scope by design.
- **Screen verification → Playwright MCP.** When you genuinely need to verify a rendered screen (visual check, "does this look right", regression after a UI change), drive the running app with the **Playwright MCP** (`playwright` server in `.mcp.json`): snapshot before acting, re-snapshot after the page changes, and screenshot to confirm the result. Only when a check is actually needed — not by default.

## Available skills

**Source of truth: `skills/<capability>/<name>/SKILL.md`** — that is the only
copy you ever edit. A `SKILL.codex.md` sits next to it where the Codex variant
genuinely diverges.

The discovery trees `.claude/skills/` (Claude Code) and `.agents/skills/`
(Codex/Cursor) are **generated** from that source by `npm run skills:sync`
(which also runs on `predev` and `postinstall`) and are gitignored. Editing
them does nothing: the next sync overwrites your change.

Invoke a skill via `/<name>`; some trigger by context. `skills/_legacy/auis-generate.md`
is a compatibility stub, not an active workflow.

**First-run / onboarding**

A freshly cloned Auis ships **deliberately empty** — neutral tokens, no brand, no
voice. The first-run flow turns it into *the user's* product. The hub (`/auis`)
shows a soft-gate "Welcome — set up your brand" card until setup is done; the
form lives at `/auis/welcome` and posts to the `/api/setup` route (Node runtime,
same filesystem idiom as `/api/page-edits` and `/api/review-bridge/comments`),
which writes the uploaded logo to `public/assets/brand/` and the brand overlay to
the gitignored `app/auis/_data/brand.runtime.json` (default lives in
`app/auis/_data/brand.ts`).

| Skill | When to use |
|---|---|
| `auis-setup` | The guided first-run **orchestrator** the welcome screen points at. It creates nothing itself — it **sequences** the three creators (`auis-brand` → `auis-foundation` → `auis-voice`), checking in between each, then flips setup to done. Use for "/auis-setup", "first-run setup", "I just filled the welcome form", "I cloned Auis, now what". |
| `auis-brand` | Establishes the product's **brand** — the app name, the one-line positioning, and the logo/mark — from the welcome intake, and wires `components/ui/AuLogo.tsx` / the brand config at the user's mark. The only skill that establishes brand (`auis-foundation` = tokens, `auis-voice` = voice; it touches neither). |

**Design System**
| Skill | When to use |
|---|---|
| `auis-design-system-foundation` | Bootstrap the DS from a visual reference / design source (may rewrite `globals.css`). One of two skills allowed to touch tokens. |
| `auis-foundation-update` | **Incremental, additive token updates** to the existing foundation (add/extend a scale, fill ramp gaps). No rebootstrap, no clobber; keeps `@theme`+`:root`+dark in sync. The other token-authorized skill. |
| `auis-new-component` | Add a new component to the DS using existing tokens (shadcn wrapper + showcase + nav). Always `Au*` in `components/ui/`. |
| `auis-new-page` | Build a full page from a screenshot/Figma/brief, reusing DS components. |
| `auis-design-system-audit` | Audit consistency (tokens/components/showcases/nav); optionally sync against a reference. |
| `shadcn` | Consult shadcn docs/registry/CLI for primitives. It is a support skill only: all repo rules above still win (`Au*` wrapper, existing tokens, Material Symbols by default). |

**UX Flows** (`/auis/styleguide/ux-flows`)
| Skill | When to use |
|---|---|
| `auis-create-ux-flow` | Create a NEW single-journey flow from a description / step list. |
| `auis-create-ux-flow-golden-eye` | Create a COMPILED, multi-scenario "golden eye" view — several journeys merged into one deduped graph with per-scenario focus lenses (raw ReactFlow, à la `poc-visao-global`). Use when the value is overlaying scenarios + toggling between them, not one linear path. |
| `auis-update-ux-flow` | Register a structural update to an existing flow (+ changelog entry). |
| `auis-pg-create-flow` | Create a NEW flow from a `.awflow.json` (designer/PG export). |
| `auis-pg-merge-flow` | Merge a `.awflow.json` into a flow that already exists. |

**Content / UX Writing**
| Skill | When to use |
|---|---|
| `auis-ux-writing` | In-product UX-writing pass on a route / several routes / pasted links: reads the page's real strings, audits them against the Auis **product** voice (it solves, it doesn't sell — inspired by ElevenLabs + OpenAI), proposes rewrites with rationale, applies **text-only** edits after approval. NOT marketing voice (that's the global `auis-brand-voice`), NOT layout/structure (that's `ux-page-rework`). |

**Local bridges**
| Skill | When to use |
|---|---|
| `auis-review-bridge-solve` | Batch-resolve comments from the local Review Bridge queue. `npm run dev` already starts/prepares the bridge; do not use a skill just to turn it on. |
| `auis-review-bridge-dispatch` | **The `/loop` motor** — turns `@agent /skill #now` mentions into live action. One pass reads `/api/review-bridge/dispatch-queue` (gated by the per-agent toggles in the Auis dot + the `#now` double-lock) and routes each item: Live Response → reply; Auto Construct + `#now` → run the skill, mark `in_review`, reply a summary. Run under `/loop`. The runtime side of the agent-mentions feature. |
| `auis-review-bridge-germano-audit` | **Germano Faccio** — critical second-opinion auditor on the `in_review` queue (what `solve` sent for review). Compares the request vs. the delivery and posts ONE reply per item ("good to go" / "not yet — ask for an improvement" + correction prompt). Comment-only: never transitions status, never edits code. Greg still approves/rejects in the inbox. |
| `auis-flow-bridge-solve` | Apply UX-flow suggestions (read from `flow-bridge/data/suggestions.json` via the same-origin `/api/flow-suggestions` route). |
| `auis-flow-bridge` | **Obsolete** — the flow editor is serverless now (no server to start); the skill just explains the cutover. |

The DS skills are **generic and Au-prefix-blind** — they emit `components/CustomWidget.tsx`-style output (root zone, no prefix, showcase at `components/[name]/`). So you MUST apply this file's convention on top of their output: rename → `Au[Name]`, move to `components/ui/`, showcase at `au-[name]/`, import only `Au*`.

**Routing — always use the local `auis-*` skill, NEVER the generic global homonym.** The session also exposes generic globals whose scope overlaps but which produce non-`Au` output in the wrong place:

| Intent | Use this | Avoid |
|---|---|---|
| Add a component | `auis-new-component` | `design-system-new-component` |
| Build a page | `auis-new-page` | `design-system-new-page` | 
| Bootstrap DS / tokens | `auis-design-system-foundation` | `setup-design-system-from-*` |
| Audit consistency | `auis-design-system-audit` | — |
| Revise in-product copy / microcopy | `auis-ux-writing` | `ux-copy` (generic, EN), `auis-brand-voice` (marketing voice) |

**Setup-only / neutralized skills (kept as a record, do NOT trigger).** Four generic
Au-blind skills survive on disk from the Auis initial setup, but their
`description` is neutralized so they no longer trigger: `setup-design-system-from-cla-design`
and `setup-design-system-from-reference` (one-time DS bootstrap — this repo is already
set up, don't re-bootstrap) and `design-system-new-component` / `design-system-new-page`
(superseded by the `auis-*` equivalents above). Always use the `auis-*`
skills for day-to-day work; these four are history, not active workflows.

## How the agent should combine skill + convention

When any skill suggests creating `MyComponent.tsx` in `components/`:

1. **Rename** to `AuMyComponent.tsx`
2. **Move** to `components/ui/`
3. **Update imports** across the codebase
4. **Create showcase** at `app/auis/styleguide/components/au-my-component/page.tsx`
5. **Register** in `navigation.ts`

The skill produces the skeleton; this AGENTS.md adjusts naming and destination.

## Common questions

**"Can I create a component without the Au prefix?"**
No. Every design system component is `Au*` in `components/ui/`. There is no
unprefixed staging area for design system components.

**"The component wraps a shadcn primitive — what's the file name?"**
The shadcn primitive lives at `components/ui/button.tsx` (generated by `npx shadcn add`). Your wrapper lives at `components/ui/AuButton.tsx` and imports the primitive. Pages import `AuButton`.

**"I found an unprefixed component at the `components/` root. Do I update it or create `Au[Name]`?"**
Create `components/ui/Au[Name].tsx` as a wrapper around the shadcn primitive. Replicate the existing behavior + current tokens + icons via `Icon`. Migrate usages page by page. The unprefixed file dies when nothing imports it anymore. (`AuButton` already exists — don't recreate it.)

**"A skill runs `npx shadcn@latest add button` — should I run it?"**
**Yes.** That's this repo's official path. The primitive goes to `components/ui/button.tsx` (lowercase). Then create/update `components/ui/AuButton.tsx` which imports that primitive and adds the brand layer (variants, sizes, intents, icon). Pages import only `AuButton`.

**"There's already an `AuButton.tsx` in the repo, but no shadcn primitive behind it. What do I do?"**
That's the current debt. When you need to touch that component, install the shadcn primitive (`npx shadcn add button`) and refactor `AuButton.tsx` to wrap it, preserving the same props contract so existing pages don't break.

## Imported Claude Cowork project instructions

How this repo expects agents and their tooling to be wired.

- Cursor project rules are represented by this `AGENTS.md` + thin `CLAUDE.md` pointer. Do not create a separate `.cursor/rules` source of truth.
- **`PRODUCT_CONTEXT.md` describes *your* product, not Auis.** It is a template: fill it in with your product's language and locale, its voice, its protected vocabulary, and its canonical copy corpus. The writing skills (`auis-ux-writing`, `auis-brand-voice`) read it and will produce generic copy until you do.
- MCP servers (all in `.mcp.json`): `figma` remote MCP (`https://mcp.figma.com/mcp`), `shadcn` (`npx shadcn@latest mcp`), `playwright` (`@playwright/mcp`, on-demand screen verification — see Stack & scope gotchas), and `mobbin` remote MCP (`https://mcp.mobbin.com/mcp`, UI-pattern reference). OAuth tokens stay in the user's local app storage and must never be copied into this repo.
- The `shadcn` skill lives at `skills/support/shadcn/` so Claude Code and Codex/Cursor share the same component-registry guidance. The repo-specific `Au*` and token rules in this file override generic shadcn guidance whenever they conflict.
- Cursor/Claude raw histories, workspaceStorage DBs, OAuth attempts, and extension state are not project instructions. Mine them for context when explicitly requested, but never commit them.
