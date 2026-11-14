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
| W1 | The look: the app's own chrome (toolbar, launcher) as a real renderer, in the current Auis visual direction | next |
| W2 | Core: `env`, `detect`, `nextLock`, `server` (the supervisor), `projects`, `workspace`, with unit tests and a CI job | not started |
| W3 | Launcher and project window wired to the core; `security.ts`; Playwright-Electron smoke | not started |
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
- **The look follows the current Auis visual direction**, taken from where the newest
  version of the Auis chrome lives. W1 starts by reading that reference and writing
  the direction down here before any UI is built.

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
- **The app's identity is frozen:** product name `Auis`, bundle id
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

## Architecture

```
packages/desktop/
  scripts/build.mjs        esbuild: main (node, cjs); preload and renderer join in W1
  src/shared/app.ts        product name and bundle id
  src/shared/ipc.ts        (W1) channel names and payload types
  src/shared/workspace.ts  (W2) {kind:'local',path} | {kind:'remote',url}; isAllowedNavigation()
  src/main/env.ts          the user's shell environment for a folder
  src/main/nextLock.ts     Next's dev lock: read, validate, liveness
  src/main/detect.ts       (W2) what kind of project a folder is; package manager; deps installed
  src/main/server.ts       (W2) the supervisor: state machine, logs, install, restart
  src/main/projects.ts     (W2) the persisted project list
  src/main/cli.ts          (W4) arguments for `npx @auis/cli`
  src/main/security.ts     (W3) app:// protocol, sender validation, navigation and permission guards
  src/main/windows/        (W3) launcher.ts, project.ts
  src/main/index.ts        lifecycle
  src/preload/chrome.ts    (W1) contextBridge → window.auisDesktop
  src/renderer/            (W1) one bundle, two HTML entries: launcher, toolbar
  test/                    (W2) node --test
```

Modules under `src/main/` other than `index.ts`, `security.ts` and `windows/` do not
import `electron`, so they run under `node --test`. Nothing Node- or
Electron-flavoured goes into `kit/ui` (`kit/__tests__/boundaries.test.ts`).

### The supervisor (W2 hardens what W0 does inline)

1. **Folder** missing → `folder-missing` (Locate / Remove).
2. **Environment** from the user's shell, per folder: interactive login shell, then
   login shell, then a static PATH. Version managers switch Node by directory.
3. **Project** without a `dev` script → error. A scaffold has `package.json#auis`; a
   host has `.auis/manifest.json`.
4. **Node** missing or below `engines.node ?? >=20.9` → say which one was found, where.
5. **Attach** when the lock exists, its pid is alive and the port answers. Never stop
   an attached server.
6. **Dependencies** missing → `deps-missing`, with an Install action.
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
| W1 | The toolbar and the launcher render in the app, light and dark, from `app://auis/`; a screenshot of each is in the PR |
| W2 | `npm --prefix packages/desktop test` → `# fail 0`; the `desktop` job is green in CI |
| W3 | `npm --prefix packages/desktop run smoke` passes: open a fixture, Starting → Running, navigate from the toolbar, an external link leaves the view alone, no `require` in the page, logs show, kill → Crashed → Restart, quit leaves no process and no lock |
| W4 | New project ends on `/auis/welcome` |
| W5 | `npm --prefix packages/desktop run dist` → `release/Auis-0.1.0-arm64.dmg`; `codesign -dv` shows `Signature=adhoc`; `codesign --verify --deep --strict` exits 0; the manual list passes from a Finder launch |

W0's `--capture=<dir>` and `--quit-after=<ms>` exist only so that gate can run
unattended. The W3 smoke replaces them; remove them there.

## After v1

1. **The skills read the dev lock** instead of assuming port 3000. Independent of the
   app, and it removes the port hazard for everyone.
2. **Public distribution:** Developer ID, notarization, `electron-updater` with GitHub
   Releases, x64 or universal, a release workflow, a download page on the site.
3. **Remote workspace:** open a hosted URL in the same window.
4. **`auis init` from the app**, and an **agent panel**.
