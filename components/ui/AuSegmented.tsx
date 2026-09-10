"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { AuSpinner } from "./AuSpinner"

export interface AuSegmentedOption<T extends string> {
  value: T
  label: string
  /** Visual node rendered before the label — an `<Icon/>`, a mark, or several
   *  side by side. Rendered verbatim; not an icon-name string. */
  leading?: React.ReactNode
  disabled?: boolean
}

export interface AuSegmentedProps<T extends string> {
  options: AuSegmentedOption<T>[]
  value: T
  onChange: (value: T) => void
  /** Accessible name for the tablist. */
  ariaLabel: string
  /** Density. `md` (default) → h-8 / body-sm. `sm` → h-7 / body-xs. */
  size?: "sm" | "md"
  /**
   * Async-commit variation: the value that is being confirmed asynchronously.
   * While set, that segment lights up optimistically and swaps its leading for
   * a spinner, and the whole track turns `aria-busy` and non-interactive until
   * the prop goes back to `null`. Leaving it out keeps the control synchronous
   * (additive, backwards compatible).
   */
  pendingValue?: T | null
  className?: string
}

// Fully rounded (pill) track and segments — the canonical shape of the control.
// `thumb` is the vertical inset of the sliding pill (= track padding).
const SIZE: Record<"sm" | "md", { track: string; seg: string; thumb: string }> = {
  sm: {
    track: "gap-0.5 rounded-full p-0.5",
    seg: "h-7 gap-1.5 rounded-full px-2.5 body-xs",
    thumb: "top-0.5 bottom-0.5",
  },
  md: {
    track: "gap-0.5 rounded-full p-1",
    seg: "h-8 gap-1.5 rounded-full px-3 body-sm",
    thumb: "top-1 bottom-1",
  },
}

/**
 * Single-select segmented control / toggle group, generic over the option
 * value. The selected segment carries the DS **primary** treatment (solid
 * `--fg-primary` fill with `--bg-canvas` text — identical to `AuButton`
 * variant primary), painted by a pill that slides between segments.
 *
 * a11y: `role="tablist"`/`tab` with roving `tabindex` + Arrow/Home/End keys.
 */
export function AuSegmented<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  size = "md",
  pendingValue = null,
  className,
}: AuSegmentedProps<T>): React.JSX.Element {
  const sz = SIZE[size]
  const busy = pendingValue != null
  const refs = React.useRef<Map<T, HTMLButtonElement | null>>(new Map())
  const trackRef = React.useRef<HTMLDivElement | null>(null)

  // Sliding pill under the lit segment. Measured from the button itself;
  // before the first measurement (SSR/first paint) the active segment carries
  // the fill on its own — no flash.
  const litValue = pendingValue ?? value
  const [thumb, setThumb] = React.useState({ left: 0, width: 0, ready: false })

  const measureThumb = React.useCallback(() => {
    const target = refs.current.get(litValue)
    if (!target) {
      setThumb((prev) => (prev.ready ? { ...prev, ready: false } : prev))
      return
    }
    setThumb({ left: target.offsetLeft, width: target.offsetWidth, ready: true })
  }, [litValue])

  React.useLayoutEffect(() => {
    measureThumb()
  }, [measureThumb, options, size])

  React.useEffect(() => {
    const track = trackRef.current
    if (!track || typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(() => measureThumb())
    observer.observe(track)
    return () => observer.disconnect()
  }, [measureThumb])

  // Roving focus owner: the selected segment when enabled, else the first
  // enabled one — so Tab always lands on a focusable, meaningful segment.
  const selectedEnabled = options.some((o) => o.value === value && !o.disabled)
  const firstEnabled = options.find((o) => !o.disabled)?.value
  const tabStop = selectedEnabled ? value : firstEnabled

  const focusValue = (v: T) => {
    onChange(v)
    refs.current.get(v)?.focus()
  }

  const move = (from: T, dir: 1 | -1) => {
    const enabled = options.filter((o) => !o.disabled)
    if (enabled.length === 0) return
    const idx = enabled.findIndex((o) => o.value === from)
    const start = idx === -1 ? (dir === 1 ? -1 : 0) : idx
    const next = enabled[(start + dir + enabled.length) % enabled.length]
    if (next) focusValue(next.value)
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, v: T) => {
    switch (e.key) {
      case "ArrowRight":
      case "ArrowDown":
        e.preventDefault()
        move(v, 1)
        break
      case "ArrowLeft":
      case "ArrowUp":
        e.preventDefault()
        move(v, -1)
        break
      case "Home": {
        e.preventDefault()
        const first = options.find((o) => !o.disabled)
        if (first) focusValue(first.value)
        break
      }
      case "End": {
        e.preventDefault()
        const last = [...options].reverse().find((o) => !o.disabled)
        if (last) focusValue(last.value)
        break
      }
    }
  }

  return (
    <div
      ref={trackRef}
      role="tablist"
      aria-label={ariaLabel}
      aria-busy={busy || undefined}
      className={cn(
        // `w-fit` because `inline-flex` alone does not hold the width: inside a
        // `flex flex-col` parent the default `align-items: stretch` stretches
        // the track edge to edge and leaves an empty strip after the segments.
        "relative isolate inline-flex w-fit items-center border border-(--border-subtle) bg-(--bg-surface)",
        sz.track,
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute left-0 z-0 rounded-full bg-(--fg-primary)",
          "transition-[transform,width] duration-au-base ease-au-out motion-reduce:transition-none",
          sz.thumb,
        )}
        style={{
          width: thumb.width,
          transform: `translateX(${thumb.left}px)`,
          opacity: thumb.ready ? 1 : 0,
        }}
      />
      {options.map((opt) => {
        const active = opt.value === value
        const pending = pendingValue === opt.value
        // During a commit the target segment lights up optimistically (even
        // before `value` changes) to answer the click immediately.
        const lit = active || pending
        return (
          <button
            key={opt.value}
            ref={(node) => {
              refs.current.set(opt.value, node)
            }}
            type="button"
            role="tab"
            aria-selected={active}
            // The whole track locks during a commit — avoids firing a second
            // commit on top of the first.
            disabled={opt.disabled || busy}
            tabIndex={opt.value === tabStop ? 0 : -1}
            onClick={() => onChange(opt.value)}
            onKeyDown={(e) => onKeyDown(e, opt.value)}
            className={cn(
              "relative z-10 inline-flex shrink-0 items-center justify-center font-medium whitespace-nowrap",
              "transition-colors duration-au-fast",
              "focus-visible:z-10 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-(--ring-focus) focus-visible:ring-offset-2 focus-visible:ring-offset-(--bg-surface)",
              "disabled:cursor-not-allowed disabled:pointer-events-none",
              // The pending segment does NOT dim (it carries the spinner); the
              // others dim while the commit runs.
              busy && !pending && "opacity-50",
              sz.seg,
              lit
                ? // The sliding pill carries the fill; the segment only does so
                  // while the pill has not been measured (SSR/first paint).
                  cn("text-(--bg-canvas)", !thumb.ready && "bg-(--fg-primary)")
                : "text-(--fg-secondary) hover:bg-(--bg-hover) hover:text-(--fg-primary)",
            )}
          >
            {pending ? (
              <AuSpinner size="sm" className="text-(--bg-canvas)" aria-hidden="true" />
            ) : (
              opt.leading && (
                <span className="inline-flex shrink-0 items-center">
                  {opt.leading}
                </span>
              )
            )}
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
