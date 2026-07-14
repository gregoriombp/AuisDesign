"use client"

import * as React from "react"
import { Icon } from "@/components/ui/Icon"
import { ModeFamilySwitch } from "@/components/auis/ModeFamilySwitch"
import { EDIT_OVERLAY_DATA_ATTR, EDIT_Z } from "./constants"

// Sibling of ReviewToolbar — SAME pill (rounded-full bg-raised border-subtle
// shadow-lg px-1.5 py-1.5), SAME h-8 w-8 rounded-full buttons, SAME dividers.
// Tool chrome consistent with Review Mode (the two never show up together).

export function EditToolbar({
  openCount,
  inReviewCount,
  inboxOpen,
  onToggleInbox,
  onExit,
}: {
  openCount: number
  inReviewCount: number
  inboxOpen: boolean
  onToggleInbox: () => void
  onExit: () => void
}) {
  return (
    <div
      {...{ [EDIT_OVERLAY_DATA_ATTR]: "toolbar" }}
      className="fixed bottom-4 left-1/2 -translate-x-1/2 pointer-events-none"
      style={{ zIndex: EDIT_Z.toolbar }}
    >
      <div className="pointer-events-auto rounded-full bg-(--bg-raised) border border-(--border-subtle) shadow-lg px-1.5 py-1.5 flex items-center gap-1">
        {/* Mode switch (Review ↔ Edit) — same category as the review toolbar. */}
        <ModeFamilySwitch current="edit" />

        <span className="h-5 w-px bg-(--border-subtle)" />

        {/* Selection mode (the MVP's only mode) — always active, like the ModeButtons. */}
        <span
          aria-hidden
          className="h-8 w-8 inline-flex items-center justify-center rounded-full bg-(--bg-inverse) text-(--fg-on-inverse)"
          title="Select"
        >
          <Icon name="arrow_selector_tool" size={16} />
        </span>

        <span className="h-5 w-px bg-(--border-subtle)" />

        <button
          type="button"
          onClick={onToggleInbox}
          aria-pressed={inboxOpen}
          aria-label={
            inReviewCount > 0
              ? `Edits · ${inReviewCount} in review`
              : "Edits on this screen"
          }
          title={
            inReviewCount > 0
              ? `Edits · ${inReviewCount} in review`
              : "Edits on this screen"
          }
          className={[
            "relative h-8 inline-flex items-center gap-1 px-2 rounded-full transition-colors",
            inboxOpen
              ? "bg-(--bg-inverse) text-(--fg-on-inverse)"
              : "text-(--fg-secondary) hover:bg-(--bg-hover) hover:text-(--fg-primary)",
          ].join(" ")}
        >
          <Icon name="inbox" size={16} />
          {openCount > 0 && (
            <span className="body-xs font-semibold tabular-nums">{openCount}</span>
          )}
          {inReviewCount > 0 && (
            <span
              className="absolute -top-1 -right-1 min-w-4 h-4 px-1 inline-flex items-center justify-center rounded-full body-xs font-semibold tabular-nums bg-(--au-amber-500) text-(--fg-on-inverse) ring-2 ring-(--bg-raised)"
              aria-hidden="true"
            >
              {inReviewCount}
            </span>
          )}
        </button>

        <span className="h-5 w-px bg-(--border-subtle)" />

        <button
          type="button"
          onClick={onExit}
          aria-label="Exit Edit Mode"
          title="Exit (⌘⇧E)"
          className="h-8 w-8 inline-flex items-center justify-center rounded-full text-(--fg-secondary) hover:bg-(--bg-hover) hover:text-(--fg-primary)"
        >
          <Icon name="close" size={16} />
        </button>
      </div>
    </div>
  )
}
