"use client"

import { ReviewChrome } from "@auis/ui/ReviewChrome"
import type { ReviewModeLink } from "@auis/ui/review/ReviewToolbar"
import { useEditStore } from "@/lib/auis-edit/store"
import { useStatesStore } from "@/lib/auis-states/store"

// The review chrome comes from @auis/ui; what is Auis-specific is the switch to
// the other two modes on the toolbar's left edge — the same three ModeFamilySwitch
// offers on the Edit and State toolbars.
const MODES: ReviewModeLink[] = [
  { id: "review", icon: "rate_review", label: "Review Mode", active: true },
  {
    id: "edit",
    icon: "edit",
    label: "Edit Mode",
    onActivate: () => useEditStore.getState().toggleActive(),
  },
  {
    id: "states",
    icon: "instant_mix",
    label: "State Mode",
    onActivate: () => useStatesStore.getState().toggleActive(),
  },
]

export function AuisReview() {
  return <ReviewChrome modes={MODES} />
}
