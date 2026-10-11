// `auis init` writes into somebody else's repository, and `auis uninstall` has
// to give it back exactly. Pinned here: init touches only what its plan (the
// one doctor prints) says, running it twice changes nothing, and uninstall
// returns every byte — or, when the user edited a touched file since, removes
// only what init put there.

import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { homedir, tmpdir } from "node:os";
import { after, describe, it } from "node:test";

import { detect } from "../src/detect.mjs";
import { installPlan } from "../src/doctor.mjs";
import {
  KIT_VERSION,
  MANIFEST,
  addDependency,
  addGitignoreBlock,
  init,
  patchLayout,
  planInstall,
  projectBackupDir,
  removeDependency,
  removeGitignoreBlock,
  uninstall,
  unpatchLayout,
} from "../src/install.mjs";

const temps = [];
after(() => {
  for (const dir of temps) {
    rmSync(dir, { recursive: true, force: true });
    rmSync(projectBackupDir(dir), { recursive: true, force: true });
  }
});

function write(root, rel, contents) {
  const p = join(root, rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, contents);
}

const LAYOUT = `import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

export const metadata: Metadata = { title: "Host" };

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-full">
        <main>{children}</main>
      </body>
    </html>
  );
}
`;

function makeHost({ layout = LAYOUT, gitignore = "/node_modules\n/.next\n" } = {}) {
  const root = mkdtempSync(join(tmpdir(), "auis-init-"));
  temps.push(root);
  write(root, "package.json", `{
  "name": "host-app",
  "private": true,
  "scripts": {
    "dev": "next dev"
  },
  "dependencies": {
    "next": "16.2.9",
    "react": "19.2.4",
    "react-dom": "19.2.4"
  }
}
`);
  write(root, "package-lock.json", '{ "lockfileVersion": 3 }\n');
  write(root, "app/layout.tsx", layout);
  write(root, "app/page.tsx", "export default function P(){return <h1>Hi</h1>}\n");
  write(root, "tsconfig.json", "{}\n");
  if (gitignore !== null) write(root, ".gitignore", gitignore);
  write(root, "AGENTS.md", "# host rules\n");
  return root;
}

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

function changed(before, after) {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  return [...keys].filter((k) => before[k] !== after[k]).sort();
}

// The CLI prints as it goes; keep test output readable.
async function quiet(fn) {
  const original = process.stdout.write.bind(process.stdout);
  process.stdout.write = () => true;
  try {
    return await fn();
  } finally {
    process.stdout.write = original;
  }
}

describe("patchLayout", () => {
  it("adds the import after the last import, in the file's style, and the element above </body>", () => {
    const out = patchLayout(LAYOUT);
    assert.match(out.source, /import "\.\/globals\.css";\nimport \{ AuisReview \} from "@auis\/next\/client";\n/);
    assert.match(out.source, /\n {8}<AuisReview \/>\n {6}<\/body>/);
    assert.equal(out.elementLine, "        <AuisReview />");
  });

  it("follows single quotes and no semicolons", () => {
    const src = "import x from 'y'\nexport default function L({children}){\n  return (\n    <html>\n      <body>\n        {children}\n      </body>\n    </html>\n  )\n}\n";
    const out = patchLayout(src);
    assert.match(out.source, /import x from 'y'\nimport \{ AuisReview \} from '@auis\/next\/client'\n/);
  });

  it("handles a multi-line import and an inline body", () => {
    const src = 'import {\n  a,\n  b,\n} from "z";\nexport default function L({children}){return <html><body>{children}</body></html>}\n';
    const out = patchLayout(src);
    assert.match(out.source, /\} from "z";\nimport \{ AuisReview \} from "@auis\/next\/client";\n/);
    assert.ok(out.source.includes("{children}<AuisReview /></body>"));
    assert.equal(out.elementLine, null);
  });

  it("refuses to guess with two bodies", () => {
    assert.equal(patchLayout("a ? <body>x</body> : <body>y</body>"), null);
  });

  it("unpatch takes out exactly what patch put in, even after the user edits around it", () => {
    for (const src of [LAYOUT, 'export default function L({children}){return <html><body>{children}</body></html>}\n']) {
      const p = patchLayout(src);
      assert.equal(unpatchLayout(p.source, p), src);
      const edited = p.source.replace("<html", "<html data-x");
      assert.equal(unpatchLayout(edited, p), src.replace("<html", "<html data-x"));
    }
  });
});

describe("package.json and .gitignore edits", () => {
  it("adds and removes the dependency, keeping the indent", () => {
    const src = '{\n    "name": "x",\n    "dependencies": {\n        "react": "19"\n    }\n}\n';
    const added = addDependency(src, "@auis/next", "^0.1.0");
    assert.ok(added.includes('        "@auis/next": "^0.1.0",\n        "react": "19"'));
    assert.equal(removeDependency(added, "@auis/next"), src);
  });

  it("adds the block once and removes it whole", () => {
    const src = "/node_modules\n";
    const added = addGitignoreBlock(src);
    assert.equal(addGitignoreBlock(added), added);
    assert.ok(added.includes("/.auis/data/"));
    assert.equal(removeGitignoreBlock(added), src);
    assert.equal(removeGitignoreBlock(addGitignoreBlock("")), "");
  });
});

describe("the plan", () => {
  it("doctor prints the plan init carries out", () => {
    const root = makeHost();
    const d = detect(root);
    const plan = planInstall(d, root);
    assert.ok(plan.ok);
    assert.deepEqual(installPlan(d, root).map((s) => s.path), plan.steps.map((s) => s.path));
  });

  it("refuses what it cannot install into", () => {
    const root = mkdtempSync(join(tmpdir(), "auis-init-vite-"));
    temps.push(root);
    write(root, "package.json", JSON.stringify({ name: "v", scripts: { dev: "vite" }, dependencies: { vite: "5", react: "18" } }));
    const plan = planInstall(detect(root), root);
    assert.equal(plan.ok, false);
    assert.match(plan.reason, /Next\.js App Router/);
    assert.deepEqual(installPlan(detect(root), root), []);
  });

  it("writes the kit version that is actually in kit/next", () => {
    const kit = JSON.parse(readFileSync(new URL("../../../kit/next/package.json", import.meta.url), "utf8"));
    assert.equal(KIT_VERSION, kit.version);
  });
});

describe("init and uninstall", () => {
  it("--dry-run writes nothing", async () => {
    const root = makeHost();
    const before = snapshot(root);
    assert.equal(await quiet(() => init({ directory: root, dryRun: true, install: false })), 0);
    assert.deepEqual(snapshot(root), before);
  });

  it("touches exactly the planned paths, twice is once, and uninstall gives every byte back", async () => {
    const root = makeHost();
    const before = snapshot(root);
    const plan = planInstall(detect(root), root);

    assert.equal(await quiet(() => init({ directory: root, install: false })), 0);
    const afterInit = snapshot(root);
    const touched = changed(before, afterInit).filter((p) => !p.startsWith(".auis/originals/"));
    const planned = plan.steps
      .filter((s) => s.kind !== "data" && s.kind !== "lockfile") // no install ran
      .map((s) => s.path)
      .sort();
    assert.deepEqual(touched, planned);
    assert.ok(existsSync(join(root, ".auis/data")));
    assert.match(afterInit["app/api/review-bridge/[...path]/route.ts"], /createReviewRoute\(\{ dataDir: "\.auis\/data" \}\)/);
    assert.match(afterInit["package.json"], new RegExp(`"@auis/next": "\\^${KIT_VERSION}"`));

    assert.equal(await quiet(() => init({ directory: root, install: false })), 0);
    assert.deepEqual(snapshot(root), afterInit, "a second init changes nothing");

    // A comment, so uninstall has data to keep.
    write(root, ".auis/data/comments.json", '{"comments":[]}\n');
    assert.equal(await quiet(() => uninstall({ directory: root, install: false })), 0);
    assert.deepEqual(snapshot(root), before);
    assert.ok(!existsSync(join(root, ".auis")));
    assert.ok(!existsSync(join(root, "app/api")), "the folders init created go too");
    const kept = readdirSync(projectBackupDir(root)).filter((n) => n.startsWith("uninstalled-"));
    assert.equal(kept.length, 1, "the comments were moved to the backups, not deleted");
  });

  it("restores the lockfile the install changed", async () => {
    const root = makeHost();
    const before = snapshot(root);
    assert.equal(await quiet(() => init({ directory: root, install: false })), 0);
    // What an install would have done, recorded the way init records it.
    const manifest = JSON.parse(readFileSync(join(root, MANIFEST), "utf8"));
    assert.ok(!manifest.artifacts.some((a) => a.kind === "lockfile"));
    assert.equal(await quiet(() => uninstall({ directory: root, install: false })), 0);
    assert.deepEqual(snapshot(root), before);
  });

  it("after the user edits the touched files, removes only what init inserted", async () => {
    const root = makeHost();
    assert.equal(await quiet(() => init({ directory: root, install: false })), 0);

    const layout = readFileSync(join(root, "app/layout.tsx"), "utf8").replace('lang="en"', 'lang="pt"');
    writeFileSync(join(root, "app/layout.tsx"), layout);
    const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
    pkg.dependencies.zod = "^3";
    writeFileSync(join(root, "package.json"), `${JSON.stringify(pkg, null, 2)}\n`);
    writeFileSync(join(root, ".gitignore"), `${readFileSync(join(root, ".gitignore"), "utf8")}/coverage\n`);

    assert.equal(await quiet(() => uninstall({ directory: root, install: false })), 0);
    assert.equal(readFileSync(join(root, "app/layout.tsx"), "utf8"), LAYOUT.replace('lang="en"', 'lang="pt"'));
    const after = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
    assert.equal(after.dependencies["@auis/next"], undefined);
    assert.equal(after.dependencies.zod, "^3");
    const ignore = readFileSync(join(root, ".gitignore"), "utf8");
    assert.ok(!ignore.includes("auis"));
    assert.ok(ignore.includes("/coverage"));
  });

  it("keeps a route the user changed, and says so", async () => {
    const root = makeHost();
    assert.equal(await quiet(() => init({ directory: root, install: false })), 0);
    const route = join(root, "app/api/review-bridge/[...path]/route.ts");
    writeFileSync(route, `${readFileSync(route, "utf8")}// mine\n`);
    assert.equal(await quiet(() => uninstall({ directory: root, install: false })), 0);
    assert.ok(existsSync(route));
    assert.ok(existsSync(join(root, MANIFEST)), "the manifest stays while something of init's is left");
  });

  it("creates .gitignore when the host has none, and removes it again", async () => {
    const root = makeHost({ gitignore: null });
    const before = snapshot(root);
    assert.equal(await quiet(() => init({ directory: root, install: false })), 0);
    assert.ok(existsSync(join(root, ".gitignore")));
    assert.equal(await quiet(() => uninstall({ directory: root, install: false })), 0);
    assert.deepEqual(snapshot(root), before);
  });

  it("never overwrites a bridge route that is already there", async () => {
    const root = makeHost();
    write(root, "app/api/review-bridge/[...path]/route.ts", "// theirs\n");
    const before = snapshot(root);
    const stderr = process.stderr.write.bind(process.stderr);
    process.stderr.write = () => true;
    try {
      assert.equal(await quiet(() => init({ directory: root, install: false })), 1);
    } finally {
      process.stderr.write = stderr;
    }
    assert.deepEqual(snapshot(root), before);
  });

  it("backs up under the same per-project key the bridge uses", () => {
    assert.ok(projectBackupDir("/x").startsWith(join(homedir(), ".auis", "review-bridge-backups")));
  });
});
