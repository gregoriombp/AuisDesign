# Flow Bridge

Runtime storage for **UX flow suggestions** — the structural edits proposed from a
flow page (`/auis/ux-flow/<slug>` → "Suggest edit") and moderated on the Review
Bridge page (`/auis/review-bridge` → "Flow suggestions").

The bridge is serverless: the Next.js app serves it through
`app/api/flow-suggestions/*`, there is no separate process to run.

## Data files (gitignored)

| File | Contents |
| --- | --- |
| `flow-bridge/data/suggestions.json` | Open, in-review and recently applied suggestions. |
| `flow-bridge/data/suggestions.archive.json` | Applied and discarded suggestions moved out of the main file. |

Both files are created on first write by `lib/bridge-store` (namespace `flows`).
Delete them to reset the bridge locally.

## Lifecycle

```
open ──▶ in_review ──▶ applied
  │          │
  └──────────┴──────▶ discarded
```

- **open** — filed from the flow editor. Carries the proposed `nodes`/`edges`, the
  `baseRevision`/`baseHash` of the graph it was made against and the author.
- **in_review** — an agent (or the `auis-flow-bridge-solve` skill) took it.
- **applied** — the graph change was materialised into
  `app/auis/ux-flow/<slug>/page.tsx`; the record stores a `materializationReceipt`
  (files touched, resulting hash) so a stale base can be detected.
- **discarded** — rejected with an optional reason.

Transitions are validated server-side (`_integrity.ts`). A transition against a
graph whose base hash no longer matches returns `409` with a `FlowTransitionError`.

## HTTP API

| Method | Route | Notes |
| --- | --- | --- |
| `GET` | `/api/flow-suggestions?flow=<slug>&status=<s>` | List suggestions (main file + archive when `status` targets it). |
| `POST` | `/api/flow-suggestions` | Create. Requires `flow`, `nodes`, `edges`, `baseNodes`, `baseEdges`, `description`. Agents (`x-bridge-agent-token`) cannot create. |
| `GET` | `/api/flow-suggestions/<id>` | Read one record. |
| `PUT` | `/api/flow-suggestions/<id>` | `{ transition: "in_review" \| "applied" \| "discarded", reason?, receipt? }` — session-gated. |
| `DELETE` | `/api/flow-suggestions/<id>` | Admin only. |

See `skills/bridges/auis-flow-bridge-solve/SKILL.md` for how an agent pulls, applies
and closes suggestions, and `review-bridge/README.md` for the comment side of the
same workflow.
