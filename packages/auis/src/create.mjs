/**
 * `auis [directory]` — scaffold a project from the Auis template.
 *
 * The template is the AuisDesign repository itself: it is not a library you
 * install into an app, it *is* the app (Next.js + Tailwind v4 + shadcn/ui plus
 * the builder surfaces and the agent skills). Scaffolding therefore means
 * "unpack the repo, drop the parts that only make sense for contributors to
 * Auis, and make the result look like the user's own project".
 */

import fs from "node:fs/promises";
import path from "node:path";
import { ask, color, fail, spinner, step, warn, write } from "./ui.mjs";
import { DEFAULT_REF, REPO_URL, exec, fetchTemplate, hasCommand } from "./template.mjs";

/** Files that document contributing to Auis, not building with it. */
export const PRUNE = [
  ".git",
  ".github/ISSUE_TEMPLATE",
  ".github/PULL_REQUEST_TEMPLATE.md",
  "CONTRIBUTING.md",
  "CODE_OF_CONDUCT.md",
  "docs/EXTRACTION-AUDIT.md",
  "docs/ds-cleanup-plan.md",
  "packages",
];

/** Entries that do not make a directory "non-empty" for our purposes. */
const IGNORABLE = new Set([
  ".DS_Store",
  ".git",
  ".gitattributes",
  ".gitignore",
  ".idea",
  ".vscode",
  "Thumbs.db",
  "LICENSE",
  "README.md",
]);

export const PACKAGE_MANAGERS = ["npm", "pnpm", "yarn", "bun"];

/** npm's name rules, applied to whatever the user typed as a directory. */
export function toPackageName(input) {
  const name = String(input)
    .trim()
    .replace(/^.*[\\/]/, "")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^[._-]+/, "")
    .replace(/[-._]+$/, "")
    .slice(0, 214);
  return name || "auis-app";
}

export function detectPackageManager(userAgent = process.env.npm_config_user_agent) {
  const name = String(userAgent ?? "").split("/")[0];
  return PACKAGE_MANAGERS.includes(name) ? name : "npm";
}

const installArgs = (pm) => (pm === "yarn" ? [] : ["install"]);

async function readDirSafe(dir) {
  try {
    return await fs.readdir(dir);
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

export async function conflictsIn(dir) {
  const entries = await readDirSafe(dir);
  if (entries === null) return [];
  return entries.filter((entry) => !IGNORABLE.has(entry));
}

async function personalize(root, { name, ref, cliVersion }) {
  const pkgPath = path.join(root, "package.json");
  const pkg = JSON.parse(await fs.readFile(pkgPath, "utf8"));

  // Keep the template's key order and its scripts/dependencies; replace only
  // the identity fields, which describe Auis rather than the new project.
  const next = { ...pkg };
  delete next.author;
  delete next.repository;
  delete next.keywords;
  next.name = name;
  next.version = "0.1.0";
  next.description = `${name} — a design system and product surface built with Auis.`;
  next.private = true;
  next.auis = { template: `${REPO_URL}#${ref}`, createdWith: `auis@${cliVersion}` };

  await fs.writeFile(pkgPath, `${JSON.stringify(next, null, 2)}\n`);

  await fs.writeFile(path.join(root, "README.md"), projectReadme(name));
}

/**
 * Runs against the final destination, not the staging copy: under --force the
 * directory may already hold a .env.local with real keys in it, and copying the
 * example over it would be data loss.
 */
async function seedEnv(root) {
  const envLocal = path.join(root, ".env.local");
  try {
    await fs.access(envLocal);
    return;
  } catch {
    /* not there yet — seed it below */
  }
  try {
    await fs.copyFile(path.join(root, ".env.example"), envLocal);
  } catch {
    /* the template always ships an example, but never block a scaffold on it */
  }
}

function projectReadme(name) {
  return `# ${name}

Built with [Auis](${REPO_URL}) — a code-native design builder. The design
system, the screens, the UX flows and the review queue all live in this
repository, and AI agents (Claude Code, Codex, Cursor) build against them under
the rules in [\`AGENTS.md\`](AGENTS.md).

## Run it

\`\`\`bash
npm install
npm run dev        # http://127.0.0.1:3000
\`\`\`

## First move

In your agent, run:

\`\`\`
/auis-setup
\`\`\`

It sequences the three things Auis will never invent for you: **brand** (name,
tagline, logo), **tokens** (from a visual reference you hand it) and **voice**
(from your product). Or open \`/auis/welcome\` and follow the card.

## Surfaces

| Surface | Route |
|---|---|
| Hub | \`/auis\` |
| Welcome / first-run setup | \`/auis/welcome\` |
| Styleguide | \`/auis/styleguide\` |
| Review inbox | \`/auis/styleguide/review\` |
| Review Bridge dashboard | \`/auis/review-bridge\` |
| UX Flow hub | \`/auis/ux-flow\` |
| State Mode matrix | \`/auis/states\` |

## Commands

| Command | What it does |
|---|---|
| \`npm run dev\` | Dev server (predev syncs the agent skill trees) |
| \`npm run build\` / \`typecheck\` / \`lint\` | Build / types / lint |
| \`npm test\` | Unit tests |
| \`npm run ds:check\` | Design-system lint (hardcode debt) |
| \`npm run skills:sync\` | Regenerate \`.claude/skills\` + \`.agents/skills\` |

Docs: [\`AUIS.md\`](AUIS.md) · [\`AGENTS.md\`](AGENTS.md) · [\`docs/GETTING-STARTED.md\`](docs/GETTING-STARTED.md)
`;
}

async function initGit(root) {
  if (!(await hasCommand("git"))) return "git not found";

  const inside = await exec("git", ["rev-parse", "--is-inside-work-tree"], { cwd: root });
  if (inside.ok) return "already inside a repository";

  const init = await exec("git", ["init", "-b", "main"], { cwd: root });
  if (!init.ok) return init.stderr || "git init failed";

  const add = await exec("git", ["add", "-A"], { cwd: root });
  if (!add.ok) return add.stderr || "git add failed";

  const commit = await exec("git", ["commit", "-m", "chore: scaffold Auis"], { cwd: root });
  if (!commit.ok) return "commit skipped — set user.name and user.email, then commit";

  return null;
}

export async function create(options) {
  const {
    directory,
    ref = DEFAULT_REF,
    packageManager,
    install = true,
    git = true,
    force = false,
    yes = false,
    cliVersion,
  } = options;

  const raw =
    directory ?? (yes ? "auis-app" : await ask("Project directory", "auis-app"));
  const root = path.resolve(process.cwd(), raw);
  const name = toPackageName(path.basename(root));
  const relative = path.relative(process.cwd(), root) || ".";
  const pm = packageManager ?? detectPackageManager();

  const existing = await fs.stat(root).catch(() => null);
  if (existing && !existing.isDirectory()) {
    fail(`${color.bold(relative)} already exists and is not a directory.`);
    return 1;
  }

  if (!force) {
    const conflicts = await conflictsIn(root);
    if (conflicts.length > 0) {
      fail(
        `${color.bold(relative)} is not empty (${conflicts.slice(0, 4).join(", ")}${
          conflicts.length > 4 ? ", …" : ""
        }).\n    Pick another directory or pass --force to scaffold into it anyway.`,
      );
      return 1;
    }
  }

  let template;
  const stopFetch = spinner(`Fetching the Auis template (${ref})…`);
  try {
    template = await fetchTemplate(ref);
  } catch (error) {
    stopFetch();
    fail(error.message);
    return 1;
  }
  stopFetch();
  step("Template", `${ref} · ${template.source}`);

  try {
    await Promise.all(
      PRUNE.map((entry) =>
        fs.rm(path.join(template.contents, entry), { recursive: true, force: true }),
      ),
    );
    await personalize(template.contents, { name, ref, cliVersion });
    await fs.mkdir(root, { recursive: true });
    await fs.cp(template.contents, root, { recursive: true, force: true });
    await seedEnv(root);
  } catch (error) {
    fail(`could not write the project: ${error.message}`);
    return 1;
  } finally {
    await fs.rm(template.dir, { recursive: true, force: true });
  }
  step("Project", `${name} → ${relative}`);

  if (git) {
    const problem = await initGit(root);
    if (problem) warn(`Git: ${problem}`);
    else step("Git", "initialized · first commit");
  }

  let installed = false;
  let exitCode = 0;
  if (install) {
    const stopInstall = spinner(`Installing dependencies with ${pm}…`);
    const started = Date.now();
    const result = await exec(pm, installArgs(pm), { cwd: root });
    stopInstall();
    installed = result.ok;
    if (result.ok) {
      step("Install", `${pm} · ${Math.round((Date.now() - started) / 1000)}s`);
    } else {
      // The project is on disk and usable — say what broke, then let the next
      // steps carry the install command, but report the failure in the exit code.
      warn(`${pm} install failed — the project is there, the dependencies are not.`);
      if (result.stderr) {
        write(color.dim(`    ${result.stderr.split("\n").slice(-3).join("\n    ")}`));
      }
      exitCode = 1;
    }
  }

  const commands = [];
  if (relative !== ".") commands.push(`cd ${relative}`);
  if (!installed) commands.push(`${pm} ${installArgs(pm).join(" ")}`.trim());
  commands.push(`${pm === "npm" ? "npm run" : pm} dev`);

  write();
  write(`  ${color.bold(exitCode === 0 ? "Ready." : "Almost there.")}`);
  write();
  for (const command of commands) write(`    ${color.cyan(command)}`);
  write(`    ${color.dim("→ http://127.0.0.1:3000/auis")}`);
  write();
  write(`  ${color.dim("Then, in Claude Code / Codex / Cursor:")}`);
  write(`    ${color.cyan("/auis-setup")}   ${color.dim("brand → tokens → voice")}`);
  write();
  write(`  ${color.dim(`Docs: ${REPO_URL}`)}`);
  write();
  return exitCode;
}
