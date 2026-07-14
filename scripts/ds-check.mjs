#!/usr/bin/env node
/**
 * Auis / Auis — design-system hygiene check.
 *
 * WARN-ONLY by default (always exits 0) so it never blocks rapid prototyping.
 * Pass `--strict` to exit 1 when there are `warn`-level findings (opt-in CI).
 *
 * It flags the patterns AGENTS.md forbids and the "use the Aw component" rules
 * from docs/component-map.md:
 *   - hardcoded color (#hex) in className/style
 *   - arbitrary Tailwind values for radius / shadow / spacing / typography
 *   - arbitrary sizing (w/h/min/max) — info only, often legit
 *   - raw <svg> outside brand/illustration/agent visuals (use <Icon/>)
 *   - importing a raw shadcn primitive (card/table/button…) in product code
 *   - a hand-rolled overlay (fixed inset-0 + z-, role="dialog") — use AuModal/AuSheet
 *   - importing the deprecated BaseModal — use AuModal
 *   - a non-`Aw` component file sitting in components/ui/
 *   - drift between components/ui/Aw* and docs/component-map.md
 *
 * Usage:  npm run ds:check   (or)   node scripts/ds-check.mjs --strict
 */

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, relative, basename, dirname } from "node:path";

const ROOT = process.cwd();
const STRICT = process.argv.includes("--strict");
const MAX_PER_RULE = 40;

const KNOWN_PRIMITIVES = [
  "accordion", "badge", "button", "calendar", "card", "chart", "collapsible",
  "dropdown-menu", "popover", "separator", "table", "tooltip",
];

// Primitives with a TRUE drop-in Aw wrapper — importing the raw one in product
// is a real miss, so we flag it with an actionable target. The rest are
// "sanctioned bare primitives": low-customization Radix utilities already styled
// via the globals.css compat tokens, with no drop-in Aw to point to (tooltip,
// popover, collapsible, separator, calendar, accordion). `chart` has the AuChart
// helper layer, not a drop-in; `table` uses AuTable for simple cases or DataTable
// for rich ones — neither a 1:1 swap. See docs/component-map.md → primitives.
const AW_EQUIVALENT = {
  card: "AuCard",
  button: "AuButton",
  badge: "AuPill",
  "dropdown-menu": "AuDropdownMenu",
};

// Files where a raw <svg> or a hex literal is legitimately expected:
// brand marks, illustrations, agent/decorative visuals, the Icon component.
const RAW_VISUAL_RE =
  /(BrandIllustration|BrandLogo|CardBrand|MemoryBaseLogo|Logo|AgentCore|AgentAvatar|UserAgentOrb|CopilotSynthesis|Beams|DotTunnel|NeuralPattern|QrPlaceholder|Icon)\.tsx$/;
// WebGL/shader files pass numeric hex to the GPU (var() can't be read there).
const SHADER_HINT_RE =
  /@react-three|from ["']three["']|ShaderMaterial|uniforms|gl_FragColor|createShader/;
// Overlays legitimamente "crus": o gate de tela cheia e o próprio shell legado
// BaseModal (deprecado; seus imports são sinalizados à parte). Os primitivos de
// overlay Aw* (AuModal/AuSheet/AuCopilotDrawer…) já ficam de fora via !inUi.
const OVERLAY_EXEMPT_RE = /(DesktopOnlyBlocker|modals\/BaseModal)\.tsx$/;

const LINE_RULES = [
  {
    id: "hardcoded-color", sev: "warn", skipVisual: true,
    re: /-\[#[0-9a-fA-F]{3,8}\]|(?:color|background|backgroundColor|borderColor|fill|stroke)\s*:\s*["']?#[0-9a-fA-F]{3,8}/,
    hint: "Cor hardcoded. Use tokens (bg-raised, text-fg-primary, border-subtle) ou a paleta au-*.",
  },
  {
    id: "arbitrary-radius-shadow", sev: "warn",
    re: /\b(?:rounded|shadow)-\[(?!inherit\]|auto\])/,
    hint: "Radius/shadow arbitrário. Use rounded-{xs..2xl,full} / shadow-{xs..lg,overlay}.",
  },
  {
    id: "arbitrary-spacing", sev: "warn",
    re: /\b(?:p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr|gap|space-x|space-y)-\[(?!inherit\]|auto\])/,
    hint: "Spacing arbitrário. Use a escala de spacing (p-4, gap-2…).",
  },
  {
    id: "arbitrary-typography", sev: "warn",
    re: /\btext-\[[0-9]|\bleading-\[(?!inherit\]|auto\])|\btracking-\[|\bfont-\[(?!inherit\])/,
    hint: "Tipografia arbitrária. Use as classes de texto do sistema.",
  },
  {
    id: "raw-tailwind-color", sev: "warn",
    re: /\b(?:bg|text|border|fill|stroke|ring|divide|from|via|to|outline|decoration)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-[0-9]{2,3}\b/,
    hint: "Cor Tailwind crua (fora dos tokens). Use a paleta au-* ou tokens semânticos (bg-raised, text-fg-*).",
  },
  {
    id: "arbitrary-size", sev: "info",
    re: /\b(?:w|h|min-w|max-w|min-h|max-h|size)-\[(?!inherit\]|auto\]|calc)/,
    hint: "Tamanho arbitrário — revise (pode ser intencional; não há token de largura/altura).",
  },
  {
    id: "raw-svg", sev: "warn", skipVisual: true,
    re: /<svg[\s>]/,
    hint: 'SVG cru. Use <Icon name="…" />. SVG só p/ marca/ilustração/visual de agente.',
  },
];

const findings = [];
const addFinding = (sev, rule, file, line, text, hint) =>
  findings.push({
    sev, rule, hint,
    file: relative(ROOT, file),
    line,
    text: String(text).trim().replace(/\s+/g, " ").slice(0, 120),
  });

const norm = (p) => relative(ROOT, p).split("\\").join("/");
const lineOf = (src, index) => src.slice(0, index).split("\n").length;

function walk(dir, out = []) {
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); }
  catch { return out; }
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (["node_modules", ".next", ".git", ".agents"].includes(e.name)) continue;
      walk(p, out);
    } else if (e.isFile() && /\.tsx?$/.test(e.name)) {
      out.push(p);
    }
  }
  return out;
}

// ── scan ────────────────────────────────────────────────────────────────────
const files = [...walk(join(ROOT, "app")), ...walk(join(ROOT, "components"))];

for (const file of files) {
  const rel = norm(file);
  const src = readFileSync(file, "utf8");
  const inStyleguide = rel.includes("app/auis/"); // docs/showcases: example strings
  const inUi = rel.includes("components/ui/");
  const inToolUi = rel.includes("components/tool-ui/");
  const isVisual = RAW_VISUAL_RE.test(file) || SHADER_HINT_RE.test(src);
  // CLI-generated shadcn primitives carry upstream arbitrary values — not our debt.
  const isPrimitiveFile =
    norm(dirname(file)) === "components/ui" &&
    KNOWN_PRIMITIVES.includes(basename(file, ".tsx"));

  // line-level token/icon rules (skip styleguide doc surfaces + generated primitives)
  if (!inStyleguide && !isPrimitiveFile) {
    const lines = src.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const ln = lines[i];
      const t = ln.trimStart();
      if (t.startsWith("//") || t.startsWith("*") || t.startsWith("/*")) continue; // comments
      for (const r of LINE_RULES) {
        if (r.skipVisual && isVisual) continue;
        if (r.re.test(ln)) addFinding(r.sev, r.id, file, i + 1, ln, r.hint);
      }
    }
  }

  // raw shadcn primitive imported in product code (not a DS wrapper / adapter / showcase)
  if (!inStyleguide && !inUi && !inToolUi) {
    for (const m of src.matchAll(/from\s+["']@\/components\/ui\/([a-z][a-z-]*)["']/g)) {
      const aw = AW_EQUIVALENT[m[1]];
      if (aw) {
        addFinding(
          "warn", "primitive-import-in-product", file, lineOf(src, m.index),
          `import … "@/components/ui/${m[1]}"`,
          `Primitivo cru "${m[1]}" em produto — use ${aw} (docs/component-map.md).`,
        );
      }
    }

    // BaseModal deprecado — migrar para AuModal (anima entrada E saída).
    for (const m of src.matchAll(/from\s+["'][^"']*BaseModal["']/g)) {
      addFinding(
        "warn", "deprecated-basemodal", file, lineOf(src, m.index),
        "import … BaseModal",
        "BaseModal está deprecado — use AuModal (anima entrada E saída + tokens).",
      );
    }

    // Overlay na mão (modal/drawer) — perde a transição enter/exit que
    // AuModal/AuSheet carregam. Pula os overlays crus sancionados.
    if (!OVERLAY_EXEMPT_RE.test(file)) {
      const ovLines = src.split("\n");
      for (let i = 0; i < ovLines.length; i++) {
        const ln = ovLines[i];
        const t = ln.trimStart();
        if (t.startsWith("//") || t.startsWith("*") || t.startsWith("/*")) continue;
        const strongModal =
          /\brole=["']dialog["']/.test(ln) || /\baria-modal\b/.test(ln);
        // fixed full-bleed com z-index POSITIVO e interativo = overlay. Exclui
        // camadas de fundo (-z-, pointer-events-none).
        const fixedOverlay =
          /\bfixed inset-0\b/.test(ln) &&
          /\bz-(?:\[|[1-9])/.test(ln) &&
          !/-z-/.test(ln) &&
          !/pointer-events-none/.test(ln);
        if (strongModal || fixedOverlay) {
          addFinding(
            "warn", "handrolled-overlay", file, i + 1, ln,
            "Overlay na mão — use AuModal/AuSheet (carregam enter+exit + tokens). Modal na mão fecha sem transição.",
          );
        }
      }
    }
  }
}

// non-Aw component file directly under components/ui/ (subfolders like fluid/ are exempt)
for (const file of walk(join(ROOT, "components", "ui"))) {
  if (norm(dirname(file)) !== "components/ui") continue;
  if (!file.endsWith(".tsx")) continue;
  const name = basename(file, ".tsx");
  if (/^[a-z]/.test(name) && !KNOWN_PRIMITIVES.includes(name)) {
    addFinding("warn", "non-au-in-ui", file, 1, name,
      "Arquivo de DS sem prefixo Aw. Componentes do DS são Aw* (AGENTS.md §1).");
  }
}

// component-map drift
const mapPath = join(ROOT, "docs", "component-map.md");
if (existsSync(mapPath)) {
  const mapTxt = readFileSync(mapPath, "utf8");
  for (const file of walk(join(ROOT, "components", "ui"))) {
    if (norm(dirname(file)) !== "components/ui") continue;
    const name = basename(file, ".tsx");
    if (name.startsWith("Aw") && !mapTxt.includes(name)) {
      addFinding("info", "map-missing", file, 1, name,
        "Componente não citado em docs/component-map.md — documente-o.");
    }
  }
  for (const m of mapTxt.matchAll(/@\/components\/ui\/(Aw[A-Za-z0-9]+|Icon)\b/g)) {
    if (!existsSync(join(ROOT, "components", "ui", `${m[1]}.tsx`))) {
      addFinding("warn", "map-broken", mapPath, lineOf(mapTxt, m.index), m[1],
        "Linha do mapa aponta p/ componente inexistente.");
    }
  }
} else {
  addFinding("warn", "map-missing-file", mapPath, 1, "docs/component-map.md",
    "Índice de componentes ausente — crie docs/component-map.md.");
}

// ── report ───────────────────────────────────────────────────────────────────
const order = ["warn", "info"];
const byRule = new Map();
for (const f of findings) {
  const k = `${f.sev}:${f.rule}`;
  if (!byRule.has(k)) byRule.set(k, []);
  byRule.get(k).push(f);
}

const warnCount = findings.filter((f) => f.sev === "warn").length;
const infoCount = findings.filter((f) => f.sev === "info").length;

console.log("\n  ds:check — higiene do design system Auis\n");
if (!findings.length) {
  console.log("  ✓ nenhum problema encontrado.\n");
  process.exit(0);
}

for (const sev of order) {
  const keys = [...byRule.keys()].filter((k) => k.startsWith(`${sev}:`)).sort();
  for (const k of keys) {
    const items = byRule.get(k);
    const label = sev === "warn" ? "AVISO" : "nota";
    console.log(`  [${label}] ${k.split(":")[1]} — ${items[0].hint}`);
    for (const it of items.slice(0, MAX_PER_RULE)) {
      console.log(`     ${it.file}:${it.line}  ${it.text}`);
    }
    if (items.length > MAX_PER_RULE) {
      console.log(`     … +${items.length - MAX_PER_RULE} mais`);
    }
    console.log("");
  }
}

console.log(`  resumo: ${warnCount} aviso(s), ${infoCount} nota(s).`);
console.log("  guia: docs/component-map.md · AGENTS.md (Tokens are sacred / Components before code)\n");

process.exit(STRICT && warnCount > 0 ? 1 : 0);
