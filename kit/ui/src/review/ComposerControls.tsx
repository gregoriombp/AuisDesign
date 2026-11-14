"use client"

import * as React from "react"
import { Button } from "../primitives/Button"
import { Spinner } from "../primitives/Spinner"
import { VoiceWaveform } from "../primitives/VoiceWaveform"
import { Icon } from "../primitives/Icon"

/**
 * The pieces of the Review Bridge pill composer, shared by the new comment
 * (ReviewCommentPopover) and the reply (ReplyComposer): the frame, the tools,
 * the round send button and the dictation's recording bar.
 */

export const COMPOSER_SHELL_CLASS =
  "flex items-end gap-0.5 min-h-10 pl-3.5 pr-1 py-1 rounded-full border border-(--auis-border-default) bg-(--auis-bg-raised) focus-within:border-(--auis-border-strong) transition-colors"

export const COMPOSER_TEXTAREA_CLASS =
  "block w-full resize-none overflow-hidden bg-transparent py-1 body-sm text-(--auis-fg-primary) placeholder:text-(--auis-fg-tertiary) focus:outline-hidden"

const MAX_TEXT_HEIGHT = 160
const SINGLE_LINE_MAX = 34

/**
 * Grows the textarea with the text up to the ceiling, and turns the pill into a
 * rounded rectangle once it passes one line. Touches the DOM directly so it
 * does not re-render on every key.
 */
export function useComposerAutosize(
  textareaRef: React.RefObject<HTMLTextAreaElement | null>,
  shellRef: React.RefObject<HTMLDivElement | null>,
  value: string,
) {
  React.useLayoutEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = "auto"
    const height = Math.min(ta.scrollHeight, MAX_TEXT_HEIGHT)
    ta.style.height = `${height}px`
    ta.style.overflowY = ta.scrollHeight > MAX_TEXT_HEIGHT ? "auto" : "hidden"
    const shell = shellRef.current
    if (shell) {
      shell.style.borderRadius =
        height > SINGLE_LINE_MAX ? "var(--auis-radius-xl)" : "var(--auis-radius-full)"
    }
  }, [textareaRef, shellRef, value])
}

function BusySlot({ label }: { label: string }) {
  return (
    <span
      aria-busy="true"
      title={label}
      className="shrink-0 h-7.5 w-7.5 inline-flex items-center justify-center text-(--auis-fg-secondary)"
    >
      <Spinner size="sm" aria-label={label} />
    </span>
  )
}

export function ComposerToolButton({
  icon,
  label,
  onClick,
  disabled,
  busy,
}: {
  icon: string
  label: string
  onClick: () => void
  disabled?: boolean
  busy?: boolean
}) {
  if (busy) return <BusySlot label={label} />
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      iconOnly={icon}
      iconSize={20}
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className="shrink-0 bg-transparent! text-(--auis-fg-tertiary)! hover:text-(--auis-fg-primary)! hover:bg-(--auis-bg-hover)!"
    />
  )
}

export function ComposerSendButton({
  label,
  type = "button",
  onClick,
  disabled,
  loading,
}: {
  label: string
  type?: "button" | "submit"
  onClick?: () => void
  disabled?: boolean
  loading?: boolean
}) {
  if (loading) return <BusySlot label={label} />
  return (
    <Button
      type={type}
      variant="primary"
      size="sm"
      iconOnly="arrow_upward"
      iconSize={20}
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className="shrink-0 ml-0.5 rounded-full!"
    />
  )
}

/**
 * Takes over the pill while dictation records: discard, elapsed time, the
 * microphone's wave and stop. The audio becomes text when recording stops.
 */
export function ComposerRecording({
  stream,
  onDiscard,
  onStop,
  labels,
}: {
  stream: MediaStream | null
  onDiscard: () => void
  onStop: () => void
  labels?: { group: string; discard: string; stop: string }
}) {
  const [seconds, setSeconds] = React.useState(0)
  React.useEffect(() => {
    const startedAt = Date.now()
    const id = window.setInterval(
      () => setSeconds(Math.floor((Date.now() - startedAt) / 1000)),
      500,
    )
    return () => window.clearInterval(id)
  }, [])
  const elapsed = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`

  return (
    <div
      role="group"
      aria-label={labels?.group ?? "Recording dictation"}
      className="flex flex-1 min-w-0 items-center gap-2 -ml-2.5"
    >
      <Button
        type="button"
        variant="ghost"
        size="sm"
        iconOnly="close"
        iconSize={20}
        aria-label={labels?.discard ?? "Discard recording"}
        title={labels?.discard ?? "Discard recording"}
        onClick={onDiscard}
        className="shrink-0 bg-transparent! text-(--auis-fg-secondary)! hover:bg-(--auis-bg-hover)!"
      />
      <span className="shrink-0 inline-flex items-center gap-1.5 body-xs font-medium tabular-nums text-(--auis-fg-primary)">
        <span
          aria-hidden="true"
          className="h-2 w-2 rounded-full bg-(--auis-accent-danger) animate-pulse motion-reduce:animate-none"
        />
        {elapsed}
      </span>
      <span className="flex flex-1 min-w-0 justify-center overflow-hidden text-(--auis-fg-secondary)">
        <VoiceWaveform stream={stream} bars={30} size="sm" />
      </span>
      <Button
        type="button"
        variant="primary"
        size="sm"
        iconOnly="stop"
        iconSize={20}
        iconFill={1}
        aria-label={labels?.stop ?? "Stop recording"}
        title={labels?.stop ?? "Stop recording"}
        onClick={onStop}
        className="shrink-0 rounded-full!"
      />
    </div>
  )
}

export function ComposerThumbnails({
  images,
  onRemove,
  onAdd,
  canAdd,
}: {
  images: string[]
  onRemove: (index: number) => void
  onAdd?: () => void
  canAdd?: boolean
}) {
  if (images.length === 0) return null
  return (
    <ul
      aria-label="Attached images"
      className="m-0 p-0 list-none flex flex-wrap gap-2.5 px-1 pt-1.5"
    >
      {images.map((src, idx) => (
        <li key={idx} className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={`Attached image ${idx + 1}`}
            className="h-14 w-14 rounded-md object-cover border border-(--auis-border-subtle)"
          />
          <button
            type="button"
            onClick={() => onRemove(idx)}
            aria-label="Remove image"
            title="Remove image"
            className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-(--auis-bg-raised) border border-(--auis-border-subtle) shadow-xs flex items-center justify-center text-(--auis-fg-secondary) hover:text-(--auis-fg-primary)"
          >
            <Icon name="close" size={12} />
          </button>
        </li>
      ))}
      {onAdd && canAdd && (
        <li>
          <button
            type="button"
            onClick={onAdd}
            aria-label="Add image"
            title="Add image"
            className="h-14 w-14 rounded-md border border-dashed border-(--auis-border-default) flex items-center justify-center text-(--auis-fg-tertiary) hover:text-(--auis-fg-primary) hover:border-(--auis-border-strong) transition-colors"
          >
            <Icon name="add" size={16} />
          </button>
        </li>
      )}
    </ul>
  )
}
