// The kit/ packages have to stay installable in someone else's repository, so
// what each one may import is a rule, checked here on every `npm test`:
//   @auis/core   — nothing outside itself (no app alias, framework or Node built-in)
//   @auis/server — @auis/core and Node built-ins, never the app or a UI framework
//   @auis/next   — @auis/server and @auis/core, never the app
// See docs/review-bridge-packages-plan.md.
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const KIT = path.resolve(import.meta.dirname, "..");

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return name === "__tests__" ? [] : sources(full);
    return /\.tsx?$/.test(name) ? [full] : [];
  });
}

function specifiers(file: string): string[] {
  // Comments are documentation (a usage example names the host's import).
  const text = readFileSync(file, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
  const found = text.matchAll(/(?:from\s+|import\s*\(\s*|require\s*\(\s*)["']([^"']+)["']/g);
  return [...found].map((m) => m[1]);
}

function violations(pkg: string, allowed: (spec: string) => boolean): string[] {
  return sources(path.join(KIT, pkg, "src")).flatMap((file) =>
    specifiers(file)
      .filter((spec) => !allowed(spec))
      .map((spec) => `${path.relative(KIT, file)} imports "${spec}"`),
  );
}

const relative = (spec: string) => spec.startsWith("./") || spec.startsWith("../");

test("@auis/core imports nothing outside itself", () => {
  assert.deepEqual(violations("core", relative), []);
});

test("@auis/server imports only @auis/core and Node built-ins", () => {
  assert.deepEqual(
    violations("server", (s) => relative(s) || s.startsWith("node:") || s.startsWith("@auis/core")),
    [],
  );
});

test("@auis/next imports only the other kit packages", () => {
  assert.deepEqual(
    violations("next", (s) => relative(s) || s.startsWith("@auis/server") || s.startsWith("@auis/core")),
    [],
  );
});
