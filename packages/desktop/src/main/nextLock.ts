// Where a project's dev server is, according to Next itself.
//
// Since Next 16, `next dev` holds `<distDir>/dev/lock` for as long as it runs
// and writes its own address into it. That file is how we answer the two
// questions the app depends on:
//
// - "Is a dev server for this folder already running?" It must be, because two
//   servers on one folder corrupt Auis's JSON stores (their locks are in-memory,
//   one process). If one is running we attach to it instead of starting another.
// - "Is the server we started ready, and at which URL?" Next prints "Ready"
//   before it takes the lock, so a doomed second instance also prints it. The
//   lock is the signal; stdout is not.
//
// The lock is removed on a clean exit and left behind after a SIGKILL, so a
// lock alone proves nothing: always pair it with `pidAlive`.
//
// This module does not import `electron`, so it runs under `node --test`.

import fs from "node:fs";
import path from "node:path";
import type { Env } from "./env.ts";
import { isLoopback } from "../shared/workspace.ts";

export interface DevServerInfo {
  pid: number;
  port: number;
  hostname: string;
  /** The origin to load. Same-origin with what Next serves, so HMR works. */
  appUrl: string;
  /** Epoch milliseconds. Tells our server's lock from a stale one. */
  startedAt: number;
}

/** `NEXT_DIST_DIR` is this template's knob for a per-account build folder. */
export function devLockFile(root: string, env: Env = {}): string {
  return path.join(root, env.NEXT_DIST_DIR || ".next", "dev", "lock");
}

export function parseDevLock(raw: string): DevServerInfo | null {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof data !== "object" || data === null) return null;
  const { pid, port, hostname, appUrl, startedAt } = data as Record<string, unknown>;
  if (
    typeof pid !== "number" || !Number.isSafeInteger(pid) || pid <= 0 ||
    typeof port !== "number" || !Number.isInteger(port) || port < 1 || port > 65535 ||
    typeof appUrl !== "string" ||
    typeof startedAt !== "number" || !Number.isSafeInteger(startedAt) || startedAt <= 0
  ) {
    return null;
  }
  try {
    const url = new URL(appUrl);
    if (!isLoopback(appUrl)) return null;
    if (Number(url.port || (url.protocol === "https:" ? 443 : 80)) !== port) return null;
  } catch {
    return null;
  }
  return {
    pid,
    port,
    hostname: typeof hostname === "string" ? hostname : new URL(appUrl).hostname,
    appUrl: new URL(appUrl).origin,
    startedAt,
  };
}

export function readDevLock(root: string, env: Env = {}): DevServerInfo | null {
  try {
    return parseDevLock(fs.readFileSync(devLockFile(root, env), "utf8"));
  } catch {
    return null;
  }
}

/** True when the process exists. `EPERM` means it exists and is not ours. */
export function pidAlive(pid: number): boolean {
  if (!Number.isSafeInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}

/** The lock of a server that is actually running, or null. */
export function liveDevServer(root: string, env: Env = {}): DevServerInfo | null {
  const info = readDevLock(root, env);
  return info && pidAlive(info.pid) ? info : null;
}
