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
| W2 | Core hardening: unit tests for the main-process modules; `detect` (project kind, Node version, an Install action for missing dependencies); the port notice; the navigation rules; a CI job | **done** (2026-11-14) |
| W3 | Playwright-Electron smoke; the gate flags go away; a proper app menu | **done** (2026-11-14) |
| W4 | New project from the app (`npx @auis/cli`) | next |
| W5 | Packaging: ad-hoc signed arm64 `.dmg`, tester README | packaged and installed locally (2026-11-14); real-project manual checks pending |

Update this table in the same PR that moves a wave forward.

The owner requested installation before W4 on 2026-11-14. The current app is
therefore packaged for opening existing projects; new-project creation remains next.

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
  The package is self-contained: it has its own React, esbuild and TypeScript, and
  installs, tests and builds without the root install. (Sharing the root's React
  only mattered while the chrome was going to reuse `kit/ui`; it has its own
  stylesheet instead.)
- **The Node check reads `engines.node` and nothing else.** With no declared range
  there is no check: assuming one would block a project on an older Next that runs
  fine. Next itself reports a Node it cannot use, and that lands in the log.
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

## What W2 established

- **The tests run real processes.** The server tests start a throwaway project whose
  `dev` script stands in for `next dev` (`test/fixtures/dev-server.mjs`: it answers
  HTTP and writes the lock Next writes), through the real package manager. Process
  groups, signals and lock files are the point of that module; a fake of them would
  test the fake.
- **A failure must not leave a process behind.** Writing the tests found one: a dev
  script that never became ready kept running after the app had reported the error.
  Now an error means nothing the app started is still up.
- **The shell's answer is taken the moment it is complete.** A startup file can leave
  something running that keeps the pipe open; waiting for the pipe to close would
  wait for that.
- **`npm install` succeeds on a dependency that is not there** (a `file:` path to
  nothing becomes a dangling link). A test that needs a failing install uses a
  failing `preinstall` script, which needs no network either.
- **Electron 45's clipboard is promise-based** (`writeText` returns a promise; the
  old synchronous helpers are gone). The types allowed an un-awaited call; running
  it is what showed it.
- **The port notice is a layout region** under the toolbar, like the log strip: the
  main process moves the project view down by its height.

## Architecture

```
packages/desktop/
  scripts/build.mjs        esbuild: main and preload (node, cjs), renderer (browser), the two pages
  test/smoke/              Playwright-Electron gate; npm run smoke builds and opens the app
  src/shared/app.ts        product name and bundle id
  src/shared/ipc.ts        channel names, payload types, the layout both sides agree on
  src/shared/workspace.ts  where a project's view may go: allowed origins, web links, in-app routes
  src/main/env.ts          the user's shell environment for a folder; which tools it has
  src/main/nextLock.ts     Next's dev lock: read, validate, liveness
  src/main/detect.ts       what a folder is: kind, package manager, dev script, dependencies, Node range
  src/main/server.ts       one project's dev server: attach or start, install, state, log, stop
  src/main/projects.ts     the persisted project list
  src/main/cli.ts          (W4) arguments for `npx @auis/cli`
  src/main/security.ts     app:// protocol, who may call IPC, navigation and permission guards
  src/main/windows/        project.ts (the launcher window is small enough to live in index.ts)
  src/main/index.ts        lifecycle, the launcher, the IPC router
  src/main/menu.ts         native menu; commands target the focused project's view
  src/preload/chrome.ts    contextBridge → window.auisDesktop
  src/renderer/            one bundle, two pages: launcher.html, project.html
  test/                    node --test, one file per module; fixtures/ holds the stand-in dev server
```

`env`, `nextLock`, `detect`, `server`, `projects` and `shared/workspace` do not import
`electron`, so they run under `node --test`. Nothing Node- or Electron-flavoured goes
into `kit/ui` (`kit/__tests__/boundaries.test.ts`).

A project is one of four kinds, named by what the app acts on (`detect.ts`): `auis`
(the Auis surfaces are in it: the window opens on the hub and offers their
shortcuts), `auis-review` (the Review kit was installed into a host app: its own
pages, no hub), `next`, and `other`. The first two have a bridge, so they get the
port notice.

The remote workspace does not exist yet, so there is no `Workspace` type yet either.
What is in place for it is the rule it needs: the view is kept on a *list* of allowed
origins, compared exactly.

### The supervisor (`src/main/server.ts`)

A start asks, in this order, the questions that can stop it:

1. **Is the folder a project that can run?** Missing, no `package.json` or no `dev`
   script → say which.
2. **What is the user's shell environment for it?** Interactive login shell, then
   login shell, then a static PATH. Asked per folder: version managers switch Node
   by directory.
3. **Is a dev server already running there?** The lock exists and its pid is alive →
   attach. An attached server is never stopped. This comes before the tool checks on
   purpose: a server that is already up does not need this environment to start one.
4. **Are the package manager and Node on the PATH, and is Node in the project's
   declared range?** → say which tool, which version, where it was found.
5. **Are the dependencies installed?** No → an error that offers to install; the
   install runs `<pm> install` with its output in the log, then starts.
6. **Start** `<pm> run dev`, detached, with no port argument. Ready when the lock's
   `startedAt` is ours and its pid is alive. "already running" in the output →
   attach. Exit before ready, no lock in 90 s, or no answer in 30 s → an error, and
   whatever was started is ended.

Then: a server that goes away shows as stopped, with Start again — there is no
automatic restart loop. A port other than 3000 shows the notice with the
`BRIDGE_BASE` to export. Close or quit sends `SIGTERM` to the process group and
`SIGKILL` after 5 s, for servers the app started only; stopping while a start or an
install is under way cancels it.

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
| W2 | `npm --prefix packages/desktop test` → `fail 0`, and the run exits by itself with no process left; the `desktop` job is green in CI; in the built app, a project with no `node_modules` installs and starts from the button, and an Auis project off port 3000 shows the notice, copies its command and moves the page back up when dismissed |
| W3 | `npm --prefix packages/desktop run smoke` passes: open a fixture, Starting → Running, navigate from the toolbar, an external link leaves the view alone, no `require` in the page, logs show, kill → Stopped → Start again, quit leaves no process and no lock |
| W4 | New project ends on `/auis/welcome` |
| W5 | `npm --prefix packages/desktop run dist` → `release/Auis-Design-0.1.0-arm64.dmg`; `codesign -dv` shows `Signature=adhoc`; `codesign --verify --deep --strict` exits 0; the manual list passes from a Finder launch |

### What W3 established

- **The gate opens the real Electron app.** `npm run smoke` builds it and runs
  four Playwright scenarios with temporary project folders, a separate profile,
  and an offline HTTP fixture that implements the Next dev-lock contract. It
  checks install/start, toolbar navigation, native menu actions, external-link
  routing, the sandbox, logs, crash/restart, attach, Close and Quit. Native folder
  selection and the OS browser handoff are stubbed at those boundaries only.
- **The app has a native menu.** File opens folders or returns to Projects; View
  navigates/reloads the focused project, toggles its log, restarts its server or
  opens its current page in the browser. Edit and Window use native roles. Project
  commands disable in the launcher and follow server/history state.
- **Close and Quit both await cleanup.** Closing during a restart cancels its
  queued replacement and waits for the earlier stop too. On Mac, closing the last
  window leaves the app available in the Dock; activating it opens the launcher.
- **The log has one copy of every line.** Its initial snapshot and a buffered
  event may overlap; the renderer refreshes the bounded history on each batch.
- **Local verification:** 71 desktop unit tests, all four Electron smoke scenarios,
  173 root tests, both typechecks, desktop build and root lint passed. The lint
  result retains the same 33 existing warnings. All four CI jobs, including the
  macOS Electron gate, passed in [run 43584854381](https://github.com/gregoriombp/AuisDesign/actions/runs/43584854381).
- **The old capture/quit flags are gone.** Screenshots, accessibility snapshots,
  main-process logs and Playwright traces live in ignored `output/smoke/` under
  this package. CI retains them for seven days in the `desktop-smoke` artifact.
  The smoke runs in the `desktop-smoke` macOS job; the W2 unit/build job remains
  independent on Linux. No root install or Playwright browser download is needed.

The HTTP fixture deliberately does not prove Next compatibility, HMR, Finder
environment lookup, agent mentions or microphone permission. Those real-project
and packaged-app checks remain in W5's manual gate.

### W5 local installation

- `electron-builder.config.mjs` produces an Apple Silicon DMG and an ad-hoc signed
  app, with the existing Auis icon and the frozen `design.auis.desktop` identity.
  Only the bundled app and package metadata are included; dev dependencies and
  source maps stay out. `dist` never publishes anything.
- `verify:mac` checks metadata, arm64 architecture and `codesign --verify --deep
  --strict`. `smoke:packaged` runs all four Electron scenarios against the signed
  archive. These gates passed locally, as did `hdiutil verify` for the DMG.
- Installed `/Applications/Auis Design.app` and opened it through Launch Services.
  The launcher rendered and found the user's Node, npm, Git, Claude Code and Codex.
- The [tester README](README.md) records the install/build commands and remaining
  checks. Real-project HMR, agent mentions and microphone interaction are still
  unverified. W5's full manual gate is therefore not marked complete.

## After v1

1. **The skills read the dev lock** instead of assuming port 3000. Independent of the
   app, and it removes the port hazard for everyone.
2. **Public distribution:** Developer ID, notarization, `electron-updater` with GitHub
   Releases, x64 or universal, a release workflow, a download page on the site.
3. **Remote workspace:** open a hosted URL in the same window.
4. **`auis init` from the app**, and an **agent panel**.
