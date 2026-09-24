# @auis/cli

Scaffold [**Auis**](https://github.com/gregoriombp/AuisDesign) — a code-native
design builder. One command, no clone, no config:

```bash
npx @auis/cli@latest my-product
```

```
  auis  0.2.0
  code-native design builder

  ✓ Template  main · tarball
  ✓ Project   my-product → my-product
  ✓ Git       initialized · first commit
  ✓ Install   npm · 41s

  Ready.

    cd my-product
    npm run dev
    → http://127.0.0.1:3000/auis

  Then, in Claude Code / Codex / Cursor:
    /auis-setup   brand → tokens → voice
```

## What you get

A Next.js (App Router) + Tailwind v4 + shadcn/ui project where the design
system, the screens, the UX flows and the review process all live in the
codebase, and AI agents build against them under enforced rules:

- **Living styleguide** (`/auis/styleguide`) — tokens, foundations, components rendered from real code.
- **Review Mode** — visual comments on any screen become a local work queue agents resolve.
- **Edit Mode** — non-destructive visual edits that agents materialize into code.
- **UX Flows as code** (`/auis/ux-flow`) — navigable flow diagrams that are React pages.
- **State Mode** (`/auis/states`) — every registered screen in every state, side by side.
- **37 agent skills** — execution contracts for Claude Code, Codex and Cursor.

## Options

```
npx @auis/cli@latest [directory] [options]     scaffold a new project
npx @auis/cli@latest doctor [directory]        read an existing repo, write nothing

      --json           doctor only: the full report as JSON
  -r, --ref <ref>      branch, tag or commit of the template (default: main)
      --pm <manager>   npm | pnpm | yarn | bun (default: detected)
      --no-install     skip dependency installation
      --no-git         skip git init and the first commit
      --force          scaffold into a directory that is not empty
  -y, --yes            take the defaults, never prompt
  -h, --help           show usage
  -v, --version        print the CLI version
```

Examples:

```bash
npx @auis/cli@latest my-product          # new directory
npx @auis/cli@latest .                   # current directory
npx @auis/cli@latest my-product --pm pnpm --no-git
npx @auis/cli@latest my-product --ref v1.0.0
npx @auis/cli@latest doctor              # what Auis can do in the current repo, writes nothing
```

Requires **Node.js ≥ 20**. The template is fetched as a GitHub tarball (`tar`),
falling back to `git clone --depth 1`. The CLI itself has zero dependencies.

## What the scaffold changes

Everything in the repository, minus the parts that only concern contributing to
Auis (`.github/ISSUE_TEMPLATE`, `PULL_REQUEST_TEMPLATE.md`, `CONTRIBUTING.md`,
`CODE_OF_CONDUCT.md`, the extraction/cleanup notes, and this `packages/`
directory), plus:

- `package.json` renamed to your project, `0.1.0`, `private: true`, with an
  `auis` field recording the template ref it came from;
- a project `README.md` in place of the Auis one;
- `.env.local` seeded from `.env.example`;
- `git init` and a first commit (unless `--no-git`);
- dependencies installed, which runs `skills:sync` and generates
  `.claude/skills` + `.agents/skills` (unless `--no-install`).

`LICENSE` stays: Auis is MIT and the notice travels with the code.

MIT © Gregório Pinheiro
