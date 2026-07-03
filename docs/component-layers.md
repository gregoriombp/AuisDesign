# Camadas do design system — taxonomia canônica

> Fonte de verdade para a **classificação** de cada componente do Auis DS.
> Irmão do [`styleguide-page-structure.md`](./styleguide-page-structure.md) (que
> define a *estrutura* de cada página). Aqui definimos em que **camada** cada peça
> vive na sidebar do styleguide (`app/auis/styleguide/navigation.ts`).

Esta é a versão 2026-05.

## Por que existe

A documentação por componente já é forte. O que faltava era **taxonomia**: um dev
batendo o olho na sidebar não distinguia um tijolo reutilizável (`Botões`) de uma
peça única de tela de negócio (`WhatsApp panel`) — ambos ficavam lado a lado numa
única seção "Componentes" com ~55 itens em ordem alfabética.

A sidebar agora reflete a **pirâmide de abstração** do design system. Lendo de cima
pra baixo, o dev aprende a hierarquia: do mais fundamental e reutilizável (base) ao
mais específico e amarrado ao produto (topo).

```
┌─────────────────────────────────────────────────────────────┐
│  Domínio        ← só faz sentido na Auis (agente, billing) │  + específico
│  Padrões        ← fluxo/região inteira, ainda genérico        │
│  Componentes    ← compõe primitivos, agnóstico de negócio     │
│  Primitivos     ← tijolo de 1 propósito, sem domínio          │  + fundamental
│  Foundations    ← tokens: cor, tipografia, spacing, motion…   │  (base, não-componente)
└─────────────────────────────────────────────────────────────┘
```

**Regra de dependência:** cada camada só depende das camadas **abaixo** dela, nunca
das de cima. Um `Botões` (primitivo) jamais importa um `Integration card` (domínio); um
`Integration card` é livre pra usar `Botões`, `Avatar`, `Pills`. É isso que mantém a base
estável — mexer num primitivo propaga pra todo mundo; mexer numa peça de domínio o
estrago é local.

## As 4 camadas (a régua de classificação)

| Camada | Pergunta-chave | Sabe de negócio? | Exemplos |
|---|---|---|---|
| **Primitivos** | É um tijolo de propósito único, composto só de tokens + HTML/Radix? | Não | Botões, Inputs, Select, Checkbox, Avatar, Pills, Toast, Skeleton |
| **Componentes** | Combina primitivos num bloco genérico, reutilizável em qualquer produto? | Não | Cards, Modais, Sheet, Tabela, Nav rail, Page header, Stat card |
| **Padrões** | Orquestra um fluxo ou região inteira de tela, mas ainda genérico? | Pouco | Onboarding shell, Welcome modal, Connect modal, Password setup |
| **Domínio** | Está amarrado a um conceito de negócio da Auis (agente, integração, billing, brand)? | Sim | Visual dos agentes, Specialists pair, Integration card, WhatsApp panel |

### Regras de desempate

1. **Se deixaria de fazer sentido em outro produto que não a Auis → é Domínio.**
   (vence sobre as outras camadas)
2. **Na dúvida entre duas camadas adjacentes → escolha a mais baixa** (mais
   fundamental / mais reutilizável) e registre o porquê aqui.
3. Pergunta-guia: *"compõe outros componentes do DS?"* Não → Primitivo. Sim e
   genérico → Componente. Sim e multi-passo/região → Padrão. Sim mas preso ao
   negócio → Domínio.

## Criei um componente novo — em que camada coloco?

```
Só faz sentido dentro da Auis (agente, integração, billing, brand)?
   └─ sim → Domínio
   └─ não → É um fluxo/região inteira (multi-passo)?
              └─ sim → Padrões
              └─ não → Compõe outros componentes do DS?
                         └─ sim → Componentes
                         └─ não → Primitivos
```

Registre o componente em `navigation.ts` na seção da sua camada, em ordem
alfabética. **Nenhum `href` muda** ao mudar de camada — o agrupamento é só
governança de navegação.

Quando uma família tem mais de um item concreto, use um item-mãe com
`children` em vez de criar várias entradas top-level. O item-mãe aponta para o
hub canônico; os filhos apontam para subpáginas técnicas ou anchors dentro do
hub. Exemplos atuais:

- `Tabelas` → `AuTable`, `Data table`, `Members table`
- `Modais e dialogs` → `AuModal`, `Connect modal`, `Contact channel modal`,
  `Welcome modal`, `Add integration modal`
- `Sheets e drawers` → `AuSheet`, `Template builder sheet`
- `Visual dos agentes` → `Agent Core`, `Agente do Usuário`, `Cortex`

## Mapeamento atual (auditoria)

Espelha `app/auis/styleguide/navigation.ts` — consulte a nav para o inventário vivo (a contagem muda; não fixamos número aqui).

O inventário por camada vive nas seções **Primitivos / Componentes / Padrões /
Domínio** de [`navigation.ts`](../app/auis/styleguide/navigation.ts). Não
duplicamos a lista aqui de propósito — ela defasaria a cada componente novo. Para a
classificação de cada peça, leia a régua das 4 camadas acima e as fronteiras
revisadas abaixo.

### Fronteiras revisadas (2026-05)

Itens debatíveis, resolvidos aplicando o tie-break #1 — *"só faz sentido na
Auis"*:

- **Dot tunnel** → *Componentes* (era Domínio). Visual decorativo sem lógica de
  negócio; faz sentido em qualquer produto, então não é Domínio.
- **Payment method card** + **Card brand** → *Componentes*, juntos (Payment method
  card era Domínio). Chip de bandeira e cartão salvo são UI de pagamento genérica —
  qualquer SaaS com billing usa; não são conceito exclusivo da Auis.
- **Empty** / **Alertas** → *Primitivos*. Compõem sub-partes, mas têm propósito
  único de feedback; ficam na base por reutilização.

Resultado: **Domínio** fica só com o inequivocamente Auis — agentes
(Specialists pair, Visual dos agentes), integrações (Integration card, Brand logo,
WhatsApp panel) e comercial (Banner de plano adicional).

## Escopo desta fase

A pasta física `components/ui/` permanece **plana de propósito** — a camada vive na
**navegação e na governança**, não no filesystem. Mover ~78 arquivos pra subpastas
quebraria centenas de imports por ganho marginal. Se um dia uma migração de pastas
for desejada, ela segue exatamente este mapeamento como roteiro.

Fora de escopo (decidido): mover arquivos, criar barrel exports, renomear
componentes.
