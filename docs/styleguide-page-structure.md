# Styleguide page structure — padrão canônico

> Fonte de verdade para qualquer página em `app/auis/styleguide/`.
> Skills podem gerar o esqueleto livre; **o agente reordena pro padrão antes de aplicar**.

Esta é a versão 2026-05. Vive em `_primitives.tsx`; mude lá quando mudar aqui.

## Por que existe

Antes desta convenção, cada página do styleguide escolhia a ordem das seções
e o que documentar. Resultado: devs achavam a API num lugar, anatomia em
outro, e a11y/responsive/tokens consumidos não existiam consistentemente.

Esta página fixa **a ordem das seções** e **quais primitivos usar em cada
uma**. A intenção é que um dev novo encontre a mesma informação no mesmo
lugar, qualquer componente que abrir.

## Estrutura de uma página de **componente individual** (15 seções)

Use este padrão para uma página que documenta **um** componente específico
(`AuButton`, `AuSelect`, `AuCheckpointChip`, etc.). Para uma página-mãe que agrupa
várias implementações da mesma família, use a seção "página-hub de família"
abaixo.

A ordem é fixa. Seções podem ser **puladas** quando não se aplicam (ex: um
componente puramente visual sem interação pula `States`, `Accessibility` fica
mais curto). Nunca **reordene**.

| # | Seção | Primitivo | Quando pular |
|---|---|---|---|
| 1 | PageHero — título e lead | `PageHero` | Nunca |
| 2 | Tldr — quando usar / não usar | `Tldr` | Nunca |
| 3 | Toc — sumário (página >400 linhas) | `Toc` | Páginas curtas |
| 4 | Anatomy — partes nomeadas | `Section` + `Spec` | Componente trivial (1 elemento) |
| 5 | Variants — variantes visuais | `Section` + `Stage` | Componente sem variantes |
| 6 | Sizes — densidades / escalas | `Section` + `Stage` | Componente com 1 tamanho |
| 7 | States — interativos | `StatesMatrix` | Componente puramente visual |
| 8 | Composition — uso real combinado | `Section` + `Stage` | Componente folha |
| 9 | Responsive — comportamento por viewport | `ResponsiveStage` | Componente fora de layout (ex: dot, badge) |
| 10 | API — props | `ApiTable` + `PropRow` | Nunca (mesmo zero props vale como linha "—") |
| 11 | TokensConsumed — design tokens lidos | `TokensConsumed` | Nunca (ao menos `--fg-*` ou `--bg-*`) |
| 12 | Accessibility — ARIA, keyboard, SR | `Section` + `KeyboardTable` | Componente sem foco/keyboard |
| 13 | Code — exemplos canônicos | `CodeExample` x3-4 | Nunca |
| 14 | DoDont — regras visuais | `DoDont` | Nunca |
| 15 | RelatedLinks — navegação contextual | `RelatedLinks` | Nunca (mínimo 2 itens) |

## Estrutura de uma **página-hub de família**

Use quando a sidebar tem um item-mãe com mais de um filho, por exemplo:

- `Tabelas` → `AuTable`, `Data table`, `Members table`
- `Modais e dialogs` → `AuModal`, `Connect modal`, `Welcome modal`
- `Visual dos agentes` → `Agent Core`, `Agente do Usuário`, `Cortex`

A página-hub serve para decisão rápida e comparação visual. Ela não deve
começar com cards de "quando usar / quando não usar"; primeiro mostra o
inventário inteiro.

| # | Seção | Primitivo | Observação |
|---|---|---|---|
| 1 | PageHero | `PageHero` | Explica a família, não um item específico |
| 2 | Toc | `Toc` | Sempre que a página tiver mais de 3 seções |
| 3 | Inventário inline | `Section` + previews reais/estáticos | Mostre todos os filhos na mesma página, sem depender de botões que abrem overlays |
| 4 | Anatomia / padrões compartilhados | `Section` + `Spec` | Só o que vale para a família inteira |
| 5 | API do item base | `ApiTable` + `PropRow` | Quando há primitivo-base (`AuModal`, `AuTable`) |
| 6 | Quando usar | tabela HTML | Colunas mínimas: componente, quando usar, quando não usar, observação |
| 7 | RelatedLinks | `RelatedLinks` | Links para subpáginas técnicas dos filhos |

Regras da página-hub:

- O item-mãe é a entrada principal na sidebar.
- Cada filho aparece como `children` no item-mãe de `navigation.ts`.
- Subpáginas técnicas dos filhos podem continuar existindo, mas não competem
  com o hub na sidebar como top-level.
- Mostre todos os filhos inline no hub; em modais, não obrigue o usuário a
  clicar num botão para entender qual modal existe.
- A decisão "quando usar / quando não usar" fica no fim em formato de tabela,
  não em `Tldr` no topo.

## Estrutura de uma página de **foundation** (10 seções)

Foundations (cor, typography, spacing, grid, motion, iconography, logos…)
documentam *tokens* e *princípios*, não props.

| # | Seção | Primitivo |
|---|---|---|
| 1 | PageHero | `PageHero` |
| 2 | Princípios / Quando usar o quê | `Tldr` ou tabela de decisão |
| 3 | Toc (opcional) | `Toc` |
| 4 | Anatomy / Unidade-raiz | `Section` + `Spec` |
| 5 | Catálogo / Inventário | `Section` (grid próprio) |
| 6 | Em contexto | `Section` |
| 7 | Em código | `CodeExample` |
| 8 | Accessibility (quando aplicável) | `Section` |
| 9 | DoDont | `DoDont` |
| 10 | RelatedLinks | `RelatedLinks` |

## Snippet de imports padrão

```tsx
import {
  PageHero,
  Section,
  Stage,
  Spec,
  Tldr,
  Toc,
  StatesMatrix,
  PropRow,
  ApiTable,
  TokensConsumed,
  ResponsiveStage,
  KeyboardTable,
  CodeExample,
  DoDont,
  RelatedLinks,
} from "../../_primitives"
```

Importe **só o que usar**. ESLint não bloqueia, mas o reviewer pede.

## Esqueleto mínimo de uma página de componente

```tsx
export default function FooPage() {
  return (
    <>
      <PageHero title="Foo">
        Descrição do que é Foo em 1-2 frases.
      </PageHero>

      <div className="max-w-[1200px] mx-auto px-10 pb-14 flex flex-col gap-16">
        <Tldr
          use={[<>Item 1</>, <>Item 2</>]}
          dontUse={[<>Item 1</>, <>Item 2</>]}
        />

        <Section id="anatomy" title="Anatomia" lead="…">
          {/* Spec rows com partes nomeadas */}
        </Section>

        <Section id="variants" title="Variantes" lead="…">
          <Stage label="…"> {/* … */} </Stage>
        </Section>

        <Section id="sizes" title="Tamanhos" lead="…">
          <Stage label="sm · md · lg"> {/* … */} </Stage>
        </Section>

        <Section id="states" title="Estados" lead="…">
          <StatesMatrix states={[/* … */]} />
        </Section>

        <Section id="composition" title="Composition" lead="…">
          {/* exemplos com outros componentes */}
        </Section>

        <Section id="responsive" title="Responsivo" lead="…">
          <ResponsiveStage mobile={/* … */} desktop={/* … */} />
        </Section>

        <Section id="api" title="API" lead="…">
          <ApiTable>
            <PropRow prop="…" type="…" def="…" doc="…" />
          </ApiTable>
        </Section>

        <Section id="tokens" title="Tokens consumidos" lead="…">
          <TokensConsumed tokens={[
            { token: "--bg-raised", role: "fundo do card", value: "var(--au-white)" },
          ]} />
        </Section>

        <Section id="accessibility" title="Acessibilidade" lead="…">
          <KeyboardTable rows={[
            { keys: ["Tab"], action: "Move foco" },
          ]} />
        </Section>

        <Section id="code" title="Em código" lead="…">
          <CodeExample>{`/* … */`}</CodeExample>
        </Section>

        <Section id="do-dont" title="Do / Don't">
          <DoDont dos={[/* … */]} donts={[/* … */]} />
        </Section>

        <Section id="related" title="Veja também">
          <RelatedLinks items={[
            { name: "Component X", href: "/auis/styleguide/components/x", description: "…" },
          ]} />
        </Section>
      </div>
    </>
  )
}
```

## Convenções

- **Container externo:** `<div className="max-w-[1200px] mx-auto px-10 pb-14 flex flex-col gap-16">`
- **gap entre seções:** `gap-16` (64px)
- **Ids das `Section`:** kebab-case, semântica (não numeração). Use `id="api"`, não `id="section-9"`.
- **Lead das `Section`:** uma frase curta. Explica **por que** existe a seção, não repete o título.
- **Linguagem:** PT-BR principal, código e nomes técnicos em inglês quando fazem sentido. Não traduza nomes de tokens nem componentes.
- **Tokens:** **nunca** hardcode cores, paddings, radius. Sempre `var(--*)`.
- **Acessibilidade do <kbd>:** `KeyboardTable` já cuida do styling — só passe a lista.
- **Camada do componente:** a *estrutura* da página é definida aqui; a *camada*
  (Primitivos / Componentes / Padrões / Domínio) onde ele entra na sidebar é
  definida em [`component-layers.md`](./component-layers.md). Os dois andam juntos.

## Exemplo vivo

A página de referência canônica é
[components/buttons/page.tsx](../app/auis/styleguide/components/buttons/page.tsx).
Use-a como espelho ao criar uma página nova.

## Migração de páginas existentes

A migração é **incremental**: cada página antiga é refatorada quando o
componente correspondente for tocado. Não há corrida para refatorar tudo
de uma vez. O padrão deste documento vale apenas para:

1. Páginas novas
2. Páginas existentes que estão sendo substancialmente reescritas
