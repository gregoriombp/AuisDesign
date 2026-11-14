// Bundles the desktop app with esbuild, the same way kit/chrome builds the
// extension. Only the main process exists in W0; the preload and the renderer
// entries join this file in W1 (see ../PLAN.md).
//
// The main bundle is CommonJS on purpose: the package is `"type": "module"` so
// the tests can run the TypeScript sources directly under Node, and `.cjs`
// keeps Electron's entry independent of that choice.

import { build } from "esbuild";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

await build({
  absWorkingDir: root,
  entryPoints: { "main/index": "src/main/index.ts" },
  outdir: "dist",
  outExtension: { ".js": ".cjs" },
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node24",
  external: ["electron"],
  sourcemap: true,
  logLevel: "info",
});
