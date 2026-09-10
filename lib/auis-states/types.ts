// State Mode: the URL is the source of truth. Registry: ./registry.ts

export type ScreenStateOption = {
  value: string
  label: string
  /** Hover text in the switcher. */
  description?: string
}

export type ScreenStateAxis = {
  param: string
  label: string
  options: ScreenStateOption[]
  /** No param in the URL. Selecting it deletes the param (a clean URL = the real default). */
  defaultValue: string
}

export type ScreenStateInteraction = {
  label: string
  /**
   * FlowStateDriver recipe (`?ge=`): `t:<text>` / `c:<css>` / `w:<ms>`
   * separated by `>>`. Outside the key of Pattern A screens — no remount.
   */
  ge: string
}

export type ScreenStatesEntry = {
  /** Pathname; `[x]` matches one segment. E.g. `/orders/[orderId]`. */
  pattern: string
  screenLabel: string
  axes: ScreenStateAxis[]
  interactions?: ScreenStateInteraction[]
  /**
   * Concrete URL for the matrix (`/auis/states`) when the pattern is dynamic
   * or needs a query to render. Without it the entry is skipped by the matrix.
   */
  previewPath?: string
}

/**
 * Axis options typed against the screen's union. A new member without a label
 * fails the compile. Key order = UI order, except keys such as `"1"`, `"2"`
 * (`Object.entries` hoists them) — declare `options` literally in that case.
 */
export function axisFromRecord<T extends string>(
  labels: Record<T, string | { label: string; description?: string }>,
): ScreenStateOption[] {
  return (
    Object.entries(labels) as [T, string | { label: string; description?: string }][]
  ).map(([value, entry]) =>
    typeof entry === "string" ? { value, label: entry } : { value, ...entry },
  )
}
