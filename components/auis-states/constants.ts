// Chrome of State Mode. Same z-index band as its siblings (above AuModal/AuSheet
// content at 1001, below dropdowns/toasts at 1100) — safe to reuse the same
// numbers because the modes are mutually exclusive.
export const STATES_Z = {
  toolbar: 1055,
  popover: 1060,
} as const

// Marks the mode's own chrome (parity with data-auis-review / data-auis-edit).
export const STATES_OVERLAY_DATA_ATTR = "data-auis-states"
