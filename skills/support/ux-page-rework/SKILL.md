---
name: ux-page-rework
description: Audits a product page (and its subpages) and delivers TWO different improvement directions — one refinement (keeps the structure, polishes components and UX writing) and one restructuring (reorganizes the information hierarchy, proposes new patterns) — each on its own branch, no merge. Use whenever the user asks to "improve this page", "rework this page", "refine this page", "audit the UX of this screen", "create 2 improvement versions", "redesign /<route>", "propose improvements for this page", or pastes a URL/route and asks for a UX audit/improvement. Also applies when the user says "compare it with Mobbin/Dribbble/competitor X" about an existing page. Ideal for UI/UX preview repos (Next.js + design system) that need two implementable directions for the same screen.
---

# UX Page Rework

Two improvement directions for a product page, each on its own branch, no merge. Triggered by a request to "improve/rework/audit/redesign" a route.

## What you deliver

- `ux/<slug>-refinement` — preserves structure and routes; polishes components, visual hierarchy within each page, copy.
- `ux/<slug>-restructure` — reorganizes the information hierarchy; proposes new interaction patterns.

Where `<slug>` is the last meaningful segment of the path (`/settings/financeiro/` → `financeiro`; `/dashboard/billing` → `billing`). Never the whole URL.

Branches stay local, no push and no merge. The user compares, picks one (or cherry-picks), and moves on.

## Workflow

### Phase 0 — Project context (before anything else)

Before touching any file:

1. **Repo rules** — read `AGENTS.md` at the project root. Naming conventions, component prefixes, token restrictions, etc.
2. **User memory** — read `~/.claude/projects/<this-repo-encoded>/memory/MEMORY.md` if it exists, but treat it as advisory. If it conflicts with `AGENTS.md`, the repo wins.
3. **Locate the design system** — typically `app/auis/styleguide/` or `app/styleguide/`. List `components/`, read `navigation.ts`, identify tokens in `globals.css`.
4. **Git state** — `git status`. If there are uncommitted changes:
   - Ask the user: commit, stash, or ignore?
   - If ignoring: you NEVER use `git add .` or `git add -A` in the commit. Always `git add <path>` file by file, so you don't pull in work from another agent/session.
5. **Dev server** — check whether something is already running on `:3000`. If so, leave it alone — hot reload will pick up your changes. Don't kill it.

### Phase 1 — Understand the current page

1. **Normalize the slug** from the URL.
2. **Detect subpages automatically.** If the route has a layout with tabs, read the tabs file (e.g. `FinanceiroTabs.tsx`) and list every child route. Don't rely on the initial URL alone.
3. **List the pages you are going to touch** with the role of each one. Show it to the user before continuing — if you inferred wrong, they correct it here.
4. **Read the files** of each page + local components (`_components/`). Don't read the entire design system's primitives — only what is specific to these pages.
5. **Interpret it as an end user.** What does this page communicate? What is its function? How does it operate? Write that in 2-3 lines — it will anchor everything that comes after.

### Phase 2 — External references (optional, non-blocking)

Reference sites like **Mobbin, Dribbble, Behance, public Mobbin** have a paywall or block scraping. `WebFetch` fails. Don't insist.

Two paths:

- **A — the user sends material.** Ask for 1-3 screenshots or written notes about the flows they want to absorb. Ask explicitly which ones are "visual" (component, elegance) and which are "content" (hierarchy, copy) — because you will treat them differently.
- **B — inference fallback.** If the user mentioned apps you know (OpenAI Platform, Stripe, Intercom, Linear, etc.), use prior knowledge of their patterns and **flag that it is inference**, not fresh research. Example: "I couldn't access Mobbin (paywall). I'll use what I know about these companies' billing patterns — correct me if I'm out of date."

When the user sends material, split it into two buckets and treat them differently:

| Bucket | Use it for | Ignore |
|---|---|---|
| **Visual** reference (e.g. ElevenLabs, OpenAI) | Component patterns, density, visual elegance, spacing | Colors and tokens — those come from the local design system |
| **Content** reference (e.g. Intercom, Lemni) | Information hierarchy, structure, UX writing, section order | The entire visual — it doesn't matter how it looks |

### Phase 3 — Assessment + plan (with approval gate)

Write a short assessment of the current page along three axes:

- **A.** Are the components smart? Is the design elegant and minimal?
- **B.** Is the information accessible and visually intuitive?
- **C.** Is the UX writing clear, direct, in the product's tone?

Then propose the **two versions**, each as a list per subpage:

```
Version A — Refinement (keeps routes/structure)
- visao-geral: <what changes + why>
- saldo-creditos: <what changes + why>
- ...

Version B — Restructure (reorganizes the hierarchy)
- visao-geral: <what changes + why>
- saldo-creditos: <what changes + why>
- ...
```

**STOP HERE.** Show the plan and ask for approval. Don't jump straight to Phase 4. The user can:
- approve both,
- approve only one (valid — saves half the work),
- ask for cuts ("lean V1, just the main page"),
- redirect.

### Phase 3.5 — Size check (automatic gate)

Before implementing, make a quick estimate: `subpages × sections-per-page × versions`. If the product is high (arbitrary threshold: ≥ 20), **propose a lean V1 first**. Something like:

> "This route has 4 subpages with ~3 sections each. Two versions = 24 implementations. I suggest a V1 focused on the 2 subpages that deliver the most visual difference (`visao-geral` and `saldo-creditos`); the others inherit smaller changes. Sound good?"

The underlying rule: over-the-top external prompts (ChatGPT-style, lists of 30 changes) almost always carry 70% busywork. Identify the 3-4 things that really matter and propose those. Don't ship raw spec without distilling it.

### Phase 4 — Implementation

For each approved version:

1. **Create the branch.** `git checkout -b ux/<slug>-refinement` (or `-restructure`). Always from the user's current branch, don't force `main`.
2. **Implement** file by file. Reuse styleguide components; don't duplicate primitives.
3. **Validate BEFORE committing:**
   - `npx tsc --noEmit` — has to pass clean.
   - For each affected route: `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000<route>` — expect 200 or 3xx. If 500, open the dev server log and fix it.
4. **Selective staging.** `git add <file>` for each file YOU touched. Never `git add .` — there may be a parallel agent or a linter running that left other things modified in the working tree.
5. **Descriptive commit** focusing on the WHY, not the what. Style: `ux(<slug>): refine hierarchy and copy across all subpages` + bullets explaining the main change per subpage.
6. **No merge. No push.** Unless the user explicitly asks.

Repeat for Version B, first going back to the base branch (`git checkout <base>`).

### Phase 5 — Side-by-side preview (optional)

To review the two versions running at the same time without switching branches (especially useful when another agent in Cursor is working on main in parallel), offer a worktree setup:

```bash
# From the repo root:
git worktree add ../<repo>-refinement ux/<slug>-refinement
git worktree add ../<repo>-restructure ux/<slug>-restructure

# In each worktree, avoid reinstalling node_modules:
ln -s /absolute/path/to/repo/node_modules <worktree>/node_modules

# Start a dev server on a different port for each:
cd ../<repo>-refinement && PORT=3001 npm run dev
cd ../<repo>-restructure && PORT=3002 npm run dev
```

The user opens `:3001` and `:3002` in the browser and sees the two versions side by side. The main branch and `:3000` stay free for the parallel agent.

When the user is done reviewing: `git worktree remove <path>` on each one.

## Rules (loads the project's conventions)

Apply whichever exist in this repo. Default for UI/UX preview projects:

- **The design system is law.** A visual decision never contradicts the local styleguide. Tokens, components, spacing — everything flows from there.
- **Never create new tokens.** If a color/spacing/radius does not exist, use the closest one that does or ask. Forbidden: `bg-[#hex]`, `p-[Npx]`, `text-[#hex]`, `gap-[Npx]`. Use `var(--<token>)` or the tokens' Tailwind classes.
- **Component lookup order:** project component (e.g. `Au*`) → shadcn primitive (via MCP if available) → custom only as a last resort. If you are going to create a custom one, ask first.
- **The reference informs structure, not style.** Stealing OpenAI's layout ≠ stealing OpenAI's colors.
- **Desktop-only** unless the repo proves otherwise. Don't add `md:` / `lg:` reflows just to fill space. Don't document mobile-first if the product has no mobile.
- **`font-mono` is forbidden in product UI.** Use `tabular-nums` for aligned numbers. Mono only for real code displayed in a block.
- **UX writing tone:** direct, operational, present tense. "Invoices attempt charges in this order" > "Charges will be attempted in order". Read 2-3 strings that already exist in the repo before writing new ones — copy the tone.

## Antipatterns to reject on sight

If you catch yourself doing one of these, stop and reconsider — it's almost always the wrong version:

- **Grids of KPI cards** on billing / usage screens. They look "dashboardy" but bury the number that matters. Prefer: one big number + a single banner + flat shortcuts.
- **Two parallel hero cards** (e.g. "Next charge" + "Credit balance" with the same weight). One is the hero, the other is context.
- **Notification toggles** when the user wants a recent activity feed. Read the real intent, not the obvious interface.
- **Duplicating the same information** across hero + tile + chart. Show it once, at the highest point in the hierarchy.
- **Renaming legacy showcase folders** in the styleguide. It breaks routes. If the convention changed, leave the legacy alone and follow the new one only for new components.

## Edge cases

- **Working tree dirty from another agent.** Don't include it in your commits. `git add <file>` file by file. If you need to switch branches and the parallel agent is writing, avoid switching — just create the next branch straight from the current state with `git checkout -b`.
- **The linter rewrites your code mid-work.** Some editors run format-on-save independently of your session. Re-read the file before the next Edit — what is on disk may have changed after your last Write.
- **Dev server already running.** Don't kill it. Hot reload picks up your changes. To see two versions simultaneously, use worktrees (Phase 5).
- **Mobbin/Dribbble/Behance.** WebFetch fails. Don't keep trying. Ask for a screenshot or use declared inference.
- **Subpages that don't exist in the sidebar but do exist in the app router** (e.g. orphan pages). `find <app-dir>/<slug> -name "page.tsx"` to make sure you got them all.
- **The route is a redirect** (e.g. a `page.tsx` that only does `redirect("/sub")`). You want to work on the subpages, not the redirect.
