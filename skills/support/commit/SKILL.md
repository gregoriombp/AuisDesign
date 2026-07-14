---
name: commit
description: Maps the pending changes and creates local atomic commits — one commit per file/area when it makes sense, without rewriting content inside a file just to slice it further. Does NOT push and does NOT open a PR unless the user asks. Trigger whenever the user types /commit.
---

# Atomic commit (local)

You were invoked because the user typed `/commit`. Your job is to turn the pending changes into one or more **local atomic commits**.

## Non-negotiable rules

1. **Never push.** Never run `git push`, and never suggest it, unless the user explicitly asks in this message or in a later one (e.g. "send it to the remote", "push it", "push", "get it up to git").
2. **Never open a PR.** Do not run `gh pr create` or any other PR command. This skill is strictly local.
3. **Never use `--no-verify`, `--no-gpg-sign` or `--amend`** unless the user asks. If a hook fails, fix the cause and create a **new** commit.
4. **Never use `git add -A` or `git add .`** — always add files by name, to avoid including secrets or unintended artifacts.
5. **Do not create an empty commit.** If there is nothing to commit, say so and stop.
6. **Confirm before discarding work.** No `git reset --hard`, `git checkout --`, `git clean -f` etc. without an explicit request.

## What "atomic" means here

An atomic commit = one coherent logical concern per commit, grouping the working tree by what is **already physically separate** across files/areas. The goal is to map what changed and get it into git cleanly — not to sculpt a surgical history.

**Default guideline:** split when the files/areas are already naturally separate. Do not rewrite file content just to slice it further.

Heuristics for splitting (apply top to bottom, stopping at the first level where the changes separate):
- **Different file, different subject** → separate commit by default. Only put files in the same commit if one depends on the other to compile/work (e.g. a new module imported by the file that consumes it) or if they are literally the same change replicated.
- **Different folders/areas** (UI vs. lib, layout shell vs. a specific page, app/X vs. app/Y) → separate commits.
- **Adding a new helper/util vs. consuming it** → two commits (helper first, consumption second) whenever the helper is usable on its own.
- **Dependencies/lockfiles** (`package-lock.json`, `bun.lockb`, `pnpm-lock.yaml`) go with the change that generated them. If they were an isolated bump, they get their own commit.

**When a single file mixes concerns** (e.g. the same `page.tsx` carries a new feature + a cosmetic refactor), commit it as **a single commit**. Do not use `Edit` to revert chunks and re-apply them — that is overengineering. Mention the concerns in the message if it helps readability, and move on.

**Do not use `git add -p` / `-i`** (interactive mode, does not work here).

Ideal sequence: each commit leaves the repository in a working state. If slice A depends on B to compile, B comes first.

## Step by step

### 1. Diagnose the current state (in parallel)

Run in parallel (a single block of tool calls):
- `git status` (without `-uall`)
- `git diff` (unstaged)
- `git diff --cached` (staged)
- `git log -n 10 --oneline` (to follow the style of the repo's recent commits)

### 2. Decide the grouping

Analyze the diffs and decide, **starting from N commits = N distinct concerns detected** (not from "1 commit that covers everything"):
- How many commits to create — aim for the **maximum** that still keeps each commit working and self-contained.
- Which files (or chunks, see the section above) go in each commit.
- The order of the commits (dependencies before consumers).
- The message for each commit.

Before staging, ask yourself for each pair of changes: *"if I were opening separate PRs, would I open one or two?"*. If the answer is "two", then they are two commits here.

**Message style:** follow the style of the repository's latest commits (look at the `git log`). If the repo uses Conventional Commits (`feat:`, `fix:`, `chore:`…), follow it. If it uses short imperative English sentences, follow that. If it mixes Portuguese/English, mirror the dominant pattern. Do not force a style the repo does not use.

**Message content:** focus on the *why*, not just the *what*. 1–2 lines in the subject; body optional, only if it adds real context.

**Security:** if any pending file looks like it contains secrets (`.env`, `*credentials*`, `*.pem`, private keys, hardcoded tokens), **stop and warn the user** before staging it.

### 3. Create each commit

For each group, in sequence:
1. `git add <specific-files>` (never `-A`/`.`).
2. `git commit -m "$(cat <<'EOF' ... EOF)"` passing the message via HEREDOC to preserve formatting.
3. If a pre-commit hook fails: diagnose, fix, re-stage and create a **new** commit (not `--amend`).

**Do not include** `Co-Authored-By` lines or `🤖 Generated with Claude Code` in these commits — this skill is the user's personal local helper; automatic attribution only if the user asks.

### 4. Report

At the end, run `git status` and `git log -n <N> --oneline` (where N = number of commits created) and show the user:
- How many commits were created.
- The subject of each one.
- A short reminder that **nothing was sent to the remote** and that, if they want, they just have to ask (e.g. "push that").

Keep the final summary short (≤ 6 lines).

## If the user asks for a push later

If, in a subsequent message, the user authorizes sending to the remote:
1. Check the current branch (`git branch --show-current`) and the upstream (`git rev-parse --abbrev-ref --symbolic-full-name @{u}` can fail if there is no upstream).
2. If there is no upstream, run `git push -u origin <branch>`. If there is, `git push`.
3. **Never** `--force` or `--force-with-lease` without an explicit request. If it is to `main`/`master`, warn first even with generic permission.
4. Do not open a PR and do not ask to open one — the user said "no PR".
