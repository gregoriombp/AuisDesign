# Releasing the installer

`npx @auis/cli@latest my-product` is served by two npm packages that live in this
repository:

| Package | Directory | Status | Why it exists |
|---|---|---|---|
| [`@auis/cli`](https://www.npmjs.com/package/@auis/cli) | `packages/auis` | published | The CLI. `npx @auis/cli@latest` resolves this name; the binary it installs is still called `auis`. |
| `create-auis` | `packages/create-auis` | not published | Alias so `npm create auis@latest` works. Depends on `@auis/cli`. |

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

## Publishing

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
