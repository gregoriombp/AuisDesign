// Contracts the review chrome, the anchoring code and the stored data share.

/** Marks the review chrome's own elements. Anchoring skips anything inside one,
 *  so a pin never lands on the toolbar, a popover or the canvas. */
export const OVERLAY_DATA_ATTR = "data-auis-review"

/** localStorage keys of the client storage implementations. */
export const STORAGE_KEYS = {
  identity: "auis-review:identity",
  comments: "auis-review:comments",
  schemaVersion: "auis-review:schema-version",
} as const

/** Version of every stored comment. A literal on `ReviewComment`: bumping it
 *  invalidates every comment on disk. */
export const SCHEMA_VERSION = 3
