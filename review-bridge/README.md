# Auis Review Bridge

Backend local que guarda os comentários visuais do **Review Mode** (Auis)
e os expõe pra agentes rodando na mesma máquina. Desde o commit
`2f7dd24e` o bridge virou **serverless**: as rotas vivem dentro do Next em
`/api/review-bridge/*` (same-origin), sem token e sem `.env`. Os dados continuam
nos mesmos arquivos JSON em `review-bridge/data/` — só a casca mudou.

> **Como subir:** `npm run dev` na raiz já sobe tudo. Não precisa de token, não
> precisa de `.env.local`, não precisa de um segundo processo.
>
> **Modo legado opt-in:** `npm run dev:bridge` ainda existe e sobe o servidor
> Express avulso na `:9878` em paralelo com o Next (config velha:
> `NEXT_PUBLIC_AUIS_REVIEW_BRIDGE_URL=http://127.0.0.1:9878`). Use só se
> tiver motivo específico pra rodar o bridge fora do Next — não é a fonte
> recomendada e o `src/` do Express não recebe mais features novas.

---

## Lifecycle de um comment

```
                       ┌─────────────────────────────────────┐
                       │                                     │
                       ▼                                     │
  (cria pin/desenho)  open  ──── transition: in_review ─►  in_review
                       │                                     │
                       │ transition: resolve_direct          │ transition: approve
                       │ (user marca como resolvido)         │ (user aprova revisão)
                       │                                     │
                       └─────────►  resolved  ◄──────────────┘
                                       │
                                       │ comments.archive.json
                                       │
                                       ▼
                                  (arquivado — fora da listagem padrão)

  in_review  ── transition: reject ──►  open       (rejeita: volta pra ativo)
  resolved   ── transition: reopen_from_archive ──►  open  (desarquiva)
```

**Resumo:**

- `open` → comment ativo, ninguém ainda alegou resolver.
- `in_review` → algum **agente** ou **usuário** alegou resolver e está aguardando aprovação humana. Vive no mesmo arquivo que os abertos.
- `resolved` → aprovado. **Sai fisicamente** de `comments.json` e vai pra `comments.archive.json`.

A separação física do arquivo existe para que **agentes que leem o JSON pra contexto** só vejam comments ainda em jogo — sem ler centenas de comments já resolvidos que vazam pra dentro da janela de contexto.

---

## Arquivos de dados

| Arquivo | Conteúdo | Quando ler |
|---|---|---|
| `data/comments.json` | comments com status `open` e `in_review` + identidades dos revisores | sempre |
| `data/comments.archive.json` | comments com status `resolved` (arquivados) | só quando você precisa consultar histórico |

`schemaVersion = 3`. Tanto o backend serverless (`app/api/review-bridge/_store.ts`)
quanto o Express legado escrevem nesse formato. Se você ainda tiver dados v2 por
aí, veja a seção [Migração v2 → v3](#migração-v2--v3) — no fluxo padrão a
migração já aconteceu há bastante tempo.

---

## API HTTP

Base URL local: `http://127.0.0.1:3000/api/review-bridge` (porta padrão do
`next dev`; se você rodou com `PORT=xxxx`, troque). **Sem token, sem header
custom** — é uma rota Next como qualquer outra do app.

### Listagem

| Método | Path | Descrição |
|---|---|---|
| `GET` | `/health` | `{ ok, service, mode: "serverless", schemaVersion: 3, tokenRequired: false }` — usado pelas skills (`solve`, `germano-*`) pra confirmar que o bridge serverless está de pé antes de operar |
| `GET` | `/version` | `{ signature }` — assinatura derivada do `mtime` dos dois arquivos JSON. Usada pelo overlay como polling barato (4s) pra detectar escritas externas (skill do agente editou enquanto o user estava com o overlay aberto). **Substitui o antigo SSE** |
| `GET` | `/comments?url=&status=` | Ativos. `status` aceita `open` ou `in_review`. Resolvidos **não saem aqui** |
| `GET` | `/comments/archive?url=&before=&limit=` | Arquivo, paginado por cursor `updatedAt` |
| `GET` | `/comments/:id` | Retorna `{ comment, location: "main" \| "archive" }` |

### Modificação

| Método | Path | Notas |
|---|---|---|
| `PUT` | `/comments/:id` | **Modo upsert** (body é um `ReviewComment` completo) — cria/edita texto, anchor, autor. **Modo transição** (body com `{ transition, actor }`) — ver abaixo |
| `POST` | `/comments/:id/replies` | Adiciona reply. Funciona em comments do main e do arquivo |
| `DELETE` | `/comments/:id` | Remove totalmente (main ou archive) |

### Transitions (modo `PUT /comments/:id` com `transition`)

| `transition` | Efeito | `actor` obrigatório? |
|---|---|---|
| `in_review` | open → in_review, popula `resolution` com a string formatada | sim |
| `approve` | in_review → resolved, move pro archive, popula `resolution.approvedAt/approvedBy` | sim (quem aprovou) |
| `reject` | in_review → open, limpa `resolution`. Replies preservadas | não |
| `resolve_direct` | open → resolved direto (user marcou sem agente intermediário). Move pro archive | sim |
| `reopen_from_archive` | resolved → open, move do archive pro main | não |

Erro `400 { error: "invalid_actor" }` quando o `actor` é exigido e está ausente/malformado.

### Outros

| Método | Path | |
|---|---|---|
| `PUT` | `/identity/:id` | Upsert da identidade do revisor |
| `GET` | `/export` | Snapshot completo: `comments[]` + `archivedComments[]` |
| `POST` | `/import` | Merge de snapshot (skipa IDs duplicados) |

> **SSE saiu.** O servidor Express antigo expunha `GET /events` como stream
> SSE. No modo serverless o Next não mantém conexão aberta por cliente — o
> overlay faz polling de `/version` a cada 4s e só dispara `onChange` quando a
> assinatura muda. É o suficiente porque os writes externos vêm das skills
> (lotes ocasionais), não de outro humano editando ao vivo.

---

## Como agentes resolvem comments

Quando o usuário pedir "resolve esse aí", **NÃO chame o endpoint legado de upsert**.
Use o transition `in_review` — o usuário aprova ou rejeita depois pelo inbox.

```bash
curl -X PUT "http://127.0.0.1:3000/api/review-bridge/comments/$ID" \
  -H "Content-Type: application/json" \
  -d '{
    "transition": "in_review",
    "actor": { "kind": "agent", "id": "claude", "name": "Claude" }
  }'
```

Resposta:

```json
{
  "ok": true,
  "location": "main",
  "comment": {
    "id": "cmt-...",
    "status": "in_review",
    "resolution": {
      "actor": { "kind": "agent", "id": "claude", "name": "Claude" },
      "at": 1779800744000,
      "summary": "Resolvido por Claude em 20/05/2026 às 16:05:44."
    },
    ...
  }
}
```

O campo `resolution.summary` é **sempre** uma string no formato:

```
Resolvido por <name> em DD/MM/YYYY às HH:MM:SS.
```

Agentes que lerem esse JSON depois saberão exatamente quem alegou resolver e quando. Use timezone do servidor (horário da máquina rodando o Next).

---

## Como agentes respondem a comments

Use o endpoint de replies quando você tiver uma dúvida, opinião ou pergunta antes de
resolver — o usuário vê a thread inteira no card.

```bash
curl -X POST "http://127.0.0.1:3000/api/review-bridge/comments/$ID/replies" \
  -H "Content-Type: application/json" \
  -d '{
    "authorKind": "agent",
    "authorId": "claude",
    "authorName": "Claude",
    "authorColorToken": "var(--au-purple-600)",
    "text": "Antes de fixar isso, prefere botão primário ou ghost?"
  }'
```

Resposta: `{ "reply": {...}, "location": "main" | "archive" }`.

Replies funcionam em qualquer comment, independente do status (até em arquivados — útil para deixar nota sobre uma decisão antiga).

---

## Como agentes leem só o que importa

| Cenário | Endpoint sugerido |
|---|---|
| Trabalhar nos comments **abertos** da página em que o user está | `GET /comments?url=/caminho/da/pagina&status=open` |
| Revisar a fila do que **você (agente)** já marcou em revisão | `GET /comments?status=in_review` |
| Olhar histórico de uma página específica | `GET /comments/archive?url=/caminho&limit=20` |

> Não busque `GET /comments` sem filtro a menos que você precise mesmo de todos os
> ativos. O archive não vem por padrão — chame `/comments/archive` explicitamente.

### Contexto visual do alvo

Comentários novos podem carregar um campo opcional `context`, capturado no
momento em que o pin ou desenho foi criado. Ele existe para reduzir ambiguidade
em instruções curtas como "remove isso":

```json
{
  "context": {
    "pageUrl": "/auis/styleguide/components/buttons",
    "pageTitle": "Auis",
    "target": {
      "tag": "button",
      "role": "button",
      "label": "Salvar",
      "text": "Salvar",
      "selector": "body > main:nth-of-type(1) > ...",
      "fingerprint": { "tag": "button", "text": "Salvar" },
      "attributes": { "type": "button", "ariaLabel": "Salvar" },
      "rect": { "x": 420, "y": 216, "width": 88, "height": 32 },
      "pointer": { "fx": 0.48, "fy": 0.52 }
    },
    "nearbyText": ["Cancelar", "Salvar alterações"]
  }
}
```

Ao resolver, use `context.target.text`, `label`, `attributes`, `fingerprint` e
`nearbyText` para mapear o comentário ao trecho de código antes de editar. As
coordenadas continuam sendo só apoio visual; não trate `rect` como contrato
pixel-perfect.

---

## Migração v2 → v3

Quem rodou o bridge em algum momento depois da migração já tem os arquivos no
formato v3 — esta seção é histórica. O que mudou:

1. `schemaVersion: 2` → `3` em `data/comments.json` e `data/comments.archive.json`.
2. Status `"resolved"` que estavam no main migram pro archive.
3. `resolvedBy: "Gregorio"` + `resolvedAt: 1779...` viram:
   ```json
   {
     "resolution": {
       "actor": { "kind": "user", "id": "legacy", "name": "Gregorio" },
       "at": 1779...,
       "summary": "Resolvido por Gregorio em DD/MM/YYYY às HH:MM:SS."
     }
   }
   ```
4. Comments sem `resolvedBy` que estavam como `resolved` ganham `actor = { kind: "user", id: "legacy", name: "unknown" }`.

No backend serverless o `_store` não tem um passo de migração — ele assume v3 no
read e força `schemaVersion: 3` no write. Se você precisa migrar dados v2 hoje,
suba o Express legado (`npm run dev:bridge`) uma vez: a migração v2→v3 dele é
idempotente e roda no boot.

Rollback: a v2 não tinha o conceito de archive, então um downgrade exigiria mesclar
os dois arquivos de volta e reescrever `resolvedBy`/`resolvedAt` como flat strings.
**Não há script automatizado** — guarde backup antes de fazer downgrade.

---

## Troubleshooting

Problemas comuns:

| Sintoma | Causa | Onde checar |
|---|---|---|
| `ECONNREFUSED 127.0.0.1:3000` em qualquer rota do bridge | `next dev` não está rodando | subir `npm run dev` na raiz |
| `404` em `/api/review-bridge/...` | bateu numa rota errada (path antigo do Express?) ou Next ainda não compilou esse route | conferir o path em `app/api/review-bridge/` |
| Overlay falando com `:9878` em vez de same-origin | `.env.local` antigo com `NEXT_PUBLIC_AUIS_REVIEW_BRIDGE_URL=http://127.0.0.1:9878` em cache | apagar a linha do `.env.local` e reiniciar `npm run dev` |
| `EADDRINUSE :9878` ao rodar `npm run dev:bridge` | porta do Express legado ocupada | `lsof -i :9878` — geralmente é uma instância antiga, mata e sobe de novo |
| Overlay não atualiza quando uma skill escreve no JSON | polling de `/version` parado ou hot-reload travou | reload da aba; em último caso reiniciar `next dev` |
| Comment "some" depois de aprovar | foi pro archive — esperado | `GET /comments/archive` |
| Agente alegou resolver mas user não vê em revisão | falta `actor.kind === "agent"` na request | inspecionar curl |

---

## Convenções de identidade do actor

- `kind: "user"` — revisor humano. O `id` é o `ReviewIdentity.id` (UUID gerado pelo overlay no primeiro uso) e o `name` é o nome que o user escolheu.
- `kind: "agent"` — qualquer cliente automatizado. Use um id estável por tipo de agente (`claude`, `claude-haiku`, `cursor`, etc.) e um `name` legível pra humanos.

Para Claude Code, o padrão recomendado é:

```json
{ "kind": "agent", "id": "claude", "name": "Claude" }
```

Se você é um agente diferente, mude o `id` e `name`. O `colorToken` é opcional em replies — default `var(--fg-tertiary)`.
