"use client"

import * as React from "react"
import { Icon } from "@/components/ui/Icon"
import { AuDropdownMenu, type AuDropdownItem } from "@/components/ui/AuDropdownMenu"
import { useReviewStore } from "@/lib/auis-review/store"
import { useCommentsForUrl, useCurrentUrl } from "@/lib/auis-review/hooks"
import { useStopDismiss } from "@/lib/auis-review/useStopDismiss"
import { OVERLAY_DATA_ATTR, REVIEW_Z } from "./constants"
import { ReviewAvatar } from "./ReviewAvatar"
import { ModeFamilySwitch } from "@/components/auis/ModeFamilySwitch"
import { useBuilderChromeHidden } from "@/lib/auis/useBuilderChromeHidden"
import type { ReviewMode } from "./types"

// Mirrors the motion tokens in globals.css (--dur-slow + --ease-out) so the bar
// widens/shrinks in the same idiom as the rest of the DS.
const EXPAND_EASE = "cubic-bezier(0.22, 0.61, 0.36, 1)"
const EXPAND_MS = 300

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

// Avatar menu: switch the review account / add a new one.
function AccountAvatarMenu() {
  const identity = useReviewStore((s) => s.identity)
  const accounts = useReviewStore((s) => s.accounts)
  const switchIdentity = useReviewStore((s) => s.switchIdentity)
  const addAccount = useReviewStore((s) => s.addAccount)
  const openIdentityModal = useReviewStore((s) => s.openIdentityModal)

  // Controlled and opened on CLICK (not on Radix's pointerdown): the toolbar
  // intercepts pointerdown (useStopDismiss) so it never dismisses dialogs, which
  // would swallow Radix's default trigger. The click goes through normally.
  const [open, setOpen] = React.useState(false)

  if (!identity) return null

  const items: AuDropdownItem[] = [
    { id: "hdr", isLabel: true, label: "Review account" },
    ...accounts.map((a) => ({
      id: a.id,
      label: a.name,
      checked: a.id === identity.id,
      onSelect: () => void switchIdentity(a.id),
    })),
    { id: "sep", separator: true },
    {
      id: "edit",
      label: "Edit current account",
      icon: "edit",
      onSelect: () => openIdentityModal("edit"),
    },
    {
      id: "add",
      label: "Add another account",
      icon: "person_add",
      onSelect: () => addAccount(),
    },
  ]

  return (
    <AuDropdownMenu
      side="top"
      align="center"
      sideOffset={10}
      aria-label="Review account"
      open={open}
      onOpenChange={setOpen}
      trigger={
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={`Account: ${identity.name} · switch`}
          title="Review account"
          className="mr-0.5 inline-flex rounded-full transition-transform hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-(--border-strong)"
        >
          <ReviewAvatar
            authorId={identity.id}
            authorName={identity.name}
            colorToken={identity.colorToken}
            size={28}
          />
        </button>
      }
      items={items}
    />
  )
}

export function ReviewToolbar() {
  const chromeHidden = useBuilderChromeHidden()
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

  // The pill and the bar are both mounted (overlapping, absolute) and we
  // measure the natural width of each; the shell animates only `width` between
  // them — so it "widens/shrinks" horizontally, without distorting the content
  // or rising from below. The content crossfades its opacity.
  const pillRef = React.useRef<HTMLDivElement>(null)
  const barRef = React.useRef<HTMLDivElement>(null)
  const [widths, setWidths] = React.useState<{ pill: number; bar: number } | null>(
    null
  )

  React.useLayoutEffect(() => {
    if (pillRef.current && barRef.current) {
      setWidths({
        pill: pillRef.current.offsetWidth,
        bar: barRef.current.offsetWidth,
      })
    }
  }, [identity, openCount, inReviewCount])

  const target = widths ? (active ? widths.bar : widths.pill) : undefined

  // `?chrome=0` (state matrix iframes, PDF generator): the thumbnail shows only
  // the product — not even the collapsed pill appears.
  if (chromeHidden) return null

  return (
    <div
      {...{ [OVERLAY_DATA_ATTR]: "" }}
      ref={stopDismiss}
      className="fixed bottom-4 left-1/2 -translate-x-1/2 pointer-events-none"
      style={{ zIndex: REVIEW_Z.toolbar }}
    >
      <div
        className={[
          "pointer-events-auto relative h-11 rounded-full overflow-hidden bg-(--bg-raised) shadow-lg",
          active ? "ring-1 ring-(--border-subtle)" : "",
        ].join(" ")}
        style={{
          width: target != null ? target : "auto",
          transitionProperty: "width",
          transitionDuration: `${EXPAND_MS}ms`,
          transitionTimingFunction: EXPAND_EASE,
        }}
      >
        {/* Expanded BAR — defines the open width (measured through barRef). */}
        <div
          ref={barRef}
          aria-hidden={!active}
          className={[
            "absolute inset-y-0 left-0 flex items-center gap-1 px-1.5 whitespace-nowrap transition-opacity",
            active ? "opacity-100" : "opacity-0 pointer-events-none",
          ].join(" ")}
          style={{ transitionDuration: "150ms", transitionTimingFunction: EXPAND_EASE }}
        >
          <ModeFamilySwitch current="review" />

          <span className="h-5 w-px bg-(--border-subtle)" />

          <AccountAvatarMenu />

          <span className="h-5 w-px bg-(--border-subtle)" />

          <ModeButton mode="cursor" icon="arrow_selector_tool" label="Cursor" />
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

        {/* Collapsed PILL — overlay shown while inactive (measured through pillRef). */}
        <div
          ref={pillRef}
          aria-hidden={active}
          className={[
            "absolute inset-y-0 left-0 transition-opacity",
            active ? "opacity-0 pointer-events-none" : "opacity-100",
          ].join(" ")}
          style={{ transitionDuration: "150ms", transitionTimingFunction: EXPAND_EASE }}
        >
          <button
            type="button"
            onClick={toggleActive}
            aria-label="Open Review Mode (⌘⇧Y)"
            title="Review Mode · ⌘⇧Y"
            className="h-full inline-flex items-center gap-2 px-4 whitespace-nowrap bg-(--bg-inverse) text-(--fg-on-inverse) hover:opacity-90 body-xs font-medium"
          >
            <Icon name="rate_review" size={14} />
            Review
          </button>
        </div>
      </div>
    </div>
  )
}
