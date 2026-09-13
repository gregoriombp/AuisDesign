# Auis

Auis is the visual builder layer of this repository. It
brings the design system, product screens, UX flows, screen states, visual
review, and agent workflows into one code-native environment for building
product UI. It is product-agnostic: it ships with neutral foundations and
product-neutral examples, and everything product-specific is created on top of
it by the skills.

Its purpose is to shorten the distance between product intent and implementation:
the real design system lives in code, screens are navigable, flows are editable,
every screen state is one URL away, and visual comments become a local work queue
that agents can resolve with user approval.

## Current Surfaces

| Surface | Route | Role |
|---|---|---|
| Welcome | `/auis/welcome` | First-run setup form: project name, a one-line "what is your product", and a logo upload. Posts to `/api/setup`, which seeds the brand overlay the builder chrome reads. Also surfaced as a soft-gate card on the hub (`/auis`) until setup is done. |
| Styleguide | `/auis/styleguide` | Live design system source: foundations, tokens, `Au*` components, brand, patterns, the Review Mode foundation page, the review inbox and the link to the State Mode matrix. |
| Projects | `/auis/projects` | Workbench for imported projects/screens, design-system update requests, and build requests. |
| UX Flow hub | `/auis/ux-flow` | Gallery + sidebar of every UX flow. Each flow is its own page (`/auis/ux-flow/<slug>`) with the flow editor: screen previews, comments, structural suggestions, inline sub-flow expansion, and a changelog. Compiled ("golden-eye") views overlay several journeys in one graph. |
| State Mode matrix | `/auis/states` | Every registered screen rendered in every registered state, side by side (iframes with `?chrome=0`). Each cell is a real deep link; `npm run states:pdf` exports the matrix. |
| Review Inbox | `/auis/styleguide/review` | Inbox for comments created through Review Mode: filters, permalinks, approve / reject / reopen. |
| Review Bridge (dashboard) | `/auis/review-bridge` | In-app view of the local queue: comments, UX-flow suggestions, and the team (identities + roles). |
| Review Bridge (data) | `review-bridge/data/` | Runtime files written by the same-origin `/api/review-bridge/*` routes (gitignored). Not a server: there is nothing to start besides `npm run dev`. |
| Flow Bridge (data) | `flow-bridge/data/` | Runtime files written by `/api/flow-suggestions` (gitignored). |
| Design System Tweaks | `/auis/design-system-tweaks` | Controlled foundation/token experiments and visual impact checks. |
| Roadmap | `/auis/roadmap` | Non-authoritative parking lot for ideas about the Auis builder itself. |

## Mental Model

Auis is not separate documentation for the product. It is a product layer
that runs with the Next.js app.

- **Design system as source of truth:** official components live in
  `components/ui/Au*`, use tokens from `app/globals.css`, and are documented in
  the styleguide.
- **Builder by composition:** new screens should start from existing `Au*`
  components. When a missing piece is reusable, it becomes an official design
  system component.
- **Flows as code:** UX flows are React pages with structured nodes and edges,
  not static images.
- **States as URLs:** a screen state is a query param, never hidden component
  state. The State Mode registry maps those params, so the matrix, the toolbar
  and the flow deep links all replay the same URL.
- **Review as work queue:** visual comments carry route, location trail and
  target context, so local agents can resolve them before the user approves or
  rejects the result.
- **Three global modes:** the root layout mounts Review Mode (⌘⇧Y), Edit Mode
  (⌘⇧E) and State Mode (⌘⇧S) providers, the floating dot (AuisDot) and the
  `FlowStateDriver` so the tools work on product routes too. The modes are
  mutually exclusive.
- **Skills as execution contracts:** agents use Auis skills to follow repo
  rules instead of inventing file structure.

## Creating New Work

### First-Run Setup (a fresh Auis project)

A project starts with `npx auis@latest my-product` (or a clone of the repository).

Use `auis-setup` — or open `/auis/welcome` and fill the form (project name, a
one-line "what is your product", a logo upload). `auis-setup` is a guided
orchestrator: it sequences the three creators — `auis-brand` (name, mark, one-line
identity), then `auis-foundation` (tokens), then `auis-voice` (voice + locale) —
checking in between each, then flips setup to done so the hub's welcome card
disappears. The form's `/api/setup` route writes the logo to
`public/assets/brand/` and the brand overlay to
`app/auis/_data/brand.runtime.json` (gitignored); `auis-brand` materializes that
intent into `PRODUCT_CONTEXT.md` and the app chrome (`components/ui/AuLogo.tsx`).

### New Design System Component

Use `auis-new-component`.

Expected output:

- `components/ui/Au[Name].tsx`
- showcase at `app/auis/styleguide/components/au-[name]/page.tsx`
- entry in `app/auis/styleguide/navigation.ts`
- existing tokens only
- shadcn primitive installed and wrapped when appropriate

### New Screen or Screen Redesign

Use `auis-new-page`.

The agent should first compose the screen with existing `Au*` components and
feature modules. If the screen exposes a reusable pattern that the design system
does not have, create that pattern with `auis-new-component`. If it is
feature-specific, keep it local in `_components` or in the feature module.
When the screen has more than one state, register them with `auis-update-states`
(see "State Mode" below).

### New UX Flow

Use `auis-create-ux-flow` (single journey), `auis-create-ux-flow-golden-eye`
(compiled view of several journeys) or the `auis-pg-*` skills (import from a
designer export), depending on the flow source. Structural updates go through
`auis-update-ux-flow`.

The editable file lives at:

```txt
app/auis/ux-flow/[slug]/page.tsx        # exports NODES / EDGES + the page
app/auis/ux-flow/_data/flow-meta.ts     # { slug, title, description, group } — feeds the hub and its sidebar
```

Product-neutral references: `app/auis/ux-flow/example/page.tsx` and
`app/auis/ux-flow/example-golden-eye/page.tsx`.

### Review Comments

`npm run dev` serves the Review Bridge through same-origin routes
(`app/api/review-bridge/*`) that persist to `review-bridge/data/`. There is no
separate server, no port and no token in local development.

- Every comment carries the route, a human-readable location trail, the target
  element anchor and the steps needed to reveal it.
- Mention an agent (`@claude`, `@codex`, `@germano`) or a skill (`/auis-ux-writing`)
  in a comment. The toggles in the floating dot are the permission: **Live
  Response** lets the agent reply, **Auto Construct** lets it act. There is no
  extra directive to type.
- `auis-review-bridge-dispatch` (run under `/loop`) reads `/api/review-bridge/dispatch-queue`
  and routes each item; `auis-review-bridge-solve` batch-resolves the open queue.
  Executors move work to `in_review`; Germano only comments and pins.
- The user approves or rejects afterwards from the inbox (`/auis/styleguide/review`)
  or the dashboard (`/auis/review-bridge`).

Hierarchy: the local session is always an **admin**. When a deployment enables
authentication, `admin` / `reviewer` / `agent` roles are resolved in
`app/api/review-bridge/_session.ts`; agents authenticate with
`x-bridge-agent-token` against `BRIDGE_AGENT_TOKEN`.

### State Mode

State Mode shows **every scenario of every screen** side by side and lets the
user switch a screen's state in place (⌘⇧S or the floating dot → Modes). The
rule that makes it work: **the URL is the source of truth.** The toolbar only
writes and clears query params; the registry (`lib/auis-states/registry.ts`) is
the map of those params.

Registry entries declare, per route: `axes` (a query param each, built with
`axisFromRecord<Union>` so an unlabeled union member fails `npm run typecheck`),
optional shared axes reused by reference, `interactions` (`?ge=` click recipes
replayed by `FlowStateDriver` — `t:<text>` clicks the first clickable whose text
matches, `c:<css>` clicks a selector, `w:<ms>` waits, steps joined by `>>`), and
`previewPath` when the route has a dynamic segment. `matchScreenStates` returns
the first matching entry, deepest first.

Two implementation patterns for a screen:

- **Pattern A (server-thin):** the page maps `searchParams` to initial props and
  derives a `key` from the state params, remounting the client component on
  every change.
- **Pattern B (client):** the page reads the params with `useScreenStateOverride`,
  derives the scenario during render and wraps the screen in `Suspense`. Never
  copy the override into `useState`.

`/auis/states/example` is the worked Pattern B example (`app/auis/states/example/`).
`auis-update-states` keeps the registry honest after a page changes; the matrix
reads it through `/api/screen-states`, and `npm run states:pdf` prints it.

## Architecture Rules

- `AGENTS.md` is the source of truth for agent rules.
- `PRODUCT_CONTEXT.md` is the product context, voice, and vocabulary source.
- Do not create tokens outside the foundation skill.
- Do not create official components without the `Au` prefix.
- Do not use `components/playground` as AI staging.
- Do not expose the dev server (and with it the bridges) on the LAN or bind it
  to `0.0.0.0`.
- Do not use `.next/`, `.agents/`, `.claude/worktrees/`, `node_modules/`, or
  runtime data as architecture sources.

## Relationship to the Product

Auis exists to accelerate product building without breaking the design
system. The expected loop is:

1. build with real components;
2. register reusable patterns in the styleguide;
3. map relevant journeys as UX flows and register every screen state;
4. review with visual comments;
5. let agents apply scoped changes with enough context;
6. have the user approve the final result.
