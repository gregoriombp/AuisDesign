---
name: prose-sweep
description: >
  Audits, or on request cuts, source comments and JSDoc that only restate the
  code, so agents keep invariants instead of stale prose. Ranks candidate files
  with a bundled script, classifies each block as keep, cut, compress or skip,
  and reports unless asked to apply. Use for "/prose-sweep", "sweep the
  comments", "strip redundant comments from these types", "too much JSDoc".
argument-hint: "<file, folder, or empty = ranked candidates>"
---

# Prose sweep

A shortcut for cutting comments that **repeat the code**. The harm is not the
tokens: an agent gives prose and types the same weight, and follows the old
text when the two disagree.

**Thesis:** an invariant TypeScript cannot express stays; the rest goes.

Audit → report and stop. Apply → only on an explicit request ("apply", "cut
them").

## Scope

**Do:** `//`, `/* */`, `/** */` in `.ts` `.tsx` `.js` `.jsx` `.mjs` `.cjs`.

**Do not:** UI copy (`auis-ux-writing`), canonical docs (`AGENTS.md`,
`AUIS.md`, `docs/`, skills), generated folders (`.next*`, `.agents/`,
`.claude/`, `node_modules/`, `review-bridge/data/`, `flow-bridge/data/`,
`page-editor/data/`).

**Skip until the user names it:** vendored code you did not write (upstream
JSDoc of a copied library or a CLI-generated primitive).

Run `git status` first. Do not step on someone else's diff.

## Classification

Each block is **keep**, **cut**, **compress** or **skip**.

| | Stays | Goes |
|---|---|---|
| **Keep** | Behavior the type does not carry. A trap (compare-and-swap, `Object.entries` order, native vs React events). A secret or a mock behind a high-fidelity screen. A ban on the next wrong edit. A short pointer to the canonical doc. | |
| **Cut** | | Translates the identifier (`label` → "the label"). A header that retells `AUIS.md` or `AGENTS.md`. An obvious `@example`. A `────` ruler. JSDoc on every field of a type that already reads well. |
| **Compress** | A true keep that grew into a paragraph. It fits in 1–4 lines of invariant. | Do not rewrite it as new prose. |
| **Skip** | Vendored tree, doc, skill, generated folder. | |

A duplicate across 3+ files → **cut** in code; do **not** copy it to the docs
in this pass (report it as `move` only if the canonical doc lacks the rule).

## Workflow

1. Target: the paths the user gave. No path → the ranker's candidates.
2. Run:

```bash
node .claude/skills/prose-sweep/scripts/rank.mjs [path...]
# .agents/skills/prose-sweep/scripts/rank.mjs under Codex
```

3. Read only the candidates. Do not open every file in the repository.
4. Classify block by block. When in doubt, **keep**.
5. Report. Without "apply" or "cut them", **do not edit**.
6. Apply only what the report marked cut or compress, in the accepted files.
   Validate with a focused lint on the touched files (`npm run lint`).

## Applying

- Prefer deleting to rewriting.
- Compress: at most 4 lines; only the invariant.
- Do not "improve" a keep. Do not move architecture into markdown in this
  pass.
- Do not touch a file outside the list.

## Output

Group by file. One line per block:

```
lib/store.ts
  L12–18  cut       JSDoc of `label` translates the name
  L40–46  keep      `defaultValue` clears the query param
  L1–4    compress  header retells AUIS.md
```

Close with: files seen, cuts vs keeps, what only applies on request, and the
residual risk (vendored code not swept, a duplicate that should live in a
doc).
