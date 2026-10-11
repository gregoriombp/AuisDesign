# Releasing the installer and the kit

`npx @auis/cli@latest my-product` and `npx @auis/cli@latest init` are served by
six npm packages that live in this repository:

| Package | Directory | Status | Why it exists |
|---|---|---|---|
| [`@auis/cli`](https://www.npmjs.com/package/@auis/cli) | `packages/auis` | published | The CLI. `npx @auis/cli@latest` resolves this name; the binary it installs is still called `auis`. |
| `create-auis` | `packages/create-auis` | not published | Alias so `npm create auis@latest` works. Depends on `@auis/cli`. |
| [`@auis/core`](https://www.npmjs.com/package/@auis/core) | `kit/core` | published (0.1.0) | The Review Bridge's shared domain. |
| [`@auis/server`](https://www.npmjs.com/package/@auis/server) | `kit/server` | published (0.1.0) | The Review Bridge server, and the `auis-mention-run` bin. |
| [`@auis/ui`](https://www.npmjs.com/package/@auis/ui) | `kit/ui` | published (0.1.0) | The review chrome. |
| [`@auis/next`](https://www.npmjs.com/package/@auis/next) | `kit/next` | published (0.1.0) | The Next.js adapter — the one dependency `auis init` adds to an app. |

The unscoped name `auis` is **not** ours and never was: npm rejects names it
considers too similar to an existing package, and only says so at publish
time, so the CLI shipped under the `@auis` scope instead (scoped names skip
that check). `npx auis@latest` 404s — never document it.

The Next.js app at the repository root is **never** published (`"private": true`).
The CLI does not bundle the template — it downloads this repository as a tarball
at run time — so **a change to the app ships the moment it lands on `main`**. Only
changes under `packages/` need a release.

## Versioning

The CLI version is its own thing; it does not track the template. Bump
`packages/auis/package.json`:

- **patch** — fixes inside the CLI;
- **minor** — new flags, subcommands or scaffold behaviour (e.g. `doctor`, a change to `PRUNE`);
- **major** — a flag or default that breaks existing invocations.

`create-auis` pins `@auis/cli` with a caret range. On `0.x` a caret only floats
within the minor (`^0.2.0` means `0.2.x`), so until `1.0.0` re-release
`create-auis` whenever `@auis/cli` bumps its minor, and whenever its own `bin`
changes.

## The kit (`@auis/core`, `server`, `ui`, `next`)

The four kit packages share one version, bumped together in every
`kit/*/package.json` (and in the `^x.y.z` ranges they declare on each other).
`KIT_VERSION` in `packages/auis/src/install.mjs` is the range `init` writes; a
test fails when it differs from `kit/next/package.json`. So a kit release that
`init` should install is also a CLI release.

Each package's `prepack` builds its `dist/` (`kit/scripts/build.mjs`: tsc, file
by file, then `.js` added to relative imports and `chrome.css` copied), so
`npm publish` from the folder is all it takes. Order matters, because each one
depends on the ones before it, and `init` writes a version that has to exist:

```bash
npm whoami || npm login
cd kit/core   && npm publish --access public
cd ../server  && npm publish --access public
cd ../ui      && npm publish --access public
cd ../next    && npm publish --access public
cd ../../packages/auis && npm publish --access public
```

npm asks for the owner's 2FA in the browser on each publish. Check a tarball
before the first real publish with `npm pack --dry-run` in the folder.

To try a release end to end without publishing, publish to a local registry
(Verdaccio) with a throwaway `--userconfig`, then run `init` in a scratch copy
of a host with `npm_config_userconfig` pointing at it. That is how wave 3 was
validated (`docs/review-bridge-packages-plan.md`).

## Publishing the CLI

The repository secret `NPM_TOKEN` is an npm **automation** token for an account
that owns the `@auis` scope (*Settings → Secrets and variables → Actions*).

1. Bump the version, commit, push.
2. Actions → **Publish CLI** → `package: auis` (the directory; it publishes
   `@auis/cli`), `dry-run: true`, run it, read the packed file list, then run it
   again with `dry-run: false`.
3. For the alias, repeat with `package: create-auis` — always **after** the
   `@auis/cli` version it depends on is live. The unscoped `create-auis` name is
   still unclaimed; if npm refuses it, publish it as `@auis/create` instead,
   which makes the command `npm create @auis my-product`, and update the docs
   accordingly.

Then verify from a clean directory:

```bash
npx @auis/cli@latest probe --no-install --no-git && rm -rf probe
npx @auis/cli@latest doctor . --json > /dev/null        # reads, writes nothing
npm create auis@latest probe -- --no-install --no-git && rm -rf probe   # once create-auis is published
```

Before a release, locally:

```bash
npm run test:cli                                          # unit tests
node packages/auis/bin/auis.mjs /tmp/probe --no-install    # end-to-end, ~1s
node packages/auis/bin/auis.mjs doctor /tmp/probe          # doctor on the result
```

Publishing locally works too, from `packages/auis`: `npm publish --access public`.

## What ships

`files` in each `package.json` limits the tarball to `bin/`, `src/` and the
README. Check it before a real publish:

```bash
cd packages/auis && npm pack --dry-run
```

The CLI has **zero runtime dependencies**, so `npx` starts in about a second.
Keep it that way.

## History

- `@auis/cli@0.1.0` (2026-09-15) — scaffold only. It predates `doctor`: on that
  version `npx @auis/cli doctor` scaffolds into a directory named `doctor`.
- `0.2.0` — first version with `doctor`. Publish it before pointing anyone at
  the `doctor` docs.
- `0.2.1` — `doctor` no longer tells a server-less host to run `npx @auis/server`,
  a package that was never published.
- `0.2.2` — `doctor` marks every capability that lives in the builder chrome
  (Review, Edit, flow driver, State Mode) unsupported when the host has no
  React 18+, and names the host's UI library (Vue, Svelte…) as the reason.
- `0.3.0` — `init` installs Review into an existing Next.js App Router app
  (`@auis/next@^0.1.0`) and `uninstall` reverses it. **Breaking:** `init` is no
  longer a name for create — `npx @auis/cli init my-app` now refuses a folder
  with no `package.json` and points to `npx @auis/cli my-app`. `doctor` prints
  the plan `init` carries out, and only promises a shared comment queue where
  `init` can mount one. `create-auis` needs a re-release with `^0.3.0`.
