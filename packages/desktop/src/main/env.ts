// The environment a project's processes run with.
//
// An app opened from Finder does not read the shell's startup files, so its
// PATH is `/usr/bin:/bin:/usr/sbin:/sbin`: no Homebrew, no nvm/fnm/mise, no
// `claude`. The dev server, and the agent CLIs it spawns for mentions, need the
// environment the user would get in a terminal opened in that folder. So we ask
// their shell for it, from the project folder (version managers switch Node per
// directory), and build every child's environment from the answer.
//
// This module does not import `electron`, so it runs under `node --test`.

import { execFile, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import type { ToolInfo, ToolName } from "../shared/ipc.ts";

export type Env = Record<string, string>;
export type EnvSource = "interactive" | "login" | "fallback";

const MARKER = "__AUIS_DESKTOP_ENV__";
const FALLBACK_PATH = ["/opt/homebrew/bin", "/usr/local/bin", "/usr/bin", "/bin", "/usr/sbin", "/sbin"];

/**
 * Variables that describe the process that launched *us*, not the user's
 * terminal. `npm_*` is the dangerous one: started through `npm --prefix`, we
 * inherit `npm_config_prefix`, and a project's `npm run dev` would then run the
 * wrong package's script.
 */
const LAUNCHER_ONLY = /^(npm_|ELECTRON_|INIT_CWD$|DISABLE_AUTO_UPDATE$)/;

/** `source` with the launcher-only variables dropped. */
export function scrubEnv(source: Record<string, string | undefined>): Env {
  const env: Env = {};
  for (const [key, value] of Object.entries(source)) {
    if (value === undefined || LAUNCHER_ONLY.test(key)) continue;
    env[key] = value;
  }
  return env;
}

/**
 * Reads what `env -0` printed between the two markers. The markers fence off
 * whatever the startup files print (banners, prompts, version-manager notices),
 * and the NUL separator keeps multi-line values in one piece.
 */
export function parseEnvOutput(stdout: string, marker: string = MARKER): Env | null {
  const start = stdout.indexOf(marker);
  const end = stdout.lastIndexOf(marker);
  if (start === -1 || end === start) return null;

  const env: Env = {};
  for (const entry of stdout.slice(start + marker.length, end).split("\0")) {
    const equals = entry.indexOf("=");
    if (equals > 0) env[entry.slice(0, equals)] = entry.slice(equals + 1);
  }
  return Object.keys(env).length > 0 ? env : null;
}

function askShell(
  shell: string,
  flags: string,
  cwd: string,
  base: Env,
  timeoutMs: number,
): Promise<Env | null> {
  return new Promise((resolve) => {
    // `$1` and `$2` instead of interpolation: the folder is the user's, and a
    // path with a quote in it must not become shell syntax.
    const script = `cd -- "$1" 2>/dev/null; printf '%s' "$2"; /usr/bin/env -0; printf '%s' "$2"`;
    let stdout = "";
    let settled = false;

    const child = spawn(shell, [flags, script, "auis-env", cwd, MARKER], {
      // No stdin: a startup file that prompts must fail, not wait forever.
      stdio: ["ignore", "pipe", "ignore"],
      // oh-my-zsh checks for updates in interactive shells and asks a question.
      env: { ...base, DISABLE_AUTO_UPDATE: "true" },
    });

    const finish = (env: Env | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      // Let go of the pipe and the shell. A startup file can leave something
      // running in the background that keeps the pipe open long after the
      // answer is in; waiting for the pipe to close would wait for that.
      child.stdout?.destroy();
      child.kill("SIGKILL");
      resolve(env);
    };
    const timer = setTimeout(() => finish(parseEnvOutput(stdout)), timeoutMs);

    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
      // Both markers are in: that is the whole answer, whatever the shell does next.
      const first = stdout.indexOf(MARKER);
      if (first !== -1 && stdout.indexOf(MARKER, first + MARKER.length) !== -1) {
        finish(parseEnvOutput(stdout));
      }
    });
    child.on("error", () => finish(null));
    child.on("close", () => finish(parseEnvOutput(stdout)));
  });
}

export interface ResolveShellEnvOptions {
  /** The project folder; the shell answers from inside it. */
  cwd: string;
  timeoutMs?: number;
  /** The environment we were launched with. Defaults to `process.env`. */
  base?: Record<string, string | undefined>;
}

/**
 * The user's terminal environment for `cwd`. Tries an interactive login shell
 * first (nvm and fnm usually load from `.zshrc`, which only interactive shells
 * read), then a plain login shell, then what we were launched with plus the
 * usual tool folders. Never throws: a broken startup file must not stop the app
 * from opening.
 */
export async function resolveShellEnv(
  options: ResolveShellEnvOptions,
): Promise<{ env: Env; source: EnvSource }> {
  const base = scrubEnv(options.base ?? process.env);
  const shell = base.SHELL || "/bin/zsh";
  const timeoutMs = options.timeoutMs ?? 8000;

  const interactive = await askShell(shell, "-ilc", options.cwd, base, timeoutMs);
  if (interactive) return { env: scrubEnv(interactive), source: "interactive" };

  const login = await askShell(shell, "-lc", options.cwd, base, timeoutMs);
  if (login) return { env: scrubEnv(login), source: "login" };

  const known = new Set((base.PATH ?? "").split(":").filter(Boolean));
  const missing = FALLBACK_PATH.filter((dir) => !known.has(dir));
  return {
    env: { ...base, PATH: [...known, ...missing].join(":") },
    source: "fallback",
  };
}

const TOOLS: ToolName[] = ["node", "npm", "git", "claude", "codex"];

/** The first executable called `name` on `env.PATH`, the way a shell would find it. */
export function findOnPath(name: string, env: Env): string | null {
  for (const dir of (env.PATH ?? "").split(":")) {
    if (!dir) continue;
    const candidate = path.join(dir, name);
    try {
      fs.accessSync(candidate, fs.constants.X_OK);
      if (fs.statSync(candidate).isFile()) return candidate;
    } catch {
      /* not here */
    }
  }
  return null;
}

/** `v24.12.0`, `git version 2.50.1 (Apple Git-155)`, `2.1.4 (Claude Code)` → the number. */
export function parseVersion(output: string): string | null {
  return output.match(/\d+\.\d+(?:\.\d+)?/)?.[0] ?? null;
}

function versionOf(file: string, env: Env): Promise<string | null> {
  return new Promise((resolve) => {
    execFile(file, ["--version"], { env, timeout: 5000 }, (error, stdout) => {
      resolve(error ? null : parseVersion(stdout));
    });
  });
}

/** Where a tool is in this environment and which version it reports, or null when it is not there. */
export async function locateTool(
  name: string,
  env: Env,
): Promise<{ path: string; version: string | null } | null> {
  const file = findOnPath(name, env);
  return file ? { path: file, version: await versionOf(file, env) } : null;
}

/**
 * What the project's processes will find in this environment. A tool that is
 * on the PATH but does not answer `--version` still counts as present, with
 * its version unknown, rather than as missing.
 */
export async function probeTools(env: Env): Promise<ToolInfo[]> {
  return Promise.all(
    TOOLS.map(async (name): Promise<ToolInfo> => {
      const found = await locateTool(name, env);
      return { name, version: found ? (found.version ?? "found") : null };
    }),
  );
}
