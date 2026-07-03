---
name: auis-edit-bridge-solve
description: >
  Materializes Auis Live Edit Mode overlays into real code. The page
  editor stores non-destructive edit "ops" (text, style token, variant/size,
  icon, icon optical axes, token-value edits, custom/off-palette colors,
  hide/remove, move/reorder-siblings) per route in page-editor/data via
  the serverless /api/page-edits route; this skill reads them with a filter
  chosen by the user (a whole route, only open ones, a specific id, everything),
  makes ONE PLAN BEFORE touching any code, waits for approval, rewrites the real
  TSX (text→string literal, variant→prop, style→token class/prop, icon→icon
  prop, hide→remove/condition, move→reorder JSX siblings), and marks each op
  `in_review` in the bridge with
  `actor: { kind: "agent", id: "claude", name: "Claude" }` — the user then
  approves or rejects it from the edit inbox, which clears the overlay so the
  materialized code becomes the source of truth (committed
  like any other change). Use whenever the user asks for
  "/auis-edit-bridge-solve", "materializa as edições" (materialize the
  edits), "transforma o overlay em código" (turn the overlay into code),
  "aplica as edições da página X no código", "promove as edições do live
  editor", "resolve o page-edits", or variations. Do NOT use it to author
  edits (that is the in-browser Edit Mode) nor for Review Mode comments (that
  is `auis-review-bridge-solve`).
---

# Auis Edit Bridge — Materializar overlays em código

Esta skill é o **agente que materializa** as edições do Live Edit Mode. O
editor no browser grava edições como um *overlay* não-destrutivo (um JSON por
rota em `page-editor/data/`); aqui você lê esse overlay, planeja a edição de
código equivalente, reescreve o TSX real, e devolve cada op marcada como
**em revisão** pro usuário aprovar pelo inbox da página.

> Pré-requisito: `npm run dev` rodando na raiz (o page-edits é serverless,
> parte do Next — mesma origem, sem token, sem processo separado).
>
> Contrato/payloads: `app/api/page-edits/_store.ts` (tipos `PageEditOp`,
> `PageEditPayload`). Engine de apply ao vivo: `lib/auis-edit/applier.ts`.

## Regra de ouro

**Você NÃO aplica (arquiva) direto.** Sempre transiciona pra `in_review` e
deixa o usuário aprovar pelo inbox. Aprovar move a op pro archive e **limpa o
overlay** — a partir daí o código materializado É a verdade (e segue
pelo fluxo normal de commit). **Sem exceção:** mesmo se o user
disser "aplica direto", você marca `in_review` e ele aprova no inbox (é 1
clique) — você nunca usa `transition: "apply"`/`"discard"`.

```
status atual → o que você faz
─────────────────────────────────
open       → in_review  (depois de reescrever o TSX equivalente)
in_review  → não tocar  (já está com você/outro agente; só o user aprova/rejeita)
applied/discarded → ignorar (já no archive)
```

## Identidade do actor

Em TODA chamada que escreve no bridge:

```json
{ "kind": "agent", "id": "claude", "name": "Claude" }
```

---

## Fluxo

### 0. Setup — descobrir a base URL e validar

```bash
# O page-edits roda junto do Next. Porta padrão do dev: 3000.
BASE=${EDIT_BASE:-http://127.0.0.1:3000}
# valida que a rota responde (precisa de ?route=…)
curl -s "$BASE/api/page-edits?route=%2F" >/dev/null || echo "Suba 'npm run dev' na raiz e volte."
```

Você também pode ler os arquivos direto do disco (não precisa do dev server pra
LER): `page-editor/data/<rota-encodada>.json` (+ `.archive.json`), onde a chave é
`encodeURIComponent(pathname)` — ex.: `/integrations` → `%2Fintegrations.json`.
Pra TRANSICIONAR (`in_review`) use o `PUT` da API (precisa do dev server).

**Formatos (não são arrays/campos crus — são embrulhados):**
- `GET /api/page-edits?route=…` → `{ "ops": [ … ] }` (leia `.ops`).
- `POST` → `{ "op": { … } }`; `PUT /api/page-edits/:id` → `{ "op": { …, "resolution": { "summary" } } }` (leia `.op.resolution.summary`).
- Arquivo em disco → `{ "schemaVersion", "route", "ops": [ … ] }` (leia `.ops`). O
  arquivo E o diretório `page-editor/data/` podem **não existir** até a primeira
  edição salva — ausência = "nenhuma op", não erro.

### 1. Parsear o filtro

| User disse | Filtro |
|---|---|
| "materializa a página /X" | ops `open` da rota `/X` |
| "todas as edições" / "tudo" | varre todos os arquivos em `page-editor/data/*.json` (status `open`) |
| "só as abertas" | `status=open` (default) |
| "a op `<id>`" | a op com aquele id na rota dela |
| "as em revisão" | `status=in_review` → NÃO mexer; aborte explicando que essas já estão na fila do user |

```bash
# Listar ops abertas de uma rota
ROUTE="/integrations"
ENC=$(python3 -c "import urllib.parse,sys;print(urllib.parse.quote(sys.argv[1],safe=''))" "$ROUTE")
curl -s "$BASE/api/page-edits?route=$ENC&status=open" | python3 -m json.tool
```

### 2. Mapear a rota → arquivo de página

`pathname` → arquivo do app router. Regra geral: `/x/y` → `app/x/y/page.tsx`.
Rotas com route groups (`(grupo)`) ou layouts podem divergir — confirme com
busca. Se a rota renderiza um componente de domínio, a edição pode ser nele e
não na `page.tsx`.

### 3. Plano — SEMPRE antes de tocar em código

Pra cada op no escopo, monte uma linha. Use os campos da op pra localizar o
alvo no código:

- `anchor.component` — nome do Au* (ex.: `AuButton`) quando detectado.
- `anchor.domText` — `textContent` do elemento no momento da captura (ótimo
  pra `grep` no TSX).
- `payload` — o que mudar.

```
- <id> · /url · tipo=<text|style|variant|icon|hide|move>
  alvo: <componente/elemento + domText>   (move: o container PAI)
  proposta: <edição de código em 1 linha>
  arquivo: <arquivo:linha> (se já achou)
  confiança: alta | média | baixa
  flag: off-spec → override direto na raiz de <offSpecComponent> (style só)
  ação: materializar | pular (motivo)
```

**Risco de ambiguidade (seja honesto):** o `anchor.selector` é um caminho
`nth-of-type` que resolve um NÓ do DOM, mas TSX→DOM é muitos-pra-um (`.map()`,
fragmentos, condicionais). Você NÃO mapeia seletor→linha mecanicamente: mapeia
por `component` + `domText` + texto ao redor. Se o alvo é renderizado dentro de
um `.map()` (a edição teria que tocar DADOS, não JSX literal), rebaixe a
confiança e proponha pular/perguntar.

Apresente o plano consolidado (total, quantos materializar/pular) e **espere
aprovação** (AskUserQuestion: "materializar tudo" / "só confiança alta" /
"cancelar"). Em auto mode, prossiga com "tudo" e avise no resumo.

### 4. Mapa op → edição de TSX

| `payload.kind` | Edição no código |
|---|---|
| `text` | Acha o literal de string (use `domText`/`prevText` no `grep` da página) e troca por `payload.text`. Ambíguo se o texto aparece 2×: rebaixe e confirme. |
| `icon` | Troca a prop do ícone — `iconLeft`/`iconRight`/`iconOnly`/`name` — de `prevName` para `payload.name`. O componente é o pai do span (ex.: `<AuButton iconLeft="add" …>`). |
| `iconStyle` | Override das axes ópticas → props do `<Icon>`: `payload.weight`→`weight={N}`, `payload.fill`→`fill={0\|1}`, `payload.grade`→`grade={N}`, `payload.opticalSize`→`opticalSize={N}`. Emita **só** a(s) axe(s) que difere(m) do default por-tamanho do `Icon` (não despeje as 4). Alvo: o `<Icon>` pai do span `.material-symbols-rounded`. |
| `variant` | Troca a prop do eixo no `<Au… >`: `payload.axis="variant"` → `variant="<value>"`; `payload.axis="size"` → `size="<value>"`. NÃO mexa em className (a classe é derivada da prop). |
| `style` | **Leia `payload.prop`** pra saber QUAL propriedade CSS tokenizar, e `payload.token` (já vem como `var(--token)`) pro valor. Prefira utilitário Tailwind arbitrário na convenção do arquivo: `color`→`text-(--token)`, `background-color`→`bg-(--token)`, `border-color`→`border-(--token)` (+ garantir que há borda), `border-radius`→`rounded-(--token)`, `box-shadow`→`shadow-(--token)`, espaçamento (`padding`/`margin`/`gap`)→`p-(--token)`/`m-(--token)`/`gap-(--token)`; ou `style={{ <prop> : "var(--token)" }}`. NUNCA materialize uma cor/medida crua. **Se `payload.offSpec === true`** (override direto na RAIZ do componente `offSpecComponent`), sinalize: o ideal é virar uma **variante** do componente, não um override solto — proponha isso ou confirme antes de materializar como classe/style cru. **Se `payload.custom === true`** (cor crua fora da paleta — o picker "Cor custom" permite quebrar o token de propósito): NÃO inline o valor cru; **promova a um token `--custom-*`** (ver §4b) e aplique a classe/var desse token novo. |
| `token` | **Edição GLOBAL do valor de um token** (`anchor.selector === ":root"`): reescreve o valor no `globals.css` **+ grava backup antes** (ver §4b). `payload.token` = o token (ex.: `--accent-brand`), `payload.value` = a nova cor. Afeta TODAS as instâncias — não toca em nenhum elemento/JSX. |
| `hide` mode `hide` | Esconde de forma idiomática: remove o nó OU envolve em condição. Em dúvida, pergunte. |
| `hide` mode `remove` | Remove o subtree JSX de vez. |
| `move` | **Reordena IRMÃOS** no JSX. `anchor` é o **container PAI**; `payload.order` é a sequência desejada dos filhos por chave `"<tag>::<trecho-de-texto>"`. Em lista renderizada por `.map()` → reordene o **array de dados** pra casar `order`. Em JSX literal → reordene os **elementos irmãos**. Casa cada chave pelo texto+tag; irmãos sem texto (chave `"<tag>::#<i>"`) são ambíguos → confiança baixa, confirme. NUNCA mova entre containers diferentes. |

Sempre que possível, mantenha o resultado token-puro e dentro do padrão Au*
(AGENTS.md). Se materializar exigiria fugir de token/variante (ex.: cor fora da
paleta — não deveria acontecer, o picker só oferece token), **pule e reporte**.

### 4b. Tokens custom & backup (ops `token` e `style` custom)

Duas ops mexem em **token global** no `app/globals.css`. Token é sagrado (AGENTS.md),
mas aqui é edição EXPLÍCITA do usuário, revisada no inbox — trate com cuidado + backup.

**`style` com `custom: true` → novo token `--custom-*`** (não inline cor crua):
1. Em `app/globals.css`, num bloco dedicado no `:root` — crie uma vez, comentado
   `/* Custom one-off tokens — Live Edit. Revisar/renomear depois. */` — adicione
   `--custom-N: <valor cru>;` (N incremental; nome semântico se der pra inferir).
   Se houver `.dark`, replique com o mesmo valor (ou pergunte).
2. No componente, aplique como qualquer `style` op, mas apontando pro token novo:
   `text-(--custom-N)` / `bg-(--custom-N)` / `border-(--custom-N)`. Página fica token-pura.

**`token` → reescreve o valor + BACKUP (obrigatório, é o que deixa reverter):**
1. **Backup ANTES de tocar.** Leia o valor atual do token no `globals.css` e grave
   um arquivo pequeno em
   `page-editor/token-backups/<token-sem-traços>-<YYYYMMDD-HHmm>.json`:
   ```json
   { "token": "--accent-brand", "old": "<valor antigo>", "new": "<payload.value>", "route": "<rota>", "at": "<ISO>" }
   ```
   Pra reverter: restaure `old` no `globals.css` e apague o arquivo de backup.
2. **Reescreve** o valor na definição primária do `:root`. Se houver canal `.dark`
   pro mesmo token, **avise** — o editor não distingue modo; por padrão mexa só no
   claro e pergunte sobre o dark.
3. Token edit NÃO toca em elemento/JSX — só `globals.css` + o backup.

### 5. Marcar `in_review`

Depois de reescrever o TSX da op:

```bash
ID="<op id>"; ROUTE="/integrations"
curl -s -X PUT "$BASE/api/page-edits/$ID" \
  -H "Content-Type: application/json" \
  -d "{\"route\":\"$ROUTE\",\"transition\":\"in_review\",\"actor\":{\"kind\":\"agent\",\"id\":\"claude\",\"name\":\"Claude\"}}" \
  | python3 -m json.tool
```

A resposta traz `resolution.summary` ("Em revisão por Claude em DD/MM/YYYY …").
Anote id+summary pro resumo.

### 6. Resumo final (uma mensagem)

```
✅ N materializados (em revisão no inbox):
   - <id> · /url · 1 linha do que virou código
   ...
⏭️ K pulados:
   - <id> · /url · motivo (ex.: dentro de .map(), alvo ambíguo)

▶ Abra o Edit Mode na página e o inbox (ícone na toolbar) pra aprovar/rejeitar.
  Aprovar limpa o overlay (o código assume); rejeitar volta a op pra "open".
  Depois, siga o fluxo normal de commit.
```

---

## Restrições

- ❌ Não use `transition: "apply"` nem `"discard"` — só o user aprova/descarta.
- ❌ Não toque em ops `in_review`/`applied`/`discarded`.
- ⚠️ Valor cru de cor agora é INTENCIONAL quando vem com `custom: true` (picker
  "Cor custom") — **não pule**: promova a um `--custom-*` (§4b). Um valor cru de
  cor/raio/sombra/espaçamento **sem** o flag `custom` continua sendo bug do editor:
  pule e reporte.
- ✅ `token` (selector `:root`) reescreve o token no `globals.css` — sempre grave o
  backup ANTES (§4b). Em dúvida sobre o canal dark, pergunte.
- ✅ `move` reordena SÓ irmãos no mesmo pai — nunca entre containers. Em `.map()`,
  reordene o array de dados; em JSX literal, reordene os elementos. Ordem que não
  casa com clareza (irmãos sem texto) → confirme antes.
- ✅ `style` com `offSpec` é override direto na raiz de um componente — materialize,
  mas prefira/sugira virar variante (não deixe o componente destoar à toa).
- ✅ Edição de texto/ícone/variante dentro de `.map()`: trate como mudança de
  DADOS (a lista), não JSX literal — e só com confiança alta; senão pergunte.
- ✅ Se o dev server cair no meio, o que já virou `in_review` está protegido;
  retome pegando `status=open` de novo.

## Troubleshooting

| Sintoma | Causa | Contorno |
|---|---|---|
| `400 route é obrigatório` | faltou `route` no body do PUT | sempre inclua `"route"` |
| `404 Op não encontrada` | op já aprovada/rejeitada/deletada | pular do lote |
| GET volta `[]` | rota errada/encodada errado, ou ops em `in_review`/archive | confira o `ENC` e o `status` |
| Não acho o literal no TSX | texto vem de dados/`.map()` ou de outro componente | seguir `domText`+`component`; se for dado, editar o array |
