# Plano de organização do design system — estado e backlog

> Documento vivo. **A contagem exata de dívida é sempre `npm run ds:check`** — este
> arquivo descreve a estratégia e os baldes (que não mudam), não listas de arquivo
> congeladas (que envelheceriam). Iniciado em 2026-06-13.

## 1. Por que isto existe (problema original)

O dono do repo (não-especialista em DS) relatou: agentes de IA criam componentes do
zero em vez de reusar os átomos (`AuButton`, `Icon`, `AuInput`); muito hardcode
(`#hex`, `w-[37px]`, `<svg>` cru, ícones hardcoded); componentes que pareciam
duplicados (cards, tabelas); regras/skills confusas e com coisas obsoletas; e medo de
ter "instalado mil libraries". **Objetivo:** organizar o DS de modo que, ao pedir algo
a um agente, ele ache a referência na hora — e pare de poluir o repo.

## 2. O que foi feito

### Etapa 1 — Fundação (concluída)
- **Índice pra IA:** [`docs/component-map.md`](./component-map.md) — "preciso de X → use Y →
  import → cuidado", vocabulário de tokens reais, desambiguação de famílias
  (cards/tabelas/modais), status do Fluid, primitivos sancionados.
- **Regras endurecidas:** [`AGENTS.md`](../AGENTS.md) — composição atômica promovida (§3),
  ponteiro pro índice, regra "ícone = `Icon`, nunca `<svg>` cru", status do Fluid.
- **Checklist atômico restaurado** nas skills `auis-new-component`/`-new-page`
  (o refactor `a95f7bf` do "Codex" tinha comprimido demais essa parte — causa-raiz do
  sintoma "não compõe atômico").
- **Skills Au-cegas neutralizadas** (`design-system-*`, `setup-design-system-from-*`) —
  mantidas no disco como registro do setup inicial, com a `description` neutralizada (não
  disparam mais) e banner no corpo que redireciona pras `auis-*`.
- **Guard-rail:** [`scripts/ds-check.mjs`](../scripts/ds-check.mjs) (`npm run ds:check`,
  só-aviso) — pega hex hardcoded, valores arbitrários, `<svg>` cru, primitivo cru com
  wrapper Au, e drift do índice.
- Limpeza de stale: rota morta `knowledge-os` removida do `PRODUCT_CONTEXT.md`.

### Etapa 2 — Tipografia (concluída e verificada no app)
- Descoberta: ~85% do "hardcode" era uma **rampa de tipo sem token** (o produto usa
  10/11/13/15px, que a escala do Tailwind pula). `card.tsx`/`table.tsx`/`chart.tsx`
  **não eram duplicatas** — são a base shadcn do subsistema `tool-ui` (ligada aos tokens
  por um compat layer). **Não deletar.**
- **Skill nova** [`auis-foundation-update`](../.claude/skills/auis-foundation-update/SKILL.md):
  update de token incremental, aditivo, sem rebootstrap/clobber. Autorizada no `AGENTS.md`
  junto da `foundation`.
- `text-2xs`(11px) e `text-3xs`(10px) adicionados (font-size puro) e adotados nos
  10/11px do produto — **verificado pixel-idêntico** no app.
- `13/15/17/9px` (drift entre degraus) racionalizados pros degraus padrão
  (`text-sm`/`base`/`lg`/`text-3xs`) — **before/after sem quebra** (settings/perfil +
  tabela de funções).
- Resultado da Etapa 2 (snapshot 2026-06-13): `ds:check` **479 → 322 avisos**. Marco
  histórico — a contagem de hoje é sempre `npm run ds:check`, não este número.

Histórico real: `git log` (commits `docs(component-map)…` até `refactor(tokens): racionaliza…`).

## 3. O que falta (backlog) — rode `npm run ds:check` pra o número do dia

Acabaram os ganhos mecânicos; **tudo daqui pra frente é caso-a-caso, com verificação
visual.** Em ordem de valor:

| Balde | ~Qtd | Abordagem |
|---|---|---|
| **`<svg>` cru — triar** | ~117 | A queixa original nº 1, mas **não é "tudo vira `Icon`"**. Triar cada um (ver _Estratégia de ícones_ abaixo): ícone normal → biblioteca (`Icon`); animação/visual custom → componente próprio. |
| **Cores cruas** (`text-gray-400`…) | ~64 | Mapear pro token semântico **por papel** (texto secundário → `text-fg-secondary`, borda → `border-subtle`…). |
| **`text-[Npx]` "no degrau"** (12/14/16/18/20/24/30) | ~64 | Têm token, mas migrar adiciona o line-height do Tailwind → **verificar visual** (ou usar as utilities semânticas `body-*`). |
| **Spacing `p/gap-[18px]`** | ~16 | Snap pro grid (4px) ou aceitar como exceção. |
| Notas `w/h-[..]` | ~302 | Baixa prioridade — largura/altura sem token costuma ser intencional. |

### Estratégia de ícones (refina o balde `<svg>` acima)

Os `<svg>` crus em produto **não são todos ícones** — o plano **não** é achatar tudo em
`Icon`. Triar cada um em dois destinos:

- **Ícone normal** (setas, lixeira, check, chevron, etc.) → trocar pela **biblioteca**
  (`Icon` / Material Symbols Rounded). Aproveitar a passada pra **enriquecer a cobertura**:
  o Material Symbols tem muito mais glifo do que se usa hoje — padronizar nele em vez de
  svgs ad-hoc. É o grosso dos ~117.
- **Animação / visual custom** (a animação do Agent Studio, visuais da Memory Base, orbs
  dos agentes, ilustrações de marca) → **não são ícones.** Mantêm SVG/Canvas/WebGL e,
  quando reusados, viram **componente dedicado `Au*`** (vários já são — `AuAgentCore`,
  `AuBrandIllustration`, `AuBeams`…, e por isso o `ds:check` já os allowlista). A tarefa
  aqui é só avaliar caso-a-caso se falta formalizar algum `<svg>` de página como componente.

Regra: a **triagem** decide o destino de cada `<svg>`; **só os normais viram `Icon`**. Os
custom/animados nunca são "consertados" pra `Icon` — seriam uma regressão.

### Backlog maior (fora do escopo "Fundação", decidido adiar)
- **Fluid "leva 2":** fundir os motores do Fluid nos primitivos `Au*` (um único
  `AuToggle`/`AuSlider`…), removendo os 8 primitivos `fluid/*` duplicados. **Confirmar a
  licença do upstream antes.**
- **Perf:** `dynamic()`/lazy-load do `three.js` (~1.2MB, hoje eager em ~6 lugares).

## 4. Como retomar com eficiência (fresh session)

1. Ler `AGENTS.md` + `docs/component-map.md`; rodar `npm run ds:check` pra ver a dívida atual.
2. Escolher **um balde** e atacar **por página** (não tudo de uma vez).
3. Padrão seguro já provado:
   - **Token novo?** Só via `auis-foundation-update` (aditivo; `@theme`+`:root`+dark
     em sincronia). Conversão font-size-puro = zero mudança; mudar valor em uso = verificar visual.
   - **Mudou tamanho/leading/cor/ícone?** Screenshot before/after (Playwright) numa página
     densa antes de commitar.
4. Commits atômicos + push pra `origin/main` ao fim de cada balde/página (preferência do dono).

## 5. Por que isto NÃO vira AI slop nem fica outdated

- **Slop:** a Fundação (índice + regras + checklist + `ds:check` + tokens) é exatamente o
  que **impede** slop no trabalho NOVO. Telas novas leem o mapa, reusam `Au*`, usam os
  tokens e são pegas pelo `ds:check`. **Pode construir à vontade** — o backlog acima é
  dívida LEGADA, isolada em telas antigas; ela não contamina telas novas. Só rode
  `ds:check` no que tocar.
- **Outdated:** este doc aponta pro `ds:check` como fonte viva da contagem e descreve
  **baldes + abordagem** (duráveis), não listas de arquivo. Os números mudam; a estratégia não.
