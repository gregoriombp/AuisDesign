---
name: auis-review-bridge
description: >
  Explains that the Auis Review Mode bridge is now serverless and
  embedded in the Next app at `/api/review-bridge/*` — `npm run dev` already
  brings everything up, there is no separate process to start, no token,
  no env. Use this skill only when the user explicitly asks to
  "/auis-review-bridge", "start the review-bridge", spin up the review
  bridge, "turn on the comments server", open the review-bridge,
  "/review-bridge", or similar — to redirect them and (only if they
  explicitly want the old Express) explain the opt-in legacy bridge via
  `npm run dev:bridge`. Does NOT resolve comments — for that, see
  `auis-review-bridge-solve`.
---

# Auis Review Mode — Bridge (serverless)

The review-bridge **went serverless** (commit `2f7dd24e`, 24/06/2026). The
endpoints now sit same-origin inside Next itself at `/api/review-bridge/*`,
writing to the same JSONs as always (`review-bridge/data/comments.json` and
`comments.archive.json`) with atomic writes and a global lock in
`app/api/review-bridge/_store.ts`.

**There is nothing to start manually.** `npm run dev` at the root already brings
everything up. No token, no `AUIS_REVIEW_TOKEN`, no bridge `NEXT_PUBLIC_*`.

When the user asks to "start the review-bridge", the right answer is to
redirect them, in one short message:

> The bridge now runs inside Next, in the same `npm run dev` you already
> use. There is no separate server and no token. If Review Mode is not
> responding, confirm that Next is at `http://127.0.0.1:3000`.

## Confirm health (when you want to diagnose)

```bash
curl -s http://127.0.0.1:3000/api/review-bridge/health
```

Expected:

```json
{
  "ok": true,
  "service": "auis-review-bridge",
  "mode": "serverless",
  "schemaVersion": 3,
  "tokenRequired": false
}
```

If this fails, the problem is Next (it went down, it is on another port, or it
never started). There is no separate bridge process to investigate.

## Constraints

- ❌ Do not recreate `review-bridge/.env`, do not regenerate a token, do not write
  `NEXT_PUBLIC_AUIS_REVIEW_BRIDGE_URL` or
  `NEXT_PUBLIC_AUIS_REVIEW_TOKEN` into `.env.local`. Those envs only
  enable the legacy mode below — in serverless they make the frontend
  point at the dead Express on `:9878`.
- ❌ Do not delete `review-bridge/data/comments.archive.json` "to clean up" —
  it is the source of Review Mode's Archived tab.
- ❌ Do not expose Next on `0.0.0.0` and do not set up port forwarding. The flow is
  local-only.

## Legacy mode (Express) — opt-in, only if the user asks

The old server at `review-bridge/src/index.ts` still exists, but as an
opt-in. Use it **only if the user explicitly asks for the Express**
(compare behavior, test with another instance, etc.):

```bash
npm run dev:bridge
```

That script runs `concurrently` and brings up two things:

1. Next with `NEXT_PUBLIC_AUIS_REVIEW_BRIDGE_URL=http://127.0.0.1:9878`
   in the process env (without touching the tracked `.env.local`).
2. Express on `127.0.0.1:9878`, after `review-bridge:prepare` takes care
   of the token and the envs.

To verify:

```bash
TOKEN=$(grep AUIS_REVIEW_TOKEN review-bridge/.env | cut -d= -f2)
curl -s -H "X-Review-Token: $TOKEN" http://127.0.0.1:9878/health
```

Both modes read/write the same JSON files in `review-bridge/data/`,
so the state is shared — only who answers the endpoints changes.

> **Gotcha:** if you write `NEXT_PUBLIC_AUIS_REVIEW_BRIDGE_URL` into
> `.env.local` (tracked), the frontend keeps hitting `:9878` even on a
> normal `npm run dev`. Keep those envs out of `.env.local`. The
> `dev:bridge` injects them into the process via `concurrently`, with no
> file needed.

## Do not use this skill to

- Resolve/approve/reply to comments in bulk → `auis-review-bridge-solve`
- Audit what the agent sent for review → `auis-review-bridge-germano-audit`
- Patrol pages and drop new pins → `auis-review-bridge-germano-explore`
