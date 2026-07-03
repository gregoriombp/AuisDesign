---
name: auis-flow-bridge
description: >
  [OBSOLETE] The styleguide UX flow editor went serverless — suggestions now
  go to a same-origin route (/api/flow-suggestions) that writes to
  flow-bridge/data/suggestions.json, with no separate server, no token, and no
  env. There is nothing left to "start up". Use this skill only when the user
  asks to "/auis-flow-bridge", "subir o flow-bridge" (start the
  flow-bridge), "ligar o servidor de sugestões" (turn on the suggestions
  server), start the flows bridge, or "/flow-bridge" — to explain it is no
  longer needed and redirect them. To apply suggestions in bulk, use
  `auis-flow-bridge-solve`.
---

# Auis Flow Bridge — não precisa mais subir nada

O fluxo de sugestões dos UX flows (`/auis/styleguide/ux-flows/*`)
**não depende mais de um servidor separado**. Cutover feito: o botão
"Sugerir edição" está **sempre ativo** e o "Salvar" grava direto via uma
rota do próprio Next.

- **Rota:** `app/api/flow-suggestions/` (GET/POST/PUT/DELETE), mesma origem
  do app, **sem auth**.
- **Persistência:** `flow-bridge/data/suggestions.json` (+
  `suggestions.archive.json`) — os mesmos arquivos de antes, então o
  histórico continua e a skill `auis-flow-bridge-solve` segue lendo
  daí.
- **"Copiar prompt"** continua como fallback 100% client-side (cola no chat).

## O que fazer quando te chamarem

Se o usuário pedir pra "subir o flow-bridge":

1. Explique que **não precisa mais** — o editor é serverless agora.
2. Confirme que o dev server do time (`npm run dev`) está no ar — é onde a
   rota `/api/flow-suggestions` vive. Se sim, está tudo pronto: abra
   qualquer `/auis/styleguide/ux-flows/*` e use "Sugerir edição".
3. Pra aplicar sugestões que já chegaram, aponte pra
   `auis-flow-bridge-solve`.

> O servidor Express em `flow-bridge/` foi **aposentado** (continua no repo
> só porque é dono da pasta `data/`). O `dev` script **não** o sobe mais, e
> as envs `NEXT_PUBLIC_AUIS_FLOW_*` ficaram sem uso.
