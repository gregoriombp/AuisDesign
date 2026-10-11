// @auis/server — the Review Bridge server with no framework in it: one
// `handle(Request): Promise<Response>` for every endpoint, the disk store, the
// backups, the session/role resolution and the mention trigger. Depends only
// on @auis/core and Node built-ins. See docs/review-bridge-packages-plan.md.
export { createReviewHandler } from "./review/handler";
export type { ReviewServerOptions } from "./review/config";
export { getBridgeSession } from "./review/session";
export type { BridgeRole, BridgeSession } from "./review/session";
export {
  BridgeConflictError,
  BridgeUnavailableError,
  createDocStore,
} from "./docstore";
export type { BridgeDocStore, DocStoreConfig } from "./docstore";
