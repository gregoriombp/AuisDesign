---
name: auis-review-bridge
description: >
  Diagnoses or manually recovers the local Auis Review Mode server
  (review-bridge). The normal flow is `npm run dev`, which already prepares
  the envs and brings the bridge up. Use this skill only when the user asks
  to "/auis-review-bridge", start the review-bridge ("subir o
  review-bridge"), spin up the review bridge, turn on the comments server
  ("ligar o servidor de comentários"), start a review with the agent, open
  the review-bridge, "/review-bridge", or similar. Do NOT use it to resolve
  comments — for that, see `auis-review-bridge-solve`.
---

# Auis Review Mode — Diagnosticar o Bridge

O caminho normal é rodar **`npm run dev` na raiz**. Esse comando executa
`review-bridge:prepare`, sincroniza `review-bridge/.env` + `.env.local`, e sobe
o Next junto do bridge local em `127.0.0.1:9878`.

Esta skill só existe como fallback/diagnóstico quando o bridge local caiu ou
quando o usuário pediu explicitamente para mexer nele. Ela NÃO resolve comentários —
pra resolver/aprovar/responder em lote, use a skill irmã
`auis-review-bridge-solve`.

> **Arquitetura, lifecycle, API completa e exemplos curl pra agentes:**
> sempre consulte `review-bridge/README.md`. Esse arquivo descreve o
> esquema atual (v3: `open | in_review | resolved`), o split físico
> `comments.json` (ativos) / `comments.archive.json` (arquivados), e
> todas as transitions/endpoints.

## Pré-checagem (sempre rodar primeiro)

Antes de qualquer ação, confirme em paralelo:

1. `review-bridge/package.json` existe → senão **abortar** com mensagem
   pedindo pra rodar a etapa de scaffolding do servidor (não recrie aqui).
2. `review-bridge/node_modules/` existe → se não, anotar que vai precisar
   instalar.
3. `review-bridge/.env` existe → se não, anotar que vai precisar gerar.
4. `.env.local` existe na raiz → necessário pra escrever as envs do frontend.

## Passos

### 1. Instalar deps (se precisar)

```bash
npm run review-bridge:install
```

Pula se `review-bridge/node_modules/` já existe.

### 2. Gerar token (se precisar)

Se `review-bridge/.env` não existe:

```bash
TOKEN=$(openssl rand -hex 32)
echo "AUIS_REVIEW_TOKEN=$TOKEN" > review-bridge/.env
```

Se já existe, **leia** o valor de `AUIS_REVIEW_TOKEN` no arquivo —
não regenere (invalidaria a configuração local já usada pelo frontend/agentes).

### 3. Escrever envs no .env.local do frontend

Escreva/atualize as duas linhas:

```
NEXT_PUBLIC_AUIS_REVIEW_BRIDGE_URL=http://127.0.0.1:9878
NEXT_PUBLIC_AUIS_REVIEW_TOKEN=<TOKEN>
```

- **URL:** deve ser sempre `http://127.0.0.1:9878` neste fluxo local.
- **Token:** nunca regenere se já existe.

Use Edit/Write preservando as outras linhas do `.env.local`.

### 4. Subir o servidor em background

```bash
npm run review-bridge:dev
```

O servidor deve escutar em `127.0.0.1`, nunca em `0.0.0.0`. Use Bash com
`run_in_background: true`. Não fique pollando — o usuário recebe notificação
quando o processo termina (ou seja, se cair).

> **Migração automática:** se o `data/comments.json` ainda está em v2,
> o boot migra in-place pra v3 e cria `data/comments.archive.json` com
> todos os `status: "resolved"` antigos. Isso é idempotente, mas avise o
> usuário pra fazer backup antes do primeiro boot pós-v3 se tiver dados
> que importam.

### 5. Validar /health

Aguarde ~2s e bata em:

```bash
curl -s -H "X-Review-Token: <TOKEN>" http://127.0.0.1:9878/health
```

Espere:

```json
{
  "ok": true,
  "version": "0.2.0",
  "service": "auis-review-bridge",
  "tokenRequired": true,
  "schemaVersion": 3,
  "subscribers": 0,
  "dataFile": ".../data/comments.json",
  "archiveFile": ".../data/comments.archive.json",
  ...
}
```

Se `schemaVersion` for diferente de `3` ou o `archiveFile` não estiver
listado, está rodando uma versão antiga. Avise pro usuário atualizar.

### 6. Reportar

Mensagem final pro usuário, concisa, com:

- ✓ Servidor rodando em `http://127.0.0.1:9878`
- ✓ Token configurado
- ✓ Schema v3 — `comments.json` (ativos) + `comments.archive.json` (arquivados)
- Contagens rápidas (úteis pro user pra saber a fila):
  ```bash
  curl -s -H "X-Review-Token: $TOKEN" "http://127.0.0.1:9878/comments?status=open"     | python3 -c "import sys,json;print('open:',len(json.load(sys.stdin)['comments']))"
  curl -s -H "X-Review-Token: $TOKEN" "http://127.0.0.1:9878/comments?status=in_review"     | python3 -c "import sys,json;print('in_review:',len(json.load(sys.stdin)['comments']))"
  curl -s -H "X-Review-Token: $TOKEN" "http://127.0.0.1:9878/comments/archive?limit=1"     | python3 -c "import sys,json;d=json.load(sys.stdin);print('next_archive_cursor:',d.get('nextCursor'))"
  ```
- O Review Mode fica **sempre montado** (sem env flag): é só abrir a bolota →
  "Entrar no Review Mode" (ou `⌘⇧Y`). Toast "X comentários no localStorage"
  aparece se tiverem dados antigos pra importar.
- Como parar o servidor: `pkill -f "tsx src/index.ts"` ou usar TaskStop
  no PID retornado pelo Bash.
- Pra começar a **resolver** os comentários em lote, invocar a skill
  `auis-review-bridge-solve`.

## Restrições

- ❌ Não regere o token se `review-bridge/.env` já tem um — quebra o frontend
  local e agentes já configurados.
- ❌ Não sobrescreva `.env.local` sem perguntar quando já há valores
  divergentes.
- ❌ Não exponha o servidor na rede (não rode em `0.0.0.0`, não faça port
  forwarding). O modo atual é local-only.
- ❌ Não commit `review-bridge/.env` nem `.env.local` (já no .gitignore).
- ❌ Não delete `data/comments.archive.json` "pra limpar" — quebra histórico
  e tudo que o frontend lista na aba Arquivados.

## Checagem rápida quando algo dá errado

| Sintoma | Provável causa | Como verificar |
|---|---|---|
| `EADDRINUSE` | porta 9878 ocupada | `lsof -i :9878` |
| 401 do health | token errado | comparar `.env` do bridge com `.env.local` |
| Frontend não detecta bridge | `NEXT_PUBLIC_*` não foi recarregado | reiniciar `npm run dev` |
| CORS bloqueia request | app aberto fora de `localhost`/`127.0.0.1` | abrir localmente; o bridge não aceita origem de rede |
| Toast de "importar" não aparece | já tinha sido oferecido nessa sessão | recarregar a página |
| `schemaVersion: 2` no health | versão antiga do bridge rodando | `git pull` em `review-bridge/`, reinstalar deps, reiniciar |
| `comments.archive.json` não existe | nunca rodou v3 ou data dir estava vazio | normal se nunca houve comments resolvidos; cria-se sozinho |
| Comentário "sumiu" depois de aprovar | foi pro archive — esperado | `GET /comments/archive?url=…` |
