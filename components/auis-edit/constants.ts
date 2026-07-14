// Marks every DOM node that belongs to the Edit Mode UI, so the click/hover
// capture (and the Radix focus-trap interceptor) can tell "our chrome" apart
// from the product page being edited. Mirrors review's OVERLAY_DATA_ATTR.
export const EDIT_OVERLAY_DATA_ATTR = "data-auis-edit"

/**
 * Edit Mode reuses the SAME (1001, 1100) z-band as Review Mode — the two are
 * mutually exclusive (only one captures clicks at a time), so sharing the band
 * is safe and keeps both below shared dropdowns/toasts (1100).
 */
export const EDIT_Z = {
  outline: 1050,
  hover: 1051,
  toolbar: 1055,
  inspector: 1060,
  inbox: 1065,
} as const

