---
name: design-system-new-page
description: '[INACTIVE in this repo — do not trigger.] Generic, Au-blind version
  of "build a page", kept only as a record of the Auis initial setup. To build
  or rework a product page use auis-new-page, which reuses existing Au* components
  and Auis tokens. See AGENTS.md.'
---

> **[DEPRECADO neste repo — use `auis-new-page`].** Esta skill é genérica e
> **Au-cega**: gera página/componentes fora do padrão `Au*` e dos tokens Auis.
> Não use aqui. Para construir/reformular página, use **`auis-new-page`**
> (ver tabela "Routing" em `AGENTS.md` e `docs/component-map.md`).

# Design System — Nova Página

Constrói uma página completa em Next.js (App Router) a partir de um design
visual (screenshot ou link do Figma), reusando componentes do design system
sempre que possível.

> **Pré-requisito:** o projeto já deve ter um design system inicializado
> (rota `/auis/styleguide` configurada). Sem ele, pare e oriente o
> usuário a rodar `setup-design-system-from-claude-design` ou
> `setup-design-system-from-reference` antes.

---

## Input

Aceita uma das duas formas:

1. **Imagem** (PNG, JPG, WebP) — screenshot, mockup, foto.
2. **URL do Figma** — neste caso, use o Figma MCP (se disponível) para
   extrair metadata, screenshot e variable defs antes de prosseguir; se
   não estiver disponível, peça um export PNG.

Se faltar input, **pergunte** antes de prosseguir.

---

## Workflow

### 1. Análise visual do design

Examine o input e identifique:

**Estrutura de layout:**
- Quantas seções/colunas principais?
- Tem sidebar? Header? Footer?
- Qual é a grid? (1, 2, 3 colunas).
- Largura de containers, padrões de spacing.

**Seções da UI:**
- Quebre a página em seções lógicas (top → bottom, left → right).
- Nomeie cada seção pelo propósito (ex.: "Sidebar Navigation", "Task List",
  "Chat Panel").

**Hierarquia de conteúdo:**
- Quais são os headings primários?
- O que é conteúdo principal vs. suporte?
- Quais são os CTAs?

---

### 2. Mapear elementos visuais → componentes do design system

Para cada elemento identificado, mapeie para um componente. **Prioridade
absoluta:** reusar componentes já documentados em
`/auis/styleguide/components/` antes de instalar coisa nova.

| Elemento visual | Componente | Notas |
|---|---|---|
| Sidebar de navegação | Sidebar | Use sidebar primitives |
| Tabs / segmented control | Tabs | Para troca de seção |
| Cards com conteúdo | Card | CardHeader, CardContent, CardFooter |
| Lista de itens | Card ou Table | Depende da complexidade |
| Botões | Button | Variantes: default, outline, ghost |
| Inputs de form | Input, Textarea | Sempre com Label |
| Dropdowns | Select ou DropdownMenu | |
| Badges / tags | Badge | Para status |
| Ícones | lucide-react | |
| Modal / dialog | Dialog | Para overlays |
| Toast / notificação | Toast / Sonner | Para feedback |
| Avatar | Avatar | |
| Progresso | Progress | |
| Checkbox / toggle | Checkbox ou Switch | |

**Fluxo de decisão para cada elemento:**

1. Já existe em `/auis/styleguide/components/`? → **importar do
   wrapper local** (`@/components/...`).
2. Existe no shadcn registry mas não foi instalado? → instalar via shadcn
   MCP (passo 4).
3. Não existe em nenhum dos dois? → considerar usar a skill
   `design-system-new-component` antes de seguir.

> **NUNCA** crie um componente inline na página se ele tem cara de algo
> reutilizável. Promova para o design system primeiro.

Use o shadcn MCP para verificar disponibilidade:
- `search_items_in_registries` para cada tipo.
- `get_add_command_for_items` para os install commands.

---

### 3. Definir a estrutura de seções

Antes de codar, gere um breakdown textual:

```
Page: [PAGE NAME]
├── Header
│   ├── Logo/Brand
│   ├── Navigation tabs
│   └── User actions
├── Sidebar (se houver)
│   ├── Navigation items
│   └── ...
├── Main Content
│   ├── Section 1: [nome]
│   ├── Section 2: [nome]
│   └── ...
└── Footer (se houver)
```

Confirme com o usuário se o breakdown bate antes de instalar componentes.

---

### 4. Instalar os componentes faltantes

Com base no mapping do passo 2, instale apenas o que ainda não existe no
projeto:

```bash
npx shadcn@latest add [component1] [component2] [component3]
```

Para cada componente novo, considere se ele merece passar pela skill
`design-system-new-component` (showcase + entrada na navigation) antes de
ser usado em produção. Para protótipos rápidos, pode usar direto.

---

### 5. Scaffold da estrutura da página

Crie `/app/[page-name]/page.tsx` (rota normal, **fora** do styleguide):

```tsx
import { Card, CardHeader, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
// ... outros imports

export default function PageName() {
  return (
    <div className="flex min-h-screen">
      {/* Sidebar (se houver) */}
      <aside className="w-64 border-r bg-sidebar">
        {/* Sidebar content */}
      </aside>

      {/* Main content */}
      <main className="flex-1">
        {/* Header */}
        <header className="border-b p-4">
          {/* Header content */}
        </header>

        {/* Page content */}
        <div className="p-6">
          {/* Sections */}
        </div>
      </main>
    </div>
  )
}
```

---

### 6. Aplicar styling com tokens

Use classes Tailwind que referenciam as CSS variables do design system —
**nunca** valores hard-coded:

- **Backgrounds:** `bg-background`, `bg-card`, `bg-muted`, `bg-sidebar`.
- **Texto:** `text-foreground`, `text-muted-foreground`.
- **Bordas:** `border-border`.
- **Spacing:** escala do Tailwind (`p-4`, `gap-6`, `space-y-4`).

Se um valor visual não tiver token correspondente, pare e pergunte ao
usuário se vale criar um token novo (em `globals.css`) antes de hard-codar.

---

### 7. Comportamento responsivo

Defina como o layout adapta:

- **Mobile (< 768px):** sidebar colapsa, single column.
- **Tablet (768–1024px):** sidebar como overlay ou mini.
- **Desktop (> 1024px):** layout completo como no design.

```tsx
<div className="flex flex-col md:flex-row">
  <aside className="hidden md:block md:w-64">
    {/* Sidebar - oculto no mobile */}
  </aside>
  <main className="flex-1">
    {/* Main content */}
  </main>
</div>
```

---

### 8. Adicionar interatividade

Implemente:

- Navegação/routing entre páginas.
- Estado para tabs, toggles, seleções (`useState`).
- Form handling (se aplicável).
- Loading e error states.

Componentes que precisam de interatividade exigem `"use client"` no topo
do arquivo. Se a página é majoritariamente estática, mantenha como Server
Component e isole as ilhas interativas em sub-componentes `"use client"`.

---

### 9. Adicionar metadata da página

```tsx
export const metadata = {
  title: 'Page Title',
  description: 'Descrição da página para SEO',
}
```

---

## Output esperado

- Lista das seções e componentes identificados (passos 1–3).
- Componentes shadcn faltantes instalados (passo 4).
- Página criada em `/app/[page-name]/page.tsx` (passo 5).
- Layout responsivo casando com o design (passo 7).
- Elementos interativos funcionando (passo 8).
- Metadata configurada (passo 9).

---

## Exemplo de análise

Para um screenshot de project management:

**Seções identificadas:**

1. Sidebar esquerda — Navegação e info do projeto.
2. Painel central — Chat/conversação com cards de tarefas.
3. Painel direito — Lista de tarefas com ações.

**Mapping:**

| Elemento | Componente |
|---|---|
| Sidebar | Sidebar |
| Project dropdown | Select |
| Chat messages | Card |
| Task cards | Card (Header + Content + Footer) |
| "Approve Plan" | Button (default) |
| "Edit Plan" | Button (outline) |
| Task list items | Card ou custom list |
| "View Plan" links | Button (ghost) |
| Status badges | Badge |
| Tabs (Preview/Plan/Code) | Tabs |
| Avatar | Avatar |
| Input | Input ou Textarea |

**Install command:**

```bash
npx shadcn@latest add sidebar card button badge tabs avatar input select
```

---

## Notas

- **Funciona com qualquer imagem** — Figma rough, screenshots ou mockups.
- **Análise visual primeiro** — identifique padrões antes de mapear.
- **Use o shadcn MCP** para validar disponibilidade e pegar install commands.
- **CSS variables** para todas as cores (definidas em `globals.css`).
- **Mobile-first** — pense responsividade desde o começo.
- **Importar do design system primeiro** — só instale do shadcn se realmente
  não existir nada equivalente em `/auis/styleguide/components/`.
- Para componentes que vão ser reusados em outras páginas, considere passar
  pela skill `design-system-new-component` para criar showcase e registrar
  na navegação do styleguide.
