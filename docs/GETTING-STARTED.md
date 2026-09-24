# Getting started with Auis

This guide takes you from one command to a working design system built by your AI agent. It assumes you have **Node.js ≥ 20** and one of: **Claude Code**, **Codex**, or **Cursor**.

## 1. Install and run

```bash
npx @auis/cli@latest my-product
cd my-product
npm run dev        # http://127.0.0.1:3000
```

`npx @auis/cli` unpacks the template, renames the project, initializes git, and installs dependencies (postinstall generates `.claude/skills` + `.agents/skills`). `--pm pnpm`, `--ref <branch|tag>`, `--no-install`, `--no-git` and `--force` are there when you need them — see [`packages/auis`](../packages/auis).

Already have a repository? `npx @auis/cli@latest doctor` reads it and reports what Auis can and cannot do inside it, with a reason and an alternative for each capability. It writes nothing.

Cloning still works if you'd rather have the repository as-is, contributor files included:

```bash
git clone https://github.com/gregoriombp/AuisDesign.git my-product
cd my-product
npm install        # postinstall generates .claude/skills + .agents/skills
npm run dev        # http://127.0.0.1:3000
```

Open `/auis/styleguide`. Auis ships **de-branded**, with neutral foundations and documented showcases for the builder's own `Au*` components. Your product-specific component layer starts empty and grows from there.

### First move: set up your brand

The hub (`/auis`) greets a fresh clone with a soft-gate **"Welcome — set up your brand"** card. Open `/auis/welcome` (or just click the card) and give it three things: your **project name**, a one-line **"what is your product"**, and a **logo** upload. Submitting posts to `/api/setup`, which saves the logo under `public/assets/brand/` and a gitignored brand overlay at `app/auis/_data/brand.runtime.json` — so the builder chrome starts reading as *your* product. The card disappears once setup is done.

Then let your agent finish the job in one guided pass:

```
/auis-setup
```

`auis-setup` is an orchestrator — it sequences the three creators, checking in between each: `auis-brand` (materializes the name, tagline, and logo you just uploaded into `PRODUCT_CONTEXT.md` and `AuLogo`), then `auis-foundation` (tokens, step 3 below), then `auis-voice` (voice + locale, feeds step 2 below). You can also run each creator on its own; the steps below cover them individually.

### Known state of this snapshot

The engine was extracted from a private product; it **compiles clean** (`typecheck`, `lint`, `build` all pass) but some content was deliberately emptied:

- `app/auis/projects/_data/projects.ts` is an **empty stub**; `app/auis/ux-flow/_data/flow-meta.ts` and `lib/auis-states/registry.ts` ship only the product-neutral examples (`/auis/ux-flow/example`, `/auis/ux-flow/example-golden-eye`, `/auis/states/example`) — the skills add your own flows and screens next to them.
- The inline sub-flow loader registry (`app/auis/ux-flow/_components/flow-subflow.tsx`) includes the public example — register product flows there as you create them.
- Two React 19 hooks lint rules are temporarily downgraded to warnings (see `eslint.config.mjs` TODO).

## 2. Point your agent at the rulebook

Everything an agent must know is in [`AGENTS.md`](../AGENTS.md). Claude Code discovers skills via `.claude/skills/`, Codex/Cursor via `.agents/skills/` — both are generated from `skills/` by `npm run skills:sync` (runs automatically on install and `dev`).

Fill in [`PRODUCT_CONTEXT.md`](../PRODUCT_CONTEXT.md) with your product's voice and vocabulary so the writing skills (`auis-ux-writing`) sound like you.

## 3. Build the foundation (tokens)

Give your agent a visual reference — a screenshot of a product you admire, a Figma URL, a Dribbble/Behance capture — and run:

```
/auis-foundation <reference>
```

The skill extracts colors, typography, spacing, radius, and shadows into design tokens in `app/globals.css`, and scaffolds the styleguide foundations pages.

**Rule: tokens are sacred.** `auis-foundation` (and `auis-foundation-update` for increments) are the *only* things allowed to create or change tokens. Nothing else — human or agent — hardcodes `#hex` or `w-[37px]`.

## 4. Add components

```
/auis-component Button
/auis-component Card
/auis-component Dialog
```

Each run: checks the shadcn registry first → installs/wraps the primitive as an `Au*` component (`components/ui/AuButton.tsx`) → creates a showcase page under `/auis/styleguide/components/au-button` → registers it in `navigation.ts`. Reuse > extend > create, always.

## 5. Build pages

```
/auis-page <screenshot | Figma URL | written description>
```

The agent maps every visual element to your existing `Au*` components first, falls back to shadcn primitives, and ensures anything new is also documented in the styleguide. Feature-specific pieces stay local in `_components/`.

## 6. Design flows

```
/auis-flow <feature description>                 # FigJam-convention flow board
/auis-create-ux-flow <steps or brief>            # navigable flow page in the UX Flow hub
/auis-create-ux-flow-golden-eye <scenarios>      # compiled view: several journeys in one graph
/auis-update-ux-flow <slug> <change>             # structural update + changelog entry
```

Flows are React pages with structured nodes/edges under `app/auis/ux-flow/[slug]/page.tsx`, registered in `app/auis/ux-flow/_data/flow-meta.ts` and listed at `/auis/ux-flow`. Click a screen to preview its real route; comment on a node or suggest a structural change straight from the canvas — both land in the Review Bridge.

## 7. Review loop

`npm run dev` serves the Review Bridge through same-origin Next.js routes
(`/api/review-bridge/*`) — nothing else to start, no token locally.

1. Browse your app, enter **Review Mode**, drop pin comments on anything ("this spacing is off", "wrong icon", "rewrite this empty state").
2. Comments land in a local queue (dashboard at `/auis/review-bridge`).
3. Your agent runs `/auis-review-bridge-solve` — it pulls the queue, applies scoped fixes, and moves items to *in review*.
4. You approve or reject each result from the inbox at `/auis/styleguide/review`.
5. Or let the agents come to you: put `AUIS_MENTION_TRIGGER=1` in `.env.local`, open the floating dot → **Agents**, switch an agent on and pick its ceiling — **Reply** (reads and answers) or **Edit** (changes code and sends it to review) — then mention `@claude` or `@grok` (and optionally a `/skill`) in a comment or a reply. The write itself opens that agent's CLI on your machine: no loop, nothing polling. The wording can ask for less than the ceiling, never more; if the agent leaves no reply, the runner posts the failure in the thread. Claude needs the Claude Code CLI; Grok needs xAI's Grok Build (`grok login`).

## 8. State Mode

Every screen has more states than the happy path. Register them once in `lib/auis-states/registry.ts` (`/auis-update-states`) and Auis renders **every registered screen in every state, side by side** at `/auis/states` — URL query params are the source of truth, so each cell is a real deep link (`/auis/states/example?state=empty`). On any registered screen press ⌘⇧S (or use the floating dot → Modes) to switch states in place; `npm run states:pdf` exports the matrix for a design review.

## 9. Audit

```
/auis-audit
```

Scans the repo for every component that's used but missing from the styleguide, and can create the missing showcase stubs. Run it periodically — it keeps the styleguide honest.

## 10. Verify

```bash
npm run typecheck && npm run lint && npm run build && npm run ds:check && npm test
```

`ds:check` reports design-system debt (hardcoded values, hand-rolled overlays) so you can feed it back into the review loop.

---

## The mental model in one paragraph

The design system is not documentation *about* the product — it **is** the product's UI layer, rendered live. Agents are the hands; skills are the contracts that keep those hands honest; Review Mode is how you direct them without writing prompts; and the styleguide is the ledger where every reusable piece must be registered. Once the loop is running, "design → build → review → ship" happens in one place: the repo.

Questions → open an issue. Deeper internals → [`ARCHITECTURE.md`](ARCHITECTURE.md) and [`component-map.md`](component-map.md).
