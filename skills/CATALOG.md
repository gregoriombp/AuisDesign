# Auis Skills — Catalog

> Generated from `skills/registry.json` (`npm run skills:catalog`). **34 skills.** Single source of truth in `skills/<capability>/<name>/`. The auto-discovery trees `.claude/skills/` (Claude Code) and `.agents/skills/` (Codex/Cursor) are **generated** by `npm run skills:sync`.

**Legend:** 🟣 Claude · 🟠 Codex/Cursor · 🌐 Cowork (generic / zeroed) · ⭐ recommended set · ◐ has a `SKILL.codex.md` variant · _legacy_ neutralized.

## Design System (11)

| Skill | Platform | Origin | Tags | What it does |
|---|---|---|---|---|
| `auis-audit` | 🟣🟠🌐 | cowork | ⭐ | Scans a folder, file, or whole repository and reports every component that's used or implemented but missing from /auis/styleguide. Catches app compon |
| `auis-brand` | 🟣🟠 | repo | ⭐ | Establishes a product's brand identity: app name, logo or mark, and one-line positioning. Reads the /auis/welcome intake or interviews for missing fac |
| `auis-component` | 🟣🟠🌐 | cowork | ⭐ | Adds a new component to a Auis design system project (Next.js + shadcn/ui) and registers it under /auis/styleguide with a showcase route. Always check |
| `auis-design-system-audit` | 🟣🟠 | repo | — | Audit the Auis design system for internal consistency across tokens, components, showcases, navigation, and page usage. |
| `auis-design-system-foundation` | 🟣🟠 | repo | — | Bootstrap or update the Auis design system foundation from a visual reference. This is the only skill allowed to create or change tokens. |
| `auis-foundation` | 🟣🟠🌐 | cowork | ⭐ | Sets up a complete Auis design system in a Next.js + shadcn/ui project starting from any visual reference — a screenshot, Figma URL, Dribbble shot, Be |
| `auis-foundation-update` | 🟣🟠 | repo | — | INCREMENTALLY updates the foundation tokens of the Auis design system in app/globals.css (color, typography, spacing, radius, shadow, motion) — additi |
| `auis-new-component` | 🟣🟠 | repo | — | Add or update an Auis design system component using existing tokens, shadcn primitives where appropriate, a showcase page, and navigation. |
| `auis-new-page` | 🟣🟠 | repo | — | Build or rework a product page in this Next.js app using the Auis design system, existing components, existing tokens, and desktop-only constraints. |
| `auis-page` | 🟣🟠🌐 | cowork | ⭐ | Builds a full page in a Auis design system project (Next.js + shadcn/ui) from a screenshot, Figma URL, wireframe, or written description. Maps every v |
| `auis-update-states` | 🟣🟠 | repo | — | Maps product screens into Auis State Mode: registers new screens, axes, states and `?ge=` interactions in `lib/auis-states/registry.ts` and keeps the  |

## UX Flows (7)

| Skill | Platform | Origin | Tags | What it does |
|---|---|---|---|---|
| `auis-create-ux-flow` | 🟣🟠 | repo | — | Creates a new single-journey UX flow page in the Auis UX Flow hub (app/auis/ux-flow/<slug>/page.tsx, served at /auis/ux-flow/<slug>) from a written br |
| `auis-create-ux-flow-golden-eye` | 🟣🟠 | repo | — | Creates a compiled, multi-scenario "golden eye" UX flow page in the Auis UX Flow hub (app/auis/ux-flow/<slug>/page.tsx, served at /auis/ux-flow/<slug> |
| `auis-flow` | 🟣🟠🌐 | cowork | ⭐ | Designs a feature's user flow as a FigJam board using the Auis convention: every screen becomes a card with name + route + file path + status; every t |
| `auis-import-figma-flow` | 🟣🟠 | repo | ◐ | Imports a Figma flow as a screen-by-screen navigable PROJECT under `/auis/projects` — enumerates the frames via the Figma MCP, renders each screen as  |
| `auis-pg-create-flow` | 🟣🟠 | repo | ◐ | Creates a NEW UX flow in the Auis UX Flow hub (`/auis/ux-flow/[slug]`) from an `.awflow.json` file exported from the PG (designer) repo. Reads the fil |
| `auis-pg-merge-flow` | 🟣🟠 | repo | — | Merges a `.awflow.json` (exported from the PG repo) with a flow that already exists in the Auis UX Flow hub (`/auis/ux-flow/[slug]`, `app/auis/ux-flow |
| `auis-update-ux-flow` | 🟣🟠 | repo | ◐ | Registers a structural update to an existing UX flow page in the Auis UX Flow hub (app/auis/ux-flow/<slug>/page.tsx, served at /auis/ux-flow/<slug>).  |

## Bridges (review / flow / edit / project) (3)

| Skill | Platform | Origin | Tags | What it does |
|---|---|---|---|---|
| `auis-edit-bridge-solve` | 🟣 | repo | — | Materializes Auis Live Edit Mode overlays into real TSX. Reads filtered page-editor ops (text, style tokens, typography classes, variant, icon, hide,  |
| `auis-flow-bridge-solve` | 🟣🟠 | repo | — | Materializes UX flow edit suggestions filed from the flow editor ("Suggest edit" on /auis/ux-flow/<slug>) into the canonical page code. Pulls them fro |
| `auis-review-bridge-solve` | 🟣🟠 | repo | ⭐ | Resolves Auis Review Mode comments in bulk. Reads from the review-bridge using a filter chosen by the user (all of them, only today's, only open ones, |

## Build & Handoff (3)

| Skill | Platform | Origin | Tags | What it does |
|---|---|---|---|---|
| `auis-handoff` | 🟣🟠🌐 | cowork | ⭐ | Converts a Claude Design (or Cloud Design) handoff into production code by remapping the generated output onto Auis/styleguide components first and sh |
| `auis-project-build-solve` | 🟣🟠 | repo | ◐ | Resolves filtered restyle and build requests from the /auis/projects workbench. Plans once and waits for approval; build creates a real page from Au c |
| `auis-setup` | 🟣🟠 | repo | ⭐ | The guided first-run orchestrator the welcome screen points at. It does NOT create tokens, voice, or brand itself — it SEQUENCES the three creator ski |

## Content / UX Writing (2)

| Skill | Platform | Origin | Tags | What it does |
|---|---|---|---|---|
| `auis-ux-writing` | 🟣🟠 | repo | ⭐ ◐ | Runs a fine-tooth-comb IN-PRODUCT UX writing pass over a route, several routes, or pasted links — reads the real strings from the page's files, audits |
| `auis-voice` | 🟣🟠 | repo | ⭐ | Bootstraps a product's voice by filling in PRODUCT_CONTEXT.md — the file every Auis writing skill reads. Derives the copy language and locale, the sit |

## Support (8)

| Skill | Platform | Origin | Tags | What it does |
|---|---|---|---|---|
| `commit` | 🟣🟠 | repo | — | Maps the pending changes and creates local atomic commits — one commit per file/area when it makes sense, without rewriting content inside a file just |
| `design-system-new-component` | 🟣🟠 | repo | ◐ legacy | [INACTIVE in this repo — do not trigger.] Generic, Au-blind version of "new component", kept only as a record of the Auis initial setup. To add or edi |
| `design-system-new-page` | 🟣🟠 | repo | ◐ legacy | '[INACTIVE in this repo — do not trigger.] Generic, Au-blind version |
| `figma-code-library-import` | 🟣🟠 | repo | — | Use when implementing or updating product UI from Figma in code through Claude or Cursor, especially when the project has its own component library an |
| `setup-design-system-from-cla-design` | 🟣🟠 | repo | ◐ legacy | [INACTIVE in this repo — do not trigger.] Initial design-system bootstrap from a Claude Design handoff. This repo is already set up — do not re-bootst |
| `setup-design-system-from-reference` | 🟣🟠 | repo | ◐ legacy | [INACTIVE in this repo — do not trigger.] Initial design-system bootstrap from a reference image. This repo is already set up — do not re-bootstrap. T |
| `shadcn` | 🟣🟠 | repo | — | Support skill for consulting the shadcn/ui registry, docs, and CLI when adding or wrapping primitives. Use when looking up a shadcn component, its API |
| `ux-page-rework` | 🟣🟠 | repo | — | Audits a product page (and its subpages) and delivers TWO different improvement directions — one refinement (keeps the structure, polishes components  |

---

## Recommended set — the "zeroed" core (ready for any product)

- `auis-review-bridge-solve`
- `auis-handoff` 🌐
- `auis-setup`
- `auis-ux-writing`
- `auis-voice`
- `auis-audit` 🌐
- `auis-brand`
- `auis-component` 🌐
- `auis-foundation` 🌐
- `auis-page` 🌐
- `auis-flow` 🌐

The 🌐 ones (origin `cowork`) are the **published generic** versions — prefer them when starting from scratch. The `repo` ones are richer variants (bridges, ux-flow, audit) taken from real use. Known overlaps: `auis-foundation` 🌐 vs `auis-design-system-foundation`; `auis-component` 🌐 vs `auis-new-component`; `auis-page` 🌐 vs `auis-new-page`; `auis-audit` 🌐 vs `auis-design-system-audit`.

## Platforms

Of the 34: 33 on Claude+Codex, 1 Claude-only (`auis-edit-bridge-solve`). 9 have their own Codex variant (◐).
