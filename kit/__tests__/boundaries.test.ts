// The kit/ packages have to stay installable in someone else's repository, so
// what each one may import is a rule, checked here on every `npm test`:
//   @auis/core   — nothing outside itself (no app alias, framework or Node built-in)
//   @auis/server — @auis/core and Node built-ins, never the app or a UI framework
//   @auis/next   — the other kit packages and Next, never the app
//   @auis/ui     — @auis/core, React and the chrome's own dependencies; never
//                  the app, Next or a Node built-in
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
const kit = (spec: string, ...names: string[]) => names.some((n) => spec === `@auis/${n}` || spec.startsWith(`@auis/${n}/`));

test("@auis/core imports nothing outside itself", () => {
  assert.deepEqual(violations("core", relative), []);
});

test("@auis/server imports only @auis/core and Node built-ins", () => {
  assert.deepEqual(
    violations("server", (s) => relative(s) || s.startsWith("node:") || s.startsWith("@auis/core")),
    [],
  );
});

test("@auis/next imports only the other kit packages, Next and React", () => {
  assert.deepEqual(
    violations(
      "next",
      (s) => relative(s) || kit(s, "server", "core", "ui") || s === "react" || s.startsWith("next/"),
    ),
    [],
  );
});

// What a host installs alongside the chrome (plus @radix-ui/*). Adding to this
// list adds a dependency to every host — keep it short. clsx + tailwind-merge
// keep `cn()` merging classes exactly as the primitives were written for.
const UI_DEPENDENCIES = ["react", "react-dom", "zustand", "clsx", "tailwind-merge"];

test("@auis/ui imports only @auis/core, React and its own dependencies", () => {
  assert.deepEqual(
    violations(
      "ui",
      (s) => relative(s) || kit(s, "core", "ui") || UI_DEPENDENCIES.includes(s) || s.startsWith("@radix-ui/"),
    ),
    [],
  );
});
