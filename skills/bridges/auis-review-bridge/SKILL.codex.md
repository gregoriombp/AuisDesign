---
name: auis-review-bridge
description: >
  Diagnoses or manually recovers the local Auis Review Mode server
  (review-bridge). The normal flow is `npm run dev`, which already prepares
  the envs and brings the bridge up. Use this skill only when the user asks
  to "/auis-review-bridge", "start the review-bridge", spin up the review
  bridge, "turn on the comments server", start a review with the agent, open
  the review-bridge, "/review-bridge", or similar. Do NOT use it to resolve
  comments — for that, see `auis-review-bridge-solve`.
---

# Auis Review Mode — Diagnose the Bridge

The normal path is to run **`npm run dev` at the root**. That command runs
`review-bridge:prepare`, syncs `review-bridge/.env` + `.env.local`, and brings up
Next together with the local bridge on `127.0.0.1:9878`.

This skill exists only as a fallback/diagnostic when the local bridge went down or
when the user explicitly asked to touch it. It does NOT resolve comments —
to resolve/approve/reply in bulk, use the sibling skill
`auis-review-bridge-solve`.

> **Architecture, lifecycle, full API and curl examples for agents:**
> always check `review-bridge/README.md`. That file describes the
> current schema (v3: `open | in_review | resolved`), the physical split
> `comments.json` (active) / `comments.archive.json` (archived), and
> all the transitions/endpoints.

## Pre-check (always run first)

Before any action, confirm in parallel:

1. `review-bridge/package.json` exists → otherwise **abort** with a message
   asking the user to run the server's scaffolding step (do not recreate it here).
2. `review-bridge/node_modules/` exists → if not, note that you will need to
   install it.
3. `review-bridge/.env` exists → if not, note that you will need to generate it.
4. `.env.local` exists at the root → needed to write the frontend envs.

## Steps

### 1. Install deps (if needed)

```bash
npm run review-bridge:install
```

Skip if `review-bridge/node_modules/` already exists.

### 2. Generate token (if needed)

If `review-bridge/.env` does not exist:

```bash
TOKEN=$(openssl rand -hex 32)
echo "AUIS_REVIEW_TOKEN=$TOKEN" > review-bridge/.env
```

If it already exists, **read** the `AUIS_REVIEW_TOKEN` value in the file —
do not regenerate it (that would invalidate the local configuration already used by the frontend/agents).

### 3. Write the envs into the frontend's .env.local

Write/update the two lines:

```
NEXT_PUBLIC_AUIS_REVIEW_BRIDGE_URL=http://127.0.0.1:9878
NEXT_PUBLIC_AUIS_REVIEW_TOKEN=<TOKEN>
```

- **URL:** it must always be `http://127.0.0.1:9878` in this local flow.
- **Token:** never regenerate it if one already exists.

Use Edit/Write, preserving the other lines of `.env.local`.

### 4. Start the server in the background

```bash
npm run review-bridge:dev
```

The server must listen on `127.0.0.1`, never on `0.0.0.0`. Use Bash with
`run_in_background: true`. Do not poll — the user gets a notification
when the process ends (that is, if it goes down).

> **Automatic migration:** if `data/comments.json` is still on v2,
> the boot migrates it in-place to v3 and creates `data/comments.archive.json` with
> all the old `status: "resolved"` ones. This is idempotent, but tell the
> user to back up before the first post-v3 boot if they have data
> that matters.

### 5. Validate /health

Wait ~2s and hit:

```bash
curl -s -H "X-Review-Token: <TOKEN>" http://127.0.0.1:9878/health
```

Expect:

```json
{
  "ok": true,
  "version": "0.2.0",
  "service": "auis-review-bridge",
  "tokenRequired": true,
  "schemaVersion": 3,
  "subscribers": 0,
  "dataFile": ".../data/comments.json",
  "archiveFile": ".../data/comments.archive.json",
  ...
}
```

If `schemaVersion` is anything other than `3`, or `archiveFile` is not
listed, an old version is running. Tell the user to update.

### 6. Report

Final message to the user, concise, with:

- ✓ Server running at `http://127.0.0.1:9878`
- ✓ Token configured
- ✓ Schema v3 — `comments.json` (active) + `comments.archive.json` (archived)
- Quick counts (useful for the user to know the queue):
  ```bash
  curl -s -H "X-Review-Token: $TOKEN" "http://127.0.0.1:9878/comments?status=open"     | python3 -c "import sys,json;print('open:',len(json.load(sys.stdin)['comments']))"
  curl -s -H "X-Review-Token: $TOKEN" "http://127.0.0.1:9878/comments?status=in_review"     | python3 -c "import sys,json;print('in_review:',len(json.load(sys.stdin)['comments']))"
  curl -s -H "X-Review-Token: $TOKEN" "http://127.0.0.1:9878/comments/archive?limit=1"     | python3 -c "import sys,json;d=json.load(sys.stdin);print('next_archive_cursor:',d.get('nextCursor'))"
  ```
- Review Mode is **always mounted** (no env flag): just open the floating button →
  "Entrar no Review Mode" (or `⌘⇧Y`). A "X comentários no localStorage" toast
  appears if there is old data to import.
- How to stop the server: `pkill -f "tsx src/index.ts"` or use TaskStop
  on the PID returned by Bash.
- To start **resolving** the comments in bulk, invoke the
  `auis-review-bridge-solve` skill.

## Constraints

- ❌ Do not regenerate the token if `review-bridge/.env` already has one — it breaks
  the local frontend and already-configured agents.
- ❌ Do not overwrite `.env.local` without asking when there are already divergent
  values.
- ❌ Do not expose the server on the network (do not run on `0.0.0.0`, do not set up
  port forwarding). The current mode is local-only.
- ❌ Do not commit `review-bridge/.env` or `.env.local` (already in .gitignore).
- ❌ Do not delete `data/comments.archive.json` "to clean up" — it breaks history
  and everything the frontend lists in the Archived tab.

## Quick check when something goes wrong

| Symptom | Likely cause | How to check |
|---|---|---|
| `EADDRINUSE` | port 9878 taken | `lsof -i :9878` |
| 401 from health | wrong token | compare the bridge's `.env` with `.env.local` |
| Frontend does not detect the bridge | `NEXT_PUBLIC_*` was not reloaded | restart `npm run dev` |
| CORS blocks the request | app opened outside `localhost`/`127.0.0.1` | open it locally; the bridge does not accept a network origin |
| The "import" toast does not appear | it was already offered in this session | reload the page |
| `schemaVersion: 2` in health | an old version of the bridge is running | `git pull` in `review-bridge/`, reinstall deps, restart |
| `comments.archive.json` does not exist | v3 never ran or the data dir was empty | normal if there were never any resolved comments; it creates itself |
| Comment "disappeared" after approving | it went to the archive — expected | `GET /comments/archive?url=…` |
