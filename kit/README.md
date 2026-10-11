# kit — the Review Bridge as packages

The Review Bridge (pins, comments, the drawer, the agent mentions) split into four
packages, so it can be installed into an app that is not Auis:

| Package | Folder | What it is |
|---|---|---|
| [`@auis/core`](core) | `kit/core` | The shared domain: comment types, agents, the `@`/`/` command parser, DOM anchoring. No dependencies. |
| [`@auis/server`](server) | `kit/server` | The server, with no framework in it: `createReviewHandler()` → `handle(Request): Promise<Response>`, the disk store, backups, the mention runner (`auis-mention-run`). |
| [`@auis/ui`](ui) | `kit/ui` | The review chrome, with its own scoped CSS, for any React 18+ app. |
| [`@auis/next`](next) | `kit/next` | The Next.js App Router adapter: `createReviewRoute()` for a catch-all route, `<AuisReview />` for the root layout. |

An app installs them with one command, which adds only `@auis/next`:

```bash
npx @auis/cli@latest init
```

**Inside this repository** the Auis app consumes the packages from source
(`kit/<name>/src`, through `tsconfig` paths), so a change here shows up in the
app at once. `dist/` exists only to publish: `npm run kit:build` (or
`npm pack` / `npm publish` in a package folder, whose `prepack` builds it).

How this came to be, what is decided and what is next:
[`docs/review-bridge-packages-plan.md`](../docs/review-bridge-packages-plan.md).
Releasing: [`docs/RELEASING.md`](../docs/RELEASING.md).
