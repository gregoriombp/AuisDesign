---
name: auis-pg-merge-flow
description: >
  Merges a `.awflow.json` (exported from the PG repo) with a flow that
  already exists at `/auis/styleguide/ux-flows/[slug]`. Reads the
  file, compares it against the page's current `NODES`/`EDGES`, generates
  a readable diff, analyzes the UX viability of each change, asks for
  selective approval, and applies it. Always records an entry in
  `updates[]` when there is a structural change. Use when the user says
  "mesclar flow do PG" (merge the PG flow), "atualizar flow com o
  .awflow" (update the flow with the .awflow), "aplicar mudanças do
  design no flow X" (apply the design changes to flow X), "diff entre o
  flow local e o do PG" (diff between the local flow and the PG one), or
  attaches a `.awflow.json` whose slug already exists in `ux-flows/`. Do
  NOT use when the flow does not yet exist locally — for that case, use
  `auis-pg-create-flow`.
---

# Auis PG — Merge `.awflow.json` into existing flow

Compara um export do PG com o flow local correspondente, mostra o
delta, classifica cada mudança (estrutural vs cosmética vs
problemática em UX) e aplica seletivamente sob aprovação. Adiciona a
entrada de changelog quando há mudança estrutural.

## Pré-requisitos

- `app/auis/styleguide/ux-flows/_lib/awflow-import.ts` existe.
- O flow alvo já existe em `app/auis/styleguide/ux-flows/<slug>/page.tsx`.
- Se não existe, pare e redirecione pra
  [`auis-pg-create-flow`](../auis-pg-create-flow/SKILL.md).

---

## Step 1 — Carregar arquivo + flow local

1. Carregue o `.awflow.json` (path, conteúdo colado, ou anexo) e
   parse via `parseAuFlowFile`. Pare em erro.
2. Resolva o slug local:
   - default: `file.flow.id`
   - se o usuário usar um slug diferente (ex: PG `login` → local
     `login-auth`), confirme.
3. Leia o `page.tsx` do flow local e extraia `NODES` e `EDGES`
   (parse manual do array literal — não tenta executar o arquivo).

---

## Step 2 — Computar o diff

Compare por `id` (nodes) e por `from+to+label` (edges, já que edges não
têm id estável no PG nem no styleguide local).

### Diff de nodes

| Mudança | Detecção | Classificação |
|---|---|---|
| Node adicionado | id existe no .awflow mas não no local | `new-page` |
| Node removido | id existe no local mas não no .awflow | `removed-page` |
| `kind` mudou (screen ↔ decision) | mesmo id, kinds diferentes | `flow-rework` |
| `title` mudou | mesmo id, kinds iguais, titles diferentes | cosmético (não loga) |
| `position` mudou | mesmo id, kinds e títulos iguais, posições diferentes | cosmético (não loga) |
| `note`/`question` mudou | textuais | cosmético (não loga) |

### Diff de edges

| Mudança | Detecção | Classificação |
|---|---|---|
| Edge adicionada | (from,to,label) novo | `new-branch` se `branch=true`, senão `flow-rework` |
| Edge removida | (from,to,label) sumiu | `flow-rework` |
| Edge reroute | mesmo from, novo target ou novo label | `flow-rework` |

### Resultado

Produza uma estrutura assim antes de mostrar pro usuário:

```ts
{
  added: { nodes: AuFlowNode[]; edges: AuFlowEdge[] },
  removed: { nodes: LocalNode[]; edges: LocalEdge[] },
  changed: {
    nodes: Array<{ id, kind, title, fields: string[] }>,
    edges: Array<{ from, to, fields: string[] }>,
  },
}
```

Onde `fields` lista o que mudou (ex: `["title", "note"]`).

---

## Step 3 — Análise de viabilidade UX

Pra **cada item** do diff, classifique:

- 🟢 **Safe** — mudança estrutural clara, sem efeitos colaterais (ex:
  nova decision com branches simétricos).
- 🟡 **Review** — vale o usuário olhar antes (ex: tela removida que
  era terminal, fluxo perdeu caminho de volta, decision sem branch de
  erro, novo branch que diverge muito do padrão local).
- 🔴 **Block** — bloqueia até justificar (ex: remove tela que tem
  sugestões abertas no flow-bridge, edge aponta pra node inexistente,
  novo flow encerra com decision sem terminal).

**Não invente regras** — use senso comum. Se em dúvida, marque 🟡.

---

## Step 4 — Apresentar o diff + análise

Mostre ao usuário um resumo compacto:

```
Diff: <slug> (local) vs <repo PG>

Telas:
  + 3 novas:
    🟢 sso-connecting — "Conectando ao IdP" (SSO · screen)
    🟢 2fa-backup    — "Códigos de backup" (screen)
    🟡 sem-acesso    — "Sem acesso por este método" (terminal sem caminho de volta)
  - 1 removida:
    🟡 erro-generico — antes ligada a [email, password]; órfão depois

Decisions:
  + 1 nova:
    🟢 dec-auth-compat — "Org compatível c/ método?" (filtra anti-enumeração)
  ~ 1 alterada:
    🟢 dec-multiorg — pergunta mudou de "1 org?" pra "1+ org compatível?"

Edges:
  + 5 novas (3 branches âmbar)
  - 2 removidas (1 era branch)
  ~ 4 redirecionadas

Análise:
  🔴 0
  🟡 2 (vale revisar)
  🟢 todo o resto

Tags do changelog: ["new-page", "new-branch", "flow-rework"]
```

---

## Step 5 — Aprovação seletiva

Pergunte ao usuário:

1. **Aplicar tudo** (todos os deltas, ignora 🟡 — só bloqueia 🔴)
2. **Aplicar só os safe** (🟢) e listar os 🟡 manualmente
3. **Revisar item por item** — itera, pra cada delta pergunta
   "aplicar / pular / abortar"
4. **Abortar** — não muda nada

Se houver 🔴, **não aplica nenhum** até o usuário resolver.

Quando aplicar parcialmente, faça commit mental do conjunto aprovado e
prossiga.

---

## Step 6 — Aplicar no `page.tsx`

Edite `NODES` e `EDGES` no arquivo do flow:

- Adicione novos nodes/edges respeitando o pattern existente
  (`edgeBase`, `branchEdge`, `sourceHandle` em decisions).
- Remova nodes que sumiram + edges órfãs ligadas a eles.
- Atualize campos textuais quando aprovado (title/note/question).
- **Preserve `href` dos nodes existentes** — o PG não tem essa info,
  então não sobrescreva o que está local. Pra screens NOVAS, pergunte
  href igual à skill `auis-pg-create-flow` Step 4.
- Atualize a `position` quando aprovado — não mexa em layout sem o
  usuário confirmar (decisões de geometria são caras de refazer).

---

## Step 7 — Adicionar entrada em `updates[]`

Se houve mudança estrutural (alguma das tags `new-page`,
`removed-page`, `new-branch`, `flow-rework`, `integration` se aplica),
adicione **uma única entrada** no topo do `updates`:

```ts
{
  date: "<YYYY-MM-DD hoje>",
  summary: "<frase única PT-BR, ≤140 chars descrevendo o conjunto>",
  tags: [...],
}
```

Resumo é UMA frase descrevendo o conjunto, não item-por-item. Ex:

- "SSO ganhou fast-lane via HRD e novo gate de compatibilidade por
  método de auth (anti-enumeração)."
- "Removida a tela genérica de erro; cada decisão agora tem caminho de
  erro próprio."

Se a página ainda **não tem** scaffolding de updates (import,
`const updates`, render do badge + history section), adicione
seguindo o que a skill `auis-update-ux-flow` Step 4 descreve.

---

## Step 8 — Validação

```bash
npm run typecheck
```

Visual:

- Badge "Atualizado em <data>" atualizou.
- Histórico de atualizações lista a nova entrada no topo com as tags
  corretas (pills coloridas).
- Diagrama reflete a estrutura nova.
- Cards das telas novas mostram o href correto.

Pra cada tela que era 🟡 ou 🔴, ofereça preview de cuidado especial.

---

## Output esperado

```md
Flow atualizado: <meta.title>

Rota: /auis/styleguide/ux-flows/<slug>

Aplicado:
  + N nodes / + N edges
  - N nodes / - N edges
  ~ N mudanças textuais

Pulado (🟡 não-aprovado): N
Bloqueado (🔴): N

Tags: [new-page, new-branch, ...]
Summary: <linha registrada no changelog>

Arquivos:
- app/auis/styleguide/ux-flows/<slug>/page.tsx — NODES/EDGES + updates

Validação:
- typecheck: passed
```

---

## O que NÃO fazer

- **Não sobrescreva `href` existentes** das telas. PG não tem essa info
  — manter o que já está no flow local.
- **Não rode merge automaticamente**. Sempre pede aprovação, mesmo
  quando tudo é 🟢.
- **Não cole a narrativa/screens specs do `.awflow` em comentários do
  page.tsx** — esses dados ficam disponíveis pra a skill ler quando
  precisar (do JSON), mas o `page.tsx` permanece enxuto.
- **Não delete updates anteriores.** Só prepend; nunca rewrite history.
- **Não combine com create.** Se o flow não existe, é
  `auis-pg-create-flow`.
- **Não tente "mesclar" comentários do flow-bridge.** Esse é outro
  domínio — sugestões abertas no bridge devem ser resolvidas separado
  via `auis-flow-bridge-solve` antes ou depois desse merge.
