---
name: commit
description: Maps the pending changes and creates local atomic commits — one commit per file/area when it makes sense, without rewriting content inside a file just to slice it further. Does NOT push and does NOT open a PR unless the user asks. Trigger whenever the user types /commit.
---

# Commit atômico (local)

Você foi invocado porque o usuário digitou `/commit`. Sua tarefa é transformar as mudanças pendentes em um ou mais **commits atômicos locais**.

## Regras inegociáveis

1. **Nunca faça push.** Nunca execute `git push`, nem sugira isso, a menos que o usuário peça explicitamente nesta mensagem ou em mensagem posterior (ex.: "envia pro remoto", "pusha", "push", "sobe pro git").
2. **Nunca abra PR.** Não rode `gh pr create` nem qualquer comando de PR. Este skill é estritamente local.
3. **Nunca use `--no-verify`, `--no-gpg-sign` ou `--amend`** a menos que o usuário peça. Se um hook falhar, corrija a causa e crie um **novo** commit.
4. **Nunca use `git add -A` ou `git add .`** — sempre adicione arquivos por nome, para evitar incluir segredos ou artefatos não intencionais.
5. **Não crie commit vazio.** Se não houver nada para commitar, informe e pare.
6. **Confirme antes de descartar trabalho.** Nada de `git reset --hard`, `git checkout --`, `git clean -f` etc. sem pedido explícito.

## O que é "atômico" aqui

Um commit atômico = uma preocupação lógica coesa por commit, agrupando o working tree pelo que **já está fisicamente separado** entre arquivos/áreas. O objetivo é mapear o que mudou e mandar pro git limpo — não esculpir histórico cirúrgico.

**Diretriz padrão:** divida quando os arquivos/áreas já estão naturalmente separados. Não reescreva conteúdo de arquivo pra fatiar mais.

Heurísticas para dividir (aplicar de cima para baixo, parando no primeiro nível em que as mudanças se separam):
- **Arquivo diferente, assunto diferente** → commit separado por padrão. Só junte arquivos no mesmo commit se um depender do outro para compilar/funcionar (ex.: novo módulo importado pelo arquivo que o consome) ou se forem literalmente a mesma mudança replicada.
- **Pastas/áreas diferentes** (UI vs. lib, layout shell vs. página específica, app/X vs. app/Y) → commits separados.
- **Adição de helper/util novo vs. consumo dele** → dois commits (helper primeiro, consumo depois) sempre que o helper for utilizável sozinho.
- **Dependências/lockfiles** (`package-lock.json`, `bun.lockb`, `pnpm-lock.yaml`) acompanham a mudança que as gerou. Se foram bump isolado, commit próprio.

**Quando um único arquivo mistura preocupações** (ex.: a mesma `page.tsx` traz uma feature nova + um refactor cosmético), commite como **um único commit**. Não use `Edit` pra reverter pedaços e re-aplicar — isso é overengineering. Cite as preocupações na mensagem se ajudar a leitura, e segue.

**Não use `git add -p` / `-i`** (modo interativo, não funciona aqui).

Sequência ideal: cada commit deixa o repositório em um estado funcional. Se a fatia A depende de B para compilar, B vem antes.

## Passo a passo

### 1. Diagnosticar o estado atual (em paralelo)

Rode em paralelo (um único bloco de tool calls):
- `git status` (sem `-uall`)
- `git diff` (unstaged)
- `git diff --cached` (staged)
- `git log -n 10 --oneline` (para seguir o estilo dos commits recentes do repo)

### 2. Decidir o agrupamento

Analise os diffs e decida, **partindo de N commits = N preocupações distintas detectadas** (não de "1 commit que cobre tudo"):
- Quantos commits criar — vise o **máximo** que ainda mantém cada commit funcional e auto-contido.
- Quais arquivos (ou trechos, ver seção acima) vão em cada commit.
- A ordem dos commits (dependências antes dos consumidores).
- A mensagem de cada commit.

Antes de stagear, pergunte-se para cada par de mudanças: *"se eu fosse abrir PRs separados, abriria um ou dois?"*. Se a resposta é "dois", então são dois commits aqui.

**Estilo da mensagem:** siga o estilo dos últimos commits do repositório (olhe o `git log`). Se o repo usa Conventional Commits (`feat:`, `fix:`, `chore:`…), siga. Se usa frases curtas em inglês no imperativo, siga. Se mistura português/inglês, espelhe o padrão dominante. Não force um estilo que o repo não usa.

**Conteúdo da mensagem:** foque no *porquê*, não só no *quê*. 1–2 linhas no assunto; corpo opcional apenas se agregar contexto real.

**Segurança:** se algum arquivo pendente parece conter segredos (`.env`, `*credentials*`, `*.pem`, chaves privadas, tokens em hardcode), **pare e avise o usuário** antes de stageá-lo.

### 3. Criar cada commit

Para cada grupo, em sequência:
1. `git add <arquivos-específicos>` (nunca `-A`/`.`).
2. `git commit -m "$(cat <<'EOF' ... EOF)"` passando a mensagem via HEREDOC para preservar formatação.
3. Se um pre-commit hook falhar: diagnostique, corrija, re-stage e crie um **novo** commit (não `--amend`).

**Não inclua** linhas `Co-Authored-By` nem `🤖 Generated with Claude Code` nestes commits — este skill é um helper local pessoal do usuário; atribuição automática só se o usuário pedir.

### 4. Reportar

Ao final, rode `git status` e `git log -n <N> --oneline` (onde N = número de commits criados) e mostre ao usuário:
- Quantos commits foram criados.
- Assunto de cada um.
- Lembrete curto de que **nada foi enviado ao remoto** e que, se quiser, basta pedir (ex.: "pusha isso").

Mantenha o resumo final curto (≤ 6 linhas).

## Se o usuário pedir push depois

Se, em mensagem subsequente, o usuário autorizar o envio ao remoto:
1. Verifique o branch atual (`git branch --show-current`) e o upstream (`git rev-parse --abbrev-ref --symbolic-full-name @{u}` pode falhar se não houver upstream).
2. Se não houver upstream, rode `git push -u origin <branch>`. Se houver, `git push`.
3. **Nunca** `--force` ou `--force-with-lease` sem pedido explícito. Se for para `main`/`master`, avise antes mesmo com permissão genérica.
4. Não abra PR nem peça para abrir — o usuário disse "sem PR".
