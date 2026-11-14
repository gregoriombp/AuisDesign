// One project's dev server, as the app sees it: attach to the one that is
// already running in the folder, or start the project's own `dev` script, and
// on stop end exactly what was started here.
//
// This is the W1 seed of the supervisor. It carries the behaviour W0 proved
// (lock-based attach and readiness, process-group stop) behind a state the
// toolbar can show. W2 hardens it — dependency install, Node version, crash
// detail — and gives it unit tests (see ../../PLAN.md).
//
// This module does not import `electron`, so it runs under `node --test`.

import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import type { ServerState } from "../shared/ipc.ts";
import { resolveShellEnv, type Env } from "./env.ts";
import { liveDevServer, pidAlive, readDevLock, type DevServerInfo } from "./nextLock.ts";

const READY_TIMEOUT_MS = 90_000;
const HTTP_TIMEOUT_MS = 30_000;
const STOP_GRACE_MS = 5_000;
const MAX_LOG_LINES = 2000;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const stripAnsi = (text: string) => text.replace(/\u001b\[[0-9;?]*[A-Za-z]/g, "");

type PackageManager = "npm" | "pnpm" | "yarn" | "bun";

/** The lockfile says which package manager the project is installed with. */
export function packageManagerOf(root: string): PackageManager {
  if (fs.existsSync(path.join(root, "pnpm-lock.yaml"))) return "pnpm";
  if (fs.existsSync(path.join(root, "yarn.lock"))) return "yarn";
  if (fs.existsSync(path.join(root, "bun.lock")) || fs.existsSync(path.join(root, "bun.lockb"))) {
    return "bun";
  }
  return "npm";
}

/** Why a folder is not a project the app can run, in words for the person who picked it, or null. */
export function manifestProblem(root: string): string | null {
  let manifest: { scripts?: Record<string, string> };
  try {
    manifest = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  } catch {
    return "This folder has no package.json, so there is no project to run.";
  }
  if (!manifest.scripts?.dev) return "This project has no dev script in its package.json.";
  return null;
}

/** Why a project cannot start right now, or null. */
export function projectProblem(root: string): string | null {
  const manifest = manifestProblem(root);
  if (manifest) return manifest;
  if (!fs.existsSync(path.join(root, "node_modules"))) {
    return `Dependencies are not installed. Run ${packageManagerOf(root)} install in this folder, then try again.`;
  }
  return null;
}

function groupAlive(pgid: number): boolean {
  try {
    process.kill(-pgid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}

function signalGroup(pgid: number, signal: NodeJS.Signals) {
  try {
    process.kill(-pgid, signal);
  } catch {
    /* already gone */
  }
}

export interface ProjectServer {
  state(): ServerState;
  logs(): string[];
  /** True while a server started here is still running. */
  owns(): boolean;
  start(): Promise<void>;
  stop(): Promise<void>;
  restart(): Promise<void>;
  onState(listener: (state: ServerState) => void): void;
  onLog(listener: (lines: string[]) => void): void;
}

export function createProjectServer(root: string): ProjectServer {
  let current: ServerState = { status: "idle" };
  /** The dev server, only when it was started here. An attached one is never ours to stop. */
  let child: ChildProcess | null = null;
  let env: Env = {};
  let lines: string[] = [];
  /** Bumped by every start and stop, so a superseded start stops reporting. */
  let run = 0;
  let watcher: NodeJS.Timeout | null = null;
  const stateListeners: Array<(state: ServerState) => void> = [];
  const logListeners: Array<(lines: string[]) => void> = [];

  const setState = (next: ServerState) => {
    current = next;
    for (const listener of stateListeners) listener(next);
  };

  const log = (text: string) => {
    const fresh = stripAnsi(text)
      .split("\n")
      .map((line) => line.trimEnd())
      .filter((line) => line.trim().length > 0);
    if (fresh.length === 0) return;
    lines = [...lines, ...fresh].slice(-MAX_LOG_LINES);
    for (const listener of logListeners) listener(fresh);
  };

  const stopWatching = () => {
    if (watcher) clearInterval(watcher);
    watcher = null;
  };

  /** An attached server has no exit event for us: watch its pid instead. */
  const watchAttached = (info: DevServerInfo, id: number) => {
    stopWatching();
    watcher = setInterval(() => {
      if (id !== run) return stopWatching();
      if (pidAlive(info.pid)) return;
      stopWatching();
      setState({ status: "stopped", code: null });
    }, 2000);
  };

  /**
   * Starts the project's own `dev` script and resolves once Next's lock says
   * the server is ours and up. No port is passed: forcing one disables Next's
   * own retry (3000 → 3010) and breaks `dev` scripts that are more than
   * `next dev`.
   */
  const spawnServer = (id: number): Promise<DevServerInfo> =>
    new Promise((resolve, reject) => {
      const startedAt = Date.now();
      let output = "";
      let settled = false;

      // `detached` puts the package manager, Next and everything they fork in
      // one process group, which is what lets stop end the whole tree.
      const spawned = spawn(packageManagerOf(root), ["run", "dev"], {
        cwd: root,
        env,
        detached: true,
        stdio: ["ignore", "pipe", "pipe"],
      });
      child = spawned;

      const settle = (finish: () => void) => {
        if (settled) return;
        settled = true;
        clearInterval(poll);
        clearTimeout(timer);
        finish();
      };
      const onData = (chunk: Buffer) => {
        const text = chunk.toString("utf8");
        output = (output + text).slice(-8000);
        log(text);
      };
      spawned.stdout?.on("data", onData);
      spawned.stderr?.on("data", onData);

      spawned.once("error", (error) => {
        if (child === spawned) child = null;
        settle(() => reject(new Error(`Could not run the dev script: ${error.message}`)));
      });
      spawned.once("exit", (code) => {
        if (child === spawned) child = null;
        if (settled) {
          // It was running and it stopped on its own.
          if (id === run && current.status === "running") setState({ status: "stopped", code });
          return;
        }
        settle(() => {
          // Next refuses a second instance in the same folder. If that is what
          // happened, someone started one between our check and our spawn.
          const existing = liveDevServer(root, env);
          if (existing && /already running/.test(stripAnsi(output))) resolve(existing);
          else reject(new Error(`The dev server exited with code ${code} before it was ready.`));
        });
      });

      const poll = setInterval(() => {
        const info = readDevLock(root, env);
        // `startedAt` rules out a lock left behind by a server that was killed.
        if (info && info.startedAt >= startedAt && pidAlive(info.pid)) settle(() => resolve(info));
      }, 250);
      const timer = setTimeout(() => {
        settle(() =>
          reject(new Error(`The dev server was not ready after ${READY_TIMEOUT_MS / 1000} seconds.`)),
        );
      }, READY_TIMEOUT_MS);
    });

  /** The lock appears a moment before the first request can be answered. */
  const waitForHttp = async (appUrl: string, id: number) => {
    const deadline = Date.now() + HTTP_TIMEOUT_MS;
    while (Date.now() < deadline && id === run) {
      try {
        await fetch(appUrl, { method: "HEAD", redirect: "manual" });
        return;
      } catch {
        await sleep(300);
      }
    }
    if (id === run) throw new Error(`${appUrl} did not answer.`);
  };

  const start = async () => {
    const id = ++run;
    stopWatching();
    try {
      const problem = projectProblem(root);
      if (problem) throw new Error(problem);

      setState({ status: "starting", phase: "environment" });
      const resolved = await resolveShellEnv({ cwd: root });
      env = resolved.env;
      if (id !== run) return;

      let info = liveDevServer(root, env);
      if (info) {
        log(`Attached to the dev server already running in this folder (pid ${info.pid}).`);
      } else {
        setState({ status: "starting", phase: "server" });
        info = await spawnServer(id);
      }
      if (id !== run) return;

      setState({ status: "starting", phase: "response" });
      await waitForHttp(info.appUrl, id);
      if (id !== run) return;

      const owned = child !== null;
      if (!owned) watchAttached(info, id);
      setState({ status: "running", url: info.appUrl, port: info.port, owned });
    } catch (error) {
      if (id !== run) return;
      setState({ status: "error", message: error instanceof Error ? error.message : String(error) });
    }
  };

  /** Ask first, so Next removes its lock, then insist. */
  const stop = async () => {
    run++;
    stopWatching();
    const pgid = child?.pid;
    if (pgid && groupAlive(pgid)) {
      signalGroup(pgid, "SIGTERM");
      const deadline = Date.now() + STOP_GRACE_MS;
      while (groupAlive(pgid) && Date.now() < deadline) await sleep(100);
      if (groupAlive(pgid)) {
        signalGroup(pgid, "SIGKILL");
        while (groupAlive(pgid) && Date.now() < deadline + 2000) await sleep(50);
      }
    }
    child = null;
    setState({ status: "idle" });
  };

  return {
    state: () => current,
    logs: () => lines,
    owns: () => child !== null,
    start,
    stop,
    restart: async () => {
      await stop();
      await start();
    },
    onState: (listener) => void stateListeners.push(listener),
    onLog: (listener) => void logListeners.push(listener),
  };
}
