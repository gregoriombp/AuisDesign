export const OVERLAY_DATA_ATTR = "data-auis-review"

/**
 * Review Mode sits ABOVE every product surface a reviewer might want to
 * annotate — modals and drawers top out at `z-index: 1001` (AuModal/AuSheet
 * content) — while staying BELOW shared dropdowns and toasts (`1100`). Keeping
 * the whole band inside the (1001, 1100) gap means the `⋯` menus and toasts
 * that open *inside* the review surfaces still float above them without
 * touching those shared components. Internal order mirrors the old
 * 40/50/55/1001 ladder.
 */
export const REVIEW_Z = {
  canvas: 1050,
  highlight: 1052,
  toolbar: 1055,
  popover: 1060,
  sheet: 1065,
  // Inline @ / / / # autocomplete — floats above the composer surface (popover
  // or sheet) that hosts it, just under the review modal.
  mention: 1069,
  modal: 1070,
} as const

export const STORAGE_KEYS = {
  identity: "auis-review:identity",
  comments: "auis-review:comments",
  schemaVersion: "auis-review:schema-version",
} as const

export const SCHEMA_VERSION = 3

export const STALE_DOCUMENT_HEIGHT_THRESHOLD = 0.2

export const DEFAULT_STROKE_WIDTH = 3

export const REVIEW_PALETTE: { token: string; label: string }[] = [
  { token: "var(--au-blue-600)", label: "Blue" },
  { token: "var(--au-emerald-600)", label: "Green" },
  { token: "var(--au-red-600)", label: "Red" },
  { token: "var(--au-purple-600)", label: "Purple" },
  { token: "var(--au-amber-500)", label: "Amber" },
  { token: "var(--au-pink-600)", label: "Pink" },
  { token: "var(--au-teal-600)", label: "Teal" },
]
