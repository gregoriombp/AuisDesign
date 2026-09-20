/**
 * Read-only inspection of a repository that is not Auis's.
 *
 * Every function here only reads. Nothing in this module creates, moves or
 * deletes a file — `auis doctor` is the instrument people run BEFORE they trust
 * us with their repository, so it has to be safe to run on anything.
 *
 * Each detection carries `evidence`: the file and the thing inside it that
 * decided the answer. A verdict nobody can argue with is a verdict nobody can
 * correct, and these are guesses about someone else's codebase.
 */

import fs from "node:fs";
import path from "node:path";

/** Directories that never hold host source, and are big enough to matter. */
const SKIP_DIRS = new Set([
  ".git", "node_modules", ".next", ".nuxt", ".svelte-kit", ".turbo", ".cache",
  "dist", "build", "out", "coverage", "vendor", "__pycache__",
]);

const SOURCE_EXT = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".vue", ".svelte", ".astro"]);

function read(root, rel) {
  try {
    return fs.readFileSync(path.join(root, rel), "utf8");
  } catch {
    return null;
  }
}

function readJson(root, rel) {
  const raw = read(root, rel);
  if (raw === null) return null;
  try {
    // tsconfig.json is JSONC in practice: strip comments and trailing commas.
    return JSON.parse(raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|\s)\/\/.*$/gm, "$1").replace(/,(\s*[}\]])/g, "$1"));
  } catch {
    return null;
  }
}

const exists = (root, rel) => fs.existsSync(path.join(root, rel));

/** Every source file under `root`, capped so a monorepo cannot hang the CLI. */
export function sourceFiles(root, limit = 4000) {
  const out = [];
  const walk = (dir) => {
    if (out.length >= limit) return;
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (out.length >= limit) return;
      if (entry.name.startsWith(".") && entry.name !== ".claude") continue;
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) walk(p);
      } else if (SOURCE_EXT.has(path.extname(entry.name))) {
        out.push(p);
      }
    }
  };
  walk(root);
  return out;
}

/** First dependency in `names` that the manifest declares, with its range. */
function dependency(pkg, names) {
  const all = { ...(pkg?.dependencies ?? {}), ...(pkg?.devDependencies ?? {}), ...(pkg?.peerDependencies ?? {}) };
  for (const name of names) {
    if (all[name]) return { name, range: all[name] };
  }
  return null;
}

/** Leading integer of a semver range — good enough to branch on a major. */
function major(range) {
  const m = String(range ?? "").match(/(\d+)/);
  return m ? Number(m[1]) : null;
}

const FRAMEWORKS = [
  ["next", ["next"]],
  ["nuxt", ["nuxt"]],
  ["remix", ["@remix-run/react", "@remix-run/node"]],
  ["astro", ["astro"]],
  ["sveltekit", ["@sveltejs/kit"]],
  ["angular", ["@angular/core"]],
  ["vite", ["vite"]],
  ["cra", ["react-scripts"]],
];

function detectFramework(root, pkg) {
  for (const [name, deps] of FRAMEWORKS) {
    const hit = dependency(pkg, deps);
    if (hit) {
      return {
        name,
        version: hit.range,
        major: major(hit.range),
        confidence: "certain",
        evidence: [`package.json#${hit.name}`],
      };
    }
  }
  return { name: "unknown", version: null, major: null, confidence: "certain", evidence: ["package.json"] };
}

function detectRouter(root, framework) {
  if (framework.name === "next") {
    for (const base of ["app", "src/app"]) {
      if (exists(root, `${base}/layout.tsx`) || exists(root, `${base}/layout.jsx`)) {
        return { name: "app-router", evidence: [`${base}/layout.tsx`] };
      }
    }
    for (const base of ["pages", "src/pages"]) {
      if (exists(root, base)) return { name: "pages-router", evidence: [base] };
    }
    return { name: "unknown", evidence: [] };
  }
  return { name: framework.name === "unknown" ? "unknown" : "other", evidence: [] };
}

function detectRootLayout(root, router) {
  if (router.name !== "app-router") return { path: null, patchable: false, evidence: [] };
  for (const base of ["app", "src/app"]) {
    for (const ext of ["tsx", "jsx"]) {
      const rel = `${base}/layout.${ext}`;
      const src = read(root, rel);
      if (src === null) continue;
      // One <body> means one unambiguous place to mount. Anything else is the
      // user's call, not ours — `init` prints the two lines instead of guessing.
      const bodies = (src.match(/<body[\s>]/g) ?? []).length;
      return { path: rel, patchable: bodies === 1, bodies, evidence: [rel] };
    }
  }
  return { path: null, patchable: false, evidence: [] };
}

const CSS_LIBS = [
  ["styled-components", ["styled-components"]],
  ["emotion", ["@emotion/react", "@emotion/styled"]],
  ["stitches", ["@stitches/react"]],
  ["vanilla-extract", ["@vanilla-extract/css"]],
  ["bootstrap", ["bootstrap"]],
  ["bulma", ["bulma"]],
];

function detectCss(root, pkg, files) {
  const tailwind = dependency(pkg, ["tailwindcss"]);
  if (tailwind) {
    // v4 is `@import "tailwindcss"` in the stylesheet; v3 is a tailwind.config.*
    const v4Config = ["tailwind.config.js", "tailwind.config.ts", "tailwind.config.mjs", "tailwind.config.cjs"]
      .some((f) => exists(root, f));
    return {
      solution: "tailwind",
      major: major(tailwind.range),
      evidence: [`package.json#tailwindcss`, v4Config ? "tailwind.config.*" : "no tailwind.config.*"],
    };
  }
  for (const [name, deps] of CSS_LIBS) {
    const hit = dependency(pkg, deps);
    if (hit) return { solution: name, major: major(hit.range), evidence: [`package.json#${hit.name}`] };
  }
  const modules = files.filter((f) => f.endsWith(".module.css")).length;
  if (modules > 0) return { solution: "css-modules", major: null, evidence: [`${modules} *.module.css`] };
  return { solution: "plain-css", major: null, evidence: [] };
}

/** The stylesheet the app imports first — where tokens and resets would live. */
function findCssEntry(root) {
  const candidates = [
    "app/globals.css", "src/app/globals.css", "src/index.css", "src/main.css",
    "src/styles/globals.css", "styles/globals.css", "app/app.css", "src/styles.css",
  ];
  return candidates.find((rel) => exists(root, rel)) ?? null;
}

function detectTokens(root, cssEntry) {
  if (!cssEntry) return { customProperties: 0, prefixes: {}, evidence: [] };
  const css = read(root, cssEntry) ?? "";
  // Declarations only (`--x: value`), never `var(--x)` references.
  const declared = [...css.matchAll(/(^|[;{\s])(--[A-Za-z0-9_-]+)\s*:/g)].map((m) => m[2]);
  const unique = [...new Set(declared)];
  const prefixes = {};
  for (const name of unique) {
    const key = name.split("-").slice(0, 3).join("-").replace(/[0-9]+$/, "");
    prefixes[key] = (prefixes[key] ?? 0) + 1;
  }
  return { customProperties: unique.length, prefixes, evidence: [cssEntry] };
}

/** How hard the host's own stylesheet fights back at anything we render. */
function detectReset(root, cssEntry, css) {
  const signals = [];
  if (css.includes('@import "tailwindcss"') || css.includes("@import 'tailwindcss'")) signals.push("tailwind preflight");
  if (/@tailwind\s+base/.test(css)) signals.push("tailwind base");
  if (/normalize\.css|sanitize\.css/.test(css)) signals.push("normalize/sanitize");
  const bangs = (css.match(/!important/g) ?? []).length;
  if (bangs > 20) signals.push(`${bangs} !important`);
  if (/^\s*(button|input|a|h1|body)\s*\{/m.test(css)) signals.push("bare element rules");
  const level = signals.length >= 2 ? "high" : signals.length === 1 ? "medium" : "low";
  return { level, signals, evidence: cssEntry ? [cssEntry] : [] };
}

const ICON_LIBS = [
  ["material-symbols", ["@material-symbols/svg-400", "material-symbols"]],
  ["lucide", ["lucide-react", "lucide"]],
  ["heroicons", ["@heroicons/react"]],
  ["react-icons", ["react-icons"]],
  ["phosphor", ["@phosphor-icons/react"]],
  ["tabler", ["@tabler/icons-react"]],
];

function detectIcons(root, pkg, files) {
  for (const [name, deps] of ICON_LIBS) {
    const hit = dependency(pkg, deps);
    if (hit) return { system: name, confidence: "certain", evidence: [`package.json#${hit.name}`] };
  }
  // Material Symbols is usually a Google Fonts <link>, not a dependency.
  for (const file of files.slice(0, 400)) {
    let src;
    try {
      src = fs.readFileSync(file, "utf8");
    } catch {
      continue;
    }
    if (src.includes("Material+Symbols")) {
      return { system: "material-symbols", confidence: "likely", evidence: [path.relative(root, file)] };
    }
  }
  return { system: "none", confidence: "likely", evidence: [] };
}

function detectAlias(root) {
  for (const rel of ["tsconfig.json", "jsconfig.json"]) {
    const cfg = readJson(root, rel);
    const paths = cfg?.compilerOptions?.paths;
    if (paths) {
      const entry = Object.keys(paths)[0];
      return { style: entry, evidence: [`${rel}#compilerOptions.paths`] };
    }
  }
  return { style: null, evidence: [] };
}

/**
 * Is this path ignored — by a rule naming it, or by one naming a directory
 * above it? `/.agents/` covers `.agents/skills`, and the difference decides how
 * bad a wrong delete would be, so the ancestors have to be checked too.
 *
 * Literal paths only. A glob rule reads as "not ignored", which errs toward
 * warning the user rather than reassuring them wrongly.
 */
export function isIgnored(gitignore, rel) {
  const rules = gitignore
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && !line.includes("*"))
    .map((line) => line.replace(/^\//, "").replace(/\/$/, ""));
  const parts = rel.split("/");
  for (let i = parts.length; i > 0; i--) {
    if (rules.includes(parts.slice(0, i).join("/"))) return true;
  }
  return false;
}

/** Everything Auis might want to write that the host may already own. */
export function detectAgentFiles(root) {
  const gitignore = read(root, ".gitignore") ?? "";
  const ignored = (rel) => isIgnored(gitignore, rel);
  const out = [];
  for (const rel of ["AGENTS.md", "CLAUDE.md", ".mcp.json", "components.json"]) {
    if (exists(root, rel)) out.push({ path: rel, kind: "file", gitignored: ignored(rel) });
  }
  for (const rel of [".claude/skills", ".agents/skills", ".cursor/rules"]) {
    if (!exists(root, rel)) continue;
    let entries = [];
    try {
      entries = fs.readdirSync(path.join(root, rel)).filter((e) => !e.startsWith("."));
    } catch {
      /* unreadable is the same as empty for our purposes */
    }
    out.push({ path: rel, kind: "dir", entries: entries.length, names: entries, gitignored: ignored(rel) });
  }
  return out;
}

function detectRepo(root) {
  const git = exists(root, ".git");
  return { vcs: git ? "git" : null, evidence: git ? [".git"] : [] };
}

/** Host web components: our anchors cannot reach inside a closed shadow root. */
function detectWebComponents(root, files) {
  for (const file of files) {
    let src;
    try {
      src = fs.readFileSync(file, "utf8");
    } catch {
      continue;
    }
    if (src.includes("attachShadow(")) {
      return { present: true, evidence: [path.relative(root, file)] };
    }
  }
  return { present: false, evidence: [] };
}

function detectPackageManager(root) {
  const locks = [
    ["pnpm", "pnpm-lock.yaml"], ["yarn", "yarn.lock"],
    ["bun", "bun.lockb"], ["npm", "package-lock.json"],
  ];
  for (const [name, lock] of locks) {
    if (exists(root, lock)) return { name, evidence: [lock] };
  }
  return { name: "npm", evidence: [] };
}

/**
 * Can this project's dev server write files? The bridges persist comments to
 * JSON on disk, so this is what separates a shared queue from a browser-local one.
 */
function detectDevServer(root, pkg, framework, router) {
  const script = pkg?.scripts?.dev ?? pkg?.scripts?.start ?? null;
  const serverSide =
    (framework.name === "next" && router.name === "app-router") ||
    ["vite", "remix", "nuxt", "sveltekit", "astro"].includes(framework.name);
  return {
    fileWriting: Boolean(script) && serverSide,
    command: script,
    evidence: script ? ["package.json#scripts.dev"] : [],
  };
}

/** Everything `auis doctor` knows about a repository. Reads only. */
export function detect(root) {
  const pkg = readJson(root, "package.json");
  const files = sourceFiles(root);
  const framework = detectFramework(root, pkg);
  const router = detectRouter(root, framework);
  const cssEntry = findCssEntry(root);
  const cssSource = cssEntry ? (read(root, cssEntry) ?? "") : "";
  const react = dependency(pkg, ["react"]);

  return {
    name: pkg?.name ?? path.basename(root),
    packageManager: detectPackageManager(root),
    framework,
    react: { version: react?.range ?? null, major: react ? major(react.range) : null, evidence: react ? ["package.json#react"] : [] },
    router,
    rootLayout: detectRootLayout(root, router),
    devServer: detectDevServer(root, pkg, framework, router),
    css: { ...detectCss(root, pkg, files), entry: cssEntry },
    reset: detectReset(root, cssEntry, cssSource),
    tokens: detectTokens(root, cssEntry),
    icons: detectIcons(root, pkg, files),
    alias: detectAlias(root),
    webComponents: detectWebComponents(root, files),
    repo: detectRepo(root),
    sourceFileCount: files.length,
  };
}
