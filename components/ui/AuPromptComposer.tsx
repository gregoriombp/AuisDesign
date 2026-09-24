"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { AuButton } from "./AuButton"

export type AuPromptComposerProps = {
  placeholder?: string
  /** Controlled value. Omit both this and `onValueChange` to run uncontrolled. */
  value?: string
  onValueChange?: (value: string) => void
  onSubmit?: (value: string) => void
  submitLabel?: string
  submitIcon?: string
  /** Controls rendered on the left of the footer, e.g. an attach button. */
  toolbar?: React.ReactNode
  rows?: number
  disabled?: boolean
  className?: string
  "aria-label"?: string
}

/**
 * The assistant's entry point: a raised text area with a footer that carries a
 * toolbar on the left and the submit action on the right.
 *
 * Submitting is deliberately explicit — plain Enter inserts a newline and
 * Cmd/Ctrl+Enter sends, because the field is expected to hold more than one
 * line. An empty or whitespace-only value never submits, so the button cannot
 * fire a no-op request.
 */
export function AuPromptComposer({
  placeholder,
  value,
  onValueChange,
  onSubmit,
  submitLabel = "Send",
  submitIcon = "arrow_upward",
  toolbar,
  rows = 3,
  disabled,
  className,
  "aria-label": ariaLabel,
}: AuPromptComposerProps) {
  const [internal, setInternal] = React.useState("")
  const controlled = value !== undefined
  const current = controlled ? value : internal

  function update(next: string) {
    if (!controlled) setInternal(next)
    onValueChange?.(next)
  }

  function submit() {
    const trimmed = current.trim()
    if (!trimmed || disabled) return
    onSubmit?.(trimmed)
    if (!controlled) setInternal("")
  }

  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden rounded-lg border border-(--border-subtle) bg-(--bg-raised) shadow-md",
        className
      )}
    >
      <textarea
        aria-label={ariaLabel}
        placeholder={placeholder}
        value={current}
        rows={rows}
        disabled={disabled}
        onChange={(event) => update(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
            event.preventDefault()
            submit()
          }
        }}
        className="resize-none bg-transparent px-4 pt-4 pb-2 text-sm text-fg-primary placeholder:text-fg-muted focus:outline-none"
      />
      <div className="flex items-center justify-between gap-3 px-3 pb-3">
        <div className="flex min-w-0 items-center gap-2">{toolbar}</div>
        <AuButton
          size="sm"
          variant="ai"
          iconLeft={submitIcon}
          disabled={disabled || !current.trim()}
          onClick={submit}
        >
          {submitLabel}
        </AuButton>
      </div>
    </div>
  )
}
