// `auis doctor` reads somebody else's repository and tells them what Auis could
// and could not do inside it. Two promises hold the command up: it writes
// nothing, and it exits 0 even when every answer is "no". Both are pinned here.

import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { tmpdir } from "node:os";
import { after, describe, it } from "node:test";

import { detect, isIgnored } from "../src/detect.mjs";
import { buildReport, capabilities, collisions, installPlan } from "../src/doctor.mjs";

const temps = [];
after(() => {
  for (const dir of temps) rmSync(dir, { recursive: true, force: true });
});

function write(root, rel, contents) {
  const p = join(root, rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, contents);
}

/** A Next App Router app with Tailwind v4, its own tokens, and its own agent files. */
function makeHost(overrides = {}) {
  const root = mkdtempSync(join(tmpdir(), "auis-doctor-"));
  temps.push(root);
  write(root, "package.json", JSON.stringify({
    name: "host-app",
    scripts: { dev: "next dev" },
    dependencies: { next: "16.2.9", react: "19.2.4" },
    devDependencies: { tailwindcss: "^4" },
    ...overrides.pkg,
  }));
  write(root, "app/layout.tsx", `export default function L({children}){return <html><body>{children}</body></html>}`);
  write(root, "app/globals.css", overrides.css ?? `@import "tailwindcss";\n:root{${
    Array.from({ length: 22 }, (_, i) => `--tok-${i}: #fff;`).join("")
  }}\n`);
  write(root, "tsconfig.json", JSON.stringify({ compilerOptions: { paths: { "@/*": ["./*"] } } }));
  write(root, ".gitignore", "/node_modules\n/.next\n");
  write(root, "AGENTS.md", "# host rules\n");
  write(root, ".claude/skills/host-skill/SKILL.md", "host skill\n");
  return root;
}

/** Every file under `root`, for byte comparison. */
function snapshot(root) {
  const out = {};
  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      const p = join(dir, entry);
      if (statSync(p).isDirectory()) walk(p);
      else out[relative(root, p).split(sep).join("/")] = readFileSync(p, "utf8");
    }
  };
  walk(root);
  return out;
}

const verdictOf = (caps, id) => caps.find((c) => c.id === id)?.verdict;

describe("isIgnored", () => {
  it("honours a rule naming a directory above the path", () => {
    assert.equal(isIgnored("/.agents/\n", ".agents/skills"), true);
    assert.equal(isIgnored("/.claude/skills/\n", ".claude/skills"), true);
  });

  it("does not claim a path nothing mentions", () => {
    assert.equal(isIgnored("/node_modules\n", "AGENTS.md"), false);
    assert.equal(isIgnored("# .agents/\n", ".agents/skills"), false, "a comment ignores nothing");
  });

  it("reads a glob as not-ignored, erring toward warning the user", () => {
    assert.equal(isIgnored(".claude/*\n", ".claude/skills"), false);
  });
});

describe("detect", () => {
  it("reads the stack off a repository it has never seen", () => {
    const d = detect(makeHost());
    assert.equal(d.framework.name, "next");
    assert.equal(d.router.name, "app-router");
    assert.equal(d.react.major, 19);
    assert.equal(d.css.solution, "tailwind");
    assert.equal(d.css.major, 4);
    assert.equal(d.tokens.customProperties, 22);
    assert.equal(d.alias.style, "@/*");
    assert.equal(d.devServer.fileWriting, true);
    assert.equal(d.rootLayout.patchable, true, "one <body> is a place we can patch");
  });

  it("counts declarations, never var() references", () => {
    const root = makeHost({ css: ":root{--a:1;--b:2}\n.x{color:var(--a);background:var(--b)}\n" });
    assert.equal(detect(root).tokens.customProperties, 2);
  });

  it("says unknown rather than guessing when there is no framework", () => {
    const root = mkdtempSync(join(tmpdir(), "auis-doctor-bare-"));
    temps.push(root);
    write(root, "README.md", "a repo with no package.json\n");
    const d = detect(root);
    assert.equal(d.framework.name, "unknown");
    assert.equal(d.devServer.fileWriting, false);
  });
});

describe("capabilities", () => {
  it("supports what needs nothing from the host stack", () => {
    const caps = capabilities(detect(makeHost()));
    for (const id of ["review.pins", "review.anchoring", "edit.text", "edit.reorder", "flow.driver", "skills.rulebook"]) {
      assert.equal(verdictOf(caps, id), "supported", id);
    }
  });

  it("refuses to pretend about the three registries keyed to Auis's own names", () => {
    const caps = capabilities(detect(makeHost()));
    assert.equal(verdictOf(caps, "edit.variant"), "unsupported");
    assert.equal(verdictOf(caps, "edit.typography"), "unsupported");
    assert.equal(verdictOf(caps, "edit.icon"), "unsupported", "no icon system in the fixture");
  });

  it("grades edit.style by how many tokens the host actually declares", () => {
    assert.equal(verdictOf(capabilities(detect(makeHost())), "edit.style"), "supported");
    assert.equal(verdictOf(capabilities(detect(makeHost({ css: ":root{--a:1;--b:2}" }))), "edit.style"), "degraded");
    assert.equal(verdictOf(capabilities(detect(makeHost({ css: ".x{color:red}" }))), "edit.style"), "unsupported");
  });

  it("downgrades persistence when nothing can write a file", () => {
    const root = mkdtempSync(join(tmpdir(), "auis-doctor-spa-"));
    temps.push(root);
    write(root, "package.json", JSON.stringify({ name: "spa", dependencies: { react: "19.0.0" } }));
    const caps = capabilities(detect(root));
    assert.equal(verdictOf(caps, "review.persistence"), "degraded");
    assert.equal(verdictOf(caps, "skills.bridges"), "unsupported");
    assert.equal(verdictOf(caps, "review.pins"), "supported", "pins never needed the server");
  });

  it("ties materialization to the App Router, because that is what the inference assumes", () => {
    const appRouter = capabilities(detect(makeHost()));
    assert.equal(verdictOf(appRouter, "edit.materialize"), "supported");

    const root = mkdtempSync(join(tmpdir(), "auis-doctor-pages-"));
    temps.push(root);
    write(root, "package.json", JSON.stringify({ name: "p", scripts: { dev: "next dev" }, dependencies: { next: "14.0.0", react: "18.2.0" } }));
    write(root, "pages/index.tsx", "export default function P(){return null}");
    assert.equal(verdictOf(capabilities(detect(root)), "edit.materialize"), "unsupported");
  });

  it("gives every non-supported verdict a remedy — 'may not work' is not a verdict", () => {
    for (const cap of capabilities(detect(makeHost()))) {
      assert.ok(cap.because, `${cap.id} must say why`);
      if (cap.verdict !== "supported") assert.ok(cap.remedy, `${cap.id} must offer a remedy`);
    }
  });
});

describe("collisions and plan", () => {
  it("names what the host already owns, and never plans to overwrite it", () => {
    const root = makeHost();
    const found = collisions(root);
    const agents = found.find((c) => c.path === "AGENTS.md");
    assert.equal(agents.plan, "append-block");
    const skills = found.find((c) => c.path === ".claude/skills");
    assert.equal(skills.plan, "merge-namespaced");
    assert.equal(skills.entries, 1);
    assert.ok(!found.some((c) => c.plan === "overwrite"), "nothing is ever planned as an overwrite");
  });

  it("resolves the route file against the target repo, not the caller's cwd", () => {
    const root = mkdtempSync(join(tmpdir(), "auis-doctor-src-"));
    temps.push(root);
    write(root, "package.json", JSON.stringify({ name: "s", scripts: { dev: "next dev" }, dependencies: { next: "16.0.0", react: "19.0.0" } }));
    write(root, "src/app/layout.tsx", "export default function L({children}){return <html><body>{children}</body></html>}");
    const steps = installPlan(detect(root), root);
    assert.ok(steps.some((s) => s.path === "src/app/api/auis/[...auis]/route.ts"), JSON.stringify(steps.map((s) => s.path)));
  });
});

describe("the two promises", () => {
  it("writes nothing at all", () => {
    const root = makeHost();
    const before = snapshot(root);
    buildReport(root, "0.0.0");
    assert.deepEqual(snapshot(root), before);
  });

  it("still produces a full report when the answer is no to almost everything", () => {
    const root = mkdtempSync(join(tmpdir(), "auis-doctor-alien-"));
    temps.push(root);
    write(root, "Gemfile", "source 'https://rubygems.org'\n");
    write(root, "app/views/home.html.erb", "<h1>hi</h1>\n");

    const doc = buildReport(root, "0.0.0");
    assert.equal(doc.auisDoctorVersion, 1);
    assert.equal(doc.detections.framework.name, "unknown");
    assert.ok(doc.capabilities.length >= 15);
    assert.ok(doc.summary.unsupported > 0);
    assert.ok(doc.summary.supported > 0, "the rulebook works even here");
    assert.equal(verdictOf(doc.capabilities, "skills.rulebook"), "supported");
  });
});
