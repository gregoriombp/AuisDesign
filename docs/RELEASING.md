# Releasing the CLI

`npx @auis/cli my-product` is served by one npm package that lives in this
repository: [`packages/cli`](../packages/cli), published as
[`@auis/cli`](https://www.npmjs.com/package/@auis/cli) under the `auis`
organization.

The Next.js app at the repository root is **never** published (`"private": true`).
The CLI does not bundle the template — it downloads this repository as a tarball
at run time — so **a change to the app ships the moment it lands on `main`**. Only
changes under `packages/cli` need a release.

> **Why the scope.** The unscoped name `auis` is rejected by npm: "Package name
> too similar to existing packages auto, ansis, is, ai, args, axios, uid, uuid,
> cuid". Scoped names skip that check, and `@auis/*` reserves the namespace for
> whatever ships next to the CLI.

## Versioning

The CLI version is its own thing; it does not track the template. Bump
`packages/cli/package.json`:

- **patch** — fixes inside the CLI;
- **minor** — new commands or flags, or a change to scaffold behaviour (e.g. `PRUNE`);
- **major** — a flag, command or default that breaks existing invocations.

## Publishing

npm requires 2FA to publish. The interactive `npm publish` opens a browser to
authenticate, which satisfies it; a token in CI needs to be a **granular access
token with bypass-2FA enabled**, stored as the repository secret `NPM_TOKEN`.

From a clean checkout of `main`:

```bash
cd packages/cli
npm publish --dry-run        # read the file list first
npm publish                  # publishConfig already sets access: public
```

Or run the **Publish CLI** workflow (Actions → Publish CLI), which defaults to a
dry run — untick it to publish for real. That workflow needs GitHub Actions to
be working for the account; see the note in the repository if CI is blocked.

Then verify from a directory outside the repository:

```bash
npx @auis/cli@latest probe --no-install --no-git && rm -rf probe
```

## What ships

`files` in `package.json` limits the tarball to `bin/`, `src/` and the README.
Check it before a real publish:

```bash
cd packages/cli && npm pack --dry-run
```

The CLI has **zero runtime dependencies**, so `npx` starts in about a second.
Keep it that way.
