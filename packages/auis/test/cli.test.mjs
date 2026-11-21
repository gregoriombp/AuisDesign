import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, afterEach, before, describe, it } from "node:test";

import { parseArgs, version } from "../src/cli.mjs";
import {
  PRUNE,
  conflictsIn,
  detectPackageManager,
  personalize,
  toPackageName,
} from "../src/create.mjs";
import { DEFAULT_REF, tarballUrls } from "../src/template.mjs";

describe("parseArgs", () => {
  it("defaults to creating with the template's default ref", () => {
    const options = parseArgs([]);
    assert.equal(options.directory, undefined);
    assert.equal(options.ref, DEFAULT_REF);
    assert.equal(options.install, true);
    assert.equal(options.git, true);
  });

  it("reads the directory with or without an explicit command", () => {
    assert.equal(parseArgs(["my-product"]).directory, "my-product");
    assert.equal(parseArgs(["create", "my-product"]).directory, "my-product");
    assert.equal(parseArgs(["new", "my-product"]).directory, "my-product");
  });

  it("reads init and uninstall as their own commands, not as create", () => {
    const i = parseArgs(["init", "--dry-run", "--only", "review"]);
    assert.equal(i.command, "init");
    assert.equal(i.dryRun, true);
    assert.equal(i.only, "review");
    assert.equal(parseArgs(["init", "../host"]).directory, "../host");
    const u = parseArgs(["uninstall", "--purge", "--force"]);
    assert.equal(u.command, "uninstall");
    assert.equal(u.purge, true);
    assert.equal(u.force, true);
    assert.equal(parseArgs(["init", "--only=review"]).only, "review");
  });

  it("supports both spellings of every valued flag", () => {
    assert.equal(parseArgs(["--ref", "v1.0.0"]).ref, "v1.0.0");
    assert.equal(parseArgs(["--ref=v1.0.0"]).ref, "v1.0.0");
    assert.equal(parseArgs(["-r", "next"]).ref, "next");
    assert.equal(parseArgs(["--pm", "pnpm"]).packageManager, "pnpm");
    assert.equal(parseArgs(["--pm=bun"]).packageManager, "bun");
  });

  it("turns the negative flags off", () => {
    const options = parseArgs(["app", "--no-install", "--no-git", "--force", "--yes"]);
    assert.equal(options.install, false);
    assert.equal(options.git, false);
    assert.equal(options.force, true);
    assert.equal(options.yes, true);
  });

  it("rejects unknown options, missing values and stray arguments", () => {
    assert.throws(() => parseArgs(["--nope"]), /unknown option/);
    assert.throws(() => parseArgs(["--ref"]), /needs a branch/);
    assert.throws(() => parseArgs(["--pm", "cargo"]), /--pm must be one of/);
    assert.throws(() => parseArgs(["a", "b"]), /unexpected argument/);
  });
});

describe("toPackageName", () => {
  it("keeps a valid name as it is", () => {
    assert.equal(toPackageName("my-product"), "my-product");
  });

  it("normalizes what npm would reject", () => {
    assert.equal(toPackageName("My Product!"), "my-product");
    assert.equal(toPackageName("__weird__"), "weird");
    assert.equal(toPackageName("Acme Design 2026"), "acme-design-2026");
  });

  it("takes the last path segment", () => {
    assert.equal(toPackageName("/tmp/work/Client Site"), "client-site");
  });

  it("falls back when nothing usable is left", () => {
    assert.equal(toPackageName("..."), "auis-app");
    assert.equal(toPackageName(""), "auis-app");
  });

  it("stays inside npm's length limit", () => {
    assert.equal(toPackageName("a".repeat(300)).length, 214);
  });
});

describe("detectPackageManager", () => {
  it("reads the npm user agent", () => {
    assert.equal(detectPackageManager("pnpm/9.1.0 npm/? node/v20.11.0"), "pnpm");
    assert.equal(detectPackageManager("yarn/4.1.0 npm/? node/v20.11.0"), "yarn");
    assert.equal(detectPackageManager("bun/1.1.0"), "bun");
  });

  it("falls back to npm for anything unknown", () => {
    assert.equal(detectPackageManager(""), "npm");
    assert.equal(detectPackageManager(undefined), "npm");
    assert.equal(detectPackageManager("deno/2.0.0"), "npm");
  });
});

describe("tarballUrls", () => {
  it("tries branch, tag and commit spellings in that order", () => {
    const [branch, tag, sha] = tarballUrls("v1.0.0");
    assert.match(branch, /\/tar\.gz\/refs\/heads\/v1\.0\.0$/);
    assert.match(tag, /\/tar\.gz\/refs\/tags\/v1\.0\.0$/);
    assert.match(sha, /\/tar\.gz\/v1\.0\.0$/);
    for (const url of [branch, tag, sha]) {
      assert.ok(url.startsWith("https://codeload.github.com/gregoriombp/AuisDesign/"));
    }
  });
});

describe("conflictsIn", () => {
  let dir;

  before(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), "auis-test-"));
  });

  after(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  it("treats a missing directory as free", async () => {
    assert.deepEqual(await conflictsIn(path.join(dir, "nothing-here")), []);
  });

  it("ignores editor and git leftovers", async () => {
    await fs.writeFile(path.join(dir, ".DS_Store"), "");
    await fs.writeFile(path.join(dir, "LICENSE"), "");
    assert.deepEqual(await conflictsIn(dir), []);
  });

  it("reports real content", async () => {
    await fs.writeFile(path.join(dir, "index.js"), "");
    assert.deepEqual(await conflictsIn(dir), ["index.js"]);
  });
});

describe("personalize", () => {
  let dir;
  const options = { name: "my-product", ref: "main", cliVersion: "0.0.0-test" };

  // The shape of the template's own files: a package.json and the lockfile
  // npm wrote for it, both still carrying the template's identity.
  const templatePackage = {
    name: "auis-design",
    version: "1.0.0",
    private: true,
    description: "Auis",
    author: "Auis",
    license: "MIT",
    dependencies: { next: "16.0.0" },
  };
  const templateLock = {
    name: "auis-design",
    version: "1.0.0",
    lockfileVersion: 3,
    requires: true,
    packages: {
      "": {
        name: "auis-design",
        version: "1.0.0",
        hasInstallScript: true,
        license: "MIT",
        dependencies: { next: "16.0.0" },
      },
      "node_modules/next": { version: "16.0.0", license: "MIT" },
    },
  };

  const seed = async (lock) => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), "auis-personalize-"));
    await fs.writeFile(
      path.join(dir, "package.json"),
      `${JSON.stringify(templatePackage, null, 2)}\n`,
    );
    if (lock !== undefined) await fs.writeFile(path.join(dir, "package-lock.json"), lock);
  };
  const readJson = async (file) => JSON.parse(await fs.readFile(path.join(dir, file), "utf8"));

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  it("gives the lockfile the project's name and version, so npm install leaves it clean", async () => {
    await seed(`${JSON.stringify(templateLock, null, 2)}\n`);
    await personalize(dir, options);

    const pkg = await readJson("package.json");
    const raw = await fs.readFile(path.join(dir, "package-lock.json"), "utf8");
    const lock = JSON.parse(raw);

    assert.equal(pkg.name, "my-product");
    assert.equal(lock.name, pkg.name);
    assert.equal(lock.version, pkg.version);
    assert.equal(lock.packages[""].name, pkg.name);
    assert.equal(lock.packages[""].version, pkg.version);

    assert.deepEqual(Object.keys(lock), Object.keys(templateLock));
    assert.deepEqual(Object.keys(lock.packages[""]), Object.keys(templateLock.packages[""]));
    assert.deepEqual(lock.packages["node_modules/next"], templateLock.packages["node_modules/next"]);
    assert.ok(raw.endsWith("}\n"), "keeps npm's trailing newline");
    assert.ok(!raw.endsWith("\n\n"));
  });

  it("does not create a lockfile the template did not ship", async () => {
    await seed(undefined);
    await personalize(dir, options);
    await assert.rejects(fs.access(path.join(dir, "package-lock.json")), { code: "ENOENT" });
  });

  it("leaves a lockfile it cannot parse exactly as it was", async () => {
    const broken = '{ "name": "auis-design", ';
    await seed(broken);
    await personalize(dir, options);
    assert.equal(await fs.readFile(path.join(dir, "package-lock.json"), "utf8"), broken);
  });
});

describe("package", () => {
  it("prunes the contributor-only files and its own source", () => {
    for (const entry of [
      "CONTRIBUTING.md",
      "CODE_OF_CONDUCT.md",
      "packages",
      ".git",
      ".github/readme",
      ".gitattributes",
    ]) {
      assert.ok(PRUNE.includes(entry), `${entry} should be pruned`);
    }
    assert.ok(!PRUNE.includes("LICENSE"), "the MIT notice travels with the code");
  });

  it("exposes its own version", () => {
    assert.match(version, /^\d+\.\d+\.\d+/);
  });
});
