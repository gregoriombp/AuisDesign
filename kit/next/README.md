# @auis/next

Plugs the [Auis](https://github.com/gregoriombp/AuisDesign) Review Bridge into a
Next.js App Router app: visual comments pinned to any element of your pages, a
drawer to triage them, and `@Claude` / `@Grok` mentions that open the agent on
your machine.

The easy way, from your app's root:

```bash
npx @auis/cli@latest init
```

That writes the two pieces below, records them in `.auis/manifest.json`, and
`npx @auis/cli@latest uninstall` takes them back out.

## By hand

The route — `app/api/review-bridge/[...path]/route.ts`:

```ts
import { createReviewRoute } from "@auis/next"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const route = createReviewRoute({ dataDir: ".auis/data" })
export const GET = route.GET
export const POST = route.POST
export const PUT = route.PUT
export const PATCH = route.PATCH
export const DELETE = route.DELETE
```

`runtime` and `dynamic` have to be literal in your file: Next reads them
statically. The URL must stay `/api/review-bridge`: the chrome, the agents and
the mention runner all call it.

The chrome — in `app/layout.tsx`, just before `</body>`:

```tsx
import { AuisReview } from "@auis/next/client"

<AuisReview />
```

`<AuisReview />` brings the chrome's scoped styles, its fonts (Geist and
Material Symbols Rounded, linked only when the page lacks them; pass
`loadFonts={false}` to skip) and its own Suspense boundary. Open Review from the
pill at the bottom of the page or with ⌘⇧Y.

## Options

`createReviewRoute(options)`:

| Option | Default | |
|---|---|---|
| `dataDir` | `<cwd>/review-bridge/data` | Where `comments.json`, the archive and the images live. `init` passes `.auis/data`. |
| `backupDir` | `~/.auis/review-bridge-backups/<project>` | Snapshots. `<project>` is a hash of the working directory, so each app only ever restores its own. |
| `mentionRunner` | the installed `@auis/server/bin/mention-run.mjs` | What a mention spawns. |
| `basePath` | `/api/review-bridge` | |

Mentions only fire with `AUIS_MENTION_TRIGGER=1`, never in production, and
only for an admin's comment.

Requires Next.js 14+ and React 18+. MIT.
