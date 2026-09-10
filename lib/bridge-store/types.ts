/**
 * One whole JSON document per collection. The fs driver keeps a file plus an
 * in-process lock; domain logic stays in each `_store.ts`.
 */

export interface DocStoreHooks {
  beforeRead?: () => Promise<void>;
  beforeWrite?: (next: unknown) => Promise<void>;
}

export interface DocStoreConfig {
  /** Also the lock granularity for the fs driver. */
  namespace: string;
  resolveFile: (key: string) => string;
  /** fs driver only (backup/restore). */
  hooks?: DocStoreHooks;
}

/** `null` aborts. `{ result }` does not write. `{ data, result }` writes. */
export type MutateOutcome<T, R> =
  | { data: T; result: R }
  | { data?: undefined; result: R }
  | null;

/** Same idea for a pair of documents (main + archive). */
export type PairOutcome<A, B, R> =
  | { a?: A; b?: B; result: R }
  | null;

export interface DocRef<T> {
  key: string;
  init: () => T;
}

export interface BridgeDocStore {
  /** `rev` 0 = the document does not exist yet. */
  get<T>(key: string, init: () => T): Promise<{ data: T; rev: number }>;

  /**
   * Atomic read-modify-write. `mutate` must be re-runnable — a driver with
   * optimistic concurrency retries it on every conflict. Keep side effects
   * (uploads) out of the mutate.
   */
  update<T, R>(
    key: string,
    init: () => T,
    mutate: (data: T) => MutateOutcome<T, R> | Promise<MutateOutcome<T, R>>,
  ): Promise<R | null>;

  /**
   * Read-modify-write over a pair (approve/reopen move an item between main
   * and archive). Writes only what the outcome carries (`a`, `b`).
   */
  updatePair<A, B, R>(
    a: DocRef<A>,
    b: DocRef<B>,
    mutate: (a: A, b: B) => PairOutcome<A, B, R> | Promise<PairOutcome<A, B, R>>,
  ): Promise<R | null>;

  /** Cheap signature for the client's `/version` polling. Shape `"a:b"`. */
  signature(keys: string[]): Promise<string>;
}

/** The driver gave up on a persistent write conflict. Routes map it to 503. */
export class BridgeConflictError extends Error {
  constructor(key: string) {
    super(`bridge-store: persistent conflict while writing "${key}" — try again.`);
    this.name = "BridgeConflictError";
  }
}

/** The store is unreachable — surfaced as a 503 with this message (shown in
 *  the Review Mode UI), never as a bare 500. */
export class BridgeUnavailableError extends Error {
  readonly cause?: unknown;
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "BridgeUnavailableError";
    this.cause = cause;
  }
}
