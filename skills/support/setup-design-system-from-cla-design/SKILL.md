---
name: setup-design-system-from-cla-design
description: >
  [INACTIVE in this repo — do not trigger.] Initial design-system bootstrap from a
  Claude Design handoff. This repo is already set up — do not re-bootstrap. To change
  tokens or foundation use auis-design-system-foundation. Kept only as a record
  of the Auis initial setup. See AGENTS.md.
---

> **[DEPRECADO neste repo — use `auis-design-system-foundation`].** O design
> system e os tokens deste repo já existem; não rebootstrape. Para mexer em
> tokens/foundation, use **`auis-design-system-foundation`** (a única skill
> autorizada a criar token). Ver tabela "Routing" em `AGENTS.md`.

# Design System Setup — Claude Design Handoff

Este skill recebe um handoff do **Claude Design** (`.zip` baixado **ou** fetch
URL passada para o Claude Code) e monta um projeto **Next.js + shadcn/ui** com
uma rota `/auis/styleguide` que documenta tokens e componentes.

> **Regra fundamental:** sempre extrair do bundle. Não regenerar nada via
> `shadcn add` — se o componente não existir no handoff, registrar como
> pendente e perguntar ao usuário antes de criar do zero.

---

## Input

Aceita uma das duas formas:

1. **Caminho local de `.zip`** — o usuário cola algo como
   `~/Downloads/handoff-2026-04-28.zip` ou arrasta o arquivo.
2. **Fetch URL** — link de handoff gerado pelo Claude Design (ex.
   `https://claude.com/design/handoff/...`). Nesse caso, baixar primeiro:

   ```bash
   curl -L -o /tmp/claude-handoff.zip "<fetch_url>"
   ```

Se o usuário não fornecer nenhum dos dois, **pergunte** antes de continuar.

---

## Workflow

### 0. Inspecionar o bundle (NÃO PULAR)

A estrutura interna do handoff do Claude Design **não é pública nem fixa**.
Não assuma nomes de arquivo. Sempre descubra dinamicamente:

```bash
mkdir -p /tmp/claude-handoff && cd /tmp/claude-handoff
unzip -o "<caminho_do_zip>"
unzip -l "<caminho_do_zip>"   # lista o conteúdo
find . -maxdepth 3 -type f | sort
```

Em seguida classifique o que achou. Procure por:

- **Manifesto / spec** — qualquer `*.json`, `manifest.*`, `handoff.*`,
  `design.*`, `bundle.*`, `tokens.*`, `CLAUDE.md`.
- **Tokens** — CSS com `--var:` (geralmente um `globals.css`,
  `tokens.css`, ou inline em `*.html`), JSON com chaves tipo `colors`,
  `typography`, `spacing`, `radius`, `shadow`.
- **Componentes** — arquivos `.tsx`/`.jsx`/`.html`; pastas `components/`,
  `ui/`, `src/`.
- **Páginas** — `design.html` ou múltiplos `.html` representando states.
- **Assets** — pasta com `*.png`, `*.svg`, `*.webp`.
- **Notas** — `design-notes.md`, `README.md`, `notes/*.md`.

Antes de prosseguir, **liste em texto** ao usuário:

- Total de arquivos encontrados
- Onde os tokens foram detectados (caminho + formato: CSS / JSON / HTML inline)
- Quantos componentes foram identificados e em qual linguagem
  (`.tsx`, `.html`, etc.)
- Quaisquer arquivos `*.md` de notas

Só siga para o passo 1 depois dessa confirmação rápida.

---

### 1. Analisar o Design System

A partir do que foi encontrado, identifique e/ou infira:

**Cores:**

- Cor primária / brand → escala completa (50–900+).
- Cores neutras/cinzas → escala completa (50–900+).
- Cores semânticas (success, error, warning, info).
- Background e surface.
- Border colors.
- Qualquer outra cor presente no handoff.

**Tipografia:**

- Font family (sans-serif, serif, monospace, etc.).
- Tamanhos e pesos de heading.
- Tamanhos de body / label / caption.
- Detalhes adicionais (line-height, letter-spacing, font-feature-settings).

**Espaçamento & Radius:**

- Ritmo de espaçamento (tight, normal, relaxed).
- Estilo de border radius (sharp, rounded, pill).

**Sombras:**

- Estilo de shadow (none, subtle, prominent).

**Importante:** analise QUALQUER outro aspecto presente no bundle (motion,
z-index, breakpoints, opacidades, focus rings, etc.). Não limite a análise
ao que está acima.

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

Substituir `/app/globals.css` com os tokens **extraídos do bundle**:

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
  --popover: [extraído];
  --popover-foreground: [extraído];

  /* === PRIMARY === */
  --primary: [extraído];
  --primary-foreground: [extraído];

  /* === SECONDARY === */
  --secondary: [extraído];
  --secondary-foreground: [extraído];

  /* === MUTED === */
  --muted: [extraído];
  --muted-foreground: [extraído];

  /* === ACCENT === */
  --accent: [extraído];
  --accent-foreground: [extraído];

  /* === DESTRUCTIVE === */
  --destructive: [extraído];
  --destructive-foreground: [extraído];

  /* === BORDERS & INPUTS === */
  --border: [extraído];
  --input: [extraído];
  --ring: [extraído];

  /* === BORDER RADIUS === */
  --radius: [extraído];

  /* === CHART COLORS === */
  --chart-1: [extraído];
  --chart-2: [extraído];
  --chart-3: [extraído];
  --chart-4: [extraído];
  --chart-5: [extraído];

  /* === SIDEBAR === */
  --sidebar: [extraído];
  --sidebar-foreground: [extraído];
  --sidebar-primary: [extraído];
  --sidebar-primary-foreground: [extraído];
  --sidebar-accent: [extraído];
  --sidebar-accent-foreground: [extraído];
  --sidebar-border: [extraído];
  --sidebar-ring: [extraído];

  /* === CUSTOM SEMANTIC COLORS === */
  --success: [extraído];
  --success-foreground: [extraído];
  --warning: [extraído];
  --warning-foreground: [extraído];
  --info: [extraído];
  --info-foreground: [extraído];
}

.dark {
  /* Valores invertidos para dark mode — extrair do handoff se existir */
  --background: [extraído];
  --foreground: [extraído];
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

> Se o handoff trouxer **mais variáveis do que as listadas**, adicione todas.
> Se trouxer **menos**, mantenha apenas as encontradas e mencione as omissões
> no resumo final — **não invente tokens.**

---

### 4. Instalar a fonte recomendada

Se o handoff indicar uma fonte (em CSS, README ou design-notes), instalar via
`next/font`. Exemplo:

```tsx
// /app/layout.tsx
import { Inter } from "next/font/google"; // substituir pela fonte do handoff

const font = Inter({ subsets: ["latin"] });

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={font.className}>{children}</body>
    </html>
  );
}
```

---

### 5. Extrair os componentes do bundle

**SEMPRE extrair do `.zip`. Não use `shadcn add` como fallback.**

Para cada componente identificado no passo 0:

1. Copie o arquivo para `/components/ui/<nome>.tsx` (ou `/components/<nome>.tsx`
   se for composto).
2. Adapte imports para o alias do projeto (`@/components/ui/...`,
   `@/lib/utils`).
3. Substitua valores hard-coded por tokens (`var(--primary)`,
   `text-foreground`, etc.) sempre que houver tokens equivalentes.
4. Se o componente vier em **HTML** (caso comum em bundles do Claude Design),
   converta para JSX/TSX preservando estrutura, classes, ARIA e estados.
5. Se o componente usar libs externas (Radix, lucide-react, etc.), instalar
   apenas as deps necessárias — sem `shadcn add`.

**Se faltar algum componente esperado** (ex.: o styleguide pede `Button` mas o
zip não tem), pare e pergunte ao usuário se ele quer:

- (a) extrair de outro arquivo do bundle,
- (b) recriar manualmente baseado em outro componente do handoff, ou
- (c) abrir exceção e usar `shadcn add` para esse componente específico.

**Nunca** silenciosamente caia para shadcn.

---

### 6. Criar a config de navegação do styleguide

`/app/auis/styleguide/navigation.ts`:

```ts
export interface NavItem {
  name: string;
  href: string;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export const navigation: NavSection[] = [
  {
    title: "Foundation",
    items: [{ name: "Design Tokens", href: "/auis/styleguide" }],
  },
  {
    title: "Components",
    items: [
      // Preencher com cada componente extraído do bundle no passo 5,
      // no formato: { name: "Button", href: "/auis/styleguide/components/button" }
    ],
  },
];
```

---

### 7. Criar layout do styleguide com sidebar

`/app/auis/styleguide/layout.tsx`:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { navigation } from "./navigation";

export default function StyleguideLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

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
                          : "hover:bg-muted",
                      )}>
                      {item.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </aside>

      <main className="flex-1 ml-64 overflow-auto">{children}</main>
    </div>
  );
}
```

---

### 8. Criar a página principal do styleguide

`/app/auis/styleguide/page.tsx` — exibe **todos os tokens extraídos** numa só
página:

- **Color palette** — todas as cores como swatches, com nome da CSS variable
  e valor real.
- **Primary scale** — 50 a 900 (ou equivalente do handoff).
- **Grey scale** — 50 a 900.
- **Semantic colors** — success, warning, error, info.
- **Typography** — amostras de heading e body com a fonte extraída.
- **Border radius** — exemplos de cada tamanho.
- **Shadows** — exemplos visuais.
- **Components** — preview de cada componente extraído.
- **Dark mode toggle** — preview dos dois temas (somente se o handoff trouxer
  dark).

> Inclua qualquer token extra que o handoff trouxer e que não esteja na lista
> acima (motion, z-index, breakpoints, opacidades, etc.).

Para cada componente, criar também
`/app/auis/styleguide/components/<nome>/page.tsx` com variantes, estados e
exemplos de uso baseados no que veio no handoff.

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
                └── page.tsx     # Um por componente extraído
```

---

## Output esperado

- shadcn inicializado.
- `/app/globals.css` com **todos** os tokens extraídos do handoff (e nada
  além disso).
- Fonte instalada em `/app/layout.tsx`.
- Componentes copiados/portados do bundle para `/components/ui/`.
- Styleguide navegável:
  - `/app/auis/styleguide/layout.tsx`
  - `/app/auis/styleguide/navigation.ts`
  - `/app/auis/styleguide/page.tsx`
  - Uma página por componente em `/app/auis/styleguide/components/<nome>/`.
- Resumo final (ver abaixo).
- **Lista de gaps** — qualquer token ou componente que o usuário esperava e
  que NÃO estava no handoff.

---

## Resumo de design (entregar ao final)

- **Cor primária:** [hex e nome]
- **Fonte:** [nome]
- **Estilo:** [ex. "Modern minimal", "Bold colorful", "Soft friendly"]
- **Border radius:** [ex. "Rounded 8px", "Sharp", "Pill"]
- **Sensação geral:** [breve descrição]
- **Componentes extraídos:** [lista]
- **Tokens extras encontrados (fora da lista padrão):** [lista]
- **Gaps (esperado mas ausente no handoff):** [lista]

---

## Notas

- Se a estrutura do bundle for ambígua (vários candidatos a "tokens
  canônicos", múltiplos `.css`), **pergunte** antes de escolher.
- **Nunca** complete tokens ausentes inventando valores. Marque como gap.
- **Nunca** instale componente via `shadcn add` sem confirmação explícita do
  usuário, mesmo que o styleguide-padrão peça.
- Se o handoff trouxer dark mode parcial (só algumas variáveis), exponha o
  toggle apenas se cobrir o suficiente para não quebrar; caso contrário,
  desabilite o toggle e mencione no resumo.
