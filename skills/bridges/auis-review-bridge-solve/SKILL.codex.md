---
name: auis-review-bridge-solve
description: >
  Resolves Auis Review Mode comments in bulk. Reads from the local
  review-bridge using a filter chosen by the user (all of them, only
  today's, only open ones, a specific page, explicit IDs, etc.), makes ONE
  PLAN BEFORE touching any code, waits for the user's approval, implements
  the fixes, and marks each comment as `in_review` in the bridge with
  `actor: { kind: "agent", id: "claude", name: "Claude" }` — the user then
  approves or rejects it afterward via the inbox. It can also respond with a
  question (an agent reply) when a comment is ambiguous. Use whenever the
  user asks for "/auis-review-bridge-solve", "resolve todos os
  comentários do review" (resolve all the review comments), "pega os de hoje
  e resolve" (take today's and resolve them), "resolve os abertos em lote"
  (resolve the open ones in bulk), "resolva os comments do /pagina/x"
  (resolve the comments on /page/x), "responder os comments do bridge"
  (reply to the bridge comments), or variations. Do NOT use it to start the
  server — for that, see `auis-review-bridge`.
---

# Auis Review Bridge — Resolver em lote

Esta skill é o **agente que resolve** os comentários do Review Mode. Ela
lê o bridge local, planeja correções, implementa, e devolve cada item
marcado como **em revisão** pra o usuário aprovar pelo inbox.

> Pré-requisito: `npm run dev` já está rodando na raiz. Esse comando sobe o
> Next e o review-bridge local juntos.
>
> Arquitetura, endpoints e payloads completos: `review-bridge/README.md`.

## Regra de ouro

**Você NÃO arquiva direto.** Sempre transiciona para `in_review` e deixa
o usuário aprovar. A única exceção é quando o usuário pedir
explicitamente "arquive direto" / "marca como resolvido sem revisão".

```
status atual → o que você faz
─────────────────────────────────
open         → in_review  (após implementar a correção)
open         → reply       (se você quer uma opinião do user antes)
in_review    → não tocar  (já está com você ou outro agente; só user pode aprovar/rejeitar)
resolved     → ignorar     (já arquivado; outra fila)
```

## Identidade do actor

Em TODAS as chamadas que escrevem no bridge, use:

```json
{ "kind": "agent", "id": "claude", "name": "Claude" }
```

Se for um agente diferente (Haiku, Sonnet rodando em paralelo, etc.), use
um id estável diferente (`claude-haiku`, `cursor`, etc.) e um `name` legível.

---

## Fluxo

### 0. Setup — ler env e validar bridge

```bash
# Token do bridge (servidor)
TOKEN=$(grep AUIS_REVIEW_TOKEN review-bridge/.env | cut -d= -f2-)

# URL do bridge — preferir o que o frontend usa
BRIDGE_URL=${BRIDGE_URL:-http://127.0.0.1:3000/api/review-bridge}

# Confere se o servidor está vivo
curl -s "$BRIDGE_URL/health" | python3 -c "import sys,json;d=json.load(sys.stdin);assert d['ok'] and d['schemaVersion']==3, d"
```

Se falhar, parar com mensagem dizendo pra rodar `npm run dev` na raiz e voltar.

### 1. Parsear o filtro da request do usuário

Mapeie o que o user pediu pro filtro certo:

| User disse | Filtro a aplicar |
|---|---|
| "todos os comentários" / "tudo" / sem filtro | `status=open` (default — não puxa in_review nem archive) |
| "os abertos" / "open" | `status=open` |
| "os em revisão" / "in_review" / "pendentes minha aprovação" | `status=in_review` (mas você NÃO deve mexer nesses; aborte com explicação) |
| "os de hoje" | `status=open` + filtrar `createdAt >= meia-noite local de hoje` |
| "os de ontem pra cá" / "últimos N dias" | `status=open` + filtro de data |
| "os da página X" / "/perfil" | `status=open&url=/perfil` |
| "comentário cmt-xxx" | GET direto por id |
| "responda os abertos com pergunta" | filtro `status=open`, mas em vez de implementar, postar reply |

Memória relevante:
> Memory `feedback_review_bridge_filter` — `status === "open"` puxa
> comments velhos sem filtro adicional. SEMPRE filtre por
> `createdAt >= today_midnight` quando o user falar "hoje". E SEMPRE
> filtre por `url` quando o user está focado em uma página.

### 2. Buscar e ranquear

```bash
curl -s -H "X-Review-Token: $TOKEN" "$BRIDGE_URL/comments?status=open" \
  | python3 -m json.tool > /tmp/review-bridge-open.json
```

Aplique os filtros adicionais (data, url, autor) em Python ou jq.

Ranking padrão pra ordem de processamento:
1. Comentários mais antigos primeiro (FIFO — user já espera há mais tempo).
2. Empate: mesma URL → bloco contínuo (pra você ler aquele arquivo só
   uma vez no plano).

### 3. Plano — SEMPRE antes de tocar em código

Pra cada comentário no escopo, monte uma linha:

```
- cmt-xxx · /url/da/pagina · "primeiras 60 chars do texto..."
  proposta: <o que você vai mudar, em 1 linha>
  arquivos: <arquivo:linha> (opcional, se já identificou)
  confiança: alta | média | baixa
  ação: implementar | responder com pergunta | pular (motivo)
```

Apresente o plano consolidado pro user com:
- Total de comments no escopo
- Quantos "implementar", "responder", "pular"
- Lista detalhada (até 30; se passar de 30, use AskUserQuestion pra confirmar
  prosseguir ou fatiar)

**Espere aprovação explícita** antes de executar (AskUserQuestion com
opções "executar tudo", "executar só os de confiança alta", "cancelar").
Em auto mode, prossiga com "executar tudo" mas avise no resumo final.

### 4. Executar item por item

Pra cada comentário marcado como **implementar**:

1. Ler o arquivo da página (`comment.url` → mapear pra `app/.../page.tsx`
   ou o componente correspondente). Anchor tem `viewportWidth/Height` e
   `scrollY` — use só pra contexto, não pra precisão pixel-perfect.
   - Antes de editar, leia `comment.context` quando existir. Use
     `context.target.label`, `context.target.text`, `context.target.attributes`,
     `context.target.fingerprint` e `context.nearbyText` para identificar o alvo
     real de pedidos curtos como "remove isso" ou "troca esse texto". Se o
     contexto contradiz a coordenada visual, confie primeiro no texto/label do
     alvo e confirme no código da página.
   - **Comentário de UX flow** (`comment.origin === "ux-flow"`): foi deixado
     no diagrama de um flow do styleguide. Tem `flowRef: { flow, nodeId,
     nodeLabel }` — a correção vai nos arrays `NODES`/`EDGES` de
     `app/auis/styleguide/ux-flows/<flow>/page.tsx` (o nó é `flowRef.nodeId`).
     Trate como uma edição de fluxo (mesma lógica de `auis-update-ux-flow`)
     e registre changelog se for mudança estrutural. Depois marque o comment
     `in_review` igual aos demais.
2. Implementar a correção no código com Edit/Write.
3. Marcar o comment como `in_review`:

```bash
curl -s -X PUT "$BRIDGE_URL/comments/$ID" \
  -H "X-Review-Token: $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "transition": "in_review",
    "actor": { "kind": "agent", "id": "claude", "name": "Claude" }
  }' | python3 -m json.tool
```

A resposta deve incluir `resolution.summary` no formato:

```
Resolvido por Claude em DD/MM/YYYY às HH:MM:SS.
```

Anote o id+summary pra colocar no resumo final.

Pra os marcados como **responder com pergunta**:

```bash
curl -s -X POST "$BRIDGE_URL/comments/$ID/replies" \
  -H "X-Review-Token: $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "authorKind": "agent",
    "authorId": "claude",
    "authorName": "Claude",
    "authorColorToken": "var(--au-purple-600)",
    "text": "<sua pergunta concisa, terminando em ?>"
  }'
```

Não marque esses como `in_review` — eles ficam `open` esperando o user
responder na thread.

### 5. Resumo final

Reportar pro usuário em uma mensagem só (não vai goteirando):

```
✅ N implementados (em revisão no inbox):
   - cmt-... · /url · 1 linha do que foi feito
   ...

💬 M respondidos (esperando você na thread):
   - cmt-... · /url · "pergunta?"
   ...

⏭️ K pulados:
   - cmt-... · /url · motivo

▶ Confira o inbox em /auis/styleguide/review pra aprovar/rejeitar
  os implementados. Aprovar move pro arquivo; rejeitar volta pra "open".
```

Mencionar o badge âmbar com a contagem que apareceu no toolbar.

---

## Decisões de "implementar vs responder vs pular"

| Sinal no texto do comentário | Decisão |
|---|---|
| "muda X para Y" / "deveria ser Y" / instruções claras | implementar |
| "isso parece estranho" / "não gostei" / sem direção | responder com pergunta pedindo direção |
| "quebrado" / "bug" / aponta um problema concreto na UI | implementar (investigar e corrigir) |
| pergunta direta ao agente ("@claude, qual...") | responder |
| screenshot anexada + sem texto | responder com "o que você quer mudar nessa marcação?" |
| comentário se referindo a backend/dados | pular (memória: repo é UI/UX, devs cuidam do backend) |
| referência a feature mobile | pular (memória: produto não tem mobile) |

## Restrições

- ❌ Não use `transition: "approve"` nem `transition: "resolve_direct"` —
  só o user humano aprova/arquiva direto.
- ❌ Não delete comentários (`DELETE /comments/:id`).
- ❌ Não toque em comentários com `status: "in_review"` (já estão na fila do user).
- ❌ Não toque em comentários do arquivo (`/comments/archive`) a menos que
  o user pergunte explicitamente.
- ❌ Não responda à thread se o reply é "OK" / sem conteúdo. Reply é pra
  fazer pergunta legítima.
- ❌ Não bata em todos os endpoints sem token — vai voltar 401.
- ✅ Sempre pegar timezone do servidor pro `summary` (o bridge faz isso
  sozinho — não recalcule no cliente).
- ✅ Se cair conexão no meio do lote, retomar do próximo id pendente
  (o status `in_review` já persistido protege contra repetição).

## Filtros úteis — receitas prontas

### Hoje, status open

```bash
TODAY_MS=$(python3 -c "import datetime;t=datetime.datetime.now().replace(hour=0,minute=0,second=0,microsecond=0);print(int(t.timestamp()*1000))")
curl -s -H "X-Review-Token: $TOKEN" "$BRIDGE_URL/comments?status=open" \
  | python3 -c "
import sys, json, os
d = json.load(sys.stdin)
today_ms = int(os.environ['TODAY_MS'])
hoje = [c for c in d['comments'] if c['createdAt'] >= today_ms]
print(json.dumps({'count': len(hoje), 'ids': [c['id'] for c in hoje]}, indent=2))
" TODAY_MS=$TODAY_MS
```

### Tudo open de uma URL específica

```bash
URL_ENC=$(python3 -c "import urllib.parse,sys;print(urllib.parse.quote(sys.argv[1]))" "/settings/perfil")
curl -s -H "X-Review-Token: $TOKEN" "$BRIDGE_URL/comments?status=open&url=$URL_ENC"
```

### IDs específicos

```bash
for ID in cmt-aaa cmt-bbb cmt-ccc; do
  curl -s -H "X-Review-Token: $TOKEN" "$BRIDGE_URL/comments/$ID" \
    | python3 -c "import sys,json;d=json.load(sys.stdin);c=d['comment'];print(c['id'], '-', c['status'], '-', c['text'][:80])"
done
```

### Conferir o que ficou pra você revisar (pós-execução)

```bash
curl -s -H "X-Review-Token: $TOKEN" "$BRIDGE_URL/comments?status=in_review" \
  | python3 -c "
import sys, json
d = json.load(sys.stdin)
for c in d['comments']:
    s = c.get('resolution', {}).get('summary', '?')
    print(c['id'], '·', c['url'], '·', s)
"
```

## Troubleshooting

| Sintoma | Causa | Como contornar |
|---|---|---|
| `401` | token errado | reler `review-bridge/.env` (linha pode ter espaço extra) |
| `404` numa transition | comment já foi arquivado/deletado | pular do lote |
| `400 invalid_actor` | esqueci de mandar `actor` no body | sempre incluir `{kind,id,name}` |
| 0 comentários retornados quando deveria ter | filtro pegou só `status=open`, mas o que quer pode estar em `in_review` ou archive | rever filtro |
| Lote demorado, conexão caiu | mantém o que já marcou; refazer pegando `status=open` de novo já vai pular os que viraram `in_review` | OK by design |
| Comment volta como `open` mesmo depois de eu marcar in_review | user rejeitou — você não precisa repetir, espere ele ajustar a request | OK |
