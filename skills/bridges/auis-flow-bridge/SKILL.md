---
name: auis-flow-bridge
description: >
  [OBSOLETE] The styleguide UX flow editor went serverless — suggestions now
  go to a same-origin route (/api/flow-suggestions) that writes to
  flow-bridge/data/suggestions.json, with no separate server, no token, and no
  env. There is nothing left to "start up". Use this skill only when the user
  asks to "/auis-flow-bridge", "start the flow-bridge", "turn on the
  suggestions server", start the flows bridge, or "/flow-bridge" — to explain
  it is no longer needed and redirect them. To apply suggestions in bulk, use
  `auis-flow-bridge-solve`.
---

# Auis Flow Bridge — nothing left to start

The suggestion flow of the UX flows (`/auis/styleguide/ux-flows/*`)
**no longer depends on a separate server**. Cutover done: the
"Sugerir edição" button is **always active** and "Salvar" writes straight through a
route in Next itself.

- **Route:** `app/api/flow-suggestions/` (GET/POST/PUT/DELETE), same origin
  as the app, **no auth**.
- **Persistence:** `flow-bridge/data/suggestions.json` (+
  `suggestions.archive.json`) — the same files as before, so the
  history carries over and the `auis-flow-bridge-solve` skill keeps reading
  from there.
- **"Copiar prompt"** remains a 100% client-side fallback (paste it into the chat).

## What to do when they call you

If the user asks to "start the flow-bridge":

1. Explain that it is **no longer needed** — the editor is serverless now.
2. Confirm that the team's dev server (`npm run dev`) is up — that is where the
   `/api/flow-suggestions` route lives. If it is, everything is ready: open
   any `/auis/styleguide/ux-flows/*` and use "Sugerir edição".
3. To apply suggestions that already came in, point to
   `auis-flow-bridge-solve`.

> The Express server in `flow-bridge/` has been **retired** (it stays in the repo
> only because it owns the `data/` folder). The `dev` script **no longer** starts it, and
> the `NEXT_PUBLIC_AUIS_FLOW_*` envs are now unused.
