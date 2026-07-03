---
name: auis-flow-bridge-solve
description: >
  Reads and applies UX flow edit suggestions stored in the flow-bridge
  (`/auis/styleguide/ux-flows/<flow>`). Pulls from the bridge using a
  filter chosen by the user (all of them, only one flow, only open ones, a
  specific ID, etc.), makes ONE PLAN BEFORE touching any code, waits for the
  user's approval, edits the canonical `NODES`/`EDGES` of the flow's page,
  and marks each suggestion as `in_review` in the bridge with
  `actor: { kind: "agent", id: "claude", name: "Claude" }` — the user then
  approves (apply) or rejects it from the page's inbox. Use whenever the
  user asks for "/auis-flow-bridge-solve", "avalia a sugestão X do
  flow Y" (evaluate suggestion X of flow Y), "apply the open suggestions for
  login-auth", "take today's suggestions and resolve them", "look at what's
  in the flow-bridge", or variations. Do not use it to start the server —
  for that, see `auis-flow-bridge`.
---

# Auis Flow Bridge — Resolver sugestões em lote

Esta skill é o **agente que aplica** as sugestões de edição dos UX flows.
Lê o flow-bridge, planeja as mudanças no código canônico da página do
flow, implementa, e devolve cada sugestão como `in_review` pro usuário
aprovar pelo inbox da página.

> Pré-requisito: o dev server do Next (`npm run dev`) está no ar — é onde
> vive a rota same-origin `/api/flow-suggestions`. **Não há servidor
> separado nem token** (cutover serverless feito).
>
> Persistência: `flow-bridge/data/suggestions.json` (+ `.archive.json`).

## Regra de ouro

**Você NÃO arquiva direto.** Sempre transiciona para `in_review` e deixa
o usuário aprovar (apply) pelo inbox. A única exceção é quando o usuário
pedir explicitamente "aplica e arquiva direto".

```
status atual → o que você faz
─────────────────────────────────
open         → in_review  (após editar o page.tsx do flow)
open         → reply       (skill atual não tem reply — caia pra pular + perguntar no chat)
in_review    → não tocar  (já está com você ou outro agente; só user pode aprovar/rejeitar)
applied/discarded → ignorar (já arquivado; outra fila)
```

## Identidade do actor

Em TODAS as chamadas que escrevem no bridge:

```json
{ "kind": "agent", "id": "claude", "name": "Claude" }
```

Se for outro modelo rodando em paralelo, use id estável diferente
(`claude-haiku`, `cursor`, etc.).

---

## Fluxo

### 0. Setup — ler as sugestões

Não há token nem servidor separado. Leia direto o arquivo do repo (mais
robusto) ou via a rota same-origin se o dev server estiver no ar:

```bash
# Opção A (preferida): ler o arquivo direto com a Read tool
#   flow-bridge/data/suggestions.json   (abertas + in_review)
#   flow-bridge/data/suggestions.archive.json   (applied/discarded)

# Opção B: via rota (dev server no ar) — sem token
curl -s "http://localhost:3000/api/flow-suggestions?status=open" | python3 -m json.tool
```

Pra **marcar `in_review`** no fim você precisa do dev server no ar (a rota faz
a transição). Se ele estiver fora, edite o JSON direto (mude `status` pra
`"in_review"` e adicione `resolution`) — mesmo efeito.

### 1. Parsear o filtro da request do usuário

| User disse | Filtro |
|---|---|
| "tudo" / sem filtro | `status=open` (default — não puxa in_review nem archive) |
| "as abertas" / "open" | `status=open` |
| "as em revisão" / "in_review" | `status=in_review` (mas NÃO mexa nelas — só lista) |
| "as de hoje" | `status=open` + filtrar `createdAt >= meia-noite local de hoje` |
| "as do flow login-auth" | `status=open&flow=login-auth` |
| "sugestão `abc12345`" / "id `abc12345`" | GET direto por id |

### 2. Buscar e priorizar

```bash
curl -s "http://localhost:3000/api/flow-suggestions?status=open" \
  | python3 -m json.tool > /tmp/flow-suggestions-open.json
# (ou leia flow-bridge/data/suggestions.json direto e filtre status == "open")
```

Ordem padrão: mais antigas primeiro (FIFO). Empate: mesmo `flow` em bloco
contínuo (você lê o `page.tsx` daquele flow uma vez só).

### 3. Plano — SEMPRE antes de tocar em código

Pra cada sugestão no escopo, monte uma linha:

```
- abc12345 · flow:login-auth · "primeiras 60 chars da descrição..."
  diff vs canônico: <N nodes adicionados, M edges, K nodes editados>
  proposta: <o que você vai aplicar no page.tsx, em 1 linha>
  arquivos: app/auis/styleguide/ux-flows/login-auth/page.tsx
  confiança: alta | média | baixa
  ação: aplicar | pular (motivo)
```

> Pra calcular o diff: compare os `nodes` e `edges` da sugestão com o
> `NODES`/`EDGES` exportados pelo `page.tsx` do flow. IDs novos = nodes
> adicionados. IDs sumidos = removidos. Mesma id com `data` diferente =
> editado. Mesma id com `position` diferente = reposicionado (raramente
> precisa codificar — o layout é matemático em `Y` e colunas).

Apresente plano consolidado pro user. **Espere aprovação explícita**
(AskUserQuestion com "aplicar tudo", "só os de confiança alta",
"cancelar"). Em auto mode, prossiga com "aplicar tudo" e avise no resumo
final.

### 4. Executar item por item

Pra cada sugestão marcada como **aplicar**:

1. Ler o `page.tsx` do flow (`/app/auis/styleguide/ux-flows/<flow>/page.tsx`).
2. Atualizar os arrays `NODES` e `EDGES`:
   - **Nó adicionado**: criar uma entrada nova com `type`, `data`, `position`. Se
     a posição parecer caótica (random do paleta), ajustar pra cair numa coluna
     coerente com `COL`/`COL_D` ou no corredor mais próximo.
   - **Nó editado**: alterar só os campos do `data` que mudaram (step, title,
     note, href / question).
   - **Nó removido**: tirar do array (e tirar edges órfãs).
   - **Edge nova**: criar com `edgeBase` ou `branchEdge` (sempre prefira esses
     dois — não escreva markup de edge cru).
   - **Edge removida**: tirar do array.
3. Se a sugestão também alterou nodes existentes que têm uma seção
   `screens = [...]` documentando elas no mesmo arquivo, **atualize também
   esse array** se a mudança for de propósito/título (deixa o documento
   coerente com o diagrama).
4. Marcar a sugestão como `in_review` no bridge:

```bash
curl -s -X PUT "http://localhost:3000/api/flow-suggestions/$ID" \
  -H "Content-Type: application/json" \
  -d '{
    "transition": "in_review",
    "actor": { "kind": "agent", "id": "claude", "name": "Claude" }
  }' | python3 -m json.tool
```

A resposta inclui `resolution.summary` no formato:
`Em revisão por Claude em DD/MM/YYYY às HH:MM:SS.`

### 5. Resumo final

```
✅ N aplicadas (em revisão no inbox de cada flow):
   - abc12345 · login-auth · 1 linha do que foi feito
   ...

⏭️ K puladas:
   - abc12345 · primeiro-acesso · motivo

▶ Abra /auis/styleguide/ux-flows/<flow> e clique no badge âmbar
  ("N sugestões") pra aprovar (apply) ou rejeitar (volta pra open).
```

---

## Decisões de "aplicar vs pular"

| Sinal | Decisão |
|---|---|
| Descrição clara + diff coerente com o flow | aplicar |
| Diff lógico mas posição estranha (random do paleta) | aplicar, mas reposicionar pra coluna/Y coerente |
| Descrição vaga ("melhorias") + diff grande | pular, pedir pro user clarificar |
| Sugestão muda jargão pra termo proibido (mobile, backend interno) | pular (memória: produto não tem mobile; repo é UI/UX) |
| Sugestão adiciona node com `href` apontando pra rota que não existe | aplicar mas substituir por `"#"` e avisar no resumo |

## Restrições

- ❌ Não use `transition: "apply"` nem `transition: "discard"` — só o user
  humano aprova/descarta pelo inbox da página.
- ❌ Não delete sugestões direto (`DELETE /api/flow-suggestions/:id`).
- ❌ Não toque em sugestões com `status: "in_review"` (já estão na fila do user).
- ❌ Não toque em sugestões do arquivo (`flow-bridge/data/suggestions.archive.json`)
  a menos que o user pergunte explicitamente.
- ❌ Não introduza novos tokens de cor / spacing / etc. — sempre use os
  já definidos em `globals.css`.
- ❌ Não reorganize componentes/imports do `page.tsx` que não foram
  alterados pela sugestão (mantém diff limpo).
- ✅ Sempre rodar `tsc --noEmit` no fim do lote (filtre por arquivo do
  flow). Se erro, NÃO marque `in_review` — fix primeiro.
- ✅ Se cair conexão no meio do lote, retomar do próximo id pendente.

## Filtros úteis

### Sugestões de hoje, abertas

```bash
TODAY_MS=$(python3 -c "import datetime;t=datetime.datetime.now().replace(hour=0,minute=0,second=0,microsecond=0);print(int(t.timestamp()*1000))")
curl -s "http://localhost:3000/api/flow-suggestions?status=open" \
  | TODAY_MS=$TODAY_MS python3 -c "
import sys, json, os
d = json.load(sys.stdin)
today_ms = int(os.environ['TODAY_MS'])
hoje = [s for s in d['suggestions'] if s['createdAt'] >= today_ms]
print(json.dumps({'count': len(hoje), 'ids': [s['id'] for s in hoje]}, indent=2))
"
```

### Tudo aberto de um flow

```bash
curl -s "http://localhost:3000/api/flow-suggestions?status=open&flow=login-auth"
```

### Uma sugestão específica

```bash
# A rota não tem GET por id; pegue da listagem e filtre, ou leia o JSON direto.
curl -s "http://localhost:3000/api/flow-suggestions" \
  | python3 -c "import sys,json;print([s for s in json.load(sys.stdin)['suggestions'] if s['id']=='abc12345'])"
```

### Sugestões que ficaram pendentes pra você revisar (pós-execução)

```bash
curl -s "http://localhost:3000/api/flow-suggestions?status=in_review" \
  | python3 -c "
import sys, json
d = json.load(sys.stdin)
for s in d['suggestions']:
    summary = s.get('resolution', {}).get('summary', '?')
    print(s['id'], '·', s['flow'], '·', summary)
"
```

## Troubleshooting

| Sintoma | Causa | Como contornar |
|---|---|---|
| rota não responde / `ECONNREFUSED` | dev server (`npm run dev`) fora do ar | subir o dev server, ou editar `flow-bridge/data/suggestions.json` direto |
| `404` numa transition | sugestão já arquivada/deletada | pular do lote |
| `400 transition inválida` | `transition` faltando/errada no body | usar só `in_review` \| `apply` \| `discard` \| `reject` |
| 0 sugestões retornadas | filtro restritivo demais | tirar `flow=` e ver listagem cheia primeiro |
| Diff complicado demais pra um lote | abortar o lote, fatiar por flow, pedir confirmação | "vou aplicar só o do flow X primeiro, ok?" |
