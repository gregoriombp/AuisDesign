# Auis

**Auis is a code-native design builder.** It replaces most of the design-tool loop with a live environment where the design system, the screens, the UX flows, and the review process all live **in the codebase** — and where AI agents (Claude Code, Codex, Cursor) do the building under strict, skill-encoded rules.

Instead of designing in one tool and rebuilding in another, Auis gives you:

- **A living styleguide** (`/auis/styleguide`) — tokens, foundations, components, and patterns rendered from the real code.
- **Review Mode** — drop visual comments on any screen; they become a local work queue that agents resolve, and you approve or reject the result.
- **Edit Mode** — non-destructive visual edits (text, tokens, variants, icons) that agents materialize into real code.
- **UX Flows as code** — navigable flow diagrams that are React pages, not static pictures.
- **35 agent skills** — execution contracts that force any agent to reuse components, respect tokens, and register everything it builds.

Built with **Next.js (App Router) + Tailwind v4 + shadcn/ui**, desktop-first.

> **Origin.** Auis started as *Bombardier*, an internal builder inside a private product. This repository is that engine extracted, de-branded, and open-sourced for the first time — neutral tokens, empty catalog, ready to become **your** design system.

Created by **Gregório Pinheiro** — Design Engineer UX/UI, a creator of complex AI systems.

---

## Requirements

- **Node.js ≥ 20** and npm
- An AI coding agent for the full experience: **Claude Code**, **Codex**, or **Cursor** (the builder UI runs without one, but skills are the point)
- Optional: **Figma MCP** (for flow/design import skills)

## Installation

```bash
git clone https://github.com/gregoriopinheiro/auis.git
cd auis
npm install            # postinstall generates the agent skill trees (.claude/skills, .agents/skills)
npm run dev            # Next.js on http://127.0.0.1:3000
```

Optional — Review Mode queue server:

```bash
npm run review-bridge:install
npm run dev:bridge     # Next + local Express review bridge on 127.0.0.1:9878
```

Then open the builder surfaces:

| Surface | Route |
|---|---|
| Styleguide (design system) | `/auis/styleguide` |
| Review Bridge dashboard | `/auis/review-bridge` |
| UX Flows | `/auis/ux-flow` |
| Projects workbench | `/auis/projects` |

> ℹ️ The repo compiles clean (`typecheck` · `lint` · `build` all pass), but it ships **deliberately empty**: neutral tokens, no component catalog, zeroed galleries. Your product fills it — see [docs/GETTING-STARTED.md](docs/GETTING-STARTED.md).

## Starting your own design system

The intended loop (each step is a skill your agent runs):

1. **`auis-foundation`** — hand your agent a visual reference (screenshot, Figma URL, Dribbble/Behance/Mobbin capture). It extracts tokens (colors, typography, spacing, radius, shadows) and writes them into `globals.css`. *This is the only skill allowed to create tokens.*
2. **`auis-component`** — add components. Checks the shadcn registry first, wraps/extends primitives into `Au*` components, and registers each one in the styleguide with a showcase route.
3. **`auis-page`** — build full pages from a screenshot, Figma URL, wireframe, or written description, mapping every element to existing components first.
4. **`auis-flow` / `auis-create-ux-flow`** — design feature flows as navigable diagrams tied to real routes and files.
5. **Review Mode → `auis-review-bridge-solve`** — comment visually on the running app; agents resolve the queue; you approve.
6. **`auis-audit`** — verify every component used in the app is documented in the styleguide.

Full walkthrough: [docs/GETTING-STARTED.md](docs/GETTING-STARTED.md).

## Skills

**Source of truth:** `skills/<capability>/<name>/SKILL.md` (with a `SKILL.codex.md` variant where Codex diverges — 13 cases). The `.claude/skills/` and `.agents/skills/` discovery trees are **generated** — never edit them.

```bash
npm run skills:sync      # regenerate .claude/skills (Claude Code) + .agents/skills (Codex/Cursor)
npm run skills:catalog   # regenerate skills/registry.json + skills/CATALOG.md
```

35 skills across 6 capabilities — design system, UX flows, bridges (review/flow/edit/project), build & handoff, content, support. The recommended product-agnostic core: `auis-foundation`, `auis-component`, `auis-page`, `auis-flow`, `auis-audit`, `auis-handoff`. Full matrix: [skills/CATALOG.md](skills/CATALOG.md).

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Dev server (predev syncs skills) |
| `npm run dev:bridge` | Dev server + local review-queue server |
| `npm run build` / `typecheck` / `lint` | Build / types / lint |
| `npm run ds:check` | Design-system lint (hardcode debt, hand-rolled overlays) |
| `npm run skills:sync` / `skills:catalog` | Regenerate agent discovery trees / registry + catalog |

## Architecture

- [`AGENTS.md`](AGENTS.md) — **the rulebook.** Conventions any agent must follow: `Au*` prefix, shadcn-wrapper flow, tokens-are-sacred, component-lookup order.
- [`AUIS.md`](AUIS.md) — mental model and surfaces.
- [`PRODUCT_CONTEXT.md`](PRODUCT_CONTEXT.md) — template for **your** product's voice and vocabulary (writing skills read it).
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — engine internals; [`docs/component-map.md`](docs/component-map.md) — "need X → use Y" index.

Some deep-dive docs are currently in Portuguese (PT-BR); English translations are welcome — see [Contributing](CONTRIBUTING.md).

## Security notes

The review bridge binds to `127.0.0.1` only — never expose it on a LAN or bind to `0.0.0.0`. Runtime data dirs (`flow-bridge/`, `page-editor/`, `review-bridge/data/`) are gitignored.

## Contributing

PRs welcome — read [CONTRIBUTING.md](CONTRIBUTING.md) and [AGENTS.md](AGENTS.md) first. By participating you agree to the [Code of Conduct](CODE_OF_CONDUCT.md).

## License

[MIT](LICENSE) © 2026 Gregório Pinheiro
