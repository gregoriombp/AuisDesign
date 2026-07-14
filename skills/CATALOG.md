# Auis Skills — Catálogo

> Gerado de `skills/registry.json` (`npm run skills:catalog`). **35 skills.** Fonte única em `skills/<capability>/<name>/`. As pastas de auto-discovery `.claude/skills/` (Claude Code) e `.agents/skills/` (Codex/Cursor) são **geradas** por `npm run skills:sync`.

**Legenda:** 🟣 Claude · 🟠 Codex/Cursor · 🌐 Cowork (genérica/zerada) · ⭐ set recomendado · ◐ tem variante `SKILL.codex.md` · _legacy_ neutralizada.

## Design System (9)

| Skill | Plataforma | Origem | Tags | O que faz |
|---|---|---|---|---|
| `auis-audit` | 🟣🟠🌐 | cowork | ⭐ | Scans a folder, file, or whole repository and reports every component that's used or implemented but missing from /auis/styleguide. Catches app compon |
| `auis-component` | 🟣🟠🌐 | cowork | ⭐ | Adds a new component to a Auis design system project (Next.js + shadcn/ui) and registers it under /auis/styleguide with a showcase route. Always check |
| `auis-design-system-audit` | 🟣🟠 | repo | — | Audit the Auis design system for internal consistency across tokens, components, showcases, navigation, and page usage. |
| `auis-design-system-foundation` | 🟣🟠 | repo | — | Bootstrap or update the Auis design system foundation from a visual reference. This is the only skill allowed to create or change tokens. |
| `auis-foundation` | 🟣🟠🌐 | cowork | ⭐ | Sets up a complete Auis design system in a Next.js + shadcn/ui project starting from any visual reference — a screenshot, Figma URL, Dribbble shot, Be |
| `auis-foundation-update` | 🟣🟠 | repo | — | INCREMENTALLY updates the foundation tokens of the Auis design system in app/globals.css (color, typography, spacing, radius, shadow, motion) — additi |
| `auis-new-component` | 🟣🟠 | repo | — | Add or update an Auis design system component using existing tokens, shadcn primitives where appropriate, a showcase page, and navigation. |
| `auis-new-page` | 🟣🟠 | repo | — | Build or rework a product page in this Next.js app using the Auis design system, existing components, existing tokens, and desktop-only constraints. |
| `auis-page` | 🟣🟠🌐 | cowork | ⭐ | Builds a full page in a Auis design system project (Next.js + shadcn/ui) from a screenshot, Figma URL, wireframe, or written description. Maps every v |

## UX Flows (7)

| Skill | Plataforma | Origem | Tags | O que faz |
|---|---|---|---|---|
| `auis-create-ux-flow` | 🟣🟠 | repo | — | Builds a UX flow diagram page in the Auis styleguide (/auis/styleguide/ux-flows/[name]) from a flow description, a list of steps, or any written brief |
| `auis-create-ux-flow-golden-eye` | 🟣🟠 | repo | — | Builds a COMPILED, multi-scenario "golden eye" UX flow page in the Auis styleguide (/auis/styleguide/ux-flows/[slug]) — several product journeys merge |
| `auis-flow` | 🟣🟠🌐 | cowork | ⭐ | Designs a feature's user flow as a FigJam board using the Auis convention: every screen becomes a card with name + route + file path + status; every t |
| `auis-import-figma-flow` | 🟣🟠 | repo | ◐ | Imports a Figma flow as a screen-by-screen navigable PROJECT under `/auis/projects` — enumerates the frames via the Figma MCP, renders each screen as  |
| `auis-pg-create-flow` | 🟣🟠 | repo | ◐ | Creates a NEW UX flow in the styleguide (`/auis/styleguide/ux-flows/[slug]`) from an `.awflow.json` file exported from the PG (designer) repo. Reads t |
| `auis-pg-merge-flow` | 🟣🟠 | repo | — | Merges a `.awflow.json` (exported from the PG repo) with a flow that already exists at `/auis/styleguide/ux-flows/[slug]`. Reads the file, compares it |
| `auis-update-ux-flow` | 🟣🟠 | repo | ◐ | Registers a structural update to an existing UX flow page in the Auis styleguide (`/auis/styleguide/ux-flows/[slug]`). Applies the requested change to |

## Bridges (review / flow / edit / project) (8)

| Skill | Plataforma | Origem | Tags | O que faz |
|---|---|---|---|---|
| `auis-edit-bridge-solve` | 🟣 | repo | — | Materializes Auis Live Edit Mode overlays into real code. The page editor stores non-destructive edit "ops" (text, style token, variant/size, icon, ic |
| `auis-flow-bridge` | 🟣🟠 | repo | — | [OBSOLETE] The styleguide UX flow editor went serverless — suggestions now go to a same-origin route (/api/flow-suggestions) that writes to flow-bridg |
| `auis-flow-bridge-solve` | 🟣🟠 | repo | — | Reads and applies UX flow edit suggestions stored in the flow-bridge (`/auis/styleguide/ux-flows/<flow>`). Pulls from the bridge using a filter chosen |
| `auis-review-bridge` | 🟣🟠 | repo | ◐ | Explains that the Auis Review Mode bridge is now serverless and embedded in the Next app at `/api/review-bridge/*` — `npm run dev` already brings ever |
| `auis-review-bridge-dispatch` | 🟣 | repo | — | The /loop dispatcher for the Auis Review Bridge — the "motor" that turns comments into live agent commands. One pass = read the dispatch queue (`/api/ |
| `auis-review-bridge-germano-audit` | 🟣🟠 | repo | ◐ | You are GERMANO FACCIO — an extremely critical UI/UX designer with a taste for premium/minimalist interfaces (Vercel, ElevenLabs, OpenAI, Langdock, St |
| `auis-review-bridge-germano-explore` | 🟣🟠 | repo | ◐ | You are GERMANO FACCIO on PROACTIVE PATROL — an extremely critical UI/UX designer with a taste for premium/minimalist interfaces (Vercel, ElevenLabs,  |
| `auis-review-bridge-solve` | 🟣🟠 | repo | ⭐ ◐ | Resolves Auis Review Mode comments in bulk. Reads from the local review-bridge using a filter chosen by the user (all of them, only today's, only open |

## Build & Handoff (2)

| Skill | Plataforma | Origem | Tags | O que faz |
|---|---|---|---|---|
| `auis-handoff` | 🟣🟠🌐 | cowork | ⭐ | Converts a Claude Design (or Cloud Design) handoff into production code by remapping the generated output onto Auis/styleguide components first and sh |
| `auis-project-build-solve` | 🟣🟠 | repo | ◐ | Fulfills, in bulk, the per-screen action requests from the `/auis/projects` workbench — the "Atualizar pro design system" button (kind `restyle`) and  |

## Content / UX Writing (1)

| Skill | Plataforma | Origem | Tags | O que faz |
|---|---|---|---|---|
| `auis-ux-writing` | 🟣🟠 | repo | ⭐ ◐ | Runs a fine-tooth-comb IN-PRODUCT UX writing pass over a route, several routes, or pasted links — reads the real strings from the page's files, audits |

## Support (8)

| Skill | Plataforma | Origem | Tags | O que faz |
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

## Set recomendado — núcleo "zerado" (pronto pra qualquer produto)

- `auis-review-bridge-solve`
- `auis-handoff` 🌐
- `auis-ux-writing`
- `auis-audit` 🌐
- `auis-component` 🌐
- `auis-foundation` 🌐
- `auis-page` 🌐
- `auis-flow` 🌐

As 🌐 (origin `cowork`) são as versões **genéricas publicadas** — preferir para construir do zero. As `repo` são variantes mais ricas (bridges, ux-flow, audit) do uso real. Sobreposições conhecidas: `auis-foundation` 🌐 vs `auis-design-system-foundation`; `auis-component` 🌐 vs `auis-new-component`; `auis-page` 🌐 vs `auis-new-page`; `auis-audit` 🌐 vs `auis-design-system-audit`.

## Plataformas

Das 35: 33 em Claude+Codex, 2 só Claude (`auis-edit-bridge-solve`, `auis-review-bridge-dispatch`). 13 têm variante Codex própria (◐).
