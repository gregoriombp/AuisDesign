import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { TestContext } from "node:test";
import type { Env } from "../src/main/env.ts";

export function temp(t: TestContext) {
  const root = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), "auis-desktop-test-")),
  );
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}
export function write(root: string, file: string, value: unknown) {
  const target = path.join(root, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(
    target,
    typeof value === "string" ? value : JSON.stringify(value),
  );
}
export function project(root: string, manifest: Record<string, unknown> = {}) {
  write(root, "package.json", {
    scripts: { dev: "next dev" },
    dependencies: { next: "^16" },
    ...manifest,
  });
}
export function installed(root: string) {
  write(root, "node_modules/next/package.json", {
    name: "next",
    version: "16.4.0",
    main: "index.js",
  });
  write(root, "node_modules/next/index.js", "");
}
export function environment(root: string): Env {
  return {
    PATH: [
      path.join(root, "bin"),
      path.dirname(process.execPath),
      "/usr/bin",
      "/bin",
    ].join(":"),
    HOME: os.homedir(),
  };
}
export async function until(
  predicate: () => boolean | Promise<boolean>,
  timeoutMs = 5000,
) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    if (await predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error("Condition was not met before timeout");
}
