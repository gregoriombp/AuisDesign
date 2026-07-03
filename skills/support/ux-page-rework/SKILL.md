---
name: ux-page-rework
description: Audits a product page (and its subpages) and delivers TWO different improvement directions — one refinement (keeps the structure, polishes components and UX writing) and one restructuring (reorganizes the information hierarchy, proposes new patterns) — each on its own branch, no merge. Use whenever the user asks to "improve this page", "rework this page", "refine this page", "audit the UX of this screen", "create 2 improvement versions", "redesign /<route>", "propose improvements for this page" (in Portuguese — "melhorar página", "rework página", "refinar página", "auditar UX desta tela"), or pastes a URL/route and asks for a UX audit/improvement. Also applies when the user says "compare it with Mobbin/Dribbble/competitor X" about an existing page. Ideal for UI/UX preview repos (Next.js + design system) that need two implementable directions for the same screen.
---

# UX Page Rework

Duas direções de melhoria pra uma página do produto, cada uma na sua branch, sem merge. Acionada por pedido de "melhorar/rework/auditar/redesign" de uma rota.

## O que você entrega

- `ux/<slug>-refinamento` — preserva estrutura e rotas; afina componentes, hierarquia visual dentro de cada página, copy.
- `ux/<slug>-reestruturacao` — reorganiza hierarquia de informação; propõe novos padrões de interação.

Onde `<slug>` é o último segmento significativo do path (`/settings/financeiro/` → `financeiro`; `/dashboard/billing` → `billing`). Nunca a URL inteira.

Branches ficam locais, sem push e sem merge. O usuário compara, escolhe (ou cherry-picks), e segue.

## Workflow

### Fase 0 — Contexto do projeto (antes de tudo)

Antes de tocar em qualquer arquivo:

1. **Regras do repo** — ler `AGENTS.md` na raiz do projeto. Convenções de nomenclatura, prefixos de componente, restrição de tokens, etc.
2. **Memory do usuário** — ler `~/.claude/projects/<este-repo-encoded>/memory/MEMORY.md` se existir, mas tratar como consultiva. Se conflitar com `AGENTS.md`, o repo vence.
3. **Localizar o design system** — tipicamente `app/auis/styleguide/` ou `app/styleguide/`. Listar `components/`, ler `navigation.ts`, identificar tokens em `globals.css`.
4. **Estado do git** — `git status`. Se houver mudanças não-commitadas:
   - Pergunte ao usuário: commita, stash, ou ignora?
   - Se ignorar: você NUNCA usa `git add .` ou `git add -A` no commit. Sempre `git add <caminho>` arquivo a arquivo, pra não puxar trabalho de outro agente/sessão.
5. **Dev server** — verificar se algo já roda em `:3000`. Se sim, deixar quieto — hot reload vai pegar suas mudanças. Não kill.

### Fase 1 — Entender a página atual

1. **Normalizar o slug** a partir da URL.
2. **Detectar subpáginas automaticamente.** Se a rota tem layout com tabs, ler o arquivo de tabs (ex.: `FinanceiroTabs.tsx`) e listar todas as rotas filhas. Não confiar só na URL inicial.
3. **Listar as páginas que você vai tocar** com o role de cada uma. Mostrar pro usuário antes de continuar — se você inferiu errado, ele corrige aqui.
4. **Ler os arquivos** de cada página + componentes locais (`_components/`). Não ler primitivas do design system inteiro — só o que é específico dessas páginas.
5. **Interpretar como usuário final.** O que essa página comunica? Qual a função? Como ela opera? Escreva isso em 2-3 linhas — vai ancorar tudo que vem depois.

### Fase 2 — Referências externas (opcional, sem bloquear)

Sites de referência tipo **Mobbin, Dribbble, Behance, Mobbin público** têm paywall ou bloqueiam scraping. `WebFetch` falha. Não insista.

Dois caminhos:

- **A — usuário envia material.** Peça 1-3 screenshots ou notas escritas das flows que ele quer absorver. Pergunte explicitamente quais são "visuais" (componente, elegância) e quais são "conteúdo" (hierarquia, copy) — porque você vai tratar diferente.
- **B — fallback por inferência.** Se o usuário citou apps que você conhece (OpenAI Platform, Stripe, Intercom, Linear, etc.), use conhecimento prévio dos padrões deles e **sinalize que é inferência**, não pesquisa fresca. Exemplo: "Não consegui acessar o Mobbin (paywall). Vou usar o que sei dos padrões de billing dessas empresas — me corrija se estiver desatualizado."

Quando o usuário envia material, separe em dois baldes e trate diferente:

| Bucket | Usa pra | Ignora |
|---|---|---|
| Referência **visual** (ex.: ElevenLabs, OpenAI) | Padrões de componente, densidade, elegância visual, espaçamento | Cores e tokens — esses vêm do design system local |
| Referência **conteúdo** (ex.: Intercom, Lemni) | Hierarquia de informação, estrutura, UX writing, ordem de seções | Visual inteiro — não importa como parece |

### Fase 3 — Avaliação + plano (com gate de aprovação)

Escreva uma avaliação curta da página atual nos três eixos:

- **A.** Componentes são inteligentes? Design elegante e minimalista?
- **B.** Informações acessíveis e visualmente intuitivas?
- **C.** UX writing claro, direto, no tom do produto?

Depois proponha as **duas versões**, cada uma como uma lista por subpágina:

```
Versão A — Refinamento (mantém rotas/estrutura)
- visao-geral: <o que muda + por quê>
- saldo-creditos: <o que muda + por quê>
- ...

Versão B — Reestruturação (reorganiza hierarquia)
- visao-geral: <o que muda + por quê>
- saldo-creditos: <o que muda + por quê>
- ...
```

**PARE AQUI.** Mostre o plano e peça aprovação. Não pule pra Fase 4 direto. O usuário pode:
- aprovar as duas,
- aprovar só uma (válido — economiza meio trabalho),
- pedir cortes ("V1 enxuta, só a página principal"),
- redirecionar.

### Fase 3.5 — Check de tamanho (gate automático)

Antes de implementar, faça uma estimativa rápida: `subpáginas × seções-por-página × versões`. Se o produto é alto (sinal arbitrário: ≥ 20), **proponha uma V1 enxuta antes**. Algo como:

> "Esta rota tem 4 subpáginas com ~3 seções cada. Duas versões = 24 implementações. Sugiro V1 focada nas 2 subpáginas que mais entregam diferença visual (`visao-geral` e `saldo-creditos`); as outras herdam mudanças menores. Topa?"

A regra de fundo: prompts externos exagerados (ChatGPT-style, listas de 30 mudanças) quase sempre carregam 70% de busywork. Identifique as 3-4 coisas que importam de verdade e proponha essas. Não suba spec pura sem destilar.

### Fase 4 — Implementação

Pra cada versão aprovada:

1. **Cria a branch.** `git checkout -b ux/<slug>-refinamento` (ou `-reestruturacao`). Sempre a partir do branch atual do usuário, não force `main`.
2. **Implementa** arquivo por arquivo. Reuse componentes do styleguide; não duplique primitivas.
3. **Valida ANTES de commitar:**
   - `npx tsc --noEmit` — tem que passar limpo.
   - Pra cada rota afetada: `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000<rota>` — espera 200 ou 3xx. Se 500, abre o log do dev server e conserta.
4. **Stage seletivo.** `git add <arquivo>` pra cada arquivo que VOCÊ tocou. Nunca `git add .` — pode ter agente paralelo ou linter rodando que deixou outras coisas modificadas no working tree.
5. **Commit descritivo** focando no PORQUÊ, não no o-quê. Estilo: `ux(<slug>): refine hierarchy and copy across all subpages` + bullets explicando a mudança principal por subpágina.
6. **Não faz merge. Não faz push.** A não ser que o usuário peça explicitamente.

Repete pra Versão B, voltando primeiro pro branch base (`git checkout <base>`).

### Fase 5 — Preview side-by-side (opcional)

Pra revisar as duas versões rodando ao mesmo tempo sem trocar branch (especialmente útil quando tem outro agente no Cursor mexendo no main em paralelo), oferecer setup de worktrees:

```bash
# A partir da raiz do repo:
git worktree add ../<repo>-refinamento ux/<slug>-refinamento
git worktree add ../<repo>-reestruturacao ux/<slug>-reestruturacao

# Em cada worktree, evita reinstalar node_modules:
ln -s /caminho/absoluto/do/repo/node_modules <worktree>/node_modules

# Sobe um dev server em cada porta diferente:
cd ../<repo>-refinamento && PORT=3001 npm run dev
cd ../<repo>-reestruturacao && PORT=3002 npm run dev
```

Usuário abre `:3001` e `:3002` no browser, vê as duas versões lado a lado. Branch principal e `:3000` ficam livres pro agente paralelo.

Quando o usuário terminar de revisar: `git worktree remove <path>` em cada uma.

## Regras (carrega convenções do projeto)

Aplicar as que existirem neste repo. Padrão pra projetos de preview UI/UX:

- **Design system é lei.** Decisão visual nunca contraria o styleguide local. Tokens, componentes, spacing — tudo flui de lá.
- **Nunca crie tokens novos.** Se cor/spacing/radius não existe, use o mais próximo que existe ou pergunta. Proibido: `bg-[#hex]`, `p-[Npx]`, `text-[#hex]`, `gap-[Npx]`. Use `var(--<token>)` ou classes Tailwind dos tokens.
- **Ordem de busca de componente:** componente do projeto (ex.: `Au*`) → primitiva shadcn (via MCP se disponível) → custom só em último caso. Se vai criar custom, pergunta primeiro.
- **Referência informa estrutura, não estilo.** Roubar layout do OpenAI ≠ roubar as cores do OpenAI.
- **Desktop-only** a menos que o repo prove o contrário. Não adicionar `md:` / `lg:` reflows só pra preencher espaço. Não documentar mobile-first se o produto não tem mobile.
- **`font-mono` é proibido em UI de produto.** Use `tabular-nums` pra números alinhados. Mono só pra código real exibido em bloco.
- **Tom UX writing:** direto, operacional, presente. "Faturas tentam cobrar nessa ordem" > "As cobranças serão tentadas em ordem". Leia 2-3 strings que já existem no repo antes de escrever novas — copie o tom.

## Antipadrões pra rejeitar de cara

Se você se pegar fazendo um destes, pare e reconsidere — quase sempre é a versão errada:

- **Grids de KPI cards** em telas de billing / usage. Parecem "dashboardy" mas enterram o número que importa. Prefira: número grande + banner único + atalhos flat.
- **Dois hero cards paralelos** (ex.: "Próxima cobrança" + "Saldo de créditos" com mesmo peso). Um é o hero, o outro é contexto.
- **Toggles de notificação** quando o usuário quer um feed de atividade recente. Lê a intenção real, não a interface óbvia.
- **Duplicar a mesma informação** em hero + tile + gráfico. Mostra uma vez no lugar mais alto da hierarquia.
- **Renomear pastas de showcase legadas** do styleguide. Quebra rotas. Se a convenção mudou, deixe o legado e siga a nova só pros componentes novos.

## Edge cases

- **Working tree sujo de outro agente.** Não inclua nos seus commits. `git add <arquivo>` por arquivo. Se você precisar trocar de branch e o agente paralelo está escrevendo, evite trocar — só cria a próxima branch direto do estado atual com `git checkout -b`.
- **Linter reescreve seu código no meio do trabalho.** Alguns editores rodam format-on-save independente da sua sessão. Releia o arquivo antes do próximo Edit — o que está em disco pode ter mudado depois do seu último Write.
- **Dev server já rodando.** Não mate. Hot reload pega suas mudanças. Pra ver duas versões simultaneamente, use worktrees (Fase 5).
- **Mobbin/Dribbble/Behance.** WebFetch falha. Não fique tentando. Pede screenshot ou usa inferência declarada.
- **Subpáginas que não existem na sidebar mas existem no app router** (ex.: páginas órfãs). `find <app-dir>/<slug> -name "page.tsx"` pra garantir que pegou todas.
- **A rota é uma redirect** (ex.: `page.tsx` que só faz `redirect("/sub")`). Você quer trabalhar nas subpáginas, não no redirect.
