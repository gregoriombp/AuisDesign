# Mapa de componentes — onde achar a referência no DS

> **Leia ANTES de criar qualquer componente ou tela.** Este é o índice
> "preciso de X → use Y" do design system Auis. Diz **o que importar**, de
> **onde**, e **quando NÃO** usar cada peça. É irmão de
> [`component-layers.md`](./component-layers.md) (taxonomia/camadas) e da
> [`navigation.ts`](../app/auis/styleguide/navigation.ts) (inventário vivo
> + rotas do styleguide). Aqui o foco é o **import** e o **quando usar**.
>
> Fonte de verdade das regras: [`AGENTS.md`](../AGENTS.md). Se conflitar, o AGENTS vence.

## Regra de ouro (a receita atômica)

1. **Reusar > estender > criar.** Procure aqui e em `components/ui/Au*` antes de
   escrever qualquer coisa. Só crie do zero se nada servir e a semântica for
   genuinamente nova — nunca duplique sob um nome novo.
2. **Componha de primitivos.** Uma peça maior (card, modal, tela) é uma *receita*
   de primitivos `Au*`. Um `AuGroupCard` usa `AuButton` + `Icon` + `AuAvatar` — não
   reimplementa botão, ícone ou avatar na mão.
3. **Só tokens.** Nada de `#hex`, `w-[37px]`, `rounded-[10px]`. Use o
   [vocabulário de tokens](#vocabulário-de-tokens-cole-isto-em-vez-de-hardcode)
   abaixo. Token faltando → reporte, não crie (só a skill `foundation` cria token).
4. **Ícone = `Icon`.** Material Symbols via `Icon`. Nunca `<svg>` cru nem outra
   lib de ícone. `react-icons` só para **marcas** que o Material Symbols não tem
   (Visa, Mastercard, Amex, Slack, WhatsApp). **Logo de app/integração** (Google,
   Chrome, Pipedrive…) não é `Icon` — é `AuBrandLogo`, curado do Iconify `logos`
   (ver AGENTS.md §4).

---

## Atalho por intenção (o caminho rápido)

| Preciso de… | Use | Import | Cuidado |
|---|---|---|---|
| Ícone | `Icon` | `@/components/ui/Icon` | `<Icon name="..." size={20} />`. Default ótico automático (`wght`/`GRAD`/`opsz`) — não force `weight={200}` em ícone pequeno. Nunca `<svg>` cru. |
| Logo de app / integração | `AuBrandLogo` | `@/components/ui/AuBrandLogo` | marca de 3rd-party (Google, Chrome, Pipedrive…). Curar do Iconify `logos` → `markSrc`. **Não** é `Icon`. Ver AGENTS.md §4. |
| Botão | `AuButton` | `@/components/ui/AuButton` | tem `intent`/`size`/slot de `Icon`. Não estilize `<button>` na mão. |
| Campo de formulário | `AuField` (ou `AuInput`) | `@/components/ui/AuInput` | `AuField` (label + erro + variante `framed`) e `AuInput` saem do mesmo arquivo. |
| Select | `AuSelect` | `@/components/ui/AuSelect` | |
| Checkbox / toggle / slider | `AuCheckbox` · `AuToggle` · `AuSlider` | `@/components/ui/Au{Checkbox,Toggle,Slider}` | **não** use os `fluid/*` equivalentes direto (ver [Motion](#motion-duas-camadas)). |
| Tag / chip / badge | `AuPill` | `@/components/ui/AuPill` | há `badge.tsx` (shadcn) e `fluid/badge` — prefira `AuPill`. |
| Card genérico | `AuCard` | `@/components/ui/AuCard` | **não** use `components/ui/card.tsx` (primitivo shadcn cru). Ver [famílias](#cards). |
| Card de métrica | `AuStatCard` | `@/components/ui/AuStatCard` | número + delta + ícone. |
| Tabela simples | `AuTable` | `@/components/ui/AuTable` | dados c/ sort/paginação/seleção → `DataTable`. Ver [famílias](#tabelas). |
| Modal / dialog | `AuModal` | `@/components/ui/AuModal` | base. Variantes prontas: Connect/Welcome/Contact channel/Add integration. |
| Painel lateral / drawer | `AuSheet` | `@/components/ui/AuSheet` | |
| Menu dropdown | `AuDropdownMenu` | `@/components/ui/AuDropdownMenu` | |
| Abas | `AuTabs` | `@/components/ui/AuTabs` | |
| Accordion / disclosure | `AuAccordion` | `@/components/ui/AuAccordion` | várias seções num grupo com borda; já anima expand/collapse + chevron. |
| Disclosure leve / "ver mais" | `AuCollapsible` | `@/components/ui/AuCollapsible` | uma linha/seção expansível (gatilho + meta), mais leve que o accordion; já anima. **Nunca** monte na mão. |
| Calendário / date picker | `Calendar` | `@/components/ui/calendar` | Primitivo shadcn sancionado para uso direto. Para seletor de período, componha com `Popover` + `AuButton`; não crie `AuCalendar` cerimonial. |
| Avatar | `AuAvatar` | `@/components/ui/AuAvatar` | grupo: `AuAvatarGroup` (mesmo arquivo). |
| Empty state | `AuEmpty` | `@/components/ui/AuEmpty` | slots: `AuEmptyTitle`/`Media`/`Description`/`Content`. |
| Alerta inline | `AuAlert` | `@/components/ui/AuAlert` | |
| Toast | `AuToast` | `@/components/ui/AuToast` | `AuToastProvider` no topo da árvore. |
| Skeleton / loading | `AuSkeleton` | `@/components/ui/AuSkeleton` | |
| Progress | `AuProgress` | `@/components/ui/AuProgress` | |
| Status dot | `AuStatusDot` | `@/components/ui/AuStatusDot` | |
| Breadcrumb | `AuBreadcrumb` / `AuBreadcrumbsBar` | `@/components/ui/Au{Breadcrumb,BreadcrumbsBar}` | átomo vs barra completa. |
| Cabeçalho de página | `AuPageHeader` | `@/components/ui/AuPageHeader` | |
| Navegação lateral | `AuNavRail` / `AuNavList` | `@/components/ui/Au{NavRail,NavList}` | rail = trilho com grupos; list = lista simples. |
| Gráfico | `AuChart` | `@/components/ui/AuChart` | wrapper de recharts. Não importe recharts direto na página. |
| Composer de chat | `AuInputMessage` | `@/components/ui/AuInputMessage` | já é a porta de entrada do Fluid. |
| Passos de raciocínio | `AuThinkingSteps` | `@/components/ui/AuThinkingSteps` | idem. |
| Layout de dashboard | `AuDashboardLayout` | `@/components/ui/AuDashboardLayout` | já injeta sidebar/header. |

> Não achou aqui? Veja o [inventário completo por camada](#inventário-completo-por-camada)
> antes de concluir que falta — provavelmente já existe.

---

## Vocabulário de tokens (cole isto em vez de hardcode)

Classes Tailwind v4 geradas a partir do `@theme` em `app/globals.css`. Use **estas**,
nunca valores arbitrários para cor/spacing/radius/shadow/tipografia.

**Fundos:** `bg-canvas` · `bg-surface` · `bg-raised` · `bg-hover` · `bg-muted` ·
`bg-selected` · `bg-pressed` · `bg-inverse`
**Texto:** `text-fg-primary` · `text-fg-secondary` · `text-fg-tertiary` ·
`text-fg-muted` · `text-fg-on-inverse`
**Bordas:** `border-subtle` · `border-default` · `border-strong` · `border-inverse`
**Acento/semântico:** `accent-brand` (+`-hover`, `-pressed`) · `accent-success` ·
`accent-danger` (+`-hover`, `-pressed`) · `accent-warning` · foco: `ring-focus`
**Raio:** `rounded-xs|sm|md|lg|xl|2xl|full`  ·  **Sombra:** `shadow-xs|sm|md|lg|overlay`
**Tipografia (tamanho):** `text-3xs`(10) · `text-2xs`(11) · `text-xs`(12) · `text-sm`(14) ·
`text-base`(16) · `text-lg`(18) · `text-xl`(20) · `text-2xl`(24) · `text-3xl`(30). Ou as
utilities semânticas, que já trazem line-height/tracking: `display-{sm…xxl}`, `body-{xs…xl}`,
`caption`, `au-eyebrow`. **Nunca `text-[Npx]`.**
**Paleta crua** (só quando precisar de uma família específica): `au-{gray,blue,emerald,
red,purple,teal,amber,pink,lime,slate}-{50…1200}` — ex.: `text-au-blue-700`.

Exemplo certo (de `AuStatCard`): `bg-raised border-subtle text-fg-primary text-fg-tertiary`.

---

## Famílias (qual usar quando)

Os "duplicados" que você percebe quase sempre são uma família com papéis distintos.
Aqui está a régua.

### Cards
| Componente | Quando |
|---|---|
| `AuCard` | card genérico (header/title/description/content/footer/action via sub-exports). **Padrão.** |
| `AuStatCard` | uma métrica: número + delta + ícone. |
| `AuGroupCard` | item de lista/grade com avatar + ações. |
| `AuIntegrationCard` | catálogo/estado de integração (domínio). |
| `AuPaymentMethodCard` | cartão de pagamento salvo (billing). |
| `AuCardBrand` | só a bandeira do cartão (Visa/Amex…). |
| `card.tsx` (minúsculo) | **primitivo shadcn cru — não use direto.** Existe só como base; consuma `AuCard`. |

### Tabelas
| Componente | Quando |
|---|---|
| `AuTable` | tabela simples, estática, estilizada. **Padrão.** |
| `DataTable` (`@/components/tool-ui/data-table`) | dados com sort, paginação, seleção, colunas configuráveis. |
| `AuMembersTable` | tabela de membros/permissões (células de pessoa/seleção/texto prontas). |
| `table.tsx` (minúsculo) | **primitivo shadcn cru.** Padrão é `AuTable`/`DataTable`; o cru só é aceitável numa tabela de domínio rica que elas não cobrem (ex.: `KnowledgeBaseTable`), nunca pra uma tabela simples. |

### Modais e dialogs
| Componente | Quando |
|---|---|
| `AuModal` | **base** de todo modal. |
| `AuConnectModal` · `AuWelcomeModal` · `AuContactChannelModal` · `AuAddIntegrationModal` | fluxos prontos — reuse antes de montar um novo sobre o `AuModal`. |

### Inputs
`AuField` (label + mensagem de erro + variante `framed`) compõe `AuInput`. Para um
input solto, use `AuInput`. Select = `AuSelect`.

### Ícones
`Icon` (Material Symbols Rounded, default ótico automático: `size` visual separado de
`opticalSize`, com `weight`/`grade` mais firmes em tamanhos pequenos). `fill={1}` é
estado ativo/selecionado, não correção de legibilidade. `react-icons` **só** para
marcas sem equivalente (Visa/Mastercard/Amex/Slack/WhatsApp). `lucide-react` só
aparece dentro de primitivos shadcn gerados — não puxe em código de produto.

### Primitivos shadcn: usar direto vs. wrapper Au

Os arquivos minúsculos em `components/ui/*.tsx` são primitivos shadcn (gerados via
CLI), ligados aos seus tokens por um *compat layer* em `globals.css` — então já
renderizam com as cores Auis. **Não são duplicatas pra deletar.** Regra:

- **Tem wrapper Au → use o wrapper, nunca o primitivo cru:** `card`→`AuCard`,
  `button`→`AuButton`, `badge`→`AuPill`, `dropdown-menu`→`AuDropdownMenu`. O
  `ds:check` avisa se um desses vazar pra produto.
- **Sancionados pra uso direto** (sem wrapper Au, baixa customização): `tooltip`,
  `popover`, `collapsible`, `separator`, `calendar`, `accordion`. Importar direto
  está OK — não criamos wrapper cerimonial só pra renomear.
- **Casos especiais:** `chart` tem a camada-helper `AuChart` (paleta +
  `awChartConfig()`) — use os helpers, não recrie a paleta. Tabela: simples →
  `AuTable`; rica (sort/paginação) → `DataTable`; o `table` cru fica pros adapters.
- **`tool-ui/` é subsistema vendado** (data-table, stats-display) que consome os
  primitivos via `_adapter.tsx`. Não migre o interior dele pros `Au*`.

---

## Motion: duas camadas

1. **Paint global (grátis, já ligado).** Hover/focus de elementos interativos
   recebem transição suave por uma regra `@layer base` em `globals.css`. **Não**
   adicione `transition-colors` na mão para um hover comum.
2. **Fluid (spring physics).** O **Fluid kit** (`components/ui/fluid/`) traz motion
   rico com framer-motion, mapeado aos tokens Auis. Está em **preview ("leva 1")**.
3. **Overlays (enter/exit) — grátis, mora no componente.** Modais, sheets,
   dropdowns, toasts e accordions animam abertura **e fechamento** sozinhos
   porque são `Au*` sobre Radix (`data-state` + tokens `--dur-*`/`--ease-*`, com
   guarda `prefers-reduced-motion`). **Nunca monte um overlay na mão**
   (`fixed inset-0` + `{open && …}` / `if (!open) return null`): desmonta na hora
   e mata a transição de fechamento. Use `AuModal` (wizard sequencial: prop
   `stepKey`), `AuSheet`, `AuDropdownMenu`, `AuToast`, `AuAccordion`. `BaseModal`
   está **deprecado** → `AuModal`. `ds:check` sinaliza overlay na mão.

**Regra do Fluid:** os primitivos `fluid/*` (`switch`, `slider`, `checkbox-group`,
`dialog`, `dropdown`, `accordion`, `badge`, `tooltip`) **duplicam** os `Au*` e são
preview — **não importe direto**; use o `Au*` equivalente. A porta de entrada
sancionada do Fluid são os 3 componentes já promovidos:
**`AuInputMessage`**, **`AuThinkingSteps`**, **`AuAskUserQuestions`** (superfícies de
chat/agente). A fusão dos motores nos `Au*` (leva 2) é trabalho futuro.

---

## Inventário completo por camada

Terso de propósito (nome · import `@/components/ui/<Nome>` · papel). Espelha a
taxonomia de [`component-layers.md`](./component-layers.md).

### Primitivos
`AuButton` botão · `AuInput`/`AuField` input/campo · `AuSelect` select ·
`AuCheckbox` checkbox · `AuToggle` switch · `AuSlider` slider · `AuPill` tag/chip ·
`AuAvatar` avatar (+grupo) · `AuStatusDot` status · `AuProgress` progresso ·
`AuSkeleton` loading · `AuAlert` alerta · `AuBreadcrumb` breadcrumb (átomo) ·
`AuTabs` abas · `AuDropdownMenu` dropdown · `AuAccordion` accordion ·
`AuCollapsible` disclosure leve · `AuEmpty` empty state ·
`AuFileIcon` ícone de arquivo · `AuChannelIcon` ícone de canal ·
`AuDropzone` upload · `AuTransition` transição · `AuToast` toast · `Icon` ícone base ·
`AuBrowserIcon` ícone de navegador · `AuPlanIcon` ícone de plano · `AuRadialProgress`
progresso radial · `AuTrendDelta` delta de tendência · `AuAuditTypeBadge` badge de evento.

### Componentes
`AuCard` card · `AuStatCard` métrica · `AuGroupCard` item com ações ·
`AuPaymentMethodCard`/`AuCardBrand` pagamento · `AuTable`/`AuMembersTable` tabela ·
`AuModal` (+`AuConnectModal`/`AuWelcomeModal`/`AuContactChannelModal`/`AuAddIntegrationModal`)
modais · `AuSheet` drawer · `AuNavList`/`AuNavRail` navegação · `AuOptionList` opções ·
`AuListGroup` grupo colapsável · `AuPageHeader` cabeçalho · `AuNotificationsPanel`
notificações · `AuChatBubble` balão de chat · `AuInputMessage` composer ·
`AuThinkingSteps` raciocínio · `AuAskUserQuestions` entrevista · `AuChart` gráfico ·
`AuShortcutTile` atalho · `AuNavTree` árvore de navegação ·
`AuBeams`/`AuDotTunnel` fundos decorativos.

### Padrões
`AuOnboardingShell` casca de onboarding · `AuOnboardingTimeline` linha do tempo ·
`AuPasswordSetup` setup de senha · `AuBackupCodes` códigos de backup ·
`AuQrPlaceholder` QR.

### Domínio (amarrado à Auis)
`AuIntegrationCard` integração · `AuSpecialistsPair`/`AuAgentCore`/`AuUserAgentOrb`/
`AuCortexSynthesis` visual dos agentes · `AuCapabilityTile` capacidade ·
`AuBrandLogo`/`AuLogo`/`AuBrandIllustration` marca · `AuAdditionalPlanBanner` plano ·
`AuCheckpointChip` checkpoint · `AuMentionMenu` menções · `AuAgentAvatar` avatar de agente ·
`AuToolCallCard` chamada de tool/integração · `AuAgentRunTrace` timeline da run do agente ·
`AuSourceChip` citação/grounding da Memory Base · `AuAgentStatusBadge` ciclo de vida do agente.

### Domínio — Faturamento
`AuConsumptionBar` barra de consumo · `AuCostBreakdown` quebra de custo ·
`AuInvoiceForecastCard` previsão da próxima fatura · `AuInvoiceRow` linha de fatura ·
`AuPlanSummaryCard` resumo do plano · `AuPaymentMethodRow` método de pagamento (item de
lista) · `AuPaymentMethodChip` método de pagamento (inline/link).

### Infra / layout (consumido por outros, não use direto numa página)
`AuThemeProvider` · `AuDashboardLayout` · `AuSidebar` · `AuHeader` · `AuNavRail`
(chrome) · `AuNeuralPattern` · `AuMemoryBaseLogo` · `AuCopilotDrawer`.

---

## Faltou algo de verdade?

Se nada acima serve **e** a semântica é nova, aí sim crie — pela skill
[`auis-new-component`](../.claude/skills/auis-new-component/SKILL.md)
(prefixo `Au`, em `components/ui/`, com showcase + entrada em `navigation.ts`).
Registre a peça nova **aqui** também. Rode `npm run ds:check` ao terminar.
