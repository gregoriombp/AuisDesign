"use client"

import { Icon } from "@/components/ui/Icon"
import { useReviewStore } from "@/lib/auis-review/store"
import { useEditStore } from "@/lib/auis-edit/store"
import { useStatesStore } from "@/lib/auis-states/store"

/**
 * Quick switch between the Auis modes (Review ↔ Edit ↔ States) straight from
 * the center pill — no need to open the dot. It lives on the left edge of the
 * three toolbars (ReviewToolbar / EditToolbar / StatesToolbar) as its own
 * "category", separated from the rest by a divider. Clicking the inactive mode
 * turns it on; the mutual exclusion in the providers (setActive of Edit/States
 * turns the others off by direct import; the subscriptions in EditModeProvider
 * and StatesModeProvider cover the reverse direction) guarantees that two are
 * never active at the same time.
 */
type ModeFamily = "review" | "edit" | "states"

export function ModeFamilySwitch({ current }: { current: ModeFamily }) {
  const toggleReview = useReviewStore((s) => s.toggleActive)
  const toggleEdit = useEditStore((s) => s.toggleActive)
  const toggleStates = useStatesStore((s) => s.toggleActive)

  const item = (
    mode: ModeFamily,
    icon: string,
    label: string,
    onActivate: () => void
  ) => {
    const active = current === mode
    return (
      <button
        type="button"
        onClick={active ? undefined : onActivate}
        aria-pressed={active}
        aria-label={label}
        title={label}
        className={[
          "h-8 w-8 inline-flex items-center justify-center rounded-full transition-colors",
          active
            ? "bg-(--bg-inverse) text-(--fg-on-inverse)"
            : "text-(--fg-secondary) hover:bg-(--bg-hover) hover:text-(--fg-primary)",
        ].join(" ")}
      >
        <Icon name={icon} size={16} fill={active ? 1 : 0} />
      </button>
    )
  }

  return (
    <div className="flex items-center gap-1">
      {item("review", "rate_review", "Review Mode", () => toggleReview())}
      {item("edit", "edit", "Edit Mode", () => toggleEdit())}
      {item("states", "instant_mix", "State Mode", () => toggleStates())}
    </div>
  )
}
