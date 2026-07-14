"use client"

import * as React from "react"
import { Icon } from "@/components/ui/Icon"
import { useReviewStore } from "@/lib/auis-review/store"
import { useCommentsForUrl, useCurrentUrl } from "@/lib/auis-review/hooks"
import { useStopDismiss } from "@/lib/auis-review/useStopDismiss"
import { OVERLAY_DATA_ATTR, REVIEW_Z } from "./constants"
import { ReviewAvatar } from "./ReviewAvatar"
import { ModeFamilySwitch } from "@/components/auis/ModeFamilySwitch"
import type { ReviewMode } from "./types"

type ModeButtonProps = {
  mode: ReviewMode
  icon: string
  label: string
  shortcut?: string
}

function ModeButton({ mode, icon, label, shortcut }: ModeButtonProps) {
  const current = useReviewStore((s) => s.mode)
  const setMode = useReviewStore((s) => s.setMode)
  const active = current === mode
  return (
    <button
      type="button"
      onClick={() => setMode(mode)}
      aria-label={label}
      aria-pressed={active}
      title={shortcut ? `${label} · ${shortcut}` : label}
      className={[
        "h-8 w-8 inline-flex items-center justify-center rounded-full transition-colors",
        active
          ? "bg-(--bg-inverse) text-(--fg-on-inverse)"
          : "text-(--fg-secondary) hover:bg-(--bg-hover) hover:text-(--fg-primary)",
      ].join(" ")}
    >
      <Icon name={icon} size={16} />
    </button>
  )
}

// Magic pointer: finds elements/divs on hover (see ReviewMagicCursor) and
// anchors the pin to the element, cutting down drift. The active state gets an AI
// gradient (Auis tokens) so it stands apart from the plain modes.
function MagicModeButton() {
  const active = useReviewStore((s) => s.mode === "magic")
  const setMode = useReviewStore((s) => s.setMode)
  return (
    <button
      type="button"
      onClick={() => setMode("magic")}
      aria-label="Magic pointer"
      aria-pressed={active}
      title="Magic pointer · finds elements"
      className={[
        "h-8 w-8 inline-flex items-center justify-center rounded-full transition-colors",
        active
          ? "text-(--fg-on-inverse)"
          : "text-(--fg-secondary) hover:bg-(--bg-hover) hover:text-(--fg-primary)",
      ].join(" ")}
      style={
        active
          ? {
              background:
                "linear-gradient(115deg, var(--au-blue-600), var(--au-purple-600), var(--au-pink-600))",
            }
          : undefined
      }
    >
      <Icon name="auto_awesome" size={16} fill={active ? 1 : 0} />
    </button>
  )
}

export function ReviewToolbar() {
  const active = useReviewStore((s) => s.active)
  const identity = useReviewStore((s) => s.identity)
  const sheetOpen = useReviewStore((s) => s.sheetOpen)
  const toggleSheet = useReviewStore((s) => s.toggleSheet)
  const toggleActive = useReviewStore((s) => s.toggleActive)
  const setExportOpen = useReviewStore((s) => s.setExportOpen)
  const allComments = useReviewStore((s) => s.comments)

  const url = useCurrentUrl()
  const pageComments = useCommentsForUrl(url)
  const openCount = pageComments.filter((c) => c.status === "open").length
  const inReviewCount = allComments.filter((c) => c.status === "in_review").length
  const stopDismiss = useStopDismiss<HTMLDivElement>()

  if (!active) {
    return (
      <div
        {...{ [OVERLAY_DATA_ATTR]: "" }}
        ref={stopDismiss}
        className="fixed bottom-4 left-1/2 -translate-x-1/2 pointer-events-none"
        style={{ zIndex: REVIEW_Z.toolbar }}
      >
        <button
          type="button"
          onClick={toggleActive}
          aria-label="Open Review Mode (⌘⇧Y)"
          title="Review Mode · ⌘⇧Y"
          className="pointer-events-auto inline-flex items-center gap-2 px-3 py-2 rounded-full bg-(--bg-inverse) text-(--fg-on-inverse) shadow-lg hover:opacity-90 body-xs font-medium"
        >
          <Icon name="rate_review" size={14} />
          Review
        </button>
      </div>
    )
  }

  return (
    <div
      {...{ [OVERLAY_DATA_ATTR]: "" }}
      ref={stopDismiss}
      className="fixed bottom-4 left-1/2 -translate-x-1/2 pointer-events-none"
      style={{ zIndex: REVIEW_Z.toolbar }}
    >
      <div className="pointer-events-auto rounded-full bg-(--bg-raised) border border-(--border-subtle) shadow-lg px-1.5 py-1.5 flex items-center gap-1">
        <ModeFamilySwitch current="review" />

        <span className="h-5 w-px bg-(--border-subtle)" />

        {identity && (
          <ReviewAvatar
            authorId={identity.id}
            authorName={identity.name}
            colorToken={identity.colorToken}
            size={28}
            title={`Reviewer: ${identity.name}`}
            className="mr-0.5"
          />
        )}

        <span className="h-5 w-px bg-(--border-subtle)" />

        <ModeButton
          mode="cursor"
          icon="arrow_selector_tool"
          label="Cursor"
        />
        <ModeButton
          mode="draw"
          icon="draw"
          label="Freehand mark"
          shortcut="⌘⇧K"
        />
        <ModeButton mode="pin" icon="location_on" label="Pin" />
        <MagicModeButton />

        <span className="h-5 w-px bg-(--border-subtle)" />

        <button
          type="button"
          onClick={toggleSheet}
          aria-label={
            inReviewCount > 0
              ? `Comments · ${inReviewCount} in review`
              : "Comments on this screen"
          }
          aria-pressed={sheetOpen}
          title={
            inReviewCount > 0
              ? `Comments · ${inReviewCount} in review`
              : "Comments on this screen"
          }
          className={[
            "relative h-8 inline-flex items-center gap-1 px-2 rounded-full transition-colors",
            sheetOpen
              ? "bg-(--bg-inverse) text-(--fg-on-inverse)"
              : "text-(--fg-secondary) hover:bg-(--bg-hover) hover:text-(--fg-primary)",
          ].join(" ")}
        >
          <Icon name="forum" size={16} />
          {openCount > 0 && (
            <span className="body-xs font-semibold tabular-nums">
              {openCount}
            </span>
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

        <button
          type="button"
          onClick={() => setExportOpen(true)}
          aria-label="Export comments"
          title="Export JSON"
          className="h-8 w-8 inline-flex items-center justify-center rounded-full text-(--fg-secondary) hover:bg-(--bg-hover) hover:text-(--fg-primary)"
        >
          <Icon name="ios_share" size={16} />
        </button>

        <span className="h-5 w-px bg-(--border-subtle)" />

        <button
          type="button"
          onClick={toggleActive}
          aria-label="Close Review Mode"
          title="Close (⌘⇧Y)"
          className="h-8 w-8 inline-flex items-center justify-center rounded-full text-(--fg-secondary) hover:bg-(--bg-hover) hover:text-(--fg-primary)"
        >
          <Icon name="close" size={16} />
        </button>
      </div>
    </div>
  )
}
