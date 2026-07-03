---
name: auis-review-bridge-dispatch
description: >
  The /loop dispatcher for the Auis Review Bridge — the "motor" that turns
  comments into live agent commands. One pass = read the dispatch queue
  (`/api/review-bridge/dispatch-queue`): OPEN, user-authored comments that
  @mention an agent the user ENABLED in the floating Auis dot, already gated
  by the double-lock (Live Response = reply only; Auto Construct + `#now` = act).
  For each item it routes by agent and mode: @Claude respond → replies in-thread;
  @Claude act (with #now) → runs the referenced `/skill` (or infers solve /
  ux-writing / edit-bridge-solve), implements, marks the comment `in_review` for
  the user's inbox, and replies a summary; @Germano respond → posts a UI/UX read;
  @Germano act (with #now) → runs his explore/audit skills and replies the
  findings. Meant to run under `/loop` (e.g. "/loop 30s /auis-review-bridge-dispatch"
  or self-paced) so the bridge feels live — it only acts on agents the user turned
  on in the dot, and `#now` is required for any code change. Use when the user
  says "/auis-review-bridge-dispatch", "liga o motor dos agentes" (turn on
  the agents' motor), "roda o dispatcher do bridge" (run the bridge dispatcher),
  "faz os agentes responderem os @ no review" (make the agents answer the @ in
  review), "processa a fila de menções" (process the mention queue), "inicia o
  loop de despacho", or sets up a loop over the review bridge mentions. Does NOT
  author comments (that is the in-browser Review Mode) and does NOT start the
  server (that is `auis-review-bridge`).
---

# Auis Review Bridge — Dispatcher (o motor `/loop`)

Esta skill é **o motor** que faz as menções (`@agente`, `/skill`, `#now`) dos
comentários do Review Mode virarem ação. O bridge é armazém passivo; **esta skill
é o que vigia e despacha**. Uma invocação = **uma passada** pela fila. Quem dá a
cadência é o `/loop` (ex.: `/loop 30s /auis-review-bridge-dispatch`, ou sem
intervalo pra você mesmo se cadenciar). Não faça loop interno — faça um passe e
retorne.

> Pré-requisito: `npm run dev` rodando na raiz. O bridge é **serverless, embutido
> no Next** (rotas `/api/review-bridge/*`, same-origin, sem token). Source of
> truth: `app/api/review-bridge/*/route.ts`.

## A trava dupla (já aplicada pelo endpoint)

O usuário controla cada agente na **bolota** (Live Response / Auto Construct). A
fila (`/dispatch-queue`) já resolve isso — você **não** re-decide o gate:

```
Live Response ON, sem #now (ou Auto OFF)  → mode "respond"  (só fala, nunca toca código)
Auto Construct ON  +  #now no comentário  → mode "act"      (executa e manda pra revisão)
agente desligado na bolota                → não entra na fila
pin autorado por agente (ex.: Germano)    → não entra na fila (sem self-loop)
comentário que o agente já respondeu      → não entra na fila (idempotente)
```

## Identidade do actor (em TODA escrita no bridge)

```json
Claude  → { "kind": "agent", "id": "claude",  "name": "Claude" }
Germano → { "kind": "agent", "id": "germano", "name": "Germano Faccio" }
```

---

## Fluxo

### 0. Validar o bridge

```bash
# Porta do SEU dev server (3000 padrão; 3001 no setup do Germano). NÃO leia
# BRIDGE_URL do env (um .env.local antigo aponta pro Express morto na :9878).
BRIDGE_URL=http://127.0.0.1:3000/api/review-bridge
curl -s "$BRIDGE_URL/health" >/dev/null || { echo "bridge offline — rode 'npm run dev' na raiz"; exit 0; }
```

### 1. Puxar a fila

```bash
curl -s "$BRIDGE_URL/dispatch-queue" | python3 -m json.tool > /tmp/dispatch-queue.json
# opcional, focar numa página:  "$BRIDGE_URL/dispatch-queue?url=/perfil"
```

Cada item: `{ commentId, url, agentId, agentName, mode, text, skills[], createdAt }`.
O objeto `settings` no fim diz quais toggles estão ligados (use pra reportar).

### 2. Fila vazia

Se `items` for `[]`, **encerre o passe** com uma linha curta: nada acionável +
quais agentes/capacidades estão ligados (do `settings`). Não escreva nada no
bridge. O `/loop` chama de novo no próximo tick.

### 3. Despachar item por item (ordem FIFO já vem pronta)

Roteie por `agentId` × `mode`:

| Agente | `respond` | `act` (tem `#now`) |
|---|---|---|
| **claude** | Lê o comentário (+ `context` quando houver) e **responde no thread** com uma resposta útil e curta, na voz do produto — responde a pergunta, dá a info, ou pede esclarecimento. **Não toca em código.** | Ver "Claude · act" abaixo. |
| **germano** | **Responde** com leitura/opinião/diagnóstico de UI/UX na **voz do Germano** (crítico, premium — Vercel/Linear/Apple). Não toca em código, não transiciona. | Ver "Germano · act" abaixo. |

**Claude · act** (executa de verdade):
1. Se o item traz uma `skill` citada → invoque **essa** skill, escopada na `url`
   da página. Se não traz, **infira** pela intenção do texto:
   - "resolve os comentários / ajusta isso" → `auis-review-bridge-solve` (na `url`).
   - "ajusta o texto / microcopy / UX writing" → `auis-ux-writing`.
   - "materializa as edições do live edit" → `auis-edit-bridge-solve`.
   - **Ambíguo demais** → não aja: **responda com uma pergunta** (reply, actor claude) e pare nesse item.
2. As sub-skills rodam em **modo auto** aqui: o `#now` JÁ é o "pode ir" — não
   peça aprovação no meio do loop. O gate final do usuário é o **inbox** (você marca
   `in_review`, ele aprova/rejeita).
3. Feita a mudança: **marque o comentário `in_review`** (actor claude) e **poste
   um reply** com 1–2 linhas do que mudou (+ arquivos tocados).

**Germano · act** (análise completa):
1. Rode a(s) skill(s) dele conforme o pedido: `auis-review-bridge-germano-explore`
   (patrulha a página e pina sugestões) e/ou `auis-review-bridge-germano-audit`
   (segunda opinião nos `in_review`), escopadas na `url`.
2. Poste um **reply** no comentário original com o resumo do que ele viu/pinou
   (actor germano). Germano **não edita código nem marca `in_review`** — as skills
   dele só comentam/pinam; então **não transicione** o comentário original.

#### Chamadas de escrita

```bash
# Reply (responder no thread)
curl -s -X POST "$BRIDGE_URL/comments/$CID/replies" -H 'content-type: application/json' \
  -d '{"authorKind":"agent","authorId":"claude","authorName":"Claude","text":"..."}'

# Transição pra revisão (só Claude, depois de implementar)
curl -s -X PUT "$BRIDGE_URL/comments/$CID" -H 'content-type: application/json' \
  -d '{"transition":"in_review","actor":{"kind":"agent","id":"claude","name":"Claude"}}'
```

### 4. Fechar o passe

Resumo curto: quantos itens, o que cada agente fez (respondeu / executou+revisão /
analisou), e o que pulou (e por quê). Nada de `git`/PR aqui — isso é fluxo do
o usuário (`/commit`).

## Regras de segurança

- **Nunca arquive direto.** Claude sempre vai pra `in_review`; o usuário aprova.
- **Só age com `#now`.** Sem o directive, todo @menção é `respond` (fala, não toca código) — a fila garante isso, mas nunca "promova" um respond a act por conta própria.
- **Não invente agente nem skill.** Só claude/germano e as skills do registro. Item de agente desconhecido não vem na fila; se vier algo estranho, pule e reporte.
- **Um actor por escrita**, sempre o do agente que está agindo (tabela acima).
