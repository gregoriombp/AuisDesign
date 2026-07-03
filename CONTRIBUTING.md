# Contributing to Auis

Thanks for your interest in contributing! Auis is an agent-first design builder — most conventions exist so that **AI agents and humans produce the same quality of code**. Please read this before opening a PR.

## Ground rules

1. **`AGENTS.md` is the source of truth.** Every convention (the `Au*` prefix, the shadcn-wrapper flow, the component-lookup order, the "tokens are sacred" rule) lives there. If your change conflicts with `AGENTS.md`, either follow it or propose changing `AGENTS.md` first.
2. **Tokens are sacred.** Never hardcode `#hex`, `w-[37px]`, raw `<svg>`. Use design tokens. If a token is missing, open an issue — only the `auis-foundation` skill creates tokens.
3. **Reuse > extend > create.** Check `docs/component-map.md` and `components/ui/Au*` before writing a new component.
4. **Skills live in `skills/`.** The `.claude/skills/` and `.agents/skills/` trees are **generated** — never edit them by hand. Edit `skills/<capability>/<name>/SKILL.md` and run `npm run skills:sync`.

## Development setup

```bash
git clone https://github.com/<you>/auis.git
cd auis
npm install          # postinstall runs skills:sync
npm run dev          # Next.js on 127.0.0.1:3000
```

Optional (Review Mode queue server):

```bash
npm run review-bridge:install
npm run dev:bridge   # Next + Express review bridge on 127.0.0.1:9878
```

## Before you open a PR

```bash
npm run typecheck    # tsc --noEmit
npm run lint         # eslint
npm run build        # next build
npm run ds:check     # design-system lint (hardcode debt)
```

All four must pass. If you touched skills, also run `npm run skills:catalog` and commit the regenerated `skills/registry.json` / `skills/CATALOG.md`.

## Commit style

Small, atomic commits grouped by logical subject. Conventional prefixes are welcome (`feat:`, `fix:`, `docs:`, `chore:`).

## Reporting bugs / requesting features

Use the issue templates. For skill-related issues, mention which agent you were driving (Claude Code, Codex, Cursor) — skill behavior can diverge per platform (see `SKILL.codex.md` variants).

## Code of Conduct

By participating you agree to the [Code of Conduct](CODE_OF_CONDUCT.md).
