# @auis/cli

Scaffold [**Auis**](https://github.com/gregoriombp/AuisDesign) — a code-native
design builder. One command, no clone, no config:

```bash
npx @auis/cli@latest my-product
```

```
  auis  0.2.2
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
- **31 agent skills** — execution contracts for Claude Code, Codex and Cursor.

## Existing repository?

```bash
npx @auis/cli@latest doctor
```

`doctor` reads the repository and reports what Auis could do in it — each
capability with a reason, and an alternative when the answer is no. It writes
nothing.

In a **Next.js App Router** app, `init` installs **Review** — pins, comments,
the drawer and the agent mentions — and nothing else:

```bash
npx @auis/cli@latest init --dry-run    # print what it would touch
npx @auis/cli@latest init
```

```
  What init touches  7 places

    create  app/api/review-bridge/[...path]/route.ts    15 lines — the bridge's catch-all route
    edit    app/layout.tsx                              +2 lines — one import, one <AuisReview /> before </body>
    edit    package.json                                +1 dependency — @auis/next@^0.1.0
    edit    package-lock.json                           npm install
    append  .gitignore                                  4 lines, in a delimited block
    create  .auis/manifest.json                         what auis wrote, so uninstall can reverse it
    create  .auis/data/                                 the comment queue (gitignored)
```

Then start your dev server and open Review from the pill at the bottom of the
page, or with ⌘⇧Y (Ctrl+Shift+Y). The review chrome carries its own scoped
styles and fonts, so your pages render exactly as before.

`init` never overwrites a file it did not create, and never touches `AGENTS.md`,
`.mcp.json`, `globals.css`, `tsconfig.json` or `components.json`. When the root
layout has more than one `<body>`, it prints the two lines for you to place
instead of guessing. Running it twice changes nothing.

```bash
npx @auis/cli@latest uninstall
```

`uninstall` reads `.auis/manifest.json` and reverses it: a file you have not
touched since gets its original bytes back; a file you changed loses only what
`init` inserted; a route you edited is kept, with a warning (`--force` removes
it). Your comments are moved to `~/.auis/review-bridge-backups/<project>/`, not
deleted (`--purge` deletes them).

Agent mentions (`@Claude`, `@Grok` in a comment) open the agent's CLI on your
machine when the dev server runs with `AUIS_MENTION_TRIGGER=1` (Claude starts
switched on with the `edit` ceiling; change it with
`PUT /api/review-bridge/agent-settings` — the Agents panel is Auis-only today). The runner
ships with `@auis/server`; a `.auis/mention-prompt.md` replaces the prompt it
gives the agent.

Edit Mode, State Mode and the flow driver are not installable into an existing
app yet; only Review is. The builder UI needs **React 18+** in the host today. A mount that runs beside Vue, Svelte, Angular and others is
planned; it does not exist yet.

## Options

```
npx @auis/cli@latest [directory] [options]     scaffold a new project
npx @auis/cli@latest doctor [directory]        read an existing repo, write nothing
npx @auis/cli@latest init [directory]          install Review into an existing Next.js app
npx @auis/cli@latest uninstall [directory]     take it back out, exactly

      --json           doctor only: the full report as JSON
      --only <what>    init only: what to install (review; the default)
      --dry-run        init only: print what it would touch, write nothing
      --purge          uninstall only: delete the comments instead of moving them to the backups
  -r, --ref <ref>      branch, tag or commit of the template (default: main)
      --pm <manager>   npm | pnpm | yarn | bun (default: detected)
      --no-install     skip dependency installation (create, init, uninstall)
      --no-git         skip git init and the first commit
      --force          create: scaffold into a directory that is not empty
                       uninstall: also remove files you changed since init
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
npx @auis/cli@latest init                # install Review into the current Next.js app
npx @auis/cli@latest uninstall           # and take it back out
```

Up to 0.2.x, `init` was a third name for creating a project. Since 0.3.0 it
installs into an existing app; use `create` or `new` (or no command) to
scaffold.

Requires **Node.js ≥ 20**. The template is fetched as a GitHub tarball (`tar`),
falling back to `git clone --depth 1`. The CLI itself has zero dependencies;
`init` adds `@auis/next` (and through it `@auis/server`, `@auis/ui` and
`@auis/core`) to the app it installs into.

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
