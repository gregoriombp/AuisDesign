---
name: design-system-new-component
description: >
  [INACTIVE in this repo — do not trigger.] Generic, Au-blind version of "new
  component", kept only as a record of the Auis initial setup. To add or
  edit a design-system component use auis-new-component, which enforces
  the Au prefix, Auis tokens, and the shadcn-wrapper flow. See AGENTS.md.
---

> **[DEPRECADO neste repo — use `auis-new-component`].** Esta skill é genérica e
> **Au-cega**: gera componente sem prefixo `Au`, no lugar errado e fora dos tokens
> Auis. Não use aqui. Para adicionar/editar componente, use
> **`auis-new-component`** (ver tabela "Routing" em `AGENTS.md` e
> `docs/component-map.md`).

# Design System — Novo Componente

Adiciona um componente ao projeto seguindo a hierarquia: **shadcn registry →
extender shadcn → construir custom**. Em todos os casos, gera showcase no
styleguide em `/app/auis/styleguide/components/[name]/page.tsx` e
atualiza a navegação.

> **Pré-requisito:** o projeto já deve ter um design system inicializado
> (rota `/auis/styleguide` configurada via skill
> `setup-design-system-from-claude-design` ou
> `setup-design-system-from-reference`). Se não tiver, pare e oriente o
> usuário a rodar essa skill antes.

---

## Workflow

### 1. Verificar se o componente existe no shadcn

Use o **shadcn MCP** para consultar o registry antes de qualquer outra ação:

- **Buscar:** `search_items_in_registries` com query `"[component name]"`.
- **Se encontrado, ver detalhes:** `view_items_in_registries` para checar
  estrutura e dependências.
- **Pegar exemplos de uso:** `get_item_examples_from_registries` com query
  `"[component]-demo"`.

**Decisão:**

- Componente existe no registry → ir para o **passo 2 (Instalar)**.
- Componente não existe → ir para o **passo 4 (Construir custom)**.

**Componentes mais comuns no shadcn (referência rápida):**

- **Layout:** Card, Separator, Tabs, Accordion, Collapsible.
- **Forms:** Button, Input, Select, Checkbox, Radio, Switch, Textarea, Label,
  Form.
- **Feedback:** Alert, Toast, Progress, Skeleton, Badge.
- **Overlay:** Dialog, Drawer, Popover, Tooltip, Dropdown Menu, Context Menu,
  Alert Dialog.
- **Navigation:** Navigation Menu, Breadcrumb, Pagination, Command.
- **Data:** Table, Data Table, Calendar, Chart.

---

### 2. Instalar o componente shadcn

Pegue o comando de instalação via shadcn MCP:

- `get_add_command_for_items` para o componente alvo.

Rode:

```bash
npx shadcn@latest add [component-name]
```

Isso adiciona o componente em `/components/ui/` e ele já consome
automaticamente as CSS variables definidas em `globals.css`.

Antes de seguir, abra o arquivo gerado e identifique:

- Variantes disponíveis (size, variant, style).
- Interface de props.
- Como usa as CSS variables (para consistência com seus tokens).

---

### 3. Customizar o componente (se necessário)

Se o componente base precisar de variantes ou comportamentos extras, **não
edite o arquivo em `/components/ui/`** diretamente (ele será sobrescrito em
updates). Crie uma versão wrappada em `/components/[ComponentName].tsx`:

```tsx
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface CustomButtonProps extends React.ComponentProps<typeof Button> {
  intent?: 'default' | 'success' | 'warning' | 'info'
}

export function CustomButton({
  intent = 'default',
  className,
  ...props
}: CustomButtonProps) {
  return (
    <Button
      className={cn(
        // Use CSS variables via Tailwind classes
        intent === 'success' && 'bg-success text-success-foreground hover:bg-success/90',
        intent === 'warning' && 'bg-warning text-warning-foreground hover:bg-warning/90',
        intent === 'info' && 'bg-info text-info-foreground hover:bg-info/90',
        className
      )}
      {...props}
    />
  )
}
```

**Padrões de customização:**

- Adicionar variantes de cor usando suas CSS variables (`bg-success`,
  `text-warning`, etc.).
- Adicionar variantes de tamanho.
- Compor múltiplos componentes shadcn juntos.
- Adicionar loading states, ícones ou outros recursos.

---

### 4. Construir componente custom (se não houver no shadcn)

Se o registry não tiver o componente, construa usando:

- Primitives do shadcn como blocos (Radix UI, etc.).
- CSS variables via classes Tailwind (`bg-primary`, `text-foreground`).
- Padrões consistentes com os outros componentes shadcn do projeto.

```tsx
import { cn } from "@/lib/utils"

interface CustomWidgetProps {
  variant?: 'default' | 'primary' | 'muted'
  children: React.ReactNode
  className?: string
}

export function CustomWidget({
  variant = 'default',
  children,
  className
}: CustomWidgetProps) {
  return (
    <div className={cn(
      "rounded-lg border p-4",
      variant === 'default' && 'bg-card text-card-foreground border-border',
      variant === 'primary' && 'bg-primary text-primary-foreground border-primary',
      variant === 'muted' && 'bg-muted text-muted-foreground border-border',
      className
    )}>
      {children}
    </div>
  )
}
```

---

### 5. Criar a showcase do componente

Adicione `/app/auis/styleguide/components/[component-name]/page.tsx`
contendo:

- **Todas as variantes lado a lado** (sizes, colors, styles).
- **Todos os estados** (default, hover, focus, disabled, loading).
- **Preview de dark mode** (toggle entre temas).
- **Demo interativo** com controles de prop.
- **Exemplos de código** para os usos mais comuns.

Use os exemplos do shadcn MCP (`get_item_examples_from_registries`) como
ponto de partida.

---

### 6. Documentar uso

Inclua na página de showcase:

- Import statement.
- Exemplo básico de uso.
- Tabela de props (nome, tipo, default, descrição).
- Exemplos por variante, com o código embaixo.
- Notas de acessibilidade (navegação por teclado, ARIA).

---

### 7. Atualizar a navegação do styleguide

Edite `/app/auis/styleguide/navigation.ts` e adicione o componente na
seção `Components`:

```ts
{
  title: "Components",
  items: [
    // ... componentes existentes
    { name: "[Component Name]", href: "/auis/styleguide/components/[component-name]" },
  ]
}
```

Isso faz o componente aparecer na sidebar do styleguide.

---

## Estrutura de diretórios resultante

```
components/
├── ui/                      # Base shadcn (auto-gerado, não editar)
│   ├── button.tsx
│   ├── card.tsx
│   └── ...
└── [CustomComponent].tsx    # Wrappers e custom components

app/
└── auis/
    └── styleguide/
        ├── navigation.ts                          # ← editar (passo 7)
        └── components/
            └── [component-name]/
                └── page.tsx                       # ← criar (passo 5)
```

---

## Output esperado

- Componente instalado/criado em `/components/`.
- Showcase em `/app/auis/styleguide/components/[name]/page.tsx`.
- Navegação atualizada em `/app/auis/styleguide/navigation.ts`.
- Componente visível na sidebar do styleguide.
- Uso documentado com exemplos de código.

---

## Notas

- **Use o shadcn MCP** para buscar, ver e pegar exemplos antes de construir.
- **CSS variables são a fonte da verdade** (definidas em `globals.css`).
- **Classes Tailwind referenciam as CSS variables** (`bg-primary`,
  `text-muted-foreground`).
- **Não precisa de Figma** para desenvolvimento de componente — o shadcn
  define o design.
- **Estender, não reconstruir** — customize componentes shadcn em vez de
  começar do zero.
- Nunca edite arquivos em `/components/ui/` diretamente; crie wrappers em
  `/components/`.
