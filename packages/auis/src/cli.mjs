/**
 * Argument parsing and dispatch for `npx auis`.
 *
 * One command, `create` (the default), so the bare form reads as the install
 * line it is: `npx auis@latest my-product`.
 */

import fs from "node:fs";
import { color, banner, fail, write } from "./ui.mjs";
import { DEFAULT_REF, REPO_URL } from "./template.mjs";
import { PACKAGE_MANAGERS, create } from "./create.mjs";

// Re-exported for the create-auis alias, which imports the package root.
export { restoreCursorOnExit } from "./ui.mjs";

const MIN_NODE_MAJOR = 20;
const COMMANDS = new Set(["create", "init", "new"]);

export const version = JSON.parse(
  fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"),
).version;

export function parseArgs(argv) {
  const options = {
    directory: undefined,
    ref: DEFAULT_REF,
    packageManager: undefined,
    install: true,
    git: true,
    force: false,
    yes: false,
    help: false,
    version: false,
  };

  // `auis my-app`, `auis create my-app` and `auis new my-app` are the same call.
  const rest = [...argv];
  if (COMMANDS.has(rest[0])) rest.shift();

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
  write(`  ${c.bold("auis")} — scaffold a code-native design builder`);
  write();
  write(`  ${c.bold("Usage")}`);
  write(`    npx auis@latest ${c.dim("[directory] [options]")}`);
  write();
  write(`  ${c.bold("Options")}`);
  write(`    -r, --ref ${c.dim("<ref>")}      branch, tag or commit of the template ${c.dim(`(default: ${DEFAULT_REF})`)}`);
  write(`        --pm ${c.dim("<manager>")}   ${PACKAGE_MANAGERS.join(" | ")} ${c.dim("(default: detected)")}`);
  write(`        --no-install     skip dependency installation`);
  write(`        --no-git         skip git init and the first commit`);
  write(`        --force          scaffold into a directory that is not empty`);
  write(`    -y, --yes            take the defaults, never prompt`);
  write(`    -h, --help           show this`);
  write(`    -v, --version        print the CLI version`);
  write();
  write(`  ${c.bold("Examples")}`);
  write(`    npx auis@latest my-product`);
  write(`    npx auis@latest . --no-install`);
  write(`    npm create auis@latest my-product`);
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
    fail(`${error.message}\n    Run ${color.bold("npx auis --help")} for usage.`);
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

  banner(version);
  return create({ ...options, cliVersion: version });
}
