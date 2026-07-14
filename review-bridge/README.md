# Auis Review Bridge

Local backend that stores the **Review Mode** (Auis) visual comments
and exposes them to agents running on the same machine. Since commit
`2f7dd24e` the bridge went **serverless**: the routes live inside Next at
`/api/review-bridge/*` (same-origin), with no token and no `.env`. The data still
lives in the same JSON files in `review-bridge/data/` — only the shell changed.

> **How to start it:** `npm run dev` at the root already brings everything up. No token
> needed, no `.env.local` needed, no second process needed.
>
> **Opt-in legacy mode:** `npm run dev:bridge` still exists and brings up the standalone
> Express server on `:9878` alongside Next (old config:
> `NEXT_PUBLIC_AUIS_REVIEW_BRIDGE_URL=http://127.0.0.1:9878`). Use it only if you
> have a specific reason to run the bridge outside Next — it is not the recommended
> source and the Express `src/` no longer gets new features.

---

## Lifecycle of a comment

```
                          ┌─────────────────────────────────────┐
                          │                                     │
                          ▼                                     │
  (creates pin/drawing)  open  ──── transition: in_review ─►  in_review
                          │                                     │
                          │ transition: resolve_direct          │ transition: approve
                          │ (user marks it as resolved)         │ (user approves the review)
                          │                                     │
                          └─────────►  resolved  ◄──────────────┘
                                          │
                                          │ comments.archive.json
                                          │
                                          ▼
                                     (archived — outside the default listing)

  in_review  ── transition: reject ──►  open       (reject: back to active)
  resolved   ── transition: reopen_from_archive ──►  open  (unarchive)
```

**Summary:**

- `open` → active comment, nobody has claimed to resolve it yet.
- `in_review` → some **agent** or **user** claimed to resolve it and it is waiting for human approval. It lives in the same file as the open ones.
- `resolved` → approved. It **physically leaves** `comments.json` and goes to `comments.archive.json`.

The physical file split exists so that **agents that read the JSON for context** only see comments still in play — without reading hundreds of already-resolved comments that leak into the context window.

---

## Data files

| File | Content | When to read |
|---|---|---|
| `data/comments.json` | comments with status `open` and `in_review` + reviewer identities | always |
| `data/comments.archive.json` | comments with status `resolved` (archived) | only when you need to look up history |

`schemaVersion = 3`. Both the serverless backend (`app/api/review-bridge/_store.ts`)
and the legacy Express write in this format. If you still have v2 data lying
around, see the [v2 → v3 migration](#v2--v3-migration) section — in the standard flow the
migration happened a long time ago.

---

## HTTP API

Local base URL: `http://127.0.0.1:3000/api/review-bridge` (default port of
`next dev`; if you ran it with `PORT=xxxx`, swap it). **No token, no custom
header** — it is a Next route like any other in the app.

### Listing

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | `{ ok, service, mode: "serverless", schemaVersion: 3, tokenRequired: false }` — used by the skills (`solve`, `germano-*`) to confirm the serverless bridge is up before operating |
| `GET` | `/version` | `{ signature }` — signature derived from the `mtime` of the two JSON files. Used by the overlay as cheap polling (4s) to detect external writes (an agent skill edited while the user had the overlay open). **Replaces the old SSE** |
| `GET` | `/comments?url=&status=` | Active ones. `status` accepts `open` or `in_review`. Resolved ones **do not come out here** |
| `GET` | `/comments/archive?url=&before=&limit=` | Archive, paginated by an `updatedAt` cursor |
| `GET` | `/comments/:id` | Returns `{ comment, location: "main" \| "archive" }` |

### Modification

| Method | Path | Notes |
|---|---|---|
| `PUT` | `/comments/:id` | **Upsert mode** (the body is a complete `ReviewComment`) — creates/edits text, anchor, author. **Transition mode** (body with `{ transition, actor }`) — see below |
| `POST` | `/comments/:id/replies` | Adds a reply. Works on comments in main and in the archive |
| `DELETE` | `/comments/:id` | Removes it entirely (main or archive) |

### Transitions (`PUT /comments/:id` mode with `transition`)

| `transition` | Effect | `actor` required? |
|---|---|---|
| `in_review` | open → in_review, populates `resolution` with the formatted string | yes |
| `approve` | in_review → resolved, moves it to the archive, populates `resolution.approvedAt/approvedBy` | yes (whoever approved) |
| `reject` | in_review → open, clears `resolution`. Replies preserved | no |
| `resolve_direct` | open → resolved directly (the user marked it with no agent in between). Moves it to the archive | yes |
| `reopen_from_archive` | resolved → open, moves it from the archive to main | no |

Error `400 { error: "invalid_actor" }` when the `actor` is required and is missing/malformed.

### Others

| Method | Path | |
|---|---|---|
| `PUT` | `/identity/:id` | Upsert of the reviewer identity |
| `GET` | `/export` | Full snapshot: `comments[]` + `archivedComments[]` |
| `POST` | `/import` | Snapshot merge (skips duplicate IDs) |

> **SSE is gone.** The old Express server exposed `GET /events` as an SSE
> stream. In serverless mode Next does not keep an open connection per client — the
> overlay polls `/version` every 4s and only fires `onChange` when the
> signature changes. That is enough because the external writes come from the skills
> (occasional batches), not from another human editing live.

---

## How agents resolve comments

When the user asks to "resolve that one", **do NOT call the legacy upsert endpoint**.
Use the `in_review` transition — the user approves or rejects it afterward from the inbox.

```bash
curl -X PUT "http://127.0.0.1:3000/api/review-bridge/comments/$ID" \
  -H "Content-Type: application/json" \
  -d '{
    "transition": "in_review",
    "actor": { "kind": "agent", "id": "claude", "name": "Claude" }
  }'
```

Response:

```json
{
  "ok": true,
  "location": "main",
  "comment": {
    "id": "cmt-...",
    "status": "in_review",
    "resolution": {
      "actor": { "kind": "agent", "id": "claude", "name": "Claude" },
      "at": 1779800744000,
      "summary": "Resolvido por Claude em 20/05/2026 às 16:05:44."
    },
    ...
  }
}
```

The `resolution.summary` field is **always** a string in the format:

```
Resolvido por <name> em DD/MM/YYYY às HH:MM:SS.
```

Agents that read this JSON later will know exactly who claimed to resolve it and when. Use the server timezone (the clock of the machine running Next).

---

## How agents reply to comments

Use the replies endpoint when you have a doubt, an opinion or a question before
resolving — the user sees the whole thread on the card.

```bash
curl -X POST "http://127.0.0.1:3000/api/review-bridge/comments/$ID/replies" \
  -H "Content-Type: application/json" \
  -d '{
    "authorKind": "agent",
    "authorId": "claude",
    "authorName": "Claude",
    "authorColorToken": "var(--au-purple-600)",
    "text": "Before pinning this down, do you prefer a primary or a ghost button?"
  }'
```

Response: `{ "reply": {...}, "location": "main" | "archive" }`.

Replies work on any comment, regardless of status (even archived ones — useful for leaving a note about an old decision).

---

## How agents read only what matters

| Scenario | Suggested endpoint |
|---|---|
| Work on the **open** comments of the page the user is on | `GET /comments?url=/path/of/the/page&status=open` |
| Review the queue of what **you (the agent)** already marked as in review | `GET /comments?status=in_review` |
| Look at the history of a specific page | `GET /comments/archive?url=/path&limit=20` |

> Do not fetch `GET /comments` with no filter unless you really do need all the
> active ones. The archive does not come by default — call `/comments/archive` explicitly.

### Visual context of the target

New comments may carry an optional `context` field, captured at the
moment the pin or drawing was created. It exists to reduce ambiguity
in short instructions like "remove this":

```json
{
  "context": {
    "pageUrl": "/auis/styleguide/components/buttons",
    "pageTitle": "Auis",
    "target": {
      "tag": "button",
      "role": "button",
      "label": "Salvar",
      "text": "Salvar",
      "selector": "body > main:nth-of-type(1) > ...",
      "fingerprint": { "tag": "button", "text": "Salvar" },
      "attributes": { "type": "button", "ariaLabel": "Salvar" },
      "rect": { "x": 420, "y": 216, "width": 88, "height": 32 },
      "pointer": { "fx": 0.48, "fy": 0.52 }
    },
    "nearbyText": ["Cancelar", "Salvar alterações"]
  }
}
```

When resolving, use `context.target.text`, `label`, `attributes`, `fingerprint` and
`nearbyText` to map the comment to the snippet of code before editing. The
coordinates remain visual support only; do not treat `rect` as a pixel-perfect
contract.

---

## v2 → v3 migration

Anyone who ran the bridge at any point after the migration already has the files in
v3 format — this section is historical. What changed:

1. `schemaVersion: 2` → `3` in `data/comments.json` and `data/comments.archive.json`.
2. `"resolved"` statuses that were in main migrate to the archive.
3. `resolvedBy: "Alex"` + `resolvedAt: 1779...` become:
   ```json
   {
     "resolution": {
       "actor": { "kind": "user", "id": "legacy", "name": "Alex" },
       "at": 1779...,
       "summary": "Resolvido por Alex em DD/MM/YYYY às HH:MM:SS."
     }
   }
   ```
4. Comments with no `resolvedBy` that were `resolved` get `actor = { kind: "user", id: "legacy", name: "unknown" }`.

In the serverless backend the `_store` has no migration step — it assumes v3 on
read and forces `schemaVersion: 3` on write. If you need to migrate v2 data today,
bring up the legacy Express (`npm run dev:bridge`) once: its v2→v3 migration is
idempotent and runs at boot.

Rollback: v2 had no concept of an archive, so a downgrade would require merging
the two files back and rewriting `resolvedBy`/`resolvedAt` as flat strings.
**There is no automated script** — keep a backup before downgrading.

---

## Troubleshooting

Common problems:

| Symptom | Cause | Where to check |
|---|---|---|
| `ECONNREFUSED 127.0.0.1:3000` on any bridge route | `next dev` is not running | start `npm run dev` at the root |
| `404` on `/api/review-bridge/...` | you hit the wrong route (an old Express path?) or Next has not compiled that route yet | check the path in `app/api/review-bridge/` |
| Overlay talking to `:9878` instead of same-origin | an old `.env.local` with a cached `NEXT_PUBLIC_AUIS_REVIEW_BRIDGE_URL=http://127.0.0.1:9878` | delete the line from `.env.local` and restart `npm run dev` |
| `EADDRINUSE :9878` when running `npm run dev:bridge` | the legacy Express port is taken | `lsof -i :9878` — usually an old instance; kill it and start it again |
| Overlay does not update when a skill writes to the JSON | the `/version` polling stopped or hot-reload froze | reload the tab; as a last resort restart `next dev` |
| Comment "disappears" after approving | it went to the archive — expected | `GET /comments/archive` |
| The agent claimed to resolve it but the user does not see it in review | the request is missing `actor.kind === "agent"` | inspect the curl |

---

## Actor identity conventions

- `kind: "user"` — human reviewer. The `id` is the `ReviewIdentity.id` (UUID generated by the overlay on first use) and the `name` is the name the user chose.
- `kind: "agent"` — any automated client. Use a stable id per agent type (`claude`, `claude-haiku`, `cursor`, etc.) and a human-readable `name`.

For Claude Code, the recommended default is:

```json
{ "kind": "agent", "id": "claude", "name": "Claude" }
```

If you are a different agent, change the `id` and `name`. The `colorToken` is optional in replies — default `var(--fg-tertiary)`.
