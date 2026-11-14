// Bundles the desktop app with esbuild, the same way kit/chrome builds the
// extension. Three bundles, because they run in three different places:
//
// - main:     Node, inside Electron's main process.
// - preload:  a sandboxed preload, which may only `require("electron")`.
// - renderer: the app's own chrome, a plain web page served from app://auis/.
//
// Main and preload are CommonJS on purpose: the package is `"type": "module"`
// so the tests can run the TypeScript sources directly under Node, and `.cjs`
// keeps Electron's entries independent of that choice.

import { build } from "esbuild";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, "dist");

fs.rmSync(out, { recursive: true, force: true });

const node = {
  absWorkingDir: root,
  outdir: "dist",
  outExtension: { ".js": ".cjs" },
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node24",
  external: ["electron"],
  sourcemap: true,
  logLevel: "info",
};

await build({ ...node, entryPoints: { "main/index": "src/main/index.ts" } });
await build({ ...node, entryPoints: { "preload/chrome": "src/preload/chrome.ts" } });

await build({
  absWorkingDir: root,
  entryPoints: { main: "src/renderer/main.tsx" },
  outdir: "dist/renderer",
  bundle: true,
  platform: "browser",
  format: "iife",
  target: "chrome140",
  jsx: "automatic",
  minify: true,
  sourcemap: true,
  define: { "process.env.NODE_ENV": '"production"' },
  // The fonts ship inside the app: the chrome's CSP allows nothing from the network.
  loader: { ".woff2": "file", ".woff": "file" },
  assetNames: "fonts/[name]-[hash]",
  logLevel: "info",
});

for (const page of ["launcher.html", "project.html"]) {
  fs.copyFileSync(path.join(root, "src/renderer", page), path.join(out, "renderer", page));
}
