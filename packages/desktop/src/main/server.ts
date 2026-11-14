// One project's dev server, as the app sees it: attach to the one that is
// already running in the folder, or start the project's own `dev` script, and
// on stop end exactly what was started here.
//
// The order of a start is the order of the questions that can stop it:
//
//   1. Is the folder a project that can run?            (no → say why)
//   2. What is the user's shell environment for it?
//   3. Is a dev server already running there?           (yes → attach, done)
//   4. Are the package manager and Node on the PATH,
//      and is Node the version the project asks for?    (no → say which, where)
//   5. Are the dependencies installed?                  (no → offer to install)
//   6. Start `<pm> run dev` and wait for Next's lock.
//
// Attach comes before the tool checks on purpose: a server that is already up
// does not need this environment to be able to start one.
//
// This module does not import `electron`, so it runs under `node --test`.

import { spawn, type ChildProcess } from "node:child_process";
import type { ServerState, StartAction } from "../shared/ipc.ts";
import { detectProject, nodeSatisfies, whyNotRunnable, type PackageManager } from "./detect.ts";
import { locateTool, resolveShellEnv, type Env } from "./env.ts";
import { liveDevServer, pidAlive, readDevLock, type DevServerInfo } from "./nextLock.ts";

const MAX_LOG_LINES = 2000;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const stripAnsi = (text: string) => text.replace(/\u001b\[[0-9;?]*[A-Za-z]/g, "");

/** A reason the project cannot start, with what the person can do about it. */
class Problem extends Error {
  action: StartAction;
  constructor(message: string, action: StartAction = "retry") {
    super(message);
    this.action = action;
  }
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

export interface ProjectServerOptions {
  /** The environment for the project's processes. Defaults to the user's shell, asked from the folder. */
  resolveEnv?: (root: string) => Promise<Env>;
  /** How long the dev script has to take Next's lock. */
  readyTimeoutMs?: number;
  /** How long the server has to answer its first request once the lock is there. */
  httpTimeoutMs?: number;
  /** How long a stop waits after asking before it insists. */
  stopGraceMs?: number;
  /** How often an attached server's pid is checked. */
  watchIntervalMs?: number;
}

export interface ProjectServer {
  state(): ServerState;
  logs(): string[];
  /** True while a dev server started here is still running. */
  owns(): boolean;
  /** Does nothing while a start or an install is already under way, or the server is up. */
  start(): Promise<void>;
  /** Installs the dependencies with the project's package manager, then starts. */
  install(): Promise<void>;
  stop(): Promise<void>;
  restart(): Promise<void>;
  onState(listener: (state: ServerState) => void): void;
  onLog(listener: (lines: string[]) => void): void;
}

export function createProjectServer(root: string, options: ProjectServerOptions = {}): ProjectServer {
  const resolveEnv = options.resolveEnv ?? (async (cwd: string) => (await resolveShellEnv({ cwd })).env);
  const readyTimeoutMs = options.readyTimeoutMs ?? 90_000;
  const httpTimeoutMs = options.httpTimeoutMs ?? 30_000;
  const stopGraceMs = options.stopGraceMs ?? 5_000;
  const watchIntervalMs = options.watchIntervalMs ?? 2_000;

  let current: ServerState = { status: "idle" };
  /** The dev server, only when it was started here. An attached one is never ours to stop. */
  let child: ChildProcess | null = null;
  let installer: ChildProcess | null = null;
  let env: Env = {};
  let lines: string[] = [];
  /** Bumped by every start and stop, so a superseded run stops reporting. */
  let run = 0;
  let watcher: NodeJS.Timeout | null = null;
  // Close/Quit must also await a stop that Restart already began.
  let ending: Promise<void> = Promise.resolve();
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

  /** Ask first, so Next removes its lock, then insist. */
  const endGroup = async (pgid: number | undefined) => {
    if (!pgid || !groupAlive(pgid)) return;
    signalGroup(pgid, "SIGTERM");
    const deadline = Date.now() + stopGraceMs;
    while (groupAlive(pgid) && Date.now() < deadline) await sleep(50);
    if (!groupAlive(pgid)) return;
    signalGroup(pgid, "SIGKILL");
    while (groupAlive(pgid) && Date.now() < deadline + 2000) await sleep(25);
  };

  /** An attached server has no exit event for us: watch its pid instead. */
  const watchAttached = (info: DevServerInfo, id: number) => {
    stopWatching();
    watcher = setInterval(() => {
      if (id !== run) return stopWatching();
      if (pidAlive(info.pid)) return;
      stopWatching();
      setState({ status: "stopped", code: null });
    }, watchIntervalMs);
  };

  /** Step 4: the tools the dev script needs, in the environment it will get. */
  const checkTools = async (pm: PackageManager, nodeRange: string | null) => {
    if (!(await locateTool(pm, env))) {
      throw new Problem(`${pm} was not found on your PATH. Install it, then try again.`);
    }
    // A Bun project may have no Node at all, and does not need one.
    if (pm === "bun") return;
    const node = await locateTool("node", env);
    if (!node) throw new Problem("Node was not found on your PATH. Install Node, then try again.");
    if (nodeRange && node.version && !nodeSatisfies(node.version, nodeRange)) {
      throw new Problem(
        `This project asks for Node ${nodeRange}, and your shell has Node ${node.version} (${node.path}). Switch versions, then try again.`,
      );
    }
  };

  /** Step 5, when asked to: `<pm> install`, its output in the log. */
  const runInstall = (pm: PackageManager): Promise<void> =>
    new Promise((resolve, reject) => {
      log(`$ ${pm} install`);
      // Its own process group, so a stop ends the whole install.
      const spawned = spawn(pm, ["install"], {
        cwd: root,
        env,
        detached: true,
        stdio: ["ignore", "pipe", "pipe"],
      });
      installer = spawned;
      const onData = (chunk: Buffer) => log(chunk.toString("utf8"));
      spawned.stdout?.on("data", onData);
      spawned.stderr?.on("data", onData);
      spawned.once("error", (error) => {
        if (installer === spawned) installer = null;
        reject(new Problem(`Could not run ${pm} install: ${error.message}`, "install"));
      });
      spawned.once("exit", (code) => {
        if (installer === spawned) installer = null;
        if (code === 0) resolve();
        else reject(new Problem(`${pm} install failed with code ${code}. The log has the details.`, "install"));
      });
    });

  /**
   * Step 6: starts the project's own `dev` script and resolves once Next's
   * lock says the server is ours and up. No port is passed: forcing one
   * disables Next's own retry (3000 → 3010) and breaks `dev` scripts that are
   * more than `next dev`.
   */
  const spawnServer = (pm: PackageManager, id: number): Promise<DevServerInfo> =>
    new Promise((resolve, reject) => {
      const startedAt = Date.now();
      let output = "";
      let settled = false;

      // `detached` puts the package manager, Next and everything they fork in
      // one process group, which is what lets stop end the whole tree.
      const spawned = spawn(pm, ["run", "dev"], {
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
        settle(() => reject(new Problem(`Could not run the dev script: ${error.message}`)));
      });
      spawned.once("exit", (code) => {
        if (child === spawned) child = null;
        if (settled) {
          // It had taken the lock, and then it went away on its own.
          if (id !== run) return;
          if (current.status === "running") setState({ status: "stopped", code });
          else if (current.status === "starting") {
            run++;
            setState({
              status: "error",
              message: `The dev server exited with code ${code} before it answered.`,
              action: "retry",
            });
          }
          return;
        }
        settle(() => {
          // Next refuses a second instance in the same folder. If that is what
          // happened, someone started one between our check and our spawn.
          const existing = liveDevServer(root, env);
          if (existing && /already running/.test(stripAnsi(output))) resolve(existing);
          else reject(new Problem(`The dev server exited with code ${code} before it was ready.`));
        });
      });

      const poll = setInterval(() => {
        const info = readDevLock(root, env);
        // `startedAt` rules out a lock left behind by a server that was killed.
        if (info && info.startedAt >= startedAt && pidAlive(info.pid)) settle(() => resolve(info));
      }, 250);
      const timer = setTimeout(() => {
        settle(() =>
          reject(new Problem(`The dev server was not ready after ${Math.round(readyTimeoutMs / 1000)} seconds.`)),
        );
      }, readyTimeoutMs);
    });

  /** The lock appears a moment before the first request can be answered. */
  const waitForHttp = async (appUrl: string, id: number) => {
    const deadline = Date.now() + httpTimeoutMs;
    while (Date.now() < deadline && id === run) {
      try {
        await fetch(appUrl, { method: "HEAD", redirect: "manual" });
        return;
      } catch {
        await sleep(200);
      }
    }
    if (id === run) throw new Problem(`${appUrl} did not answer.`);
  };

  const begin = async (mode: "start" | "install") => {
    const id = ++run;
    stopWatching();
    try {
      const unrunnable = whyNotRunnable(root);
      if (unrunnable) throw new Problem(unrunnable);

      setState({ status: "starting", phase: "environment" });
      env = await resolveEnv(root);
      if (id !== run) return;

      let info = liveDevServer(root, env);
      if (info) {
        log(`Attached to the dev server already running in this folder (pid ${info.pid}).`);
      } else {
        const project = detectProject(root);
        if (!project) throw new Problem("This folder has no package.json, so there is no project to run.");
        const pm = project.packageManager;
        await checkTools(pm, project.nodeRange);
        if (id !== run) return;

        if (!project.depsInstalled) {
          if (mode !== "install") throw new Problem("Dependencies are not installed.", "install");
          setState({ status: "installing", command: `${pm} install` });
          await runInstall(pm);
          if (id !== run) return;
        }

        setState({ status: "starting", phase: "server" });
        info = await spawnServer(pm, id);
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
      // From here nothing else in this run reports: the failure is the result.
      const failure = ++run;
      // An error means nothing of ours is running. A dev script that never
      // took the lock, or took it and never answered, is ended here, so that
      // trying again starts from a clean folder instead of meeting it.
      const leftover = child?.pid;
      child = null;
      ending = Promise.all([ending, endGroup(leftover)]).then(() => {});
      await ending;
      if (failure !== run) return;
      setState({
        status: "error",
        message: error instanceof Error ? error.message : String(error),
        action: error instanceof Problem ? error.action : "retry",
      });
    }
  };

  const busy = () =>
    current.status === "starting" || current.status === "installing" || current.status === "running";

  const stop = async () => {
    const id = ++run;
    stopWatching();
    const groups = [child?.pid, installer?.pid];
    child = null;
    installer = null;
    ending = Promise.all([ending, ...groups.map(endGroup)]).then(() => {});
    await ending;
    if (id === run) setState({ status: "idle" });
  };

  return {
    state: () => current,
    logs: () => lines,
    owns: () => child !== null,
    start: () => (busy() ? Promise.resolve() : begin("start")),
    install: () => (busy() ? Promise.resolve() : begin("install")),
    stop,
    restart: async () => {
      const stopped = stop();
      const id = run;
      await stopped;
      // Close/Quit during Restart supersedes the replacement start too.
      if (id === run) await begin("start");
    },
    onState: (listener) => void stateListeners.push(listener),
    onLog: (listener) => void logListeners.push(listener),
  };
}
