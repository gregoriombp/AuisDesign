---
name: setup-design-system-from-reference
description: >
  [INACTIVE in this repo — do not trigger.] Initial design-system bootstrap from a
  reference image. This repo is already set up — do not re-bootstrap. To change tokens
  or foundation use auis-design-system-foundation. Kept only as a record of the
  Auis initial setup. See AGENTS.md.
---

> **[DEPRECADO neste repo — use `auis-design-system-foundation`].** O design
> system e os tokens deste repo já existem; não rebootstrape a partir de uma imagem.
> Para mexer em tokens/foundation, use **`auis-design-system-foundation`**
> (a única skill autorizada a criar token). Ver tabela "Routing" em `AGENTS.md`.

# Design System Setup — Reference Image

Este skill recebe **uma imagem de referência** (screenshot do Dribbble,
Behance, Mobbin, ou qualquer inspiração visual) e monta um projeto
**Next.js + shadcn/ui** com uma rota `/auis/styleguide` documentando os tokens
extraídos/inferidos.

> **Diferente do skill `setup-design-system-from-claude-design`:** aqui não
> há bundle nem componentes prontos. Tokens são extraídos da imagem e os
> componentes são instalados via `shadcn add` (passo 5.1).

---

## Input

Uma imagem (PNG, JPG, WebP). Pode ser:

- Screenshot do Dribbble/Behance/Mobbin.
- Print de um produto real.
- Mockup do Figma exportado como imagem.
- Fotografia de um material gráfico.

Se o usuário não anexar imagem, **pergunte** antes de continuar.

---

## Workflow

### 1. Analisar o design

Examine a imagem e identifique/inferi:

**Cores:**
- Cor primária / brand → escala completa (50–900+).
- Cores neutras/cinzas → escala completa (50–900+).
- Cores semânticas (success, error, warning, info) — se visíveis.
- Background e surface.
- Border colors.
- Quaisquer outras cores presentes.

**Tipografia:**
- Font family (sans-serif, serif, monospace, etc.). Quando não houver pista
  óbvia, sugira a Google Font mais próxima e marque como inferência.
- Tamanhos e pesos de heading.
- Tamanhos de body / label / caption.
- Outros detalhes (line-height, letter-spacing) se inferíveis.

**Espaçamento & Radius:**
- Ritmo de espaçamento (tight, normal, relaxed).
- Estilo de border radius (sharp, rounded, pill).

**Sombras:**
- Estilo de shadow (none, subtle, prominent).

> Sempre que estiver inferindo (não medindo), marque o token com **(inferido)**
> no resumo final para que o usuário possa ajustar.

---

### 2. Inicializar shadcn

```bash
npx shadcn@latest init
```

Quando perguntado:

- Style: **Default**
- Base color: **Neutral** (vamos sobrescrever com nossos tokens)
- CSS variables: **Yes**

---

### 3. Gerar e aplicar `globals.css`

Substituir `/app/globals.css` com os tokens extraídos:

```css
@import "tailwindcss";

:root {
  /* === BASE === */
  --background: [extraído];
  --foreground: [extraído];

  /* === CARD === */
  --card: [extraído];
  --card-foreground: [extraído];

  /* === POPOVER / DROPDOWN / TOOLTIP === */
  --popover: [igual ao card ou white];
  --popover-foreground: [igual ao card-foreground];

  /* === PRIMARY === */
  --primary: [extraído];
  --primary-foreground: [white ou dark, baseado em contraste];

  /* === SECONDARY === */
  --secondary: [light grey ou versão muted];
  --secondary-foreground: [dark text];

  /* === MUTED === */
  --muted: [light grey background];
  --muted-foreground: [medium grey text];

  /* === ACCENT === */
  --accent: [igual ao secondary ou tint leve];
  --accent-foreground: [dark text];

  /* === DESTRUCTIVE === */
  --destructive: [red/error];
  --destructive-foreground: [white];

  /* === BORDERS & INPUTS === */
  --border: [extraído];
  --input: [border um pouco mais escura];
  --ring: [primary, para focus];

  /* === BORDER RADIUS === */
  --radius: [extraído, ex. 0.5rem];

  /* === CHART COLORS === */
  --chart-1: [primary];
  --chart-2: [complementar];
  --chart-3: [variação];
  --chart-4: [variação];
  --chart-5: [variação];

  /* === SIDEBAR === */
  --sidebar: [sidebar background];
  --sidebar-foreground: [sidebar text];
  --sidebar-primary: [primary];
  --sidebar-primary-foreground: [white];
  --sidebar-accent: [accent];
  --sidebar-accent-foreground: [dark text];
  --sidebar-border: [border];
  --sidebar-ring: [primary];

  /* === CUSTOM SEMANTIC COLORS === */
  --success: [green];
  --success-foreground: [white];
  --warning: [yellow/orange];
  --warning-foreground: [dark for contrast];
  --info: [blue];
  --info-foreground: [white];
}

.dark {
  /* Valores invertidos para dark mode */
  --background: [dark background];
  --foreground: [light text];
  /* ... demais variáveis */
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-sidebar: var(--sidebar);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-success: var(--success);
  --color-success-foreground: var(--success-foreground);
  --color-warning: var(--warning);
  --color-warning-foreground: var(--warning-foreground);
  --color-info: var(--info);
  --color-info-foreground: var(--info-foreground);
}

body {
  background: var(--background);
  color: var(--foreground);
  font-family: [extraído], sans-serif;
}
```

---

### 4. Instalar a fonte recomendada

Se uma Google Font for compatível, adicione em `/app/layout.tsx`:

```tsx
import { Inter } from 'next/font/google'  // ou a fonte recomendada

const font = Inter({ subsets: ['latin'] })

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={font.className}>{children}</body>
    </html>
  )
}
```

---

### 5. Instalar componentes demo

Como aqui não há bundle, instalamos componentes do shadcn diretamente para
poder demonstrar os tokens no styleguide:

```bash
npx shadcn@latest add button card badge alert radio-group
```

> Adicione mais componentes (input, dialog, tabs, etc.) se a referência
> visual claramente exigir.

---

### 6. Criar a config de navegação do styleguide

`/app/auis/styleguide/navigation.ts`:

```ts
export interface NavItem {
  name: string
  href: string
}

export interface NavSection {
  title: string
  items: NavItem[]
}

export const navigation: NavSection[] = [
  {
    title: "Foundation",
    items: [
      { name: "Design Tokens", href: "/auis/styleguide" },
    ]
  },
  {
    title: "Components",
    items: [
      // Adicionados pelo Prompt 2 / por skills posteriores
    ]
  }
]
```

---

### 7. Criar layout do styleguide com sidebar

`/app/auis/styleguide/layout.tsx`:

```tsx
"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { navigation } from "./navigation"

export default function StyleguideLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()

  return (
    <div className="flex min-h-screen">
      <aside className="w-64 border-r bg-card p-6 flex flex-col gap-6 fixed top-0 left-0 h-screen overflow-y-auto">
        <div>
          <Link href="/auis/styleguide" className="text-xl font-bold">
            Design System
          </Link>
        </div>

        <nav className="flex flex-col gap-6">
          {navigation.map((section) => (
            <div key={section.title}>
              <h3 className="text-sm font-semibold text-muted-foreground mb-2">
                {section.title}
              </h3>
              <ul className="flex flex-col gap-1">
                {section.items.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        "block px-3 py-2 rounded-md text-sm transition-colors",
                        pathname === item.href
                          ? "bg-primary text-primary-foreground"
                          : "hover:bg-muted"
                      )}
                    >
                      {item.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </aside>

      <main className="flex-1 ml-64 overflow-auto">
        {children}
      </main>
    </div>
  )
}
```

---

### 8. Criar a página principal do styleguide

`/app/auis/styleguide/page.tsx` — exibe **todos os tokens** numa só página:

- **Color palette** — swatches com nome da CSS variable.
- **Primary scale** — 50 a 900.
- **Grey scale** — 50 a 900.
- **Semantic colors** — success, warning, error, info.
- **Typography** — amostras de heading e body.
- **Border radius** — exemplos de cada tamanho.
- **Shadows** — exemplos.
- **Components** — preview de Button, Card, Badge, Alert, Radio Group usando
  os tokens.
- **Dark mode toggle** — preview dos dois temas.

> **Importante:** inclua qualquer token adicional inferido da imagem que não
> esteja na lista acima.

---

## Estrutura de diretórios resultante

```
app/
└── auis/
    └── styleguide/
        ├── layout.tsx           # Sidebar nav (passo 7)
        ├── navigation.ts        # Config de nav (passo 6)
        ├── page.tsx             # Todos os tokens (passo 8)
        └── components/
            └── [nome]/
                └── page.tsx     # Adicionados por skills posteriores
```

---

## Output esperado

- shadcn inicializado.
- `/app/globals.css` com tokens extraídos da imagem.
- Fonte instalada em `/app/layout.tsx`.
- Componentes demo instalados (button, card, badge, alert, radio-group).
- Styleguide navegável:
  - `/app/auis/styleguide/layout.tsx`
  - `/app/auis/styleguide/navigation.ts`
  - `/app/auis/styleguide/page.tsx`
- Pronto para próximos prompts (componentes, páginas).

---

## Resumo de design (entregar ao final)

- **Cor primária:** [hex e nome]
- **Fonte:** [nome]
- **Estilo:** [ex. "Modern minimal", "Bold colorful", "Soft friendly"]
- **Border radius:** [ex. "Rounded 8px", "Sharp", "Pill"]
- **Sensação geral:** [breve descrição]
- **Tokens marcados como (inferido):** [lista do que veio de inferência, não
  de medição direta — para o usuário validar]

---

## Notas

- Se algo na imagem estiver ambíguo, **pergunte** antes de prosseguir.
- **Nunca** use um componente ou token shadcn sem confirmação explícita do
  usuário.
- Em caso de dúvida, **não** extraia nada do shadcn — pergunte primeiro.
