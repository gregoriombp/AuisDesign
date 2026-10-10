import path from "node:path";
import fs from "node:fs/promises";

import {
  BridgeUnavailableError,
  type BridgeDocStore,
  type DocRef,
  type DocStoreConfig,
  type MutateOutcome,
  type PairOutcome,
} from "./types";

/**
 * Disk driver — the historical behavior of the bridges, extracted from their
 * `_store.ts` files: pretty-printed JSON, atomic tmp+rename writes (a crash
 * mid-write never leaves a truncated file), one in-process lock per NAMESPACE
 * serializing every read-modify-write (the UI fires bursts of writes; pair
 * operations touch main and archive together), and an mtime signature for the
 * client's polling.
 *
 * Single process (the local dev server) — the lock is enough. A multi-instance
 * deployment needs a driver with real optimistic concurrency; see
 * `docs/ARCHITECTURE.md` → Bridges.
 */

// One lock per namespace, shared by every driver instance (several
// createDocStore calls for the same namespace chain on the same queue). The
// registry lives on globalThis: in dev, HMR re-evaluates this module, and a
// module-scoped Map would start empty and let two writes to the same file race.
const lockHost = globalThis as unknown as { __auisBridgeFsLocks?: Map<string, Promise<unknown>> };
const locks = (lockHost.__auisBridgeFsLocks ??= new Map<string, Promise<unknown>>());
function withLock<T>(ns: string, fn: () => Promise<T>): Promise<T> {
  const prev = locks.get(ns) ?? Promise.resolve();
  const run = prev.then(fn, fn); // runs after the previous one settles (ok or error)
  locks.set(ns, run.catch(() => {}));
  return run;
}

const quarantined = new Set<string>();

async function readDoc<T>(file: string, init: () => T): Promise<T> {
  let raw: string;
  try {
    raw = await fs.readFile(file, "utf8");
  } catch (err) {
    // Missing → initial state (the dir is created on the first write).
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return init();
    throw err;
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    // A corrupt file never becomes an empty document: the next write would land
    // on top of it and erase the data. Keep a copy of the bytes next to it and
    // fail loudly (503 on the routes) until someone fixes or restores it.
    if (!quarantined.has(file)) {
      quarantined.add(file);
      const copy = `${file}.corrupt-${new Date().toISOString().replace(/[:.]/g, "-")}`;
      await fs.writeFile(copy, raw, "utf8").catch(() => {});
    }
    throw new BridgeUnavailableError(
      `${path.basename(file)} is corrupt. A copy was kept next to it (.corrupt-*). ` +
        "Fix the JSON or restore it from a backup (the Review Bridge keeps snapshots in ~/.auis/review-bridge-backups).",
    );
  }
}

async function writeDocAtomic(file: string, data: unknown): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true });
  // Unique name: two processes (the dev server and a maintenance script)
  // writing the same file do not fight over the same temp file.
  const tmp = `${file}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), "utf8");
  await fs.rename(tmp, file);
}

async function mtimeOf(file: string): Promise<number> {
  try {
    const s = await fs.stat(file);
    return Math.floor(s.mtimeMs);
  } catch {
    return 0;
  }
}

export function createFsDocStore(config: DocStoreConfig): BridgeDocStore {
  const { namespace, resolveFile, hooks } = config;

  async function load<T>(key: string, init: () => T): Promise<T> {
    await hooks?.beforeRead?.();
    return readDoc(resolveFile(key), init);
  }

  async function persist(key: string, data: unknown): Promise<void> {
    await hooks?.beforeWrite?.(data);
    await writeDocAtomic(resolveFile(key), data);
  }

  return {
    async get<T>(key: string, init: () => T) {
      const data = await load(key, init);
      return { data, rev: await mtimeOf(resolveFile(key)) };
    },

    update<T, R>(
      key: string,
      init: () => T,
      mutate: (data: T) => MutateOutcome<T, R> | Promise<MutateOutcome<T, R>>,
    ): Promise<R | null> {
      return withLock(namespace, async () => {
        const data = await load(key, init);
        const outcome = await mutate(data);
        if (outcome === null) return null;
        if (outcome.data !== undefined) await persist(key, outcome.data);
        return outcome.result;
      });
    },

    updatePair<A, B, R>(
      a: DocRef<A>,
      b: DocRef<B>,
      mutate: (da: A, db: B) => PairOutcome<A, B, R> | Promise<PairOutcome<A, B, R>>,
    ): Promise<R | null> {
      return withLock(namespace, async () => {
        const [da, db] = [await load(a.key, a.init), await load(b.key, b.init)];
        const outcome = await mutate(da, db);
        if (outcome === null) return null;
        if (outcome.a !== undefined) await persist(a.key, outcome.a);
        if (outcome.b !== undefined) await persist(b.key, outcome.b);
        return outcome.result;
      });
    },

    async signature(keys: string[]): Promise<string> {
      const stamps = await Promise.all(keys.map((k) => mtimeOf(resolveFile(k))));
      return stamps.join(":");
    },
  };
}
