// State Mode registry. Every screen that has URL-addressable scenarios is
// declared here; the floating pill (⌘⇧S) writes the params and `/auis/states`
// renders every scenario side by side. Type the options against the screen's
// own union with `axisFromRecord` — a new member without a label fails the
// compile, which is how the matrix stays honest.
//
// Auis ships with one demo screen (`/auis/states/example`). Register your
// product's screens below, deepest patterns first (the matcher returns the
// first entry that matches). The `auis-update-states` skill walks through it.

import type {
  ExampleScreenPlan,
  ExampleScreenState,
} from "@/app/auis/states/example/state"
import { axisFromRecord, type ScreenStateAxis, type ScreenStatesEntry } from "./types"

/** A shared axis can be reused by reference across entries. */
const EXAMPLE_PLAN_AXIS: ScreenStateAxis = {
  param: "plan",
  label: "Plan",
  defaultValue: "free",
  options: axisFromRecord<ExampleScreenPlan>({
    free: "Free",
    pro: { label: "Pro", description: "Unlocks the export action" },
  }),
}

export const SCREEN_STATES: ScreenStatesEntry[] = [
  {
    pattern: "/auis/states/example",
    screenLabel: "Example screen",
    axes: [
      {
        param: "state",
        label: "State",
        defaultValue: "default",
        options: axisFromRecord<ExampleScreenState>({
          default: "Default",
          empty: { label: "Empty", description: "No items yet" },
          loading: "Loading",
          error: { label: "Error", description: "The list failed to load" },
          permission: { label: "No permission", description: "Read-only member" },
        }),
      },
      EXAMPLE_PLAN_AXIS,
    ],
    interactions: [
      { label: "New item (modal open)", ge: "t:New item" },
      { label: "Item details (side panel open)", ge: "t:Open details" },
    ],
  },
]

/** First matching entry wins; `[x]` = one segment. List deeper patterns first. */
export function matchScreenStates(pathname: string): ScreenStatesEntry | null {
  const segments = pathname.split("/").filter(Boolean)
  for (const entry of SCREEN_STATES) {
    const pattern = entry.pattern.split("/").filter(Boolean)
    if (pattern.length !== segments.length) continue
    const matches = pattern.every(
      (part, i) =>
        (part.startsWith("[") && part.endsWith("]")) || part === segments[i],
    )
    if (matches) return entry
  }
  return null
}
