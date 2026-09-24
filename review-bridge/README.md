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
| `agent` | A request carrying a valid `x-bridge-agent-token` (the skills, the mention runner) when `BRIDGE_AGENT_TOKEN` is set | Reply and comment as an agent, move items to `in_review`; never approve/reject/delete |
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
| `GET` | `/dispatch-queue?url=` | Read-only view of the actionable items (open admin comments mentioning an agent that is switched on); no consumer ships with Auis |
| `GET` | `/agent-settings` | `{ settings: { [agentId]: { enabled, permission, model } }, runtime: { [agentId]: { cli, permissions, models, effort, defaults, name, handle } }, triggerEnabled }`. Admin or agent |
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
| `PUT` | `/agent-settings` | `{ agentId, settings: Partial<{ enabled, permission: "reply" \| "edit", model }> }` — merged and validated against the agent's runtime (`400 invalid_settings`). Admin only |
| `PUT` | `/identity/:id` | Upsert of a reviewer identity |
| `DELETE` | `/identity/:id` | Removes a member from the directory (their comments stay) |
| `POST` | `/import` | Snapshot merge, skips duplicate ids |

### Transitions

| `transition` | Effect | `actor` |
|---|---|---|
| `in_review` | open → in_review, writes `resolution.summary` | required; an agent actor must be `claude`, `codex` or `grok` (`403 unknown_executor` otherwise) |
| `approve` | in_review → resolved, moves to the archive, stamps `approvedAt/approvedBy` | required, `kind: "user"` |
| `reject` | in_review → open, clears `resolution` | required, `kind: "user"` |
| `resolve_direct` | open → resolved directly | required, `kind: "user"` |
| `reopen_from_archive` | resolved → open | required, `kind: "user"` |

## Agents

Agents available: `@Claude`, `@Grok` and `@Codex` — executors that share the
same contracts (`auis-review-bridge-solve`, `auis-ux-writing`,
`auis-edit-bridge-solve`). Claude and Grok have a CLI the mention trigger can
open; Codex is registered but has no engine yet and stays off. The registry is
`lib/auis-review/agents.ts`; what each one can run (CLI, ceilings, models,
effort) is `lib/auis-review/agentRuntime.ts`.

### The Agents panel

The Auis dot → **Agents** opens one row per agent: an on/off switch, a
**ceiling** and, where there is a choice, the model.

| Ceiling | Can | Cannot |
|---|---|---|
| **Reply** | read the code and the thread; answer | edit a file, change status, pin |
| **Edit** | everything Reply can + edit code and mark `in_review` | commit, push, archive, approve |

The comment's wording can ask for less than the ceiling, never more. The
ceiling is enforced by the CLI flags the runner builds (`scripts/mention-cli.mjs`:
tool allowlists, `--disallowedTools` for git, Grok's `--sandbox`), not by the
prompt alone. The settings live in `comments.json` under `agentSettings` and
are always read normalized: an old or partial record becomes the runtime
defaults (Claude on in Edit, the rest off).

### Mention trigger (local dev only)

With `AUIS_MENTION_TRIGGER=1` in `.env.local`, writing `@Claude …` or `@Grok …`
in a pin or a reply opens that agent's CLI right there, from the route that
stored the write (`app/api/review-bridge/_mention.ts`). The write is the event:
nothing polls, nothing waits. Five gates, all required:

1. never in production, and never in dev without the opt-in;
2. only the admin's own writes — a reviewer's `@Claude` stays text;
3. never a write authored by an agent (or agents would drive each other);
4. only on creation — re-saving an old comment that already says `@Claude`
   does not fire again;
5. only for an agent switched on in the Agents panel, with a CLI.

The route spawns `scripts/mention-run.mjs` detached (so it survives the dev
server's HMR) with the comment id and the mentioned agents. The runner:

- reads the Agents panel through `GET /agent-settings` (now, and again after
  waiting for the lock — switching an agent off while it is queued makes it
  skip; lowering the ceiling applies to whoever has not started);
- runs the agents in mention order, one editor per message (a second Edit
  agent is demoted to Reply for that message); Reply starts at once, Edit waits
  for the working-tree lock in `~/.auis/mention-run.lock`;
- builds the prompt from `scripts/mention-prompt.md` with the comment in
  `view=lean`, and opens `claude -p` or `grok -p` with the ceiling's flags and
  an allowlisted environment (app secrets and API keys never reach the agent;
  `BRIDGE_BASE` is pinned to the local bridge);
- judges success the way the bridge does — a reply from this run landed in the
  thread. Under Reply the agent cannot post, so the runner posts its final
  message; when nothing comes back, the runner posts the failure with its reason.

No automatic retry: re-firing is you replying in the thread again. The log is
`~/.auis/mention-run.log`; `npm run mention:dry -- <commentId> claude` prints
the command without opening a process. `GET /dispatch-queue` reads the same
settings as a read-only view of what is actionable and has no consumer.

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
