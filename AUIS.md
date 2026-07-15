# Auis

Auis is the visual builder layer of this repository. It
brings the design system, product screens, UX flows, visual review, and agent
workflows into one code-native environment for building product UI.

Its purpose is to shorten the distance between product intent and implementation:
the real design system lives in code, screens are navigable, flows are editable,
and visual comments become a local work queue that agents can resolve with user
approval.

## Current Surfaces

| Surface | Route | Role |
|---|---|---|
| Welcome | `/auis/welcome` | First-run setup form: project name, a one-line "what is your product", and a logo upload. Posts to `/api/setup`, which seeds the brand overlay the builder chrome reads. Also surfaced as a soft-gate card on the hub (`/auis`) until setup is done. |
| Styleguide | `/auis/styleguide` | Live design system source: foundations, tokens, `Au*` components, brand, patterns, and UX flows. |
| Projects | `/auis/projects` | Workbench for imported projects/screens, design-system update requests, and build requests. |
| UX Flow | `/auis/ux-flow` | Flow viewer/hub for presenting and navigating UX flows as prototypes. |
| Styleguide UX Flows | `/auis/styleguide/ux-flows` | Editable source for flow graphs, nodes, edges, comments, and changelog entries. |
| Review Inbox | `/auis/styleguide/review` | Inbox for comments created through Review Mode. |
| Review Bridge (server/data) | `review-bridge/` | Local comment-queue server + data dir for agents (a filesystem dir, not a route), with user approval after agent work. |
| Review Bridge (dashboard) | `/auis/review-bridge` | In-app view of the local review-bridge queue (comments + suggestions panels). |
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
- **Review as work queue:** visual comments carry route and target context, so
  local agents can resolve them before the user approves or rejects the result.
- **Review and Edit are global:** the root layout mounts both providers, the Auis
  dot, and the UX-flow state driver so the tools work on product routes too.
- **Skills as execution contracts:** agents use Auis skills to follow repo
  rules instead of inventing file structure.

## Creating New Work

### First-Run Setup (a freshly cloned Auis)

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

### New UX Flow

Use `auis-create-ux-flow` or the `auis-pg-*` skills, depending on
the flow source.

The editable file lives at:

```txt
app/auis/styleguide/ux-flows/[slug]/page.tsx
```

### Review Comments

`npm run dev` uses the same-origin Review Bridge routes built into the app. The
optional `npm run dev:bridge` command starts the legacy Express bridge on
`127.0.0.1:9878`. Review Mode comments enter the same local queue in either
mode. Agents should use `auis-review-bridge-solve`
to move work to `in_review`; the user approves or rejects it afterward from the
inbox.

## Architecture Rules

- `AGENTS.md` is the source of truth for agent rules.
- `PRODUCT_CONTEXT.md` is the product context, voice, and vocabulary source.
- Do not create tokens outside the foundation skill.
- Do not create official components without the `Au` prefix.
- Do not use `components/playground` as AI staging.
- Do not expose Review Bridge on the LAN or bind it to `0.0.0.0`.
- Do not use `.next/`, `.agents/`, `.claude/worktrees/`, `node_modules/`, or
  runtime data as architecture sources.

## Relationship to the Product

Auis exists to accelerate product building without breaking the design
system. The expected loop is:

1. build with real components;
2. register reusable patterns in the styleguide;
3. map relevant journeys as UX flows;
4. review with visual comments;
5. let agents apply scoped changes with enough context;
6. have the user approve the final result.
