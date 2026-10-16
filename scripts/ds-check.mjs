#!/usr/bin/env node
/**
 * Auis — design-system hygiene check.
 *
 * It flags the patterns AGENTS.md forbids and the "use the Au component" rules
 * from docs/component-map.md:
 *   - hardcoded color (#hex) in className/style
 *   - arbitrary Tailwind values for radius / shadow / spacing / typography
 *   - raw Tailwind palette colors (bg-blue-500) outside the tokens
 *   - arbitrary sizing (w/h/min/max) — info only, often legit
 *   - raw <svg> outside brand/illustration visuals (use <Icon/>)
 *   - importing a raw shadcn primitive (card/button…) in product code
 *   - a hand-rolled overlay (fixed inset-0 + z-, role="dialog") — use AuModal/AuSheet
 *   - importing the deprecated BaseModal — use AuModal
 *   - a non-`Au` component file sitting in components/ui/
 *   - drift between components/ui/Au* and docs/component-map.md
 *
 * Usage:
 *   npm run ds:check                       # whole scope (app/, components/)
 *   node scripts/ds-check.mjs <path…>      # only these files
 *   node scripts/ds-check.mjs --json       # machine-readable report
 *   node scripts/ds-check.mjs --tier edit  # only the objective rules
 *
 * Exit codes (stable, for CI and hooks):
 *   0  no primary (`warn`) findings — `info` notes never fail
 *   2  at least one primary finding
 *   1  the scan itself failed (bad config, missing target, crash)
 * `--strict` is still accepted and changes nothing: failing on findings is the default now.
 *
 * Deliberate exceptions live in `.auis/ds-check.json` (`ignoreRules`, `ignoreFiles`,
 * `ignoreValues`, each with a mandatory `reason`) or inline, in a comment:
 *   ds-check-disable [rule, …] [-- reason]            whole file
 *   ds-check-disable-line [rule, …] [-- reason]       this line
 *   ds-check-disable-next-line [rule, …] [-- reason]  the line below
 * No rule list = every rule. The same engine runs the CLI and the agent hook
 * (scripts/ds-check-hook.mjs), so an exception declared once holds for both.
 */

import { readFileSync, readdirSync, existsSync, statSync, realpathSync } from "node:fs";
import { join, relative, resolve, basename, dirname, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";

export const CONFIG_PATH = ".auis/ds-check.json";
const DEFAULT_INCLUDE = ["app", "components"];
const MAP_PATH = "docs/component-map.md";
const SCAN_EXT_RE = /\.(tsx?|css)$/;

const KNOWN_PRIMITIVES = [
  "accordion", "badge", "button", "calendar", "card", "chart", "collapsible",
  "dropdown-menu", "popover", "radio-group", "separator", "table", "tooltip",
];

// Primitives with a TRUE drop-in Au wrapper — importing the raw one in product
// is a real miss, so we flag it with an actionable target. The rest are
// "sanctioned bare primitives": low-customization Radix utilities already styled
// via the globals.css compat tokens, with no drop-in Au to point to (tooltip,
// popover, collapsible, separator, calendar, accordion). `chart` has no Au layer
// at all; `table` maps to AuTable for simple, static cases, but AuTable carries no
// sort/pagination/selection — a rich data grid is a Layer B component you build,
// so it is not a 1:1 swap either. See docs/component-map.md → primitives.
const AU_EQUIVALENT = {
  card: "AuCard",
  button: "AuButton",
  badge: "AuPill",
  "dropdown-menu": "AuDropdownMenu",
  "radio-group": "AuRadioGroup",
};

// WebGL/shader code passes numeric hex to the GPU (var() can't be read there).
// Nothing in the repo matches today — Auis ships no shader files — but the rule
// is content-based, so it keeps working if you add one. Path-based exceptions
// (AuLogo, Icon, the token source) live in .auis/ds-check.json, with a reason.
const SHADER_HINT_RE = /ShaderMaterial|uniforms|gl_FragColor|createShader/;

/**
 * Every rule, with its tier:
 *   edit — objectively broken; the per-edit hook reports these right away.
 *   turn — needs context or the whole repo; reported once, at the end of the turn.
 * `warn` findings are primary (exit 2); `info` findings are notes (exit 0).
 */
export const RULES = {
  "hardcoded-color": {
    sev: "warn", tier: "edit",
    hint: "Hardcoded color. Use tokens (bg-raised, text-fg-primary, border-subtle) or the au-* palette.",
  },
  "arbitrary-radius-shadow": {
    sev: "warn", tier: "edit",
    hint: "Arbitrary radius/shadow. Use rounded-{xs..2xl,full} / shadow-{xs..lg,overlay}.",
  },
  "arbitrary-spacing": {
    sev: "warn", tier: "edit",
    hint: "Arbitrary spacing. Use the spacing scale (p-4, gap-2…).",
  },
  "arbitrary-typography": {
    sev: "warn", tier: "edit",
    hint: "Arbitrary typography. Use the system text classes.",
  },
  "raw-svg": {
    sev: "warn", tier: "edit",
    hint: 'Raw SVG. Use <Icon name="…" />. Raw SVG is only for brand / illustration visuals.',
  },
  "handrolled-overlay": {
    sev: "warn", tier: "edit",
    hint: "Hand-rolled overlay — use AuModal/AuSheet (they carry enter+exit + tokens). A hand-rolled modal closes with no transition.",
  },
  "primitive-import-in-product": {
    sev: "warn", tier: "edit",
    hint: "Raw shadcn primitive in product code — import its Au wrapper (docs/component-map.md).",
  },
  "raw-tailwind-color": {
    sev: "warn", tier: "turn",
    hint: "Raw Tailwind color (outside the tokens). Use the au-* palette or semantic tokens (bg-raised, text-fg-*).",
  },
  "deprecated-basemodal": {
    sev: "warn", tier: "turn",
    hint: "BaseModal is deprecated — use AuModal (animates enter AND exit + tokens).",
  },
  "arbitrary-size": {
    sev: "info", tier: "turn",
    hint: "Arbitrary size — review it (may be intentional; there is no width/height token).",
  },
  "non-au-in-ui": {
    sev: "warn", tier: "turn",
    hint: "DS file without the Au prefix. DS components are Au* (AGENTS.md §1).",
  },
  "map-missing": {
    sev: "info", tier: "turn",
    hint: "Component not referenced in docs/component-map.md — document it.",
  },
  "map-broken": {
    sev: "warn", tier: "turn",
    hint: "Map line points at a component that does not exist.",
  },
  "map-missing-file": {
    sev: "warn", tier: "turn",
    hint: "Component index missing — create docs/component-map.md.",
  },
};

// Line rules. `exts` limits a rule to file types (CSS has no JSX, imports or <svg>).
// `skipVisual` = not applied to files that legitimately carry hex (shader code).
const LINE_RULES = [
  {
    id: "hardcoded-color", skipVisual: true,
    re: /[\w:-]*-\[#[0-9a-fA-F]{3,8}\]|(?:color|background|backgroundColor|borderColor|fill|stroke)\s*:\s*["']?#[0-9a-fA-F]{3,8}/,
  },
  { id: "arbitrary-radius-shadow", re: /\b(?:rounded|shadow)-\[(?!inherit\]|auto\])/ },
  {
    id: "arbitrary-spacing",
    re: /\b(?:p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr|gap|space-x|space-y)-\[(?!inherit\]|auto\])/,
  },
  {
    id: "arbitrary-typography",
    re: /\btext-\[[0-9]|\bleading-\[(?!inherit\]|auto\])|\btracking-\[|\bfont-\[(?!inherit\])/,
  },
  {
    id: "raw-tailwind-color",
    re: /\b(?:bg|text|border|fill|stroke|ring|divide|from|via|to|outline|decoration)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-[0-9]{2,3}\b/,
  },
  { id: "arbitrary-size", re: /\b(?:w|h|min-w|max-w|min-h|max-h|size)-\[(?!inherit\]|auto\]|calc)/ },
  { id: "raw-svg", skipVisual: true, exts: /\.tsx?$/, re: /<svg[\s>]/ },
];

export class DsCheckError extends Error {}

const toPosix = (p) => p.split("\\").join("/");
const lineOf = (src, index) => src.slice(0, index).split("\n").length;
const isCommentLine = (ln) => {
  const t = ln.trimStart();
  return t.startsWith("//") || t.startsWith("*") || t.startsWith("/*");
};

/** `**` crosses folders, `*` and `?` don't. A pattern with no glob also matches a folder prefix. */
export function globToRegExp(pattern) {
  const p = toPosix(pattern).replace(/^\.\//, "").replace(/\/$/, "");
  if (!/[*?]/.test(p)) {
    const esc = p.replace(/[.+^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`^${esc}(?:/.*)?$`);
  }
  let re = "";
  for (let i = 0; i < p.length; i++) {
    const c = p[i];
    if (c === "*" && p[i + 1] === "*") {
      if (p[i + 2] === "/") { re += "(?:.*/)?"; i += 2; } else { re += ".*"; i += 1; }
    } else if (c === "*") re += "[^/]*";
    else if (c === "?") re += "[^/]";
    else re += c.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`^${re}$`);
}

// ── config ──────────────────────────────────────────────────────────────────

function requireReason(entry, where) {
  if (!entry || typeof entry !== "object") throw new DsCheckError(`${where}: each entry must be an object.`);
  if (typeof entry.reason !== "string" || !entry.reason.trim()) {
    throw new DsCheckError(`${where}: "reason" is required — say why this exception is deliberate.`);
  }
}

function requireRule(id, where) {
  if (!RULES[id]) {
    throw new DsCheckError(`${where}: unknown rule "${id}". Known rules: ${Object.keys(RULES).join(", ")}.`);
  }
}

/** Reads and validates the ignore config. Missing file = no exceptions. */
export function loadConfig(root, configPath = CONFIG_PATH) {
  const abs = isAbsolute(configPath) ? configPath : join(root, configPath);
  const empty = { include: DEFAULT_INCLUDE, ignoreRules: [], ignoreFiles: [], ignoreValues: [] };
  if (!existsSync(abs)) return empty;
  let raw;
  try {
    raw = JSON.parse(readFileSync(abs, "utf8"));
  } catch (err) {
    throw new DsCheckError(`${configPath}: invalid JSON (${err.message}).`);
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new DsCheckError(`${configPath}: expected a JSON object.`);
  }
  const list = (key) => {
    const v = raw[key] ?? [];
    if (!Array.isArray(v)) throw new DsCheckError(`${configPath}: "${key}" must be an array.`);
    return v;
  };

  const include = raw.include ?? DEFAULT_INCLUDE;
  if (!Array.isArray(include) || !include.every((d) => typeof d === "string" && d)) {
    throw new DsCheckError(`${configPath}: "include" must be an array of folders.`);
  }

  const ignoreRules = list("ignoreRules").map((e, i) => {
    const where = `${configPath} ignoreRules[${i}]`;
    requireReason(e, where);
    requireRule(e.rule, where);
    return { rule: e.rule, reason: e.reason };
  });

  const ignoreFiles = list("ignoreFiles").map((e, i) => {
    const where = `${configPath} ignoreFiles[${i}]`;
    requireReason(e, where);
    if (typeof e.path !== "string" || !e.path) throw new DsCheckError(`${where}: "path" is required.`);
    if (e.rules !== undefined) {
      if (!Array.isArray(e.rules)) throw new DsCheckError(`${where}: "rules" must be an array.`);
      e.rules.forEach((r) => requireRule(r, where));
    }
    return { path: e.path, re: globToRegExp(e.path), rules: e.rules ?? null, reason: e.reason };
  });

  const ignoreValues = list("ignoreValues").map((e, i) => {
    const where = `${configPath} ignoreValues[${i}]`;
    requireReason(e, where);
    requireRule(e.rule, where);
    if (typeof e.value !== "string" || !e.value) throw new DsCheckError(`${where}: "value" is required.`);
    if (e.file !== undefined && (typeof e.file !== "string" || !e.file)) {
      throw new DsCheckError(`${where}: "file" must be a path or glob.`);
    }
    return { rule: e.rule, value: e.value, file: e.file ?? null, re: e.file ? globToRegExp(e.file) : null, reason: e.reason };
  });

  return { include: include.map((d) => toPosix(d).replace(/\/$/, "")), ignoreRules, ignoreFiles, ignoreValues };
}

// ── inline directives ───────────────────────────────────────────────────────

const DIRECTIVE_RE = /(?:\/\/|\/\*)\s*ds-check-(disable-next-line|disable-line|disable)(?![\w-])([^\n]*)/;

function parseDirective(rest) {
  let body = rest;
  const close = body.indexOf("*/");
  if (close !== -1) body = body.slice(0, close);
  const sep = body.indexOf("--");
  const rulesPart = sep === -1 ? body : body.slice(0, sep);
  const reason = sep === -1 ? "" : body.slice(sep + 2).trim();
  const rules = rulesPart.split(/[\s,]+/).filter((r) => /^[a-z][a-z0-9-]*$/.test(r));
  return { rules: rules.length ? rules : null, reason };
}

/** Maps each line (1-based) and the whole file to the inline disables that cover it. */
function readDirectives(lines) {
  const file = [];
  const byLine = new Map();
  const add = (n, d) => {
    if (!byLine.has(n)) byLine.set(n, []);
    byLine.get(n).push(d);
  };
  lines.forEach((ln, i) => {
    const m = DIRECTIVE_RE.exec(ln);
    if (!m) return;
    const d = parseDirective(m[2]);
    if (m[1] === "disable") file.push(d);
    else if (m[1] === "disable-line") add(i + 1, d);
    else add(i + 2, d);
  });
  return { file, byLine };
}

const covers = (d, rule) => !d.rules || d.rules.includes(rule);

// ── scan ────────────────────────────────────────────────────────────────────

function walk(dir, out = []) {
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); }
  catch { return out; }
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (["node_modules", ".next", ".git", ".agents"].includes(e.name)) continue;
      walk(p, out);
    } else if (e.isFile() && SCAN_EXT_RE.test(e.name)) {
      out.push(p);
    }
  }
  return out;
}

/**
 * Runs the check and returns `{ findings, suppressed, scanned, skipped }`.
 *
 * - `targets`: files to check (relative to `root` or absolute). Omitted = the
 *   whole `include` scope plus the repo-level checks. With targets, a file
 *   outside the root or the scope is skipped, and the repo-level checks only
 *   run for targets they concern (components/ui/*, the component map).
 * - `tier`: "edit" = only the objective rules; "all" (default) = every rule.
 * - `rules`: optional allowlist of rule ids.
 */
export function check({ root = process.cwd(), targets = null, tier = "all", rules = null, config } = {}) {
  root = resolve(root);
  const cfg = config ?? loadConfig(root);
  if (rules) rules.forEach((r) => requireRule(r, "--rules"));
  const enabled = (id) =>
    (tier !== "edit" || RULES[id].tier === "edit") && (!rules || rules.includes(id));

  const rel = (abs) => toPosix(relative(root, abs));
  const inScope = (r) => cfg.include.some((d) => r === d || r.startsWith(`${d}/`));

  const findings = [];
  const suppressed = [];
  const skipped = [];

  // ── which files ──
  let files;
  let mapTargeted = false;
  let uiTargets = null; // null = every components/ui file (full scan)
  if (targets) {
    files = [];
    uiTargets = new Set();
    for (const t of targets) {
      const abs = resolve(root, t);
      if (!existsSync(abs)) throw new DsCheckError(`target not found: ${t}`);
      const r = rel(abs);
      if (r.startsWith("..") || isAbsolute(r)) { skipped.push({ file: toPosix(t), why: "outside the project root" }); continue; }
      if (statSync(abs).isDirectory()) {
        for (const f of walk(abs)) {
          if (inScope(rel(f))) files.push(f);
        }
        continue;
      }
      if (r === MAP_PATH) { mapTargeted = true; continue; }
      if (!SCAN_EXT_RE.test(r)) { skipped.push({ file: r, why: "not a .ts/.tsx/.css file" }); continue; }
      if (!inScope(r)) { skipped.push({ file: r, why: `outside the scanned folders (${cfg.include.join(", ")})` }); continue; }
      files.push(abs);
    }
    for (const f of files) {
      if (dirname(rel(f)) === "components/ui" && f.endsWith(".tsx")) uiTargets.add(rel(f));
    }
  } else {
    files = cfg.include.flatMap((d) => walk(join(root, d)));
  }
  files = [...new Set(files)];

  // ── suppression ──
  const directivesByFile = new Map();
  function suppressionFor(f) {
    const rule = cfg.ignoreRules.find((e) => e.rule === f.rule);
    if (rule) return { by: "config:ignoreRules", reason: rule.reason };
    const file = cfg.ignoreFiles.find((e) => e.re.test(f.file) && (!e.rules || e.rules.includes(f.rule)));
    if (file) return { by: "config:ignoreFiles", reason: file.reason };
    const value = cfg.ignoreValues.find(
      (e) => e.rule === f.rule && (!e.re || e.re.test(f.file)) && (f.match === e.value || f.source.includes(e.value)),
    );
    if (value) return { by: "config:ignoreValues", reason: value.reason };
    const dirs = directivesByFile.get(f.file);
    if (dirs) {
      const d = dirs.file.find((x) => covers(x, f.rule)) ?? (dirs.byLine.get(f.line) ?? []).find((x) => covers(x, f.rule));
      if (d) return { by: "inline", reason: d.reason };
    }
    return null;
  }

  function add(rule, file, line, source, match = "") {
    if (!enabled(rule)) return;
    const f = {
      rule,
      severity: RULES[rule].sev,
      primary: RULES[rule].sev === "warn",
      tier: RULES[rule].tier,
      file,
      line,
      text: String(source).trim().replace(/\s+/g, " ").slice(0, 120),
      match,
      hint: RULES[rule].hint,
      source: String(source),
    };
    const s = suppressionFor(f);
    delete f.source;
    if (s) suppressed.push({ ...f, ...s });
    else findings.push(f);
  }

  // ── per-file rules ──
  for (const abs of files) {
    const r = rel(abs);
    const src = readFileSync(abs, "utf8");
    const lines = src.split("\n");
    directivesByFile.set(r, readDirectives(lines));
    const isCss = r.endsWith(".css");
    const inStyleguide = r.includes("app/auis/"); // docs/showcases: example strings
    const inUi = r.includes("components/ui/");
    const inToolUi = r.includes("components/tool-ui/");
    const isVisual = SHADER_HINT_RE.test(src);
    // CLI-generated shadcn primitives carry upstream arbitrary values — not our debt.
    const isPrimitiveFile =
      dirname(r) === "components/ui" && KNOWN_PRIMITIVES.includes(basename(r, ".tsx"));

    // line-level token/icon rules (skip styleguide doc surfaces + generated primitives)
    if (!inStyleguide && !isPrimitiveFile) {
      for (let i = 0; i < lines.length; i++) {
        const ln = lines[i];
        if (isCommentLine(ln)) continue;
        if (isCss && /^\s*--[\w-]+\s*:/.test(ln)) continue; // a custom property defines a token
        for (const lr of LINE_RULES) {
          if (lr.skipVisual && isVisual) continue;
          if (lr.exts && !lr.exts.test(r)) continue;
          const m = lr.re.exec(ln);
          if (m) add(lr.id, r, i + 1, ln, m[0]);
        }
      }
    }

    if (isCss || inStyleguide || inUi || inToolUi) continue;

    // raw shadcn primitive imported in product code (not a DS wrapper / adapter / showcase)
    for (const m of src.matchAll(/from\s+["']@\/components\/ui\/([a-z][a-z-]*)["']/g)) {
      const au = AU_EQUIVALENT[m[1]];
      if (au) {
        add("primitive-import-in-product", r, lineOf(src, m.index),
          `import … "@/components/ui/${m[1]}" — use ${au}`, m[0]);
      }
    }

    // BaseModal is deprecated — migrate to AuModal (animates enter AND exit).
    for (const m of src.matchAll(/from\s+["'][^"']*BaseModal["']/g)) {
      add("deprecated-basemodal", r, lineOf(src, m.index), "import … BaseModal", m[0]);
    }

    // Hand-rolled overlay (modal/drawer) — loses the enter/exit transition that
    // AuModal/AuSheet carry.
    for (let i = 0; i < lines.length; i++) {
      const ln = lines[i];
      if (isCommentLine(ln)) continue;
      const strongModal = /\brole=["']dialog["']/.test(ln) || /\baria-modal\b/.test(ln);
      // fixed full-bleed with a POSITIVE, interactive z-index = overlay.
      // Excludes background layers (-z-, pointer-events-none).
      const fixedOverlay =
        /\bfixed inset-0\b/.test(ln) &&
        /\bz-(?:\[|[1-9])/.test(ln) &&
        !/-z-/.test(ln) &&
        !/pointer-events-none/.test(ln);
      if (strongModal || fixedOverlay) add("handrolled-overlay", r, i + 1, ln);
    }
  }

  // ── repo-level rules (turn tier) ──
  if (tier !== "edit") {
    const uiFiles = uiTargets
      ? [...uiTargets]
      : walk(join(root, "components", "ui")).map(rel).filter((r) => dirname(r) === "components/ui" && r.endsWith(".tsx"));

    // non-Au component file directly under components/ui/ (subfolders like fluid/ are exempt)
    for (const r of uiFiles) {
      const name = basename(r, ".tsx");
      if (/^[a-z]/.test(name) && !KNOWN_PRIMITIVES.includes(name)) add("non-au-in-ui", r, 1, name);
    }

    // component-map drift — in targeted mode only for the files it concerns
    const wantMap = !targets || mapTargeted || uiFiles.length > 0;
    if (wantMap) {
      const mapAbs = join(root, MAP_PATH);
      if (existsSync(mapAbs)) {
        const mapTxt = readFileSync(mapAbs, "utf8");
        for (const r of uiFiles) {
          const name = basename(r, ".tsx");
          if (name.startsWith("Au") && !mapTxt.includes(name)) add("map-missing", r, 1, name);
        }
        if (!targets || mapTargeted) {
          for (const m of mapTxt.matchAll(/@\/components\/ui\/(Au[A-Za-z0-9]+|Icon)\b/g)) {
            if (!existsSync(join(root, "components", "ui", `${m[1]}.tsx`))) {
              add("map-broken", MAP_PATH, lineOf(mapTxt, m.index), m[1], m[1]);
            }
          }
        }
      } else {
        add("map-missing-file", MAP_PATH, 1, MAP_PATH);
      }
    }
  }

  return { findings, suppressed, scanned: files.length, skipped };
}

// ── CLI ─────────────────────────────────────────────────────────────────────

const MAX_PER_RULE = 40;

function parseArgs(argv) {
  const opts = { json: false, tier: "all", rules: null, config: CONFIG_PATH, targets: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const value = () => {
      const v = a.includes("=") ? a.slice(a.indexOf("=") + 1) : argv[++i];
      if (v === undefined) throw new DsCheckError(`${a} needs a value.`);
      return v;
    };
    if (a === "--json") opts.json = true;
    else if (a === "--strict") { /* the default now — kept so old commands still run */ }
    else if (a === "--tier" || a.startsWith("--tier=")) {
      opts.tier = value();
      if (!["edit", "all"].includes(opts.tier)) throw new DsCheckError(`--tier must be "edit" or "all".`);
    } else if (a === "--rules" || a.startsWith("--rules=")) opts.rules = value().split(",").filter(Boolean);
    else if (a === "--config" || a.startsWith("--config=")) opts.config = value();
    else if (a === "--help" || a === "-h") opts.help = true;
    else if (a.startsWith("-")) throw new DsCheckError(`unknown option ${a}`);
    else opts.targets.push(a);
  }
  return opts;
}

function printText({ findings, suppressed }) {
  console.log("\n  ds:check — Auis design-system hygiene\n");
  if (!findings.length) {
    console.log("  ✓ no problems found.");
    if (suppressed.length) console.log(`  (${suppressed.length} deliberate exception(s) skipped — see .auis/ds-check.json / inline ds-check-disable.)`);
    console.log("");
    return;
  }
  const byRule = new Map();
  for (const f of findings) {
    const k = `${f.severity}:${f.rule}`;
    if (!byRule.has(k)) byRule.set(k, []);
    byRule.get(k).push(f);
  }
  for (const sev of ["warn", "info"]) {
    const keys = [...byRule.keys()].filter((k) => k.startsWith(`${sev}:`)).sort();
    for (const k of keys) {
      const items = byRule.get(k);
      const label = sev === "warn" ? "WARN" : "note";
      console.log(`  [${label}] ${k.split(":")[1]} — ${items[0].hint}`);
      for (const it of items.slice(0, MAX_PER_RULE)) console.log(`     ${it.file}:${it.line}  ${it.text}`);
      if (items.length > MAX_PER_RULE) console.log(`     … +${items.length - MAX_PER_RULE} more`);
      console.log("");
    }
  }
  const warnCount = findings.filter((f) => f.primary).length;
  console.log(`  summary: ${warnCount} warning(s), ${findings.length - warnCount} note(s), ${suppressed.length} deliberate exception(s) skipped.`);
  console.log("  guide: docs/component-map.md · AGENTS.md (Tokens are sacred / Components before code)\n");
}

export function main(argv = process.argv.slice(2), root = process.cwd()) {
  let opts;
  try {
    opts = parseArgs(argv);
    if (opts.help) {
      console.log("usage: ds-check [--json] [--tier edit|all] [--rules a,b] [--config path] [file…]");
      return 0;
    }
    const config = loadConfig(root, opts.config);
    const result = check({
      root,
      targets: opts.targets.length ? opts.targets : null,
      tier: opts.tier,
      rules: opts.rules,
      config,
    });
    const primary = result.findings.filter((f) => f.primary).length;
    if (opts.json) {
      console.log(JSON.stringify({
        version: 1,
        tier: opts.tier,
        scanned: result.scanned,
        summary: {
          primary,
          info: result.findings.length - primary,
          suppressed: result.suppressed.length,
        },
        findings: result.findings,
        suppressed: result.suppressed,
        skipped: result.skipped,
      }, null, 2));
    } else {
      printText(result);
    }
    return primary > 0 ? 2 : 0;
  } catch (err) {
    const msg = err instanceof DsCheckError ? err.message : err.stack || String(err);
    if (opts?.json) console.log(JSON.stringify({ version: 1, error: msg }));
    console.error(`ds:check failed: ${msg}`);
    return 1;
  }
}

if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  process.exitCode = main();
}
