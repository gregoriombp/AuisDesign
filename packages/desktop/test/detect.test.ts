import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  detectProject,
  manifestProblem,
  nodeProblem,
  packageManagerOf,
  readNode,
} from "../src/main/detect.ts";
import { environment, installed, project, temp, write } from "./helpers.ts";
test("distinguishes missing folders, invalid manifests and unsupported projects", (t) => {
  const root = temp(t);
  assert.equal(detectProject(root + "/missing").ok, false);
  for (const data of [null, [], "{broken", { scripts: { dev: 1 } }]) {
    write(root, "package.json", data);
    assert.ok(manifestProblem(root));
  }
  project(root, { dependencies: { vite: "*" } });
  assert.match(JSON.stringify(detectProject(root)), /does not declare Next/);
});
test("identifies scaffold, installed host and plain Next; checks actual dependency resolution", (t) => {
  const root = temp(t);
  project(root);
  let result = detectProject(root);
  assert.ok(result.ok);
  assert.deepEqual(result.project.missingDependencies, ["next"]);
  installed(root);
  result = detectProject(root);
  assert.ok(result.ok);
  assert.equal(result.project.kind, "next");
  assert.deepEqual(result.project.missingDependencies, []);
  write(root, ".auis/manifest.json", {});
  result = detectProject(root);
  assert.ok(result.ok);
  assert.equal(result.project.kind, "host");
  project(root, { auis: { template: "test" } });
  fs.mkdirSync(root + "/app/auis", { recursive: true });
  result = detectProject(root);
  assert.ok(result.ok);
  assert.equal(result.project.kind, "scaffold");
  assert.ok(result.project.hasAuis);
  write(root, "node_modules/next/package.json", { version: "15.5.0" });
  assert.match(JSON.stringify(detectProject(root)), /Next.js 16 or later/);
});
test("packageManager declaration takes precedence over stale lockfiles", (t) => {
  const root = temp(t);
  project(root);
  assert.equal(packageManagerOf(root), "npm");
  write(root, "yarn.lock", "");
  assert.equal(packageManagerOf(root), "yarn");
  write(root, "pnpm-lock.yaml", "");
  assert.equal(packageManagerOf(root), "pnpm");
  project(root, { packageManager: "bun@1.3.0" });
  assert.equal(packageManagerOf(root), "bun");
});
test("Node checks respect full semver ranges, not just a major number", async (t) => {
  const root = temp(t);
  project(root);
  const node = await readNode(root, environment(root));
  assert.equal(node.version, process.versions.node);
  assert.equal(nodeProblem(node, ">=20.9"), null);
  assert.match(
    nodeProblem({ path: "/tools/node", version: "20.8.0" }, ">=20.9")!,
    /20.8.0 at \/tools\/node/,
  );
  assert.equal(
    nodeProblem({ path: "/tools/node", version: "22.10.0" }, "^20.9 || >=22.6"),
    null,
  );
  assert.ok(nodeProblem({ path: null, version: null }, ">=20.9"));
  assert.ok(nodeProblem({ path: "/tools/node", version: null }, ">=20.9"));
  project(root, { engines: { node: "banana" } });
  assert.equal(detectProject(root).ok, false);
});
