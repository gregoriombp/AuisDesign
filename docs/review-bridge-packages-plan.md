# Review Bridge as installable packages — plan

> **Resuming this work? Start here.** Check the status table, read the wave you are
> on, run its "Verify" list on `main` to confirm the starting point is green, then
> continue. One wave = one PR (atomic commits inside), merged only after CI passes and
> the browser check is done. Never publish to npm without the owner: publishing
> needs their 2FA (see `docs/RELEASING.md`).

## Goal

Let someone take **only the Review Bridge** (pins, comments, the drawer, the agent
mentions) into **their own repository** with one command, without scaffolding a whole
Auis project and without Auis rewriting their app. Today `npx @auis/cli` can only
create a full new Auis project, and `npx @auis/cli doctor` only diagnoses.

The end state for a host app is a command along the lines of
`npx @auis/cli init --only review`, which writes a handful of reversible touch points
(one route file, two lines in the root layout, one dependency, `.gitignore` lines, a
manifest and a data folder) and nothing else.

## Status

| Wave | What | Status |
|---|---|---|
| 1 | `@auis/core` + `@auis/server` + `@auis/next` (server side): the 16 Review Bridge routes run behind one `handle(Request)` | **done** (2026-10-10) |
| 0 | Anchor-survival experiment on real apps (gate before wave 2) | **next** |
| 2 | `@auis/ui`: the review chrome stops wearing the product's tokens; browser half of `@auis/next` | not started |
| 3 | `auis init --only review` / `uninstall` + publishing the packages | not started |
| 4+ | Shadow DOM, adapters beyond Next, the other bridges | not started |

Update this table in the same PR that moves a wave forward.

## Decisions (these override `~/.claude/plans/1-usar-alguns-componentes-sunny-deer.md`)

That earlier plan is the source for the package split and the host touch points. Where
the two disagree, this file wins:

- **No monorepo restructure, no `apps/demo`.** The Auis app stays at the repository
  root and consumes the packages from source. Nothing a current user sees moves.
- **The packages live in `kit/`, not `packages/`.** The published CLI (`@auis/cli`
  0.2.2) deletes the top-level `packages` folder from every scaffold
  (`PRUNE` in `packages/auis/src/create.mjs`) and downloads the template from `main`.
  Code under `packages/` would vanish from every new project. Moving the kit into
  `packages/` later requires narrowing `PRUNE` to `packages/auis`, publishing the CLI,
  and only then moving the folders.
- **Consumed through `tsconfig` paths, no workspaces yet.** `@auis/core`,
  `@auis/server` and `@auis/next` resolve to `kit/<name>/src` via `compilerOptions.paths`
  (Next/Turbopack) and `lib/__tests__/ts-extension-loader.mjs` (the Node test runner).
  No `package.json` inside `kit/*` until wave 3: the nearest `package.json` decides how
  Node loads `.ts` files, and adding one changes the test runner's behavior.
- **The public URL does not change.** The Auis app keeps serving
  `/api/review-bridge/*` (skills, the mention runner and every client call depend on
  it), now through a single catch-all route.

## The packages

| Package | Folder | Contains | May import |
|---|---|---|---|
| `@auis/core` | `kit/core` | Shared domain: comment types, agent identities and registry, agent runtime (ceilings, models), the `@`/`/` command parser, skills registry, reviewer handles | nothing outside itself (no `@/`, no `next`, no `react`, no `node:*`) |
| `@auis/server` | `kit/server` | Everything the Review Bridge does on the server: the doc store (disk driver), backups, images, sessions/roles, the mention trigger, the merge and reveal rules, the 16 handlers and the router behind `createReviewHandler(options) → handle(Request): Promise<Response>` | `@auis/core`, `node:*` |
| `@auis/next` | `kit/next` | Wave 1: `createReviewRoute(options)` → `{ GET, POST, PUT, PATCH, DELETE }` for a Next catch-all. Wave 2: the browser half (router hooks replacing the 3 `next/navigation` imports in the review UI) | `@auis/server`, `next` |
| `@auis/ui` | `kit/ui` (wave 2) | The review chrome: pins, drawer, popovers, toolbar, chips, with its own scoped CSS | `@auis/core`, `react` |

`handle(Request): Response` is what makes the rest possible: `NextRequest` is a
`Request`, `NextResponse` is a `Response`, and Node 18+ has both as globals. Adapters for
Vite, Express or Hono are a few dozen lines each.

A test (`kit/__tests__/boundaries.test.ts`) fails if `kit/core` or `kit/server` import
`@/`, `next` or `react`, or if `kit/core` imports `node:*`.

---

## Wave 1 — the motor and the Next plug (server only)

**Goal.** Move the Review Bridge server into `@auis/server` with no Next dependency,
and make the Auis app serve it through `@auis/next` from one catch-all route. Behavior
identical; nothing visible changes.

**Scope.**
1. `kit/core`: move `components/auis-review/types.ts` and, from `lib/auis-review/`,
   `agentIdentity`, `agentRuntime`, `agents`, `commandParse`, `skills`,
   `reviewerHandle`, plus the `ReviewerRef` type (today in the `"use client"`
   `reviewers.ts`). The agent chip tone becomes a union declared in core (the UI's
   `AuMentionChip` accepts it structurally). Callers in the app import `@auis/core`.
2. `kit/server`: move `lib/bridge-store` and every `app/api/review-bridge/_*.ts`
   helper, `lib/auis-review/agentToken.ts`, and the 16 route handlers. Handlers take a
   standard `Request` (`new URL(request.url)` instead of `nextUrl`, `Response.json`
   instead of `NextResponse.json`). A small router maps method + path to handler,
   decodes path segments, answers 404 for an unknown path and 405 for a known path with
   an unhandled method. Paths that were computed at module load (`process.cwd()`) become
   lazy, with options `dataDir`, `backupDir`, `mentionRunner`, `basePath`; the defaults
   are exactly today's (`review-bridge/data`, `~/.auis/review-bridge-backups` or
   `REVIEW_BRIDGE_BACKUP_DIR`, `scripts/mention-run.mjs`, `/api/review-bridge`).
3. `kit/next`: `createReviewRoute(options)`.
4. The app: delete the 16 route files (a static route would shadow the catch-all) and
   add `app/api/review-bridge/[...path]/route.ts`. `runtime` and `dynamic` stay literal
   in that file. `flow-suggestions` and `page-edits` import the doc store and
   `getBridgeSession` from `@auis/server`.
5. Tests: parity tests for all 16 endpoints written **before** the move and run against
   the old routes, then kept green; the existing store/merge/reveal/backup tests move
   with their code; `npm test` globs include `kit/`.

**Not in wave 1.** The browser half of `@auis/next` (needs `@auis/ui`), any UI change,
the edit and flow bridges, publishing.

**Done when.**
- `npm test` passes with at least the 75 tests from before plus the parity tests, and
  the boundaries test.
- `npm run typecheck`, `npm run lint` (no new warnings), `npm run ds:check` clean.
- Through the running dev server: `curl /api/review-bridge/health` returns the same
  JSON; `curl /api/review-bridge/comments` lists the comments; the drawer loads in the
  browser; `npm run mention:dry -- <id> claude` reaches the bridge.
- Scaffold proof: with the branch pushed,
  `npx -y @auis/cli@0.2.2 <scratch-dir> --ref <branch> --no-git` produces a project
  where `kit/` exists and `npm run typecheck` passes.
- No reference to `app/api/review-bridge/_*` left in code, skills, docs or UI copy.

**Verify.** `npm test` · `npm run typecheck` · `npm run lint` · `npm run ds:check` ·
the curl, browser, mention-dry and scaffold checks above.

**Shipped (2026-10-10).** Where things ended up, for whoever continues:

| What | Where |
|---|---|
| Shared domain | `kit/core/src/` — `types`, `agentIdentity`, `agentRuntime`, `agents`, `commandParse`, `skills`, `reviewerHandle`; imported as `@auis/core/<module>` |
| Server entry | `kit/server/src/review/handler.ts` — `createReviewHandler(options)` and the route table |
| Options | `kit/server/src/review/config.ts` — `ReviewServerOptions`, `reviewPaths()` (read at the moment of use) |
| Handlers | `kit/server/src/review/routes/*.ts` — one file per old route, standard `Request`/`Response` |
| Helpers | `kit/server/src/review/{store,session,mention,backup,images,errors,project,merge,reveal,agentToken}.ts` |
| Doc store | `kit/server/src/docstore/` (also used by `app/api/flow-suggestions`) |
| Next adapter | `kit/next/src/index.ts` — `createReviewRoute(options)` |
| The app's route | `app/api/review-bridge/[...path]/route.ts` |
| Tests | `kit/server/src/review/__tests__/routes.test.ts` (parity, written against the old routes first), `kit/__tests__/boundaries.test.ts` |

Verified: 95 tests; the same health JSON, comments and archive through the dev
server; 404/405 from the router; the drawer loading in the browser with every call
answered by the catch-all; `npm run mention:dry` reaching the bridge; and a project
scaffolded by the published `@auis/cli@0.2.2` from the branch contains `kit/`,
typechecks and passes the 95 tests.

Known gaps carried forward: the auth seam is still "edit `kit/server/src/review/session.ts`"
(a `resolveSession` option comes with wave 3/4); the edit and flow bridges still live
in `app/api/`.
- `configureReviewServer()` keeps the options at module level. Next may bundle the
  catch-all and other routes (`app/api/flow-suggestions`) with separate instances of
  `@auis/server`, so options given to `createReviewRoute()` would not reach
  `getBridgeSession` or the doc store imported elsewhere. Harmless today (everything
  runs on the defaults). Wave 3 passes `dataDir: ".auis/data"` and later
  `resolveSession`: pass the config explicitly there instead of relying on the
  singleton.

---

## Wave 0 — anchor survival (gate before wave 2)

**Goal.** Know whether pins stay attached in apps Auis did not author before spending
wave 2 on portability.

**How.** A bookmarklet that lifts `cssPath()` and `resolveElement()` from
`lib/auis-review/elementAnchor.ts` verbatim. On each app: drop 5 pins, then resize,
navigate away and back, reload, and change data. Record survivals in a sheet. Start with
the validation host (Destiny Matrix: Next 16 App Router, React 19, Tailwind v4, no
shadcn/Radix/zustand), then a Vite SPA and one non-React app.

**Gate.** If survival is poor, fix anchoring first. Wave 2 does not start until the
sheet exists.

---

## Wave 2 — the chrome dresses itself (`@auis/ui`)

**Goal.** The review UI renders correctly in an app that has none of Auis's tokens,
Tailwind setup or components, and stops leaking styles into it.

**Facts to plan with.** The review UI is 26 files and about 6,100 lines in
`components/auis-review`, with 257 `className` attributes. It uses 14 `Au*` components
(`Icon`, `AuButton`, `AuDropdownMenu`, `AuSpinner`, `AuPill`, `AuModal`,
`AuMentionMenu`, `AuMentionChip`, `popover`, `AuToast`, `AuSheet`, `AuInput`, `AuEmpty`,
`AuCheckbox`) and colors like `bg-(--bg-muted)` that come from the product's tokens. The
Auis dot (`components/auis/AuisDot.tsx`) is the mode switch the UI hangs from.

**Two routes, decide at the start of the wave:**
- *Shortcut, try first:* compile the existing Tailwind classes of the review UI into one
  static CSS file whose tokens are declared under `[data-auis-ui]`, renamed `--auis-*`
  so they cannot collide with the host's. Keeps the component code, so far less risk.
  Has to be validated against a host that also uses Tailwind (same class names, different
  rules).
- *Full:* collapse the 14 `Au*` into ~7 small own primitives (button, pill, icon, input,
  overlay, menu, notice), icons as inline SVG (no font), Tailwind compiled with a prefix.
  More work, cleaner result.

**Also in wave 2.**
- The browser half of `@auis/next`: the 3 files that import `next/navigation` go
  through router hooks the adapter provides.
- Move the DOM-side pure logic into `@auis/core`: `elementAnchor`, `scrollOffset`,
  `elementContext`, `format`, the client `storage/` implementations.
- No portal to `document.body` and no bare element selectors, so wave 4 (Shadow DOM)
  stays cheap.
- Do not bump `SCHEMA_VERSION` (it is a literal type on `ReviewComment`; bumping it
  invalidates every stored comment).

**Done when.** The Auis app looks the same. A test page with `globals.css` removed still
renders a legible chrome. The validation host renders the chrome with its own styles
untouched.

---

## Wave 3 — install into someone else's repo

**Goal.** `npx @auis/cli init --only review` in a Next App Router host.

**Scope.**
- CLI: `init` stops being an alias of create (today `create`, `init` and `new` all
  scaffold — `CREATE_ALIASES` in `packages/auis/src/cli.mjs`). `create`/`new` keep
  scaffolding; `init` installs into the current repo. `init --dry-run` is `doctor` plus
  the write plan, one code path.
- What `init` writes in the host: `app/api/auis/[...auis]/route.ts` (about 6 lines),
  two lines in the root layout, one dependency in `package.json`, a delimited block in
  `.gitignore`, `.auis/manifest.json` (every artifact it created or edited, with
  hashes) and `.auis/data/` (replaces `review-bridge/data/`). It never overwrites
  `AGENTS.md`, `.mcp.json`, `globals.css`, `tsconfig.json` or `components.json`.
- `auis uninstall` reads the manifest and restores the repo: `git status` clean.
- Publishing: each package gets its `package.json`, a build to JS + `.d.ts`, and an
  `npm publish` the owner confirms (2FA). The CLI is republished.
- The mention runner (`scripts/mention-run.mjs`) ships with `@auis/server` as a bin, so
  hosts get the `@Claude` trigger.

**Done when.** On the validation host: `init` → `git status` shows exactly the touch
points → pins work → `uninstall` → `git status` clean. `doctor` verdicts match what
the host actually does.

---

## Wave 4 and later

- Move the chrome into an open Shadow DOM root (needs wave 2's inline icons: `@font-face`
  does not work inside a shadow root; CSS variables do inherit through it, so the
  `--auis-*` rename stays required).
- `@auis/vite` / `@auis/express` / `@auis/hono` adapters around the same `handle()`, and
  a framework-agnostic mount for the chrome (Vue and similar are in scope; plain HTML is
  not the focus).
- Bring the edit bridge (`page-editor`) and the flow suggestions into `@auis/server`.
- Auth for hosts with a login: `createReviewHandler({ resolveSession })` is the seam;
  the origin's permission-table work (roles, invites, profiles) only matters once a host
  uses it.

## Invariants for every wave

- `/api/review-bridge/*` keeps answering the same JSON; the solve skills and the
  mention runner must keep working unchanged.
- `npx @auis/cli` (the published version) must still produce a working project from
  `main` after the merge. Run the scaffold proof whenever folders move.
- `kit/core` and `kit/server` never import `@/`, `next` or `react` (enforced by test).
- Data on disk stays readable: same files, same schema version, same backups folder.
