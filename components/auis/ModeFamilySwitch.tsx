"use client"

import { Icon } from "@/components/ui/Icon"
import { useReviewStore } from "@/lib/auis-review/store"
import { useEditStore } from "@/lib/auis-edit/store"

/**
 * Quick switch between the two Auis modes (Review ↔ Edit) straight from the
 * center pill — no need to open the dot. It lives on the left edge of both
 * toolbars (ReviewToolbar / EditToolbar) as its own "category", separated from
 * the rest by a divider. Clicking the inactive mode turns it on; the mutual
 * exclusion in the providers (Edit.setActive turns Review off; the
 * EditModeProvider subscription turns Edit off when Review turns on) guarantees
 * the two are never active at the same time.
 */
export function ModeFamilySwitch({ current }: { current: "review" | "edit" }) {
  const toggleReview = useReviewStore((s) => s.toggleActive)
  const toggleEdit = useEditStore((s) => s.toggleActive)

  const item = (
    mode: "review" | "edit",
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
    </div>
  )
}
