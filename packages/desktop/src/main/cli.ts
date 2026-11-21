// New project: `npx @auis/cli`, run for the person.
//
// The CLI is the one way an Auis project is made (the template, what it
// prunes, the first commit), so the app runs it instead of repeating what it
// does. What differs from a terminal is that the app passes every answer up
// front, because nothing here can see a question the CLI asks:
//
// - the folder, as an absolute path, picked in the app's own save panel;
// - `--yes` twice: npx's (fetch the CLI without asking), then the CLI's (take
//   every default);
// - `--pm npm`: the CLI guesses the package manager from
//   `npm_config_user_agent`, which the app strips from every environment it
//   hands out (env.ts);
// - `--no-install`: the project window installs, where the output has a log
//   to go to and a stop that ends it.
//
// The app never passes `--force`. A folder that is not empty is refused here,
// before the CLI runs, with a reason that makes sense in a window.
//
// This module does not import `electron`, so it runs under `node --test`.

import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import type { CreateState } from "../shared/ipc.ts";
import { whyNotRunnable } from "./detect.ts";
import { findOnPath, type Env } from "./env.ts";
import { endGroup, outputLines } from "./processes.ts";
import { displayPath } from "./projects.ts";

export const CLI_PACKAGE = "@auis/cli@latest";
export const DEFAULT_NAME = "auis-app";
/** Where a new project opens: the welcome screen walks through brand, tokens and voice. */
export const WELCOME_ROUTE = "/auis/welcome";

const MAX_LINES = 400;

/**
 * Entries that do not make a folder "not empty" to the CLI: a copy of
 * `IGNORABLE` in packages/auis/src/create.mjs. Refusing a folder the CLI
 * would take is as wrong as letting through one it would refuse.
 */
const IGNORABLE = new Set([
  ".DS_Store",
  ".git",
  ".gitattributes",
  ".gitignore",
  ".idea",
  ".vscode",
  "Thumbs.db",
  "LICENSE",
  "README.md",
]);

/** What follows `npx` to make a project at `target`. */
export function cliArgs(target: string): string[] {
  return ["--yes", CLI_PACKAGE, target, "--yes", "--pm", "npm", "--no-install"];
}

/** `auis-app` in `parent`, or the first `auis-app-N` that is not taken. */
export function suggestTarget(parent: string): string {
  for (let n = 1; ; n++) {
    const candidate = path.join(parent, n === 1 ? DEFAULT_NAME : `${DEFAULT_NAME}-${n}`);
    if (!fs.existsSync(candidate)) return candidate;
  }
}

/** Why the CLI cannot make a project at `target`, in words for the person who picked it, or null. */
export function whyNotTarget(target: string): string | null {
  let stat: fs.Stats;
  try {
    stat = fs.statSync(target);
  } catch {
    return fs.existsSync(path.dirname(target)) ? null : "The folder it would go in no longer exists.";
  }
  if (!stat.isDirectory()) return "A file already has that name. Choose another name.";
  const taken = fs.readdirSync(target).filter((entry) => !IGNORABLE.has(entry));
  return taken.length > 0
    ? "That folder already has files in it. Choose a new name, or an empty folder."
    : null;
}

const NETWORK = /ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ECONNRESET|ETIMEDOUT|ENETUNREACH|could not download|fetch failed/i;

/** What to tell the person when the CLI exited with `code`, read from what it printed. */
export function explainFailure(code: number | null, lines: string[]): string {
  if (lines.some((line) => NETWORK.test(line))) {
    return "Auis could not reach npm or GitHub. Check your connection, then try again.";
  }
  if (code === null) return "The Auis CLI was stopped before it finished.";
  return `The Auis CLI stopped with code ${code}. Its output is below.`;
}

export interface CreatorOptions {
  /** Called on every change of state, so the launcher can show it. */
  onChange(): void;
  /** The user's environment, asked from the folder the project goes in. */
  resolveEnv(cwd: string): Promise<Env>;
  /** What makes a project at `target`. Defaults to npx and `cliArgs`; the tests pass a stand-in. */
  command?: (target: string) => { file: string; args: string[] };
  /** How long a cancel waits after asking before it insists. */
  stopGraceMs?: number;
}

export interface Creator {
  state(): CreateState | null;
  /** True while the CLI is running. */
  busy(): boolean;
  /** Runs the CLI for `target`. Resolves with the folder once there is a project in it, or null. */
  create(target: string): Promise<string | null>;
  /** Runs a failed creation again, when its folder is still empty. */
  retry(): Promise<string | null>;
  /** Forgets a failed creation. */
  dismiss(): void;
  /** Ends a run under way, and what it started. Safe to call when there is none. */
  cancel(): Promise<void>;
}

export function createCreator(options: CreatorOptions): Creator {
  const graceMs = options.stopGraceMs ?? 5_000;
  let current: CreateState | null = null;
  let target: string | null = null;
  let child: ChildProcess | null = null;
  /** Bumped by every run and cancel, so a superseded run stops reporting. */
  let run = 0;

  const set = (next: CreateState | null) => {
    current = next;
    options.onChange();
  };

  const fail = (folder: string, message: string) =>
    set({
      status: "error",
      name: path.basename(folder),
      displayPath: displayPath(folder),
      lines: current?.lines ?? [],
      message,
      canRetry: whyNotTarget(folder) === null,
    });

  const append = (id: number, text: string) => {
    if (id !== run || current?.status !== "creating") return;
    const fresh = outputLines(text);
    if (fresh.length > 0) set({ ...current, lines: [...current.lines, ...fresh].slice(-MAX_LINES) });
  };

  /** Resolves when the CLI has exited and everything it printed is in. */
  const runCli = (file: string, args: string[], cwd: string, env: Env, id: number) =>
    new Promise<{ code: number | null; error: string | null }>((resolve) => {
      let settled = false;
      // Its own process group, so a cancel ends npm, the CLI and whatever they started.
      const spawned = spawn(file, args, { cwd, env, detached: true, stdio: ["ignore", "pipe", "pipe"] });
      child = spawned;
      const finish = (code: number | null, error: string | null) => {
        if (settled) return;
        settled = true;
        if (child === spawned) child = null;
        resolve({ code, error });
      };
      spawned.stdout?.on("data", (chunk: Buffer) => append(id, chunk.toString("utf8")));
      spawned.stderr?.on("data", (chunk: Buffer) => append(id, chunk.toString("utf8")));
      spawned.once("error", (error) => finish(null, error.message));
      // `close`, not `exit`: it comes after the last of the output.
      spawned.once("close", (code) => finish(code, null));
    });

  const create = async (folder: string): Promise<string | null> => {
    if (current?.status === "creating") return null;
    const id = ++run;
    target = folder;
    set({ status: "creating", name: path.basename(folder), displayPath: displayPath(folder), lines: [] });

    const refused = whyNotTarget(folder);
    if (refused) {
      fail(folder, refused);
      return null;
    }

    const cwd = path.dirname(folder);
    // Plain output: the CLI prints colour only to a terminal, but npm's update notice does not ask.
    const env: Env = { ...(await options.resolveEnv(cwd)), NO_COLOR: "1", npm_config_update_notifier: "false" };
    if (id !== run) return null;

    let command = options.command?.(folder);
    if (!command) {
      const npx = findOnPath("npx", env);
      if (!npx) {
        fail(folder, "npx was not found on your PATH. It comes with npm: install Node, then try again.");
        return null;
      }
      command = { file: npx, args: cliArgs(folder) };
    }

    const result = await runCli(command.file, command.args, cwd, env, id);
    if (id !== run) return null;
    if (result.error) {
      fail(folder, `Could not run the Auis CLI: ${result.error}`);
      return null;
    }
    if (result.code !== 0) {
      fail(folder, explainFailure(result.code, current?.lines ?? []));
      return null;
    }
    const unrunnable = whyNotRunnable(folder);
    if (unrunnable) {
      fail(folder, `The Auis CLI finished, but the folder cannot run. ${unrunnable}`);
      return null;
    }
    set(null);
    return folder;
  };

  return {
    state: () => current,
    busy: () => current?.status === "creating",
    create,
    retry: () =>
      current?.status === "error" && current.canRetry && target ? create(target) : Promise.resolve(null),
    dismiss() {
      if (current?.status === "error") set(null);
    },
    async cancel() {
      run++;
      const pid = child?.pid;
      child = null;
      await endGroup(pid, graceMs);
      if (current?.status === "creating") set(null);
    },
  };
}
