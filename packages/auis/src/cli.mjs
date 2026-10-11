/**
 * Argument parsing and dispatch for `npx @auis/cli`.
 *
 * `create` stays the default, so the bare form reads as the install line it is:
 * `npx @auis/cli@latest my-product`. The other three work on an app that
 * already exists: `doctor` reads it and writes nothing, `init` installs the
 * Review Bridge into it, `uninstall` takes it back out.
 */

import fs from "node:fs";
import { color, banner, fail, write } from "./ui.mjs";
import { DEFAULT_REF, REPO_URL } from "./template.mjs";
import { PACKAGE_MANAGERS, create } from "./create.mjs";
import { doctor } from "./doctor.mjs";
import { ONLY, init, uninstall } from "./install.mjs";

// Re-exported for the create-auis alias, which imports the package root.
export { restoreCursorOnExit } from "./ui.mjs";

const MIN_NODE_MAJOR = 20;
// `init` used to be a third alias of create; since 0.3 it installs into an
// existing app instead.
const CREATE_ALIASES = new Set(["create", "new"]);
const COMMANDS = new Set(["doctor", "init", "uninstall"]);

export const version = JSON.parse(
  fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"),
).version;

export function parseArgs(argv) {
  const options = {
    command: "create",
    directory: undefined,
    json: false,
    ref: DEFAULT_REF,
    packageManager: undefined,
    install: true,
    git: true,
    force: false,
    yes: false,
    dryRun: false,
    only: "review",
    purge: false,
    help: false,
    version: false,
  };

  // `auis my-app`, `auis create my-app` and `auis new my-app` are the same call.
  const rest = [...argv];
  if (COMMANDS.has(rest[0])) {
    options.command = rest.shift();
  } else if (CREATE_ALIASES.has(rest[0])) {
    rest.shift();
  }

  while (rest.length > 0) {
    const arg = rest.shift();
    switch (arg) {
      case "-h":
      case "--help":
        options.help = true;
        break;
      case "-v":
      case "-V":
      case "--version":
        options.version = true;
        break;
      case "-y":
      case "--yes":
        options.yes = true;
        break;
      case "--force":
        options.force = true;
        break;
      case "--json":
        options.json = true;
        break;
      case "--dry-run":
        options.dryRun = true;
        break;
      case "--purge":
        options.purge = true;
        break;
      case "--only":
        options.only = rest.shift();
        if (!options.only) throw new Error(`--only needs a value (${ONLY.join(", ")})`);
        break;
      case "--no-install":
      case "--skip-install":
        options.install = false;
        break;
      case "--no-git":
      case "--skip-git":
        options.git = false;
        break;
      case "-r":
      case "--ref":
      case "--branch":
        options.ref = rest.shift();
        if (!options.ref) throw new Error(`${arg} needs a branch, tag or commit`);
        break;
      case "--pm":
      case "--use":
        options.packageManager = rest.shift();
        if (!PACKAGE_MANAGERS.includes(options.packageManager)) {
          throw new Error(`--pm must be one of: ${PACKAGE_MANAGERS.join(", ")}`);
        }
        break;
      default: {
        if (arg.startsWith("--ref=") || arg.startsWith("--branch=")) {
          options.ref = arg.slice(arg.indexOf("=") + 1);
          break;
        }
        if (arg.startsWith("--only=")) {
          options.only = arg.slice(7);
          break;
        }
        if (arg.startsWith("--pm=")) {
          options.packageManager = arg.slice(5);
          if (!PACKAGE_MANAGERS.includes(options.packageManager)) {
            throw new Error(`--pm must be one of: ${PACKAGE_MANAGERS.join(", ")}`);
          }
          break;
        }
        if (arg.startsWith("-")) throw new Error(`unknown option: ${arg}`);
        if (options.directory !== undefined) {
          throw new Error(`unexpected argument: ${arg}`);
        }
        options.directory = arg;
      }
    }
  }

  return options;
}

export function help() {
  const c = color;
  write();
  write(`  ${c.bold("auis")} — a code-native design builder`);
  write();
  write(`  ${c.bold("Usage")}`);
  write(`    npx @auis/cli@latest ${c.dim("[directory] [options]")}     ${c.dim("scaffold a new project")}`);
  write(`    npx @auis/cli@latest doctor ${c.dim("[directory]")}        ${c.dim("read an existing repo, write nothing")}`);
  write(`    npx @auis/cli@latest init ${c.dim("[directory]")}          ${c.dim("install Review into an existing Next.js app")}`);
  write(`    npx @auis/cli@latest uninstall ${c.dim("[directory]")}     ${c.dim("take it back out, exactly")}`);
  write();
  write(`  ${c.bold("Options")}`);
  write(`        --json           doctor only: the full report as JSON`);
  write(`        --only ${c.dim("<what>")}    init only: what to install ${c.dim(`(${ONLY.join(", ")}; the default)`)}`);
  write(`        --dry-run        init only: print what it would touch, write nothing`);
  write(`        --purge          uninstall only: delete the comments instead of moving them to the backups`);
  write(`    -r, --ref ${c.dim("<ref>")}      branch, tag or commit of the template ${c.dim(`(default: ${DEFAULT_REF})`)}`);
  write(`        --pm ${c.dim("<manager>")}   ${PACKAGE_MANAGERS.join(" | ")} ${c.dim("(default: detected)")}`);
  write(`        --no-install     skip dependency installation (create, init, uninstall)`);
  write(`        --no-git         skip git init and the first commit`);
  write(`        --force          create: scaffold into a directory that is not empty`);
  write(`                         uninstall: also remove files you changed since init`);
  write(`    -y, --yes            take the defaults, never prompt`);
  write(`    -h, --help           show this`);
  write(`    -v, --version        print the CLI version`);
  write();
  write(`  ${c.bold("Examples")}`);
  write(`    npx @auis/cli@latest my-product`);
  write(`    npx @auis/cli@latest . --no-install`);
  write(`    npx @auis/cli@latest doctor`);
  write(`    npx @auis/cli@latest init --dry-run`);
  write();
  write(`  ${c.dim(REPO_URL)}`);
  write();
}

export async function run(argv = []) {
  const major = Number(process.versions.node.split(".")[0]);
  if (major < MIN_NODE_MAJOR) {
    fail(`Auis needs Node.js ${MIN_NODE_MAJOR} or newer — you are on ${process.versions.node}.`);
    return 1;
  }

  let options;
  try {
    options = parseArgs(argv);
  } catch (error) {
    fail(`${error.message}\n    Run ${color.bold("npx @auis/cli --help")} for usage.`);
    return 1;
  }

  if (options.version) {
    write(version);
    return 0;
  }
  if (options.help) {
    help();
    return 0;
  }

  if (options.command === "doctor") {
    // The JSON form is somebody's stdin — keep the banner out of it.
    if (!options.json) banner(version);
    return doctor({ directory: options.directory ?? ".", json: options.json, cliVersion: version });
  }

  banner(version);
  if (options.command === "init") {
    return init({
      directory: options.directory ?? ".",
      dryRun: options.dryRun,
      install: options.install,
      packageManager: options.packageManager,
      only: options.only,
    });
  }
  if (options.command === "uninstall") {
    return uninstall({
      directory: options.directory ?? ".",
      install: options.install,
      purge: options.purge,
      force: options.force,
    });
  }
  return create({ ...options, cliVersion: version });
}
