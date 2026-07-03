---
name: shadcn
description: Support skill for consulting the shadcn/ui registry, docs, and CLI when adding or wrapping primitives. Use when looking up a shadcn component, its API, variants, or install command before building an Au* wrapper. This skill only SOURCES primitives — the Auis repo conventions (Au* prefix + wrapper, existing tokens, Material Symbols icons) always override generic shadcn guidance.
---

# shadcn (support skill)

You were invoked to consult shadcn/ui — its registry, component docs, examples, or CLI — usually as step 1 of adding or wrapping a primitive. This is a **support skill**: it sources primitives and guidance, but **every Auis rule in `AGENTS.md` wins** when they conflict.

## Non-negotiable overrides (from AGENTS.md)

- **Wrap, don't expose.** A shadcn primitive lands at `components/ui/[name].tsx` (lowercase, CLI-generated). The DS component is `components/ui/Au[Name].tsx`, which imports it. Pages/features import **only `Au[Name]`**, never the raw primitive.
- **Tokens are sacred.** Never add new tokens. Use existing token classes/vars (`bg-primary`, `var(--accent-brand)`, …). No arbitrary `bg-[#hex]` / `p-[Npx]`. If a token is missing, report it — don't invent it.
- **Tailwind v4.** This repo is on Tailwind v4 (since 2026-06-08): `@import "tailwindcss"` + `@theme` in `app/globals.css`, and **no `tailwind.config.ts`**. The shadcn CLI auto-detects this (`npx shadcn@latest info` → `tailwindVersion v4`, `tailwindConfig -`) and emits v4-compatible output. Token VALUES live in `@theme` (which generates the `bg-au-*`/`text-au-*` utilities), mirrored by `--au-*` vars in `:root` for `var()` use — two channels, same value. Still: **don't add tokens** (see "Tokens are sacred"); only `auis-design-system-foundation` may.
- **Icons.** Material Symbols Rounded via `components/ui/Icon.tsx` is the default. Don't pull `lucide-react` into product code (it only ships inside CLI-generated primitives).

## Flow

1. **Look up** the primitive via the shadcn MCP (`search_items_in_registries`, `view_items_in_registries`, `get_item_examples_from_registries`) — server `shadcn` in `.mcp.json`.
2. **Install** with `npx shadcn@latest add [name]` → primitive at `components/ui/[name].tsx`.
3. **Wrap** in `components/ui/Au[Name].tsx` (tokens + brand variants + `Icon` slot).
4. **Showcase** at `app/auis/styleguide/components/au-[name]/page.tsx` + register in `navigation.ts`.

## Routing

For DS work prefer the local `auis-*` skills (`auis-new-component`, `auis-new-page`). Use this `shadcn` skill only to consult the registry/CLI — it does not place files for you.

> **Note — consolidated minimal version.** The fuller upstream shadcn skill (deep rules: base-vs-radix, composition, forms, icons, styling) lives in the local `.agents/skills/shadcn/` cache (gitignored). Copy those rule files in here if you want the expanded guidance versioned in the repo.
