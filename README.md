# Auis Design

**Auis is a code-native design builder.** It replaces most of the design-tool loop with a live environment where the design system, the screens, the UX flows, and the review process all live **in the codebase** — and where AI agents (Claude Code, Codex, Cursor) do the building under strict, skill-encoded rules.

Instead of designing in one tool and rebuilding in another, Auis gives you:

- **A living styleguide** (`/auis/styleguide`) — tokens, foundations, components, and patterns rendered from the real code.
- **Review Mode** — drop visual comments on any screen; they become a local work queue that agents resolve, and you approve or reject the result.
- **Edit Mode** — non-destructive visual edits (text, tokens, variants, icons) that agents materialize into real code.
- **UX Flows as code** — a dedicated hub (`/auis/ux-flow`) of navigable flow diagrams that are React pages, not static pictures, with comments, structural suggestions and compiled multi-scenario views.
- **State Mode** — every registered screen rendered in every state, side by side (`/auis/states`), driven by URL params; switch states in place on any screen with ⌘⇧S.
- **37 agent skills** — execution contracts that force any agent to reuse components, respect tokens, and register everything it builds.

Built with **Next.js (App Router) + Tailwind v4 + shadcn/ui**, desktop-first.

> **Origin.** Auis started as *Bombardier*, an internal builder inside a private product. This repository is that engine extracted, de-branded, and open-sourced with neutral foundations and a documented builder core, ready to become **your** design system.

Created by **Gregório Pinheiro** — Design Engineer UX/UI, a creator of complex AI systems.

---

## Requirements

- **Node.js ≥ 20** and npm
- An AI coding agent for the full experience: **Claude Code**, **Codex**, or **Cursor** (the builder UI runs without one, but skills are the point)
- Optional: **Figma MCP** (for flow/design import skills)

## Installation

```bash
npx @auis/cli my-product
```

That one command unpacks the template, renames the project to yours, runs
`git init` with a first commit, and installs dependencies — whose postinstall
generates the agent skill trees (`.claude/skills`, `.agents/skills`). Then:

```bash
cd my-product
npm run dev            # Next.js on http://127.0.0.1:3000
```

| Flag | What it does |
|---|---|
| `--pm npm\|pnpm\|yarn\|bun` | package manager (default: the one you ran it with) |
| `--ref <branch\|tag\|commit>` | which version of the template to unpack (default: `main`) |
| `--no-install` / `--no-git` | skip dependency installation / git init |
| `--force` | scaffold into a directory that is not empty |
| `-y, --yes` | take the defaults, never prompt |

Full CLI docs: [`packages/cli`](packages/cli). Prefer a clone? That still works:

```bash
git clone https://github.com/gregoriombp/AuisDesign.git my-product
cd my-product && npm install && npm run dev
```

The Review Bridge, the Flow Bridge and the State Mode API are same-origin Next.js
routes — `npm run dev` is all you need. Then open the builder surfaces:

| Surface | Route |
|---|---|
| Welcome / first-run setup | `/auis/welcome` |
| Styleguide (design system) | `/auis/styleguide` |
| Review Bridge dashboard | `/auis/review-bridge` |
| Review inbox | `/auis/styleguide/review` |
| UX Flow hub | `/auis/ux-flow` |
| State Mode matrix | `/auis/states` |
| Projects workbench | `/auis/projects` |
| Builder roadmap | `/auis/roadmap` |

> The repository ships a neutral, documented **Layer A**: the foundations and components used by the Auis builder itself. Your product's **Layer B** starts empty and grows through the component and page skills. See [docs/GETTING-STARTED.md](docs/GETTING-STARTED.md).

## Starting your own design system

The intended loop (each step is a skill your agent runs):

0. **`auis-setup`** — the recommended first move. Run `/auis-setup`, or open `/auis/welcome` and it will walk you through it: your project name, a one-line "what is your product", and a logo upload. It's a guided orchestrator — it sequences the three creators below (brand → tokens → voice), checking in between each. The hub (`/auis`) shows a "Welcome — set up your brand" card until setup is done.
1. **`auis-brand`** — establishes your product's identity: the app name, the one-line positioning, and your logo/mark, wired into the app chrome so the builder reads as *your* product, not Auis. *This is the only skill allowed to establish brand.*
2. **`auis-foundation`** — hand your agent a visual reference (screenshot, Figma URL, Dribbble/Behance capture). It extracts tokens (colors, typography, spacing, radius, shadows) and writes them into `globals.css`. *This is the only skill allowed to create tokens.*
3. **`auis-voice`** — hand it your product instead: an existing app, a site, a tone-of-voice doc, or just answer six questions. It fills [`PRODUCT_CONTEXT.md`](PRODUCT_CONTEXT.md) with your product's language, voice, protected vocabulary, and a corpus of its real strings. *This is the only skill allowed to create voice* — the writing skills read it and produce generic copy until it exists.
4. **`auis-component`** — add components. Checks the shadcn registry first, wraps/extends primitives into `Au*` components, and registers each one in the styleguide with a showcase route.
5. **`auis-page`** — build full pages from a screenshot, Figma URL, wireframe, or written description, mapping every element to existing components first.
6. **`auis-flow` / `auis-create-ux-flow`** — design feature flows as navigable diagrams tied to real routes and files, listed in the UX Flow hub; `auis-create-ux-flow-golden-eye` compiles several journeys into one view, and `auis-update-states` registers each screen's states for the State Mode matrix.
7. **`auis-ux-writing`** — make every string in a screen sound like your product, using the voice from step 3.
8. **Review Mode → `auis-review-bridge-solve`** — comment visually on the running app; agents resolve the queue; you approve. Mention `@claude`, `@codex` or `@germano` in a comment and, with the agent's toggles on in the floating dot, `auis-review-bridge-dispatch` (under `/loop`) replies or acts on it.
9. **`auis-audit`** — verify every component used in the app is documented in the styleguide.

Brand, tokens, and voice are the three things Auis will never invent for you — the three creators `auis-setup` sequences: `auis-brand` derives your identity from the name and logo you give it, `auis-foundation` derives the tokens from a design you show it, `auis-voice` derives the voice from a product you show it. Everything downstream consumes them.

Full walkthrough: [docs/GETTING-STARTED.md](docs/GETTING-STARTED.md).

## Skills

**Source of truth:** `skills/<capability>/<name>/SKILL.md` (with a `SKILL.codex.md` variant where Codex diverges — 10 cases). The `.claude/skills/` and `.agents/skills/` discovery trees are **generated** — never edit them.

```bash
npm run skills:sync      # regenerate .claude/skills (Claude Code) + .agents/skills (Codex/Cursor)
npm run skills:catalog   # regenerate skills/registry.json + skills/CATALOG.md
```

37 skills across 6 capabilities — design system (incl. State Mode), UX flows, bridges (review/flow/edit/project), build & handoff, content, support. The recommended product-agnostic core: `auis-setup`, `auis-brand`, `auis-foundation`, `auis-voice`, `auis-component`, `auis-page`, `auis-flow`, `auis-audit`, `auis-handoff`. Full matrix: [skills/CATALOG.md](skills/CATALOG.md).

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Dev server (predev syncs skills) |
| `npm test` | Node unit tests (review identities, flow-suggestion integrity) |
| `npm run states:pdf` | Print the State Mode matrix to `auis-states-matrix.pdf` (needs a Chromium; see the script) |
| `npm run build` / `typecheck` / `lint` | Build / types / lint |
| `npm run ds:check` | Design-system lint (hardcode debt, hand-rolled overlays) |
| `npm run skills:sync` / `skills:catalog` | Regenerate agent discovery trees / registry + catalog |

## Architecture

- [`AGENTS.md`](AGENTS.md) — **the rulebook.** Conventions any agent must follow: `Au*` prefix, shadcn-wrapper flow, tokens-are-sacred, component-lookup order.
- [`AUIS.md`](AUIS.md) — mental model and surfaces.
- [`PRODUCT_CONTEXT.md`](PRODUCT_CONTEXT.md) — template for **your** product's voice and vocabulary (writing skills read it).
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — engine internals; [`docs/component-map.md`](docs/component-map.md) — "need X → use Y" index; [`docs/EXTRACTION-AUDIT.md`](docs/EXTRACTION-AUDIT.md) — the public/private boundary and recovery decisions.

## Security notes

The bridges are same-origin routes of the dev server, which binds to `127.0.0.1` only — never expose it on a LAN or bind to `0.0.0.0`. Runtime data dirs (`flow-bridge/data/`, `page-editor/`, `review-bridge/data/`) are gitignored. Set `BRIDGE_AGENT_TOKEN` only on a deployment that must accept agent writes over the network.

## Contributing

PRs welcome — read [CONTRIBUTING.md](CONTRIBUTING.md) and [AGENTS.md](AGENTS.md) first. By participating you agree to the [Code of Conduct](CODE_OF_CONDUCT.md).

## License

[MIT](LICENSE) © 2026 Gregório Pinheiro
