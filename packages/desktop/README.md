# Auis Design for Mac — local test build

Version 0.1.0 opens existing project folders, runs or attaches to their dev server,
and shows the product in a Mac window. New-project creation is still W4 in
[the plan](PLAN.md).

## Install and open

This build is for Apple Silicon Macs. The bundle declares macOS 13 or later; the
local installation was exercised on macOS 27.2.1. Node and the project's package
manager must already be installed. Auis uses the environment from your shell;
it does not bundle Node, Git, Claude Code or Codex.

1. Open `release/Auis-Design-0.1.0-arm64.dmg`.
2. Drag **Auis Design** into **Applications**.
3. Open **Auis Design** from Applications or Spotlight.
4. Choose **Open folder** and select an existing project with a `dev` script.

The app is ad-hoc signed for local testing. It is not notarised and has no
automatic updater. Developer ID signing and public distribution remain a later
step. Do not disable Gatekeeper to run a copy macOS refuses to open.

Closing a project stops only a server started by Auis. A server started in a
terminal is left running. Closing the last window keeps the Mac app in the Dock;
**Quit Auis Design** exits it. Project records live in the app's macOS Application
Support directory; removing the app does not delete project folders.

## Build and verify

Run these commands on an Apple Silicon Mac from the repository root:

```sh
npm ci --prefix packages/desktop
npm --prefix packages/desktop run dist
npm --prefix packages/desktop run verify:mac
npm --prefix packages/desktop run smoke:packaged
```

`dist` creates the signed `.app` in `release/mac-arm64/` and the `.dmg` in
`release/`. `pack:mac` creates just the app. The build uses the existing Auis mark
from `app/icon.svg`, includes only the bundled `dist` files and package metadata,
and excludes source maps, tests and development dependencies. It never publishes
a release.

`verify:mac` checks the bundle ID, version, architecture, icon, microphone usage
description and deep/strict ad-hoc signature. To verify an installed copy:

```sh
npm --prefix packages/desktop run verify:mac -- '/Applications/Auis Design.app'
```

`smoke:packaged` runs the W3 scenarios against the actual signed `app.asar` bundle,
with temporary projects and an isolated profile. Evidence is saved to
`output/smoke-packaged/`. The macOS CI job also builds, verifies and exercises this
bundle for same-repository PRs and main pushes, without signing credentials.
Fork PRs still run the unpackaged smoke. The HTTP fixture covers lifecycle and chrome behaviour; it is not a real
Next.js or agent integration test.

## Manual checks before wider testing

Local results recorded on 14 November 2026:

| Check | Result |
|---|---|
| DMG integrity and deep/strict app signature | Passed |
| Packaged Electron smoke, four scenarios | Passed |
| Install into Applications and open through Launch Services | Passed |
| Find Node, npm, Git, Claude Code and Codex after that launch | Passed |
| Open a real Next.js project and observe HMR after an edit | Still to check |
| Complete an agent mention from a real project | Still to check |
| Request microphone permission and exercise voice input | Still to check |

The bundle includes microphone/camera usage descriptions and the corresponding
runtime entitlements. Permission is still decided by macOS and the user; packaging
those declarations does not prove that a permission prompt or voice input worked.
