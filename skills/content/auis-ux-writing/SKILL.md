---
name: auis-ux-writing
description: Runs a fine-tooth-comb IN-PRODUCT UX writing pass over a route, several routes, or pasted links — reads the real strings from the page's files, audits each one against the Auis PRODUCT voice (it solves, it doesn't sell), proposes rewrites with rationale, waits for approval, and applies surgically (text only, never layout). The voice is inspired by ElevenLabs (efficiency, simplicity, clarity) and OpenAI (warm, concise, confident, never sycophantic), adapted to PT-BR and anchored in PRODUCT_CONTEXT.md. Use when the user says "/auis-ux-writing", "apply the ux writing", "review the copy on this page", "look at the text/microcopy of /route", "improve the ux writing", "review the labels/errors/empty states", "make this screen match the product tone", or pastes a route/link/text asking for an interface-writing review. This is NOT the marketing/site voice (that is `auis-brand-voice`) and it does NOT touch layout/structure (that is `ux-page-rework`).
argument-hint: "<rota(s), link(s), ou cole o texto>"
---

# UX Writing — Auis (produto)

Uma passada de UX writing dentro do produto. O usuário aponta pra uma rota, várias, ou cola links/texto; você lê as strings reais, audita contra a voz do produto, propõe reescritas com motivo, e — depois de aprovado — aplica **só o texto**. Sem tocar em layout, props ou lógica.

## O que esta skill É (e o que NÃO é)

- **É** uma revisão de microcopy in-product: labels, botões, headings, placeholders, help text, empty states, erros, toasts, tooltips, confirmações, status.
- **Não é marketing.** Voz de site/redes/copy de venda é `auis-brand-voice`. Regra-âncora do repo: **site vende, produto resolve** (`PRODUCT_CONTEXT.md` → "Voz: site ≠ produto"). Esta skill é a voz do **produto**. Slogan de venda dentro de UI é antipadrão.
- **Não mexe em layout.** Reorganizar hierarquia, trocar componente, propor duas direções em branches — isso é `ux-page-rework`. Aqui é cirúrgico: troca string, mantém tudo o resto.
- **Não é a global `ux-copy`.** Aquela é genérica e em inglês. Esta é Auis, PT-BR, ciente das rotas e aplicada nos arquivos reais.

---

## A voz (o spec)

Síntese de três fontes. As duas primeiras dão o *princípio*; a terceira manda no *resultado* — quando houver conflito, a voz do Auis no produto ganha.

### Os 4 pilares (ElevenLabs)

1. **Eficiência** — máximo de significado no mínimo de palavras. Respeite o tempo de quem lê.
2. **Simplicidade** — palavra do dia a dia, não de cartório. "usar" > "utilizar", "fazer" > "efetuar", "por" > "através de".
3. **Clareza** — sem juízo de valor não-verificável. Nada de "poderoso", "revolucionário", "de ponta", "inteligente" como enfeite. Deixe o leitor concluir.
4. **Frescor** — vá direto ao ponto. Sem aquecimento ("Nesse momento, é importante notar que…").

### As 3 regras (Orwell, via ElevenLabs)

1. Não use palavra longa quando uma curta resolve.
2. Se dá pra cortar uma palavra, corte.
3. Não use voz passiva quando a ativa serve.

### A camada OpenAI

- **Caloroso, conciso, confiante, nunca bajulador.** Calor na intenção, concisão na forma.
- **Linguagem simples**, mesmo no técnico.
- **Clareza calma** com um traço leve de personalidade — mas contido, é produto enterprise. Nunca fofo, nunca puxa-saco ("Ótima escolha!", "Você é incrível!").

### O tom Auis no produto (manda aqui)

Direto do `PRODUCT_CONTEXT.md`. O produto **resolve** — cada texto ajuda a entender o que algo faz, por que existe, e o que acontece ao clicar.

- **Imperativo amigável + objetivo claro:** "Defina o objetivo principal para começar a configurar o comportamento do agente."
- **Mecânica explícita** (o produto sempre diz como funciona por baixo): "A cada 5 minutos, o sistema verifica todas as conversas ativas da campanha, identificando leads que não responderam."
- **Empty state que ensina, não vende:** "Crie sua primeira conversa para testar o seu agente."
- **Status calmo:** "Salvo como rascunho às 13:48".
- **Erro que orienta, não julga:** "Prompt de comando vazio. O prompt é obrigatório para publicar o agente."
- **Recomendação ancorada em razão:** "As configurações de checkpoint não estão otimizadas para o objetivo do agente."

> Antes de reescrever, **leia 2-3 strings que já existem na rota.** O corpus canônico está no `PRODUCT_CONTEXT.md`. Copie o tom de lá, não invente um novo.

### Adaptação PT-BR (não importe o inglês)

O princípio vem de fora; o texto é PT-BR. Não traga idiomatismo nem formato americano.

- **Voz ativa, tempo presente:** "O agente envia o follow-up" > "O follow-up será enviado pelo agente". "A cada 5 min o sistema verifica" > "as conversas serão verificadas".
- **Sem gerúndio de call center:** "Vamos te avisar" / "Avisamos você" > "Estaremos te avisando".
- **Fale com "você", não com "o usuário".**
- **Sentence case** em botão, label e título. Nada de "Publicar Agente Agora".
- **Formato PT-BR:** "às 13:48", "09/04/2026", "R$ 344 mil", vírgula decimal. (ElevenLabs usa data US — ignore isso.)
- **Corte o cartório, mantenha a precisão.** O produto é técnico-mas-digestível: "Configure", "Defina", "Selecione" ficam (são imperativos claros). O alvo é o burocratês, não o termo técnico.

Trocas rápidas (burocratês → claro):

| Cartório | Claro |
|---|---|
| utilizar | usar |
| realizar / efetuar | fazer |
| através de | por / via |
| a fim de / com o intuito de | para |
| no momento em que | quando |
| possui | tem |
| é necessário que você | você precisa / basta |
| efetuar a configuração de | configurar |
| proceder com | seguir / fazer |

### Antipadrões (rejeite de cara)

- Slogan de marketing em UI ("Você dá o objetivo, nós construímos" não vai em label).
- Adjetivo sem dado: "poderoso", "completo", "robusto", "inteligente" (como enfeite), "de última geração".
- "Transformar", "revolucionar", "potencializar".
- "Em breve" como conteúdo de feature (Coming Soon é página, não copy de label).
- Placeholder textual ("Imagine que aqui tem X").
- Passiva e futuro onde o presente serve ("será exibido" → "aparece").
- Bajulação ("Boa escolha!", "Perfeito!") e exclamação à toa.
- Title Case e CAIXA ALTA decorativa em PT-BR.
- Tooltip que repete o óbvio do label.
- `font-mono` como decoração (mono só pra código real exibido em bloco).
- Inventar termo fora do vocabulário canônico (ver abaixo).

### Vocabulário canônico — NÃO reescrever

Estes termos são fixos (Figma + `PRODUCT_CONTEXT.md`). Trate como protegidos, não "melhore":

`Agente`, `Agente Core™`, `Objetivo`, `Checkpoint`, `Prompt do agente`, `AOPs`, `Habilidades`, `Variáveis`, `Knowledge layers` / `Base de conhecimento`, `Memory Base`, `Templates`, `Triggers` / `Eventos acionadores`, `Canais`, `Follow-up`, `Playground`, `Handoff` / `Transferência para humano`, `Insights`, `Qualidade do agente`, `Compatibilidade`, `Cortex`. Dentro do produto é sempre **"Agente"** (nunca "Specialist" — isso é site).

---

## Padrões de copy por tipo de elemento

| Elemento | Estrutura | Exemplo bom |
|---|---|---|
| **Botão / CTA** | verbo + objeto; diga o resultado | "Publicar agente" (não "Enviar", não "OK") |
| **Empty state** | o que é + por que está vazio + como começar | "Crie sua primeira conversa para testar o seu agente." |
| **Erro** | o que aconteceu + por quê + como resolver | "Nenhuma variável encontrada. Adicione pelo menos uma para o agente funcionar." |
| **Help text** | o que faz + como funciona por baixo | "Define a janela de envio (ex: 08:00–22:00). Mensagens fora dela são reagendadas para o próximo horário permitido." |
| **Status** | factual e calmo | "Salvo como rascunho às 13:48" · "8 de 9 gatilhos ativos" |
| **Confirmação** | ação clara + consequência; botões com o verbo | "Excluir 3 checkpoints? Isso não pode ser desfeito." → "Excluir" / "Cancelar" |
| **Toast** | resultado em uma linha | "Agente publicado." (não "Sucesso!") |
| **Tooltip** | só o que o label não diz | (no `@`) "Insere uma variável do sistema" |
| **Label de campo** | substantivo curto | "Objetivo do agente" (não "Insira aqui o objetivo do seu agente") |

---

## Workflow

### Fase 0 — Contexto (antes de tudo)

1. **Regras do repo:** `AGENTS.md` (hard rules) e a seção **"Voz: site ≠ produto"** + vocabulário do `PRODUCT_CONTEXT.md`.
2. **Memory do usuário:** `~/.claude/projects/<repo-encoded>/memory/MEMORY.md`, se existir, só como contexto consultivo. Se conflitar com `AGENTS.md`, ignore a memória.
3. **git status.** Se o working tree estiver sujo, pergunte (commita/stash/ignora). Se ignorar: **nunca** `git add .` / `-A` — sempre arquivo a arquivo.
4. **Dev server:** se algo roda em `:3000`, deixe quieto (hot reload pega). Não mate (Next 16 bloqueia 2ª instância).

### Fase 1 — Resolver os alvos

A entrada vem de três jeitos. Classifique cada item:

- **Rota / link interno** (`/agent-studio`, `127.0.0.1:3000/...`, `localhost:3000/...`, `?step=`) → **ALVO**. Mapeie pro arquivo: `app/<rota>/page.tsx` + `_components/` locais. Se a rota tem tabs/sub-rotas, leia o arquivo de tabs e liste as filhas.
- **Link externo** (elevenlabs.io, openai.com, qualquer site) → **REFERÊNCIA de voz**, nunca alvo. Absorva o princípio, declare que é inferência, e **não edite nada de lá**.
- **Figma** (`figma.com/...`) → **fonte de copy canônica** do produto. Use o Figma MCP pra ler o texto oficial (Agent Studio / Memory Base têm copy canônica lá) e alinhe a rota a ele.
- **Texto colado solto** (sem rota) → revise no chat e devolva; só edite arquivo se o usuário apontar onde.

**Liste os arquivos que vai tocar, com o papel de cada um, e confirme** antes de seguir. Se inferiu errado, o usuário corrige aqui.

Modos:
- **Auditar** ("olha o ux writing de X") → entrega o diagnóstico e **pergunta** se aplica.
- **Aplicar** ("aplica o ux writing em X") → segue até a Fase 4, sempre passando pelo gate da Fase 3.

### Fase 2 — Extrair as strings

Puxe **só o texto que o usuário vê**: headings, labels, placeholders, texto de botão, help/descrição, empty states, mensagens de erro, toasts, tooltips, `aria-label` visível.

Não toque em: nomes de variável, chaves de objeto, `console.log`, comentários, imports, e **dados mock que são conteúdo real** (nomes de agente, empresas, métricas do `PRODUCT_CONTEXT.md`) — a menos que sejam claramente copy de UI.

Se as strings forem centralizadas (arquivo de i18n/constantes), edite **lá**; se forem inline no JSX, edite inline.

### Fase 3 — Auditar + propor (GATE)

Pra cada string problemática, monte a tabela. **Não liste o que já está bom** — churn de copy boa é busywork (e o usuário detesta over-spec). Marque severidade em texto, **sem emoji**:

```
Página: /agent-studio  ·  arquivo: app/agent-studio/_components/Header.tsx

| Onde | Atual | Problema | Proposto | Sev |
|---|---|---|---|---|
| Botão header | "Submeter" | verbo vago, não diz o resultado | "Publicar agente" | Corrigir |
| Help do objetivo | "Utilize este campo para realizar a definição do objetivo" | cartório + passiva | "Defina o objetivo do agente." | Corrigir |
| Tooltip do @ | "Clique para inserir variável aqui" | repete o óbvio | "Insere uma variável do sistema" | Polir |
```

Feche com **"Deixei como está (já no tom):"** + 2-3 exemplos, pra mostrar que não saiu reescrevendo tudo.

**PARE.** Espere aprovação. O usuário pode aprovar tudo, só os "Corrigir", cortar, ou redirecionar. Se algo depende de decisão de produto (termo novo, mudança de fluxo), **não decida sozinho** — marque como "precisa de decisão" e siga sem.

### Fase 4 — Aplicar (cirúrgico)

1. **Edits string por string** nos `.tsx`. Só texto. Não mexa em estrutura, props, classes, lógica.
2. **Preserve interpolação:** `{{lead_name}}`, `${var}`, template literals, `<strong>`, pluralização. O texto muda em volta da variável, a variável fica.
3. **Não crie token nem componente.** Se a copy nova precisar de espaço/quebra que o componente não dá, **reporte** — não force `text-[..]` nem refatore o componente (isso é outra skill).
4. **Valide antes de fechar:**
   - `npx tsc --noEmit` limpo.
   - Pra cada rota tocada, se o dev server estiver de pé: `curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3000<rota>` → espera 200/3xx. (Verificação visual, se pedida, é via Playwright MCP apontando para `127.0.0.1:3000`.)
5. **Stage seletivo:** `git add <arquivo>` por arquivo tocado. **Sem commit, sem push** a menos que o usuário peça (aí o estilo é `copy(<rota>): ...`).

### Fase 5 — Reportar

- O que mudou, agrupado por rota/arquivo.
- Os princípios aplicados (1 linha: "cortei passiva e cartório, ativei verbos de CTA").
- O que ficou flagado mas não mudou (precisa de decisão de produto, ou copy canônica que veio do Figma).
- O que **não** foi tocado (layout, tokens, componentes) — pra deixar claro o escopo.

---

## Regras do repo (herdadas — valem sempre)

- **Tokens são sagrados.** Esta skill não cria nem toca em token. Proibido `text-[#hex]`, `p-[Npx]`, etc.
- **Componentes antes de código.** Não crie componente pra acomodar copy; reporte o aperto.
- **Desktop-only.** Não escreva copy sobre "deslize", "toque", "no celular".
- **Sem emoji** em UI, doc ou saída de agente, salvo pedido explícito ou asset de origem.
- **Material Symbols** é o ícone padrão; `font-mono` só pra código real.
- **Português do produto** segue o corpus existente; não anglicize ("deletar"/"excluir" conforme o repo já usa — confira antes).

## Edge cases

- **Working tree sujo de outro agente** → `git add` por arquivo, nunca `-A`.
- **Linter format-on-save** pode reescrever no meio → releia o arquivo antes do próximo Edit.
- **String repetida em N lugares** (mesmo label em vários arquivos) → troque em todos pra não criar inconsistência; liste todos no report.
- **Copy que veio do Figma** (Agent Studio / Memory Base) é canônica → alinhe a rota ao Figma, não o contrário; em divergência, pergunte.
- **Mobbin/Dribbble** como referência → WebFetch falha (paywall). Peça screenshot ou use inferência declarada. Mas referência aqui é de **voz/princípio**, não de visual.
- **Rota é redirect** (`page.tsx` que só faz `redirect()`) → trabalhe nas sub-rotas, não no redirect.

## Referências de voz (declaradas, não copiadas)

A inspiração informa o **princípio**, não o texto — assim como "referência informa estrutura, não estilo" no resto do repo.

- **ElevenLabs** — eficiência, simplicidade, clareza, as 3 regras, sentence case, sem juízo de valor vazio. ([guidelines](https://11labs-guides-dev.a17.dev/))
- **OpenAI** — caloroso, conciso, confiante, nunca bajulador; linguagem simples; clareza calma com personalidade contida.
- **Stripe** — preciso, técnico-mas-humano, nunca grita (já é referência da `auis-brand-voice`).
- **Manda no resultado:** a voz do produto Auis no `PRODUCT_CONTEXT.md` — **resolve, não vende**.
