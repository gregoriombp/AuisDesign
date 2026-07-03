# Arquitetura — Auis

Como as peças se encaixam. Para convenções de código (prefixo `Au`, tokens, ordem de lookup de componentes) a fonte de verdade é [`../AGENTS.md`](../AGENTS.md); para o modelo mental do produto, [`../AUIS.md`](../AUIS.md).

## Visão geral

Auis é um **produto Next.js** (não documentação): o design system roda junto da app, as telas são navegáveis, os fluxos são código, e os comentários viram fila de trabalho para agentes. Quatro pilares:

1. **Design system como código** — primitivos em `components/ui/`, tokens em `app/globals.css`, documentados no styleguide.
2. **Builder por composição** — telas novas partem de componentes existentes; padrão reutilizável vira componente oficial.
3. **Review/Edit como fila** — comentários e edições visuais carregam contexto de rota/alvo, então agentes resolvem com contexto suficiente.
4. **Skills como contrato de execução** — agentes seguem as regras do repo via skills, em vez de inventar estrutura.

## Superfícies (rotas)

| Superfície | Rota | Papel |
|---|---|---|
| Styleguide | `/auis/styleguide` | Design system vivo (zerado — pronto pra popular) |
| Review Bridge (dashboard) | `/auis/review-bridge` | Fila local de comentários + sugestões |
| Review Inbox | `/auis/styleguide/review` | Inbox dos comentários do Review Mode |
| UX Flow | `/auis/ux-flow` | Viewer/hub de fluxos como protótipo |
| Projects | `/auis/projects` | Workbench de telas/projetos importados |
| Design System Tweaks | `/auis/design-system-tweaks` | Experimentos controlados de token |

## Camadas de componentes

Dependência é **mão única** (camadas de cima consomem as de baixo — ver [`component-layers.md`](component-layers.md)):

- **Chrome do builder** — `components/auis-review/` (canvas, pins, popovers, command menu), `components/auis-edit/` (toolbar, inspector, controls), `components/auis/` (AuisDot, ModeFamilySwitch).
- **Primitivos** — `components/ui/` (33 arquivos `Au*`): só o subconjunto que a chrome importa (`AuButton`, `AuModal`, `AuSheet`, `AuDropdownMenu`, `AuInput`, `Icon`, …), mais o shell que o workbench usa (`AuDashboardLayout`/`AuSidebar`/`AuHeader`). O catálogo completo do produto de origem **não** foi trazido.
- **Estado/lógica** — `lib/auis-review/`, `lib/auis-edit/`, `lib/copilot/`, `lib/hooks/` (stores Zustand, anchoring de elementos, parsing de comandos, voz, assist de IA).

## Bridges (runtime)

```
Review Mode (UI)  ──cria comentário──▶  /api/review-bridge/*  ──▶  review-bridge/data/*.json
                                                  │
        agente (skill auis-review-bridge-solve) lê a fila  ◀───┘
                                                  │
                          resolve → marca in_review → você aprova/rejeita no inbox
```

- **Review Bridge** — **serverless** (rotas same-origin `app/api/review-bridge/*`, default `npm run dev`) ou **Express legado opt-in** (`review-bridge/`, `npm run dev:bridge`, `127.0.0.1:9878`). Ambos gravam os mesmos JSONs com escrita atômica.
- **Flow Bridge** — sugestões via `/api/flow-suggestions` → `flow-bridge/data/`.
- **Edit Bridge** — "ops" não-destrutivas via `/api/page-edits` → `page-editor/data/`; `auis-edit-bridge-solve` materializa em código.
- **Project Builds** — `/api/project-builds` alimenta `auis-project-build-solve`.
- **Copilot** — `/api/copilot` dá o assist de IA ao Review Mode. ⚠️ chama LLM.

Os diretórios `*/data/` são **estado de runtime** (gitignored), não código-fonte.

## Sistema de skills

```
skills/<cap>/<name>/SKILL.md            (Claude — canônico)
skills/<cap>/<name>/SKILL.codex.md      (Codex — só quando diverge; 13 casos)
        │  npm run skills:catalog                 │  npm run skills:sync
        ▼                                         ▼
skills/registry.json + CATALOG.md        .claude/skills/<name>/   (Claude Code)
                                         .agents/skills/<name>/   (Codex/Cursor; aplica SKILL.codex.md)
```

- **Capabilities:** Design System (9), UX Flows (7), Bridges (8), Build & Handoff (2), Content (1), Support (9).
- **Plataformas:** 34 em Claude+Codex, 2 só Claude (`auis-review-bridge-dispatch`, `auis-edit-bridge-solve`).
- **Origem:** 6 genéricas (Cowork, núcleo "zerado") + 21 repo-local (variantes ricas: bridges, ux-flow, audit) + 9 de suporte.
- `scripts/skills-sync.mjs` faz cópia recursiva manual (evita problemas de modo de permissão em mounts restritos) e aplica a variante Codex onde existe.

## Stack

Next.js (App Router) · React 19 · **Tailwind v4** (`@theme` + `:root` em `globals.css`, sem `tailwind.config`) · shadcn/ui (primitivos lowercase + wrapper `Au*`) · Material Symbols via `components/ui/Icon.tsx` · Zustand · framer-motion · `@xyflow/react` (fluxos). MCPs em `.mcp.json` (figma, shadcn, playwright, mobbin).

## Fronteira: motor vs resíduo da origem

A marca remanescente (`AuBrandLogo`/`AuBrandIllustration`/`AuCortexSynthesis`, assets `comet-*`) e o shell `AuDashboardLayout` precisam de substituição/decisão. Os tokens já estão num baseline neutro; re-tematizar por produto é a skill `auis-foundation`.
