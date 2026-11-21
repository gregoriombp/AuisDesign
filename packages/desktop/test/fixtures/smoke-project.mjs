// The project the Electron gate runs: an Auis-shaped folder (it has app/auis,
// so the app treats it as an Auis project) whose dev script is smoke-server.mjs
// and whose one dependency installs offline. The smoke test writes it for the
// scenarios that open a folder; its stand-in npx writes it for New project.
import fs from "node:fs";
import path from "node:path";

export function writeProject(project, { startDelay = 250, stopDelay = 0 } = {}) {
  fs.mkdirSync(path.join(project, "app/auis"), { recursive: true });
  fs.mkdirSync(path.join(project, "fixture-dependency"));
  fs.writeFileSync(
    path.join(project, "fixture-dependency/package.json"),
    JSON.stringify({ name: "fixture-dependency", version: "1.0.0" }),
  );
  fs.writeFileSync(
    path.join(project, "package.json"),
    JSON.stringify({
      private: true,
      scripts: { dev: `node smoke-server.mjs ${startDelay} ${stopDelay}` },
      dependencies: { "fixture-dependency": "file:./fixture-dependency" },
    }),
  );
  fs.writeFileSync(path.join(project, ".npmrc"), "audit=false\nfund=false\n");
  fs.copyFileSync(
    new URL("./smoke-server.mjs", import.meta.url),
    path.join(project, "smoke-server.mjs"),
  );
}
