# Auis Review Bridge

Serverless backend of **Review Mode**: the same-origin routes under
`/api/review-bridge/*` persist the visual comments to the JSON files in
`review-bridge/data/` and expose them to the agents running on the same
machine. `npm run dev` already brings everything up — no second process, no
port, no token, no `.env`.

## Lifecycle of a comment

```
  (pin / drawing)  open  ── transition: in_review ─►  in_review
                    │                                   │
                    │ transition: resolve_direct        │ transition: approve
                    │ (an admin marks it as resolved)   │ (an admin approves the delivery)
                    │                                   │
                    └─────────►  resolved  ◄────────────┘
                                    │
                                    ▼  comments.archive.json (outside the default listing)

  in_review  ── transition: reject ──►  open
  resolved   ── transition: reopen_from_archive ──►  open
  open       ── PUT status "backlog" ──►  future idea (no pin, own tab)
```

- `open` — active, nobody claimed to resolve it yet.
- `in_review` — an **agent** or a **user** claimed to resolve it and it waits
  for approval. Same file as the open ones.
- `resolved` — approved. It physically leaves `comments.json` for
  `comments.archive.json`, so agents reading the JSON for context never load
  hundreds of finished comments.
- `backlog` — a "future idea": a standalone item or a comment parked for
  later. Never a pin on the canvas, never counted as open.

## Data files

| File | Content |
|---|---|
| `data/comments.json` | `open`, `in_review` and `backlog` comments + reviewer identities + per-agent settings |
| `data/comments.archive.json` | `resolved` comments |
| `data/images/<sha256>.<ext>` | Content-addressed attachments (comment and reply images are stored as `/api/review-bridge/images/<name>` refs, never as inline data URLs) |

`schemaVersion = 3`. Backups: before every write the store snapshots the
previous state to `~/.auis/review-bridge-backups/` (override with
`REVIEW_BRIDGE_BACKUP_DIR`) and restores from the latest snapshot when
`comments.json` vanished (clean checkout, reinstall).

## Hierarchy

Every request resolves a session on the server (`app/api/review-bridge/_session.ts`):

| Role | Who | Can |
|---|---|---|
| `admin` | The local dev server — Auis ships no auth provider, so every browser is an admin | Everything: comment, command agents, approve/reject/archive, private comments, agent toggles |
| `agent` | A request carrying a valid `x-bridge-agent-token` (skills, the dispatcher) when `BRIDGE_AGENT_TOKEN` is set | Reply and comment as an agent, move items to `in_review`; never approve/reject/delete |
| `reviewer` | Any other session once you plug an auth layer into `_session.ts` | Comment and reply; cannot command agents, change status or see `admins`-only comments |

The client mirrors the role through `GET /session` only to adapt the UI; the
permission is re-checked on every write.

## HTTP API

Base URL: `http://127.0.0.1:3000/api/review-bridge` (or whatever port `next dev` runs on).

### Read

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | `{ ok, service: "auis-review-bridge", mode: "serverless", schemaVersion: 3, tokenRequired: false }` |
| `GET` | `/version` | `{ signature }` derived from the files' mtime — the overlay polls it every 4s (only while the tab is visible) to detect external writes |
| `GET` | `/comments?url=&status=&origin=&flow=&authorRole=&view=` | Active comments. `status`: `open` · `in_review` · `backlog`. `origin`: `page` · `ux-flow` · `backlog`. `authorRole`: `admin` · `reviewer` (effective role). `view`: `preview` (id/url/status/text/counts, ~95% smaller) · `lean` (+ replies, target, resolution, no geometry) · `full` (default) |
| `GET` | `/comments/archive?url=&before=&limit=` | Resolved comments, paginated by an `updatedAt` cursor |
| `GET` | `/comments/:id?view=` | `{ comment, location: "main" \| "archive" }` |
| `GET` | `/dispatch-queue?url=` | Actionable items for the dispatcher (see below) |
| `GET` | `/agent-settings` | `{ settings: { [agentId]: { liveResponse, autoConstruct } } }` |
| `GET` | `/session` | `{ role, email, shared, authEnabled }` |
| `GET` | `/members` | Team directory (admin only) |
| `GET` | `/reviewers` | Mentionable humans with derived `@handle`s (60s cache) |
| `GET` | `/images/:name` | Serves a content-addressed attachment (immutable cache) |
| `GET` | `/export` | Full snapshot: `comments[]` + `archivedComments[]` |

### Write

| Method | Path | Notes |
|---|---|---|
| `PUT` | `/comments/:id` | **Upsert** (body = whole `ReviewComment`) or **transition** (body = `{ transition, actor }`). The server stamps `authorKind`/`authorRole`/`authorEmail`; an agent author (`x-bridge-agent-id` header or a known agent id) is canonicalized |
| `POST` | `/comments/:id/replies` | `{ authorKind, authorId, authorName, authorColorToken?, text, images? }` |
| `PATCH` | `/comments/:id/replies/:replyId` | `{ text, images? }` — edits a reply and stamps `editedAt` |
| `DELETE` | `/comments/:id` | Removes it (main or archive). Admin only |
| `PUT` | `/agent-settings` | `{ agentId, settings: { liveResponse, autoConstruct } }`. Admin only |
| `PUT` | `/identity/:id` | Upsert of a reviewer identity |
| `DELETE` | `/identity/:id` | Removes a member from the directory (their comments stay) |
| `POST` | `/import` | Snapshot merge, skips duplicate ids |

### Transitions

| `transition` | Effect | `actor` |
|---|---|---|
| `in_review` | open → in_review, writes `resolution.summary` | required; agents must be `claude` or `codex` (Germano is comment-only) |
| `approve` | in_review → resolved, moves to the archive, stamps `approvedAt/approvedBy` | required, `kind: "user"` |
| `reject` | in_review → open, clears `resolution` | required, `kind: "user"` |
| `resolve_direct` | open → resolved directly | required, `kind: "user"` |
| `reopen_from_archive` | resolved → open | required, `kind: "user"` |

## Agents

The toggles in the Auis dot are the permission — nothing else is needed in the
comment text:

- **Live Response** on → the agent replies in the thread when mentioned.
- **Auto Construct** (Auto Design / Auto Review) on → the agent acts: runs the
  mentioned skill (or the inferred one), moves the item to `in_review` and
  replies a summary.

`GET /dispatch-queue` encodes that gate once, server-side: open, user-authored
comments whose **admin** stream (the pin text + admin replies) mentions an
enabled agent, minus the ones the agent already answered after the latest
admin message. Agents never trigger each other. The
`auis-review-bridge-dispatch` skill consumes it under `/loop`.

Agents available: `@Claude` and `@Codex` (executors, run
`auis-review-bridge-solve`, `auis-ux-writing`, `auis-edit-bridge-solve`) and
`@Germano` (critical UI/UX opinion, comment-only —
`auis-review-bridge-germano-explore` / `-audit`).

### How a skill resolves a comment

1. `GET /health` — confirm `ok` and `schemaVersion === 3`.
2. `GET /comments?status=open&view=lean` — triage without downloading geometry.
3. Implement the change in the codebase.
4. `PUT /comments/:id` with `{ "transition": "in_review", "actor": { "kind": "agent", "id": "claude", "name": "Claude" } }`
   (send `x-bridge-agent-id: claude` as well).
5. Optionally `POST /comments/:id/replies` with a short summary as the agent.
6. The user approves or rejects from the inbox (`/auis/styleguide/review`) or
   the Review Bridge page (`/auis/review-bridge`).

Never write to the JSON files directly — the store serializes writes and
externalizes images; a hand edit races with it.
