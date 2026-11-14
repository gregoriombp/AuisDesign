# Auis for Mac — plan

> **Resuming this work? Start here.** Check the status table, read the wave you are
> on, run the previous wave's gate on `main` to confirm the starting point is green,
> then continue. One wave = one PR (atomic commits inside), merged only after CI
> passes and the gate has been run for real, with the app open.

## Goal

Today Auis exists only for someone who opens a terminal. Auis for Mac is an app you
download that **opens a project folder, runs that project's own dev server and shows
the product with Auis on top** — no terminal. Later the same window can open a hosted
URL instead of a local folder.

The app is additive. It changes nothing in the Next.js app, in the kit packages or in
anything that is deployed: everything that works in a browser today keeps working.

## Status

| Wave | What | Status |
|---|---|---|
| W0 | Skeleton: one project from the command line — start or attach, show, stop on quit | **done** (2026-11-14) |
| W1 | The look: the app's own chrome (launcher, project toolbar, log strip) as a real renderer, in the current Auis Design direction | **done** (2026-11-14) |
| W2 | Core hardening: unit tests for `env`, `nextLock`, `projects`, `server`; `detect` (project kind, Node version, an Install action for missing dependencies); the port notice; `workspace`; a CI job | implemented; local gate passed, CI pending (2026-11-14) |
| W3 | Playwright-Electron smoke; the gate flags go away; a proper app menu | not started |
| W4 | New project from the app (`npx @auis/cli`) | not started |
| W5 | Packaging: ad-hoc signed arm64 `.dmg`, tester README | not started |

Update this table in the same PR that moves a wave forward.

## Decisions

Owner's (2026-11-14):

- **Audience of v1:** people who build with an agent. They already have Node and
  Claude Code or Codex. The app uses their toolchain and shows an environment check;
  it bundles neither Node nor git.
- **Shape of v1:** a launcher (project list, open folder, new project) plus a project
  window that shows the running product, with server status and logs.
- **"Connect to prod" comes later** and means: open a hosted URL in the same window,
  signed in through that site's own login. No new backend.
- **Signing comes later.** v1 is ad-hoc signed and for testing only. Developer ID,
  notarization and auto-update need an Apple Developer Program account.
- **The look follows the current Auis Design direction**, taken from where the newest
  version of the hub lives. It is written down under "The look" below, and it applies
  to the app's own chrome only: the hub inside this repository is a separate port.

Technical:

- **Electron** (45). Same Chromium the screens are tested in; the main process is Node.
- **Thin app.** It runs the project's `dev` script with the user's Node. A bundled
  production build of Auis cannot work — see "What the repository imposes".
- **`packages/desktop/`**, with its own `package.json` and lockfile. `packages/` is
  already pruned from scaffolds, and the root install never downloads Electron.
  `react` resolves from the root, so it is the same copy `kit/ui` uses.
- **electron-builder** (26) for W5: ad-hoc signing is a documented switch
  (`mac.identity: "-"`), and Developer ID, notarization and `electron-updater` with
  GitHub Releases are later changes to the same config.
- **The app's identity is frozen:** product name `Auis Design` (the owner's pick,
  2026-11-14 — it is what the newest hub calls the product), bundle id
  `design.auis.desktop` (`src/shared/app.ts`). The userData folder and update
  continuity hang on them.
- **English UI**, like the hub and the review chrome.

## What the repository imposes

- **One instance serves one project: its `process.cwd()`.** Every data path derives
  from it, and backups key on `sha256(cwd)` (`kit/server/src/review/config.ts`). The
  app resolves the real path of a folder before using it.
- **Only `next dev` delivers the whole product.** In production the mention trigger is
  off (`kit/server/src/review/mention.ts`) and agent edits do not show without HMR.
- **Two servers on one folder corrupt the JSON stores** — their locks are in-memory,
  one process (`kit/server/src/docstore/fs.ts`). The app attaches to a server that is
  already running instead of starting a second one.
- **Next 16 answers "is it running, and where".** `next dev` holds `<distDir>/dev/lock`
  with `{pid, port, hostname, appUrl, startedAt}` and removes it on a clean exit. It
  prints "Ready" before taking the lock, so the lock is the readiness signal and
  stdout is not.
- **Do not set `PORT`, `AUIS_BRIDGE_URL`, `NODE_ENV` or `AUIS_MENTION_TRIGGER`.**
  Forcing a port disables Next's own retry (3000 → 3010). The mention route already
  hands its own origin to the runner, so mentions work on any port.
- **A port other than 3000 is the real hazard.** The skills default to
  `${BRIDGE_BASE:-http://127.0.0.1:3000}`. With two projects open, a skill run for
  one would write to the other's bridge. v1 shows a notice with the `BRIDGE_BASE` to
  export; the fix is for the skills to read the lock (see "After v1").

## What W0 established

Run for real on macOS 27, Apple Silicon, Electron 45.3, Next 16.4:

- **Start.** With port 3000 held by another project, Next moved to 3001 by itself and
  the lock named it. The window showed `/auis`. On quit, `SIGTERM` to the process
  group stopped npm, Next and its children, and Next removed its lock.
- **Attach.** With a dev server already running in the folder, the app read the lock,
  attached, and left that server running on quit.
- **The chrome cannot draw over the project.** A child view composites above the
  window's own page. Anything that has to overlap the product — the logs drawer,
  menus, the future agent panel — is a layout region or a native menu, never a DOM
  overlay.
- **Playwright sees both.** `_electron` lists the chrome page and the project view as
  two pages. Under a test runner the app's own path is not `argv[1]`; the argument
  parser recognises it by what it points at.
- **`npm_*` must be scrubbed** from the environment handed to the project. Started
  through `npm --prefix`, the app inherits `npm_config_prefix`, and the project's
  `npm run dev` would run the wrong package's script.
- **Not the app's doing, but visible through it:** Next 16.4's `next dev` appends an
  agent-rules block to the project's `AGENTS.md` (the `agentRules` option in
  `next.config`). Whether the template turns that off is the owner's call.

Not yet exercised: launching from Finder (where the shell lookup matters most), a
mention run, the microphone prompt, HMR after an edit. They are W5's manual checks.

## The look

The app's chrome follows the current Auis Design direction. The rules, so the next
screen is built from them and not from memory:

- **Canvas and cards.** A quiet neutral canvas (`#f1f2f4`; `#030507` in dark). White
  cards with a 24px radius and a border so subtle it only shows in dark. Shadow only
  on hover. One card level: a card never holds another card.
- **Type.** Instrument Serif for exactly one display line per screen (64px, 1.05).
  Geist for everything else, at weights 400 and 500 — never bolder. Geist Mono only
  for what a program printed (the log). Numbers that change use tabular figures.
- **Emphasis is dark, not colour.** One primary button per screen, a black pill. A
  selected control goes dark too. Information is gray, never blue. Colour is spent
  only on a 6px status dot: green for up, red for a problem, gray for idle.
- **Icons.** Material Symbols Rounded, filled, at 14, 16, 20 or 32px, with a firmer
  weight and grade at the small sizes.
- **Drawn previews.** A card's picture is drawn in code from the same tokens, on a
  sheet of 32px graph paper. No screenshots, no assets, so it follows light and dark.
- **Motion.** 120, 180 and 280ms on the project's own curves. One authored moment per
  screen (the launcher's cards settle in once); everything else is a paint
  transition. Reduced motion turns it all off.
- **Copy.** English. A control names its action; an error names the problem and what
  to do next. No eyebrow above a heading, no emoji.

It lives in `src/renderer/desktop.css`. Those tokens belong to this app: they are not
the product's design system and not the review chrome's `--auis-*` set. The four
fonts ship inside the app (npm packages, bundled by esbuild), because the chrome's
content-security policy allows nothing from the network.

## What W1 established

- The chrome is a real renderer served from `app://auis/`, with a preload that
  exposes named functions and IPC handlers that only answer the app's own pages.
- The project window uses a hidden-inset title bar: the toolbar is the title bar,
  with the traffic lights in its left gap.
- When a dev server fails or dies, the log strip opens by itself: what the server
  printed is the answer.
- The launcher counts a server someone started in a terminal as running; opening
  that project attaches to it.
- Playwright drives both pages and can emulate dark. `--user-data-dir=<dir>` gives a
  run its own project list, which is what a test must use so it never touches the
  real one.

## Architecture

```
packages/desktop/
  scripts/build.mjs        esbuild: main and preload (node, cjs), renderer (browser), the two pages
  src/shared/app.ts        product name and bundle id
  src/shared/ipc.ts        channel names, payload types, the layout both sides agree on
  src/shared/workspace.ts  local/remote location, explicit origins, guarded routes, bridge notice
  src/main/env.ts          the user's shell environment for a folder; which tools it has
  src/main/nextLock.ts     Next's dev lock: read, validate, liveness
  src/main/server.ts       one project's dev server: attach or start, state, log, stop
  src/main/projects.ts     the persisted project list
  src/main/detect.ts       project kind, Node semver requirement, missing dependencies
  src/main/cli.ts          (W4) arguments for `npx @auis/cli`
  src/main/security.ts     app:// protocol, who may call IPC, navigation and permission guards
  src/main/windows/        project.ts (the launcher window is small enough to live in index.ts)
  src/main/index.ts        lifecycle, the launcher, the IPC router
  src/preload/chrome.ts    contextBridge → window.auisDesktop
  src/renderer/            one bundle, two pages: launcher.html, project.html
  test/                    node --test; real child-process and HTTP fixtures
```

`env`, `nextLock`, `server` and `projects` do not import `electron`, so they run under
`node --test`. Nothing Node- or Electron-flavoured goes into `kit/ui`
(`kit/__tests__/boundaries.test.ts`).

### What W2 established

- `detect` distinguishes an Auis scaffold, an installed host, and plain Next.js;
  rejects unsupported projects before waiting for a lock; validates `engines.node`
  with npm's semver parser and reports the actual Node version and executable.
  v1 requires Next.js 16+ and its dev-lock contract. The shell's `NEXT_DIST_DIR`
  is supported; arbitrary `distDir` settings in executable Next config are not
  evaluated by the desktop app.
- Missing dependencies are resolved from the project, including hoisted packages.
  Install runs the declared package manager (lockfile fallback), streams its log,
  checks the result and starts the project. It happens only after the user clicks
  **Install dependencies**. Opening an already running project attaches without
  installing anything.
- Cancellation during environment lookup, install, lock wait or HTTP wait cannot
  load a late page. HTTP wait is bounded; failed starts stop their process group;
  ownership requires both a fresh lock and membership in the spawned process group.
  Close waits for cleanup, including children that outlive their package manager.
- A non-3000 server gets a persistent bridge-address notice, with a copy action.
  The native view reserves that space. Missing folders have **Locate** and **Forget**.
- Navigation and permissions use the workspace's explicit origins. IPC routes are
  checked after URL parsing as well, so backslashes cannot escape the local origin.
  Remote workspace types are groundwork only; opening a hosted URL is still post-v1.
- Local gate: 36 tests passed, desktop build/typecheck and root lint/typecheck/tests
  passed. The `desktop` CI job runs the tests and build on macOS with Node 22.
- Exercised in the built Electron app with a separate profile and a real Next.js
  fixture: empty/recent/missing launcher states, Install → Running on a fallback
  port, bridge command copied, `/auis` loaded without Node access, Locate replacing
  a missing entry, and quit leaving neither the owned PID nor its lock. Chrome
  checked in light and dark. Finder launch and the W3 automated smoke remain ahead.

### The supervisor

1. **Folder** missing → `folder-missing` (Locate / Remove).
2. **Environment** from the user's shell, per folder: interactive login shell, then
   login shell, then a static PATH. Version managers switch Node by directory.
3. **Project** without a `dev` script → error. A scaffold has `package.json#auis`; a
   host has `.auis/manifest.json`.
4. **Node** missing or below `engines.node ?? >=20.9` → say which one was found, where.
5. **Attach** when the lock exists, its pid is alive and the port answers. Never stop
   an attached server.
6. **Dependencies** missing → `deps-missing`, with an Install action. Installation
   can run the project's lifecycle scripts; the action says so before it runs.
7. **Start** `<pm> run dev`, detached, with no port argument.
8. **Ready** when the lock's `startedAt` is ours and its pid is in our process group.
   "already running" in the output → attach. Exit before ready → `crashed`. 90 s → `timeout`.
9. **Port ≠ 3000** → a persistent notice with the `BRIDGE_BASE` to export.
10. **Crash** → the last lines and a Restart action. No automatic restart loop.
11. **Close or quit** → `SIGTERM` to the group, `SIGKILL` after 5 s, owned servers only.
    Quitting while starting cancels, and never loads the URL.

### Security

- **The app's chrome:** served from `app://auis/`, CSP `default-src 'self'`, context
  isolation, sandbox, no Node. Every IPC handler validates its sender and its
  payload. Renderers send ids and `/paths`, never absolute paths or URLs.
- **The project view:** no preload, its own storage partition, and it stays on the
  workspace's origins; everything else opens in the default browser. Permissions are
  denied by default, with `media`, clipboard write and fullscreen allowed for the
  workspace origin. The origin list is what leaves room for a remote site's login.

## Gates

| Wave | Proof |
|---|---|
| W0 | `npm --prefix packages/desktop start -- <project>` shows the project; after quit no process from that folder remains and `<project>/.next/dev/lock` is gone; root `npm run typecheck` and `npm run lint` exit 0 |
| W1 | Driven in the built app, light and dark, from `app://auis/`: the launcher empty and with a list (featured, recent, a missing folder); a project starting, running, failing and with the log open; quit leaves no process and no lock |
| W2 | `npm --prefix packages/desktop test` → `# fail 0`; the `desktop` job is green in CI |
| W3 | `npm --prefix packages/desktop run smoke` passes: open a fixture, Starting → Running, navigate from the toolbar, an external link leaves the view alone, no `require` in the page, logs show, kill → Stopped → Start again, quit leaves no process and no lock |
| W4 | New project ends on `/auis/welcome` |
| W5 | `npm --prefix packages/desktop run dist` → `release/Auis-Design-0.1.0-arm64.dmg`; `codesign -dv` shows `Signature=adhoc`; `codesign --verify --deep --strict` exits 0; the manual list passes from a Finder launch |

W0's `--capture=<dir>` and `--quit-after=<ms>` exist only so that gate can run
unattended. The W3 smoke replaces them; remove them there.

## After v1

1. **The skills read the dev lock** instead of assuming port 3000. Independent of the
   app, and it removes the port hazard for everyone.
2. **Public distribution:** Developer ID, notarization, `electron-updater` with GitHub
   Releases, x64 or universal, a release workflow, a download page on the site.
3. **Remote workspace:** open a hosted URL in the same window.
4. **`auis init` from the app**, and an **agent panel**.
