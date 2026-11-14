import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { detectProject, nodeSatisfies, packageManagerOf, whyNotRunnable } from "../src/main/detect.ts";
import { tempDir, writeJson } from "./helpers.ts";

function project(manifest: unknown, files: string[] = []): string {
  const root = tempDir("detect");
  if (manifest !== null) writeJson(path.join(root, "package.json"), manifest);
  for (const file of files) {
    const target = path.join(root, file);
    if (file.endsWith("/")) fs.mkdirSync(target, { recursive: true });
    else {
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, "");
    }
  }
  return root;
}

const NEXT = { scripts: { dev: "next dev" }, dependencies: { next: "^16.0.0" } };

test("a project with the Auis surfaces", () => {
  assert.equal(detectProject(project(NEXT, ["app/auis/"]))?.kind, "auis");
  assert.equal(detectProject(project(NEXT, ["src/app/auis/"]))?.kind, "auis");
});

test("a host app with the Review kit installed", () => {
  assert.equal(detectProject(project(NEXT, [".auis/manifest.json"]))?.kind, "auis-review");
});

test("the Auis surfaces win over the kit's manifest", () => {
  assert.equal(detectProject(project(NEXT, ["app/auis/", ".auis/manifest.json"]))?.kind, "auis");
});

test("a Next app without Auis, and anything else", () => {
  assert.equal(detectProject(project(NEXT))?.kind, "next");
  assert.equal(detectProject(project({ scripts: { dev: "next dev" }, devDependencies: { next: "15" } }))?.kind, "next");
  assert.equal(detectProject(project({ scripts: { dev: "vite" } }))?.kind, "other");
});

test("the lockfile names the package manager", () => {
  assert.equal(packageManagerOf(project(NEXT)), "npm");
  assert.equal(packageManagerOf(project(NEXT, ["package-lock.json"])), "npm");
  assert.equal(packageManagerOf(project(NEXT, ["pnpm-lock.yaml"])), "pnpm");
  assert.equal(packageManagerOf(project(NEXT, ["yarn.lock"])), "yarn");
  assert.equal(packageManagerOf(project(NEXT, ["bun.lock"])), "bun");
  assert.equal(packageManagerOf(project(NEXT, ["bun.lockb"])), "bun");
});

test("whether the dependencies are installed", () => {
  assert.equal(detectProject(project(NEXT))?.depsInstalled, false);
  assert.equal(detectProject(project(NEXT, ["node_modules/"]))?.depsInstalled, true);
  assert.equal(detectProject(project(NEXT, [".pnp.cjs"]))?.depsInstalled, true);
});

test("the Node range comes from engines.node, and only from there", () => {
  assert.equal(detectProject(project(NEXT))?.nodeRange, null);
  assert.equal(detectProject(project({ ...NEXT, engines: { node: " >=22.6 " } }))?.nodeRange, ">=22.6");
  assert.equal(detectProject(project({ ...NEXT, engines: { node: 22 } }))?.nodeRange, null);
});

test("a folder that cannot run says why", () => {
  assert.match(whyNotRunnable(path.join(tempDir("gone"), "nowhere")) ?? "", /no longer exists/);
  assert.match(whyNotRunnable(project(null)) ?? "", /no package\.json/);
  assert.match(whyNotRunnable(project({ scripts: { build: "next build" } })) ?? "", /no dev script/);
  assert.match(whyNotRunnable(project({ scripts: { dev: "   " } })) ?? "", /no dev script/);
  assert.equal(whyNotRunnable(project(NEXT)), null);
});

test("a package.json that is not an object is not a project", () => {
  const root = tempDir("detect");
  fs.writeFileSync(path.join(root, "package.json"), "[]{");
  assert.equal(detectProject(root), null);
});

test("Node ranges as projects write them", () => {
  const cases: Array<[string, string, boolean]> = [
    ["v24.12.0", ">=20.9.0", true],
    ["20.8.1", ">=20.9.0", false],
    ["22.5.0", ">=22.6", false],
    ["22.6.0", ">=22.6", true],
    ["20.11.0", ">= 20", true],
    ["18.20.0", ">=20", false],
    ["22.3.0", ">=20 <23", true],
    ["23.0.0", ">=20 <23", false],
    ["22.9.0", "^20 || ^22", true],
    ["21.1.0", "^20 || ^22", false],
    ["20.3.1", "^20.9.0", false],
    ["20.19.0", "^20.9.0", true],
    ["21.0.0", "^20.9.0", false],
    ["22.11.3", "22.x", true],
    ["23.0.0", "22.x", false],
    ["22.4.9", "~22.4.0", true],
    ["22.5.0", "~22.4.0", false],
    ["22.0.0", "22", true],
    ["20.9.0", "20.9.0", true],
    ["20.9.1", "20.9.0", false],
    ["20.9.1", "=20.9.0", false],
    ["21.0.0", ">20", true],
    ["20.5.0", ">20", false],
    ["20.99.0", "<=20", true],
    ["21.0.0", "<=20", false],
    ["8.0.0", "*", true],
  ];
  for (const [version, range, expected] of cases) {
    assert.equal(nodeSatisfies(version, range), expected, `${version} against "${range}"`);
  }
});

test("a range it cannot read never blocks a project", () => {
  for (const range of ["18 - 20", "latest", ">=20.0.0-beta.1 <21", "^0.12", "lts/*"]) {
    assert.equal(nodeSatisfies("16.0.0", range), true, range);
  }
  assert.equal(nodeSatisfies("not a version", ">=20"), true);
});
