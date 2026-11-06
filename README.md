# Auis Design

**Auis is a code-native design builder.** It replaces most of the design-tool loop with a live environment where the design system, the screens, the UX flows, and the review process all live **in the codebase** — and where AI agents (Claude Code, Codex, Cursor) do the building under strict, skill-encoded rules.

Instead of designing in one tool and rebuilding in another, Auis gives you:

- **A living styleguide** (`/auis/styleguide`) — tokens, foundations, components, and patterns rendered from the real code.
- **Review Mode** — drop visual comments on any screen; they become a local work queue that agents resolve, and you approve or reject the result.
- **Edit Mode** — non-destructive visual edits (text, tokens, variants, icons) that agents materialize into real code.
- **UX Flows as code** — a dedicated hub (`/auis/ux-flow`) of navigable flow diagrams that are React pages, not static pictures, with comments, structural suggestions and compiled multi-scenario views.
- **State Mode** — every registered screen rendered in every state, side by side (`/auis/states`), driven by URL params; switch states in place on any screen with ⌘⇧S.
- **32 agent skills** — execution contracts that force any agent to reuse components, respect tokens, and register everything it builds.

The template is **Next.js (App Router) + Tailwind v4 + shadcn/ui**, desktop-first. That is the shape of a new Auis project, not a requirement for yours: the direction is a toolkit that installs into an existing product without changing what is already there.

## Two ways in, today

| You have | What works today |
|---|---|
| **Nothing yet** — a new product | `npx @auis/cli@latest my-product` creates the project with every surface working. |
| **An existing product** | `npx @auis/cli@latest doctor` reads the repository and reports, capability by capability, what Auis could do in it. In a **Next.js App Router** app, `npx @auis/cli@latest init` installs **Review** (pins, comments, the drawer, agent mentions); `uninstall` takes it back out. |

In an existing repository the builder UI (Review, Edit, State Mode, the flow driver) needs **React 18+** today, because it mounts as a React tree. A mount that carries its own runtime — so it runs beside Vue, Svelte, Angular and others — is planned; it does not exist yet. The skills and the rulebook are plain files and work in any repository.

> **Origin.** Auis started as *Bombardier*, an internal builder inside a private product. This repository is that engine extracted, de-branded, and open-sourced with neutral foundations and a documented builder core, ready to become **your** design system.

Created by **Gregório Pinheiro** — Design Engineer UX/UI, a creator of complex AI systems.

---

## Requirements

- **Node.js ≥ 20** and npm
- An AI coding agent for the full experience: **Claude Code**, **Codex**, or **Cursor** (the builder UI runs without one, but skills are the point)
- Optional: **Figma MCP** (for flow/design import skills)

## Installation

```bash
npx @auis/cli@latest my-product
```

That one command unpacks the template, renames the project to yours, runs
`git init` with a first commit, and installs dependencies — whose postinstall
generates the agent skill trees (`.claude/skills`, `.agents/skills`). Then:

```bash
cd my-product
npm run dev            # Next.js on http://127.0.0.1:3000
```

Every command and flag is in [CLI reference](#cli-reference) below.

Already have a product? Run `doctor` inside its repository:

```bash
npx @auis/cli@latest doctor            # reads your repo, writes nothing
```

It reports, capability by capability, what Auis can do in that codebase, what
runs degraded, and what is unsupported — each with the reason and the honest
alternative. It never writes, installs or asks. `--json` gives the full report.

In a Next.js App Router app, `init` asks what to install, as a checkbox menu of
every module. **Review** — pins, comments, the drawer and the `@Claude` mentions —
is the one that installs today; State Mode, Edit Mode, Styleguide and UX Flows
are listed, dimmed, with the reason they cannot be picked yet. Nothing else gets
scaffolded:

```bash
npx @auis/cli@latest init --dry-run    # pick, then print what it would touch, write nothing
npx @auis/cli@latest init              # install
npx @auis/cli@latest init --only review --yes   # no menu, for CI and scripts
npx @auis/cli@latest uninstall         # take it back out
```

`init` writes one route file (`app/api/review-bridge/[...path]/route.ts`), two
lines in your root layout, one dependency (`@auis/next`), a block in
`.gitignore` and a `.auis/` folder (the manifest, and the comments in
`.auis/data`, gitignored). It never touches `AGENTS.md`, `globals.css`,
`tsconfig.json` or your components, and the review chrome brings its own scoped
styles, so your pages look exactly as before. `uninstall` reads the manifest
and restores every file it edited; your comments move to the backups instead of
being deleted. The packages behind it live in [`kit/`](kit).

### CLI reference

The CLI is [`@auis/cli`](https://www.npmjs.com/package/@auis/cli) (the binary it
installs is `auis`). Run it with `npx @auis/cli@latest`; there is no unscoped `auis`
package, so `npx auis` does not work.

| Command | What it does |
|---|---|
| `npx @auis/cli@latest [directory]` | Scaffold a new project (`create` and `new` are the same command). With no directory it asks for one (`auis-app` with `--yes`); `.` means the current directory. |
| `npx @auis/cli@latest doctor [directory]` | Read an existing repository and report what Auis can do in it. Writes nothing. |
| `npx @auis/cli@latest init [directory]` | Pick modules and install them into an existing Next.js App Router app. |
| `npx @auis/cli@latest uninstall [directory]` | Reverse `init` from `.auis/manifest.json`. |

| Flag | Applies to | What it does |
|---|---|---|
| `-r, --ref <ref>` (`--branch`) | create | Branch, tag or commit of the template (default: `main`) |
| `--pm <npm\|pnpm\|yarn\|bun>` (`--use`) | create, init | Package manager (default: detected) |
| `--no-install` (`--skip-install`) | create, init, uninstall | Skip installing dependencies |
| `--no-git` (`--skip-git`) | create | Skip `git init` and the first commit |
| `--force` | create, uninstall | create: scaffold into a directory that is not empty. uninstall: also remove files you changed since `init` |
| `--json` | doctor | The full report as JSON, without the banner |
| `--only <a,b>` | init | Install these modules and skip the menu (`review`, `states`, `edit`, `styleguide`, `flows`; only `review` installs today). A module that cannot install says why and nothing is written |
| `--dry-run` | init | Print what it would touch, write nothing |
| `--purge` | uninstall | Delete the comments instead of moving them to `~/.auis/review-bridge-backups/<project>/` |
| `-y, --yes` | create, init | Take the defaults, never prompt (init: every module that installs here) |
| `-h, --help` | all | Show usage |
| `-v, --version` | all | Print the CLI version |

Needs Node.js 20 or newer. More detail, with sample output:
[`packages/auis`](packages/auis). Prefer a clone? That still works:

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
8. **Review Mode → `auis-review-bridge-solve`** — comment visually on the running app; agents resolve the queue; you approve. Or mention `@claude` or `@grok` in a comment: with `AUIS_MENTION_TRIGGER=1` in `.env.local` the write itself opens that agent's CLI, under the ceiling (Reply or Edit) you set in the floating dot's Agents panel — no loop, nothing polling.
9. **`auis-audit`** — verify every component used in the app is documented in the styleguide.

Brand, tokens, and voice are the three things Auis will never invent for you — the three creators `auis-setup` sequences: `auis-brand` derives your identity from the name and logo you give it, `auis-foundation` derives the tokens from a design you show it, `auis-voice` derives the voice from a product you show it. Everything downstream consumes them.

Full walkthrough: [docs/GETTING-STARTED.md](docs/GETTING-STARTED.md).

## Skills

**Source of truth:** `skills/<capability>/<name>/SKILL.md` (with a `SKILL.codex.md` variant where Codex diverges — 8 cases). The `.claude/skills/` and `.agents/skills/` discovery trees are **generated** — never edit them.

```bash
npm run skills:sync      # regenerate .claude/skills (Claude Code) + .agents/skills (Codex/Cursor)
npm run skills:catalog   # regenerate skills/registry.json + skills/CATALOG.md
```

32 skills across 6 capabilities — design system (incl. State Mode), UX flows, bridges (review/flow/edit/project), build & handoff, content, support. The recommended product-agnostic core: `auis-setup`, `auis-brand`, `auis-foundation`, `auis-voice`, `auis-component`, `auis-page`, `auis-flow`, `auis-audit`, `auis-handoff`. Full matrix: [skills/CATALOG.md](skills/CATALOG.md).

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Dev server (predev syncs skills) |
| `npm test` | Node unit tests for the app, the scripts and the kit (`lib/`, `app/`, `scripts/`, `kit/`) |
| `npm run test:cli` | The CLI's own tests (`packages/auis/test`) |
| `npm run kit:build` / `kit:smoke` | Build the four `@auis/*` packages to `dist/` / load what was built from a throwaway app's `node_modules`, the way an installed app would |
| `npm run ui:css` | Rebuild the review chrome's scoped stylesheet (`kit/ui`) |
| `npm run mention:dry -- <commentId> <agent>` | Run the mention runner for one comment without opening the agent's CLI (`MENTION_DRY_RUN=1`; agents comma-separated, e.g. `claude,grok`) |
| `npm run states:pdf` | Print the State Mode matrix to `auis-states-matrix.pdf` (needs a Chromium; see the script) |
| `npm run build` / `typecheck` / `lint` | Build / types / lint |
| `npm run ds:check` | Design-system lint (hardcode debt, hand-rolled overlays). Takes file paths and `--json`; exits `2` on findings, `1` if the scan fails. Exceptions, with a reason, in `.auis/ds-check.json` or a `ds-check-disable` comment |
| `npm run ds:hook -- on` | Optional, off by default: run `ds:check` as Claude Code hooks while an agent works (objective rules after each edit, the full set once per turn, never blocking twice). Meant for agents that drift from the rules. Writes `.claude/settings.local.json`; `off` removes it, `status` |
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
