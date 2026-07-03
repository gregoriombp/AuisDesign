---
name: auis-review-bridge
description: >
  Explains that the Auis Review Mode bridge is now serverless and
  embedded in the Next app at `/api/review-bridge/*` — `npm run dev` already
  brings everything up, there is no separate process to start, no token,
  no env. Use this skill only when the user explicitly asks to
  "/auis-review-bridge", "subir o review-bridge" (start the
  review-bridge), spin up the review bridge, "ligar o servidor de
  comentários" (turn on the comments server), open the review-bridge,
  "/review-bridge", or similar — to redirect them and (only if they
  explicitly want the old Express) explain the opt-in legacy bridge via
  `npm run dev:bridge`. Does NOT resolve comments — for that, see
  `auis-review-bridge-solve`.
---

# Auis Review Mode — Bridge (serverless)

O review-bridge **virou serverless** (commit `2f7dd24e`, 24/06/2026). Os
endpoints agora ficam same-origin no próprio Next em `/api/review-bridge/*`,
gravando nos mesmos JSONs de sempre (`review-bridge/data/comments.json` e
`comments.archive.json`) com escrita atômica e lock global em
`app/api/review-bridge/_store.ts`.

**Não há nada pra subir manualmente.** `npm run dev` na raiz já liga tudo.
Sem token, sem `AUIS_REVIEW_TOKEN`, sem `NEXT_PUBLIC_*` de bridge.

Quando o user pede pra "subir o review-bridge", a resposta certa é
redirecioná-lo, em uma mensagem curta:

> O bridge agora roda dentro do Next, no mesmo `npm run dev` que você já
> usa. Não tem servidor separado nem token. Se o Review Mode não tá
> respondendo, confirma que o Next está em `http://127.0.0.1:3000`.

## Confirmar saúde (quando quiser diagnosticar)

```bash
curl -s http://127.0.0.1:3000/api/review-bridge/health
```

Esperado:

```json
{
  "ok": true,
  "service": "auis-review-bridge",
  "mode": "serverless",
  "schemaVersion": 3,
  "tokenRequired": false
}
```

Se isso falha, o problema é o Next (caiu, está em outra porta, ou nem
subiu). Não existe processo separado de bridge pra investigar.

## Restrições

- ❌ Não recrie `review-bridge/.env`, não regenere token, não escreva
  `NEXT_PUBLIC_AUIS_REVIEW_BRIDGE_URL` nem
  `NEXT_PUBLIC_AUIS_REVIEW_TOKEN` no `.env.local`. Esses envs só
  ativam o modo legado abaixo — em serverless eles fazem o frontend
  apontar pro Express morto em `:9878`.
- ❌ Não delete `review-bridge/data/comments.archive.json` "pra limpar" —
  é a fonte da aba Arquivados do Review Mode.
- ❌ Não exponha o Next em `0.0.0.0` nem faça port forwarding. O fluxo é
  local-only.

## Modo legado (Express) — opt-in, só se o user pedir

O servidor antigo em `review-bridge/src/index.ts` continua existindo, mas
como opt-in. Use **apenas se o user pedir explicitamente o Express**
(comparar comportamento, testar com outra instância, etc.):

```bash
npm run dev:bridge
```

Esse script roda `concurrently` e sobe duas coisas:

1. Next com `NEXT_PUBLIC_AUIS_REVIEW_BRIDGE_URL=http://127.0.0.1:9878`
   no env do processo (sem mexer no `.env.local` rastreado).
2. Express em `127.0.0.1:9878`, depois de `review-bridge:prepare` cuidar
   do token e dos envs.

Para verificar:

```bash
TOKEN=$(grep AUIS_REVIEW_TOKEN review-bridge/.env | cut -d= -f2)
curl -s -H "X-Review-Token: $TOKEN" http://127.0.0.1:9878/health
```

Os dois modos leem/gravam os mesmos arquivos JSON em `review-bridge/data/`,
então o estado é compartilhado — muda só quem responde aos endpoints.

> **Gotcha:** se você gravar `NEXT_PUBLIC_AUIS_REVIEW_BRIDGE_URL` no
> `.env.local` (rastreado), o frontend continua batendo em `:9878` mesmo
> num `npm run dev` normal. Mantenha esses envs fora do `.env.local`. O
> `dev:bridge` injeta no processo via `concurrently`, sem precisar de
> arquivo.

## Não use esta skill pra

- Resolver/aprovar/responder comentários em lote → `auis-review-bridge-solve`
- Auditar o que o agente mandou pra revisão → `auis-review-bridge-germano-audit`
- Patrulhar páginas e dropar pins novos → `auis-review-bridge-germano-explore`
