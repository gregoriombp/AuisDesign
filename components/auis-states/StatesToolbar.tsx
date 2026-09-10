"use client"

import * as React from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Icon } from "@/components/ui/Icon"
import { AuSegmented } from "@/components/ui/AuSegmented"
import {
  AuDropdownMenu,
  type AuDropdownItem,
} from "@/components/ui/AuDropdownMenu"
import { AuSpinner } from "@/components/ui/AuSpinner"
import { ModeFamilySwitch } from "@/components/auis/ModeFamilySwitch"
import { matchScreenStates } from "@/lib/auis-states/registry"
import type {
  ScreenStateAxis,
  ScreenStateInteraction,
} from "@/lib/auis-states/types"
import { useStatesStore } from "@/lib/auis-states/store"
import { STATES_OVERLAY_DATA_ATTR, STATES_Z } from "./constants"

// Sibling of ReviewToolbar/EditToolbar — SAME pill (rounded-full bg-raised
// border-subtle shadow-lg px-1.5 py-1.5), SAME dividers. Shows the state axes
// of the current screen (registry) and writes the query params; the URL is the
// only source of truth — no selected scenario in a store.

// Params of other Auis mechanisms that do not survive a scenario change: the
// click recipe (?ge=) and the comment permalink.
const DROP_ON_APPLY = ["ge", "reviewCommentId"]

export function StatesToolbar() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const router = useRouter()
  const requestExit = useStatesStore((s) => s.requestExit)

  const entry = React.useMemo(() => matchScreenStates(pathname), [pathname])

  // Optimistic value per axis while router.replace has not reached
  // useSearchParams yet (becomes the AuSegmented `pendingValue` / the menu's
  // spinner). Cleared when the URL changes, with a safety timeout so it never
  // gets stuck.
  const [pending, setPending] = React.useState<Record<string, string>>({})
  React.useEffect(() => {
    setPending({})
  }, [searchParams])
  React.useEffect(() => {
    if (Object.keys(pending).length === 0) return
    const t = setTimeout(() => setPending({}), 2500)
    return () => clearTimeout(t)
  }, [pending])

  const currentOf = React.useCallback(
    (axis: ScreenStateAxis) => {
      const raw = searchParams.get(axis.param)
      // A value outside the options (hand-edited URL) = default, like the
      // screens' own parsers.
      return raw != null && axis.options.some((o) => o.value === raw)
        ? raw
        : axis.defaultValue
    },
    [searchParams],
  )

  const applyAxis = React.useCallback(
    (axis: ScreenStateAxis, value: string) => {
      if (value === currentOf(axis)) return
      const params = new URLSearchParams(searchParams.toString())
      if (value === axis.defaultValue) params.delete(axis.param)
      else params.set(axis.param, value)
      for (const p of DROP_ON_APPLY) params.delete(p)
      setPending((prev) => ({ ...prev, [axis.param]: value }))
      const qs = params.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    },
    [currentOf, pathname, router, searchParams],
  )

  // Fires (or clears) an interaction: writes ?ge= and the FlowStateDriver
  // replays the clicks on the live screen — no remount, the axes stay as they are.
  const applyInteraction = React.useCallback(
    (ge: string | null) => {
      const params = new URLSearchParams(searchParams.toString())
      if (ge == null) params.delete("ge")
      else params.set("ge", ge)
      params.delete("reviewCommentId")
      const qs = params.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    },
    [pathname, router, searchParams],
  )

  // Escape leaves the mode — but only with a "clean" screen: if an overlay is
  // open (Radix dropdown/popover, AuModal or AuSheet of the scenario), Escape
  // belongs to it. Detected through the markers those layers already carry.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return
      const openLayer = document.querySelector(
        "[data-radix-popper-content-wrapper], .au-modal-scrim, .au-sheet-scrim",
      )
      if (openLayer) return
      requestExit()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [requestExit])

  return (
    <div
      {...{ [STATES_OVERLAY_DATA_ATTR]: "toolbar" }}
      className="fixed bottom-4 left-1/2 -translate-x-1/2 pointer-events-none"
      style={{ zIndex: STATES_Z.toolbar }}
    >
      <div className="pointer-events-auto rounded-full bg-(--bg-raised) border border-(--border-subtle) shadow-lg px-1.5 py-1.5 flex items-center gap-1">
        {/* Mode switch (Review ↔ Edit ↔ States) — same category as the siblings. */}
        <ModeFamilySwitch current="states" />

        <span className="h-5 w-px bg-(--border-subtle)" />

        {entry ? (
          <>
            <span className="px-2 body-xs font-semibold text-(--fg-primary) whitespace-nowrap">
              {entry.screenLabel}
            </span>
            {entry.axes.map((axis) => (
              <AxisControl
                key={axis.param}
                axis={axis}
                current={currentOf(axis)}
                pending={pending[axis.param] ?? null}
                // With 3+ axes the pill overflows — every axis becomes a menu.
                forceMenu={entry.axes.length >= 3}
                onApply={(value) => applyAxis(axis, value)}
              />
            ))}
            {entry.interactions && entry.interactions.length > 0 && (
              <InteractionsControl
                interactions={entry.interactions}
                currentGe={searchParams.get("ge")}
                onApply={applyInteraction}
              />
            )}
          </>
        ) : (
          <span className="px-2 body-xs text-(--fg-tertiary) whitespace-nowrap">
            This screen has no registered states yet
          </span>
        )}

        <span className="h-5 w-px bg-(--border-subtle)" />

        <button
          type="button"
          onClick={() => requestExit()}
          aria-label="Exit State Mode"
          title="Exit (⌘⇧S)"
          className="h-8 w-8 inline-flex items-center justify-center rounded-full text-(--fg-secondary) hover:bg-(--bg-hover) hover:text-(--fg-primary)"
        >
          <Icon name="close" size={16} />
        </button>
      </div>
    </div>
  )
}

/**
 * One axis of the registry. Up to 4 options becomes an AuSegmented (one-click
 * toggle); above that — or when the route has 3+ axes — an AuDropdownMenu with
 * the current scenario on the trigger, otherwise the pill does not fit.
 */
function AxisControl({
  axis,
  current,
  pending,
  forceMenu,
  onApply,
}: {
  axis: ScreenStateAxis
  current: string
  pending: string | null
  forceMenu: boolean
  onApply: (value: string) => void
}) {
  const asMenu = forceMenu || axis.options.length > 4

  if (!asMenu) {
    return (
      <span className="inline-flex items-center gap-1.5 pl-1">
        <span className="body-xs text-(--fg-tertiary) whitespace-nowrap">
          {axis.label}
        </span>
        <AuSegmented
          size="sm"
          ariaLabel={`${axis.label} of the screen`}
          options={axis.options.map((o) => ({ value: o.value, label: o.label }))}
          value={current}
          pendingValue={pending}
          onChange={onApply}
        />
      </span>
    )
  }

  const litValue = pending ?? current
  const currentLabel =
    axis.options.find((o) => o.value === litValue)?.label ?? litValue
  const items: AuDropdownItem[] = [
    { id: `${axis.param}-label`, isLabel: true, label: axis.label },
    ...axis.options.map(
      (o): AuDropdownItem => ({
        id: o.value,
        label: o.description ? (
          <span title={o.description}>{o.label}</span>
        ) : (
          o.label
        ),
        checked: o.value === current,
        onSelect: () => onApply(o.value),
      }),
    ),
  ]

  return (
    <AuDropdownMenu
      side="top"
      align="center"
      sideOffset={8}
      aria-label={`${axis.label} of the screen`}
      items={items}
      trigger={
        <button
          type="button"
          className="h-8 inline-flex items-center gap-1.5 pl-2.5 pr-2 rounded-full text-(--fg-secondary) hover:bg-(--bg-hover) hover:text-(--fg-primary) transition-colors"
        >
          <span className="body-xs text-(--fg-tertiary) whitespace-nowrap">
            {axis.label}
          </span>
          <span className="body-xs font-medium whitespace-nowrap">
            {currentLabel}
          </span>
          {pending ? (
            <AuSpinner size="sm" aria-hidden="true" />
          ) : (
            <Icon name="keyboard_arrow_up" size={14} />
          )}
        </button>
      }
    />
  )
}

/**
 * States reachable through an interaction (open modal, open menu…): writes
 * ?ge= and the FlowStateDriver replays the clicks. Clicking the active
 * interaction clears the param (toggle) — the state axes are not touched.
 */
function InteractionsControl({
  interactions,
  currentGe,
  onApply,
}: {
  interactions: ScreenStateInteraction[]
  currentGe: string | null
  onApply: (ge: string | null) => void
}) {
  const active = interactions.find((i) => i.ge === currentGe) ?? null
  const items: AuDropdownItem[] = [
    { id: "interactions-label", isLabel: true, label: "Interactions" },
    ...interactions.map(
      (i): AuDropdownItem => ({
        id: i.ge,
        label: i.label,
        checked: i.ge === currentGe,
        onSelect: () => onApply(i.ge === currentGe ? null : i.ge),
      }),
    ),
  ]

  return (
    <AuDropdownMenu
      side="top"
      align="center"
      sideOffset={8}
      aria-label="Screen interactions"
      items={items}
      trigger={
        <button
          type="button"
          className="h-8 inline-flex items-center gap-1.5 pl-2.5 pr-2 rounded-full text-(--fg-secondary) hover:bg-(--bg-hover) hover:text-(--fg-primary) transition-colors"
        >
          <Icon name="play_arrow" size={14} />
          <span className="body-xs text-(--fg-tertiary) whitespace-nowrap">
            Interaction
          </span>
          <span className="body-xs font-medium whitespace-nowrap">
            {active ? active.label : "—"}
          </span>
          <Icon name="keyboard_arrow_up" size={14} />
        </button>
      }
    />
  )
}
