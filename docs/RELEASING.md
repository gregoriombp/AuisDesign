# Releasing the installer

`npx auis@latest my-product` is served by two npm packages that live in this
repository:

| Package | Directory | Why it exists |
|---|---|---|
| [`auis`](https://www.npmjs.com/package/auis) | `packages/auis` | The CLI. `npx auis@latest` resolves this name. |
| [`create-auis`](https://www.npmjs.com/package/create-auis) | `packages/create-auis` | Alias so `npm create auis@latest` works. Depends on `auis` with a caret range, so it rarely needs a re-release. |

The Next.js app at the repository root is **never** published (`"private": true`).
The CLI does not bundle the template — it downloads this repository as a tarball
at run time — so **a change to the app ships the moment it lands on `main`**. Only
changes under `packages/` need a release.

## Versioning

The CLI version is its own thing; it does not track the template. Bump
`packages/auis/package.json`:

- **patch** — fixes inside the CLI;
- **minor** — new flags or scaffold behaviour (e.g. a change to `PRUNE`);
- **major** — a flag or default that breaks existing invocations.

Re-release `create-auis` only when its own `bin` changes or when it must require
a new major of `auis`.

## First publish

1. Create an npm **automation** token on an account that owns (or can claim) the
   `auis` and `create-auis` names.
2. Add it as the repository secret `NPM_TOKEN`
   (*Settings → Secrets and variables → Actions*).
3. Publish `auis` **first** — `create-auis` depends on it:
   Actions → **Publish CLI** → `package: auis`, `dry-run: true`, run it, read the
   packed file list, then run it again with `dry-run: false`.
4. Repeat with `package: create-auis`.

Both names were unclaimed when the CLI was written. npm also rejects names it
considers too similar to an existing package, and it only says so at publish
time — if `auis` is refused, publish as `@auis/cli` (scoped names skip that
check), point `create-auis`'s dependency at it, and update the `npx` line in the
README, `packages/auis/README.md` and `docs/GETTING-STARTED.md`.

Then verify from a clean directory:

```bash
npx auis@latest probe --no-install --no-git && rm -rf probe
npm create auis@latest probe -- --no-install --no-git && rm -rf probe
```

## Subsequent releases

```bash
npm run test:cli                                          # unit tests
node packages/auis/bin/auis.mjs /tmp/probe --no-install    # end-to-end, ~1s
# bump packages/auis/package.json, commit, push
```

Then run the **Publish CLI** workflow (dry run first). Publishing locally works
too, from `packages/auis`: `npm publish --access public`.

## What ships

`files` in each `package.json` limits the tarball to `bin/`, `src/` and the
README. Check it before a real publish:

```bash
cd packages/auis && npm pack --dry-run
```

The CLI has **zero runtime dependencies**, so `npx` starts in about a second.
Keep it that way.
