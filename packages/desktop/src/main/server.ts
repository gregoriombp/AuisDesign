// One project's supervisor. Only process groups started here are ours to stop.
// No Electron imports: lifecycle tests use real child processes and HTTP servers.
import { spawn, execFile, type ChildProcess } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import type { ServerState } from "../shared/ipc.ts";
import { findOnPath, resolveShellEnv, type Env } from "./env.ts";
import { detectProject, readNode, nodeProblem } from "./detect.ts";
import {
  liveDevServer,
  pidAlive,
  readDevLock,
  type DevServerInfo,
} from "./nextLock.ts";

const MAX_LOG_LINES = 2000;
const stripAnsi = (text: string) =>
  text.replace(/\u001b\[[0-9;?]*[A-Za-z]/g, "");

export interface ServerOptions {
  resolveEnv?: typeof resolveShellEnv;
  readyTimeoutMs?: number;
  httpTimeoutMs?: number;
  stopGraceMs?: number;
  pollMs?: number;
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

/** A fresh lock alone is not ours: someone may have won the start race. */
function inGroup(pid: number, pgid: number): Promise<boolean> {
  return new Promise((resolve) => {
    execFile(
      "/bin/ps",
      ["-o", "pgid=", "-p", String(pid)],
      { timeout: 1000 },
      (error, stdout) => {
        resolve(!error && Number(stdout.trim()) === pgid);
      },
    );
  });
}

export interface ProjectServer {
  state(): ServerState;
  logs(): string[];
  owns(): boolean;
  start(): Promise<void>;
  install(): Promise<void>;
  stop(): Promise<void>;
  restart(): Promise<void>;
  onState(listener: (state: ServerState) => void): void;
  onLog(listener: (lines: string[]) => void): void;
}

export function createProjectServer(
  root: string,
  options: ServerOptions = {},
): ProjectServer {
  const readyTimeout = options.readyTimeoutMs ?? 90_000;
  const httpTimeout = options.httpTimeoutMs ?? 30_000;
  const stopGrace = options.stopGraceMs ?? 5_000;
  const pollMs = options.pollMs ?? 250;
  let current: ServerState = { status: "idle" };
  // Keep the group even after its leader exits: grandchildren can outlive npm.
  let group: number | null = null;
  let controller: AbortController | null = null;
  let operation: Promise<void> | null = null;
  let stopping: Promise<void> | null = null;
  let restartPending: Promise<void> | null = null;
  let intent = 0;
  let watcher: NodeJS.Timeout | null = null;
  let env: Env = {};
  let lines: string[] = [];
  const stateListeners: Array<(state: ServerState) => void> = [];
  const logListeners: Array<(lines: string[]) => void> = [];
  const setState = (next: ServerState) => {
    current = next;
    for (const listener of stateListeners) listener(next);
  };
  const log = (text: string) => {
    const fresh = stripAnsi(text)
      .split(/\r?\n/)
      .map((line) => line.trimEnd())
      .filter((line) => line.trim());
    lines = [...lines, ...fresh].slice(-MAX_LOG_LINES);
    if (fresh.length) for (const listener of logListeners) listener(fresh);
  };
  const stopWatching = () => {
    if (watcher) clearInterval(watcher);
    watcher = null;
  };
  const terminateGroup = async (pgid: number | null) => {
    if (!pgid) return;
    signalGroup(pgid, "SIGTERM");
    const deadline = Date.now() + stopGrace;
    while (groupAlive(pgid) && Date.now() < deadline) await delay(50);
    if (groupAlive(pgid)) signalGroup(pgid, "SIGKILL");
    // Reap before a subsequent start. Bound the wait (some systems retain zombies).
    const reapDeadline = Date.now() + 1000;
    while (groupAlive(pgid) && Date.now() < reapDeadline) await delay(25);
    if (group === pgid) group = null;
  };
  const waitForHttp = async (url: string, signal: AbortSignal) => {
    const deadline = Date.now() + httpTimeout;
    while (Date.now() < deadline) {
      signal.throwIfAborted();
      try {
        await fetch(url, {
          method: "HEAD",
          redirect: "manual",
          signal: AbortSignal.any([
            signal,
            AbortSignal.timeout(Math.max(1, deadline - Date.now())),
          ]),
        });
        return;
      } catch {
        signal.throwIfAborted();
        await delay(pollMs, undefined, { signal });
      }
    }
    throw new Error(
      `${url} did not answer within ${httpTimeout / 1000} seconds. Check the log, then try again.`,
    );
  };

  const spawnOwned = (command: string, args: string[], signal: AbortSignal) => {
    signal.throwIfAborted();
    const child = spawn(command, args, {
      cwd: root,
      env,
      detached: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    group = child.pid ?? null;
    child.stdout?.on("data", (chunk: Buffer) => log(chunk.toString("utf8")));
    child.stderr?.on("data", (chunk: Buffer) => log(chunk.toString("utf8")));
    return child;
  };

  const waitForExit = (child: ChildProcess): Promise<number | null> =>
    new Promise((resolve, reject) => {
      child.once("error", reject);
      child.once("exit", resolve);
    });

  const spawnServer = async (
    command: string,
    signal: AbortSignal,
  ): Promise<{ info: DevServerInfo; owned: boolean }> => {
    const startedAt = Date.now();
    const child = spawnOwned(command, ["run", "dev"], signal);
    const pgid = child.pid ?? null;
    let exited = false;
    let exitCode: number | null = null;
    let failure: Error | null = null;
    // Register synchronously so ENOENT cannot become an unhandled event.
    child.once("error", (error) => {
      failure = error;
      exited = true;
    });
    child.once("exit", (code) => {
      exited = true;
      exitCode = code;
      if (!signal.aborted && current.status === "running" && current.owned) {
        // Stop stray descendants too. The UI changes only after cleanup completes.
        void terminateGroup(pgid).then(() => {
          if (!signal.aborted) setState({ status: "stopped", code });
        });
      }
    });
    const deadline = Date.now() + readyTimeout;
    while (Date.now() < deadline) {
      signal.throwIfAborted();
      if (exited) {
        await terminateGroup(pgid);
        signal.throwIfAborted();
        const existing = liveDevServer(root, env);
        // Another starter may have won the lock. Its process is never ours.
        if (existing && existing.startedAt >= startedAt)
          return { info: existing, owned: false };
        throw (
          failure ??
          new Error(
            `The dev server exited with code ${exitCode} before it was ready. Check the log, then try again.`,
          )
        );
      }
      const info = readDevLock(root, env);
      if (
        info &&
        pgid &&
        info.startedAt >= startedAt &&
        pidAlive(info.pid) &&
        (await inGroup(info.pid, pgid))
      ) {
        return { info, owned: true };
      }
      await delay(pollMs, undefined, { signal });
    }
    throw new Error(
      `The dev server was not ready after ${readyTimeout / 1000} seconds. Check the log, then try again.`,
    );
  };

  const launch = async (install: boolean, signal: AbortSignal) => {
    const detected = detectProject(root);
    if (!detected.ok) {
      setState({
        status: "error",
        code: detected.code,
        message: detected.message,
      });
      return;
    }
    setState({ status: "starting", phase: "environment" });
    const resolved = await (options.resolveEnv ?? resolveShellEnv)({
      cwd: root,
    });
    signal.throwIfAborted();
    env = resolved.env;
    const node = await readNode(root, env);
    signal.throwIfAborted();
    const problem = nodeProblem(node, detected.project.nodeRange);
    if (problem) {
      setState({ status: "error", code: "environment", message: problem });
      return;
    }

    let info = liveDevServer(root, env);
    let owned = false;
    if (info) {
      log(
        `Attached to the dev server already running in this folder (pid ${info.pid}).`,
      );
    } else {
      const pm = detected.project.packageManager;
      const command = findOnPath(pm, env);
      if (!command) {
        setState({
          status: "error",
          code: "environment",
          message: `${pm} was not found in this folder's shell. Install or enable ${pm}, then try again.`,
        });
        return;
      }
      if (detected.project.missingDependencies.length > 0) {
        if (!install) {
          setState({
            status: "deps-missing",
            packageManager: pm,
            missing: detected.project.missingDependencies,
          });
          return;
        }
        setState({ status: "installing", packageManager: pm });
        log(`Running ${pm} install in this project.`);
        const installed = spawnOwned(command, ["install"], signal);
        const code = await waitForExit(installed);
        signal.throwIfAborted();
        await terminateGroup(installed.pid ?? null);
        signal.throwIfAborted();
        if (code !== 0)
          throw new Error(
            `${pm} install exited with code ${code}. Check the log, then try again.`,
          );
        const check = detectProject(root);
        if (!check.ok) throw new Error(check.message);
        if (check.project.missingDependencies.length)
          throw new Error(
            `${pm} install finished, but dependencies are still missing. Check the log and the project's package.json.`,
          );
      }
      // Recheck after install: a terminal could have started the project meanwhile.
      info = liveDevServer(root, env);
      if (!info) {
        setState({ status: "starting", phase: "server" });
        ({ info, owned } = await spawnServer(command, signal));
      }
    }
    signal.throwIfAborted();
    setState({ status: "starting", phase: "response" });
    await waitForHttp(info.appUrl, signal);
    signal.throwIfAborted();
    // A process can die while the first response is compiling.
    if (!pidAlive(info.pid))
      throw new Error(
        "The dev server stopped before its first page was ready. Check the log, then try again.",
      );
    setState({ status: "running", url: info.appUrl, port: info.port, owned });
    stopWatching();
    watcher = setInterval(
      () => {
        if (signal.aborted) return stopWatching();
        if (pidAlive(info.pid)) return;
        stopWatching();
        void terminateGroup(owned ? group : null).then(() => {
          if (!signal.aborted) setState({ status: "stopped", code: null });
        });
      },
      Math.max(pollMs, 250),
    );
  };

  const begin = (install = false): Promise<void> => {
    if (stopping) return stopping;
    if (operation) return operation;
    if (current.status === "running") return Promise.resolve();
    // An Install IPC call is only meaningful after this window's missing-deps state.
    if (install && current.status !== "deps-missing") return Promise.resolve();
    stopWatching();
    controller?.abort();
    controller = new AbortController();
    const signal = controller.signal;
    const task = launch(install, signal).catch(async (error: unknown) => {
      if (signal.aborted) return;
      await terminateGroup(group);
      if (!signal.aborted)
        setState({
          status: "error",
          code: "launch-failed",
          message: error instanceof Error ? error.message : String(error),
        });
    });
    operation = task;
    void task.finally(() => {
      if (operation === task) operation = null;
    });
    return task;
  };
  const stop = (): Promise<void> => {
    intent++;
    if (stopping) return stopping;
    controller?.abort();
    stopWatching();
    // An env lookup may still be finishing; cancellation prevents it from spawning.
    const task = terminateGroup(group).then(() => setState({ status: "idle" }));
    stopping = task;
    void task.finally(() => {
      if (stopping === task) stopping = null;
    });
    return task;
  };
  return {
    state: () => current,
    logs: () => [...lines],
    owns: () => group !== null,
    start: () => begin(),
    install: () => begin(true),
    stop,
    restart: () => {
      if (restartPending) return restartPending;
      const prior = operation;
      const stopped = stop();
      const expected = intent;
      const task = stopped.then(async () => {
        await prior;
        // Closing the window while Restart waits must cancel the queued start.
        if (intent === expected) await begin();
      });
      restartPending = task;
      void task.finally(() => {
        if (restartPending === task) restartPending = null;
      });
      return task;
    },
    onState: (listener) => void stateListeners.push(listener),
    onLog: (listener) => void logListeners.push(listener),
  };
}
