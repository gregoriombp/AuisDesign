# @auis/server

The [Auis](https://github.com/gregoriombp/AuisDesign) Review Bridge server with
no framework in it: one `handle(Request): Promise<Response>` for every endpoint
under `/api/review-bridge`, a JSON store on disk, per-project backups, and the
agent mention trigger.

```ts
import { createReviewHandler } from "@auis/server"

const handle = createReviewHandler({ dataDir: ".auis/data" })
// any server that speaks Request/Response: return handle(request)
```

For Next.js use [`@auis/next`](https://www.npmjs.com/package/@auis/next), which
wraps this in a route — or run `npx @auis/cli@latest init`.

## The mention runner

`auis-mention-run <commentId> <agent[,agent]>` is the bin the route spawns when
an admin's comment mentions `@Claude` or `@Grok` (with `AUIS_MENTION_TRIGGER=1`,
never in production). It runs the agent's CLI under the ceiling in the agent
settings (`GET`/`PUT /api/review-bridge/agent-settings`; Claude starts on, with
the `edit` ceiling; Grok off) and posts its reply in the thread. It only talks
to a bridge on this machine. `MENTION_DRY_RUN=1` prints what it would run.

The prompt it gives the agent is `bin/mention-prompt.md`; a project replaces it
with its own `.auis/mention-prompt.md`.

Node 20+. MIT.
