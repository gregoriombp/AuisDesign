import { createFsDocStore } from "./fs";
import type { BridgeDocStore, DocStoreConfig } from "./types";

export * from "./types";

/**
 * Auis ships the disk driver only: every bridge (review, flow suggestions,
 * page edits) persists to the gitignored `<bridge>/data/*.json` files of the local
 * checkout, which is exactly what the skills read. To run the bridges on a
 * multi-instance host, add a driver that implements `BridgeDocStore` with real
 * optimistic concurrency (compare-and-swap on a revision) and pick it here.
 */
export function createDocStore(config: DocStoreConfig): BridgeDocStore {
  return createFsDocStore(config);
}
