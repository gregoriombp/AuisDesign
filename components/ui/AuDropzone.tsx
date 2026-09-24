"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Icon } from "./Icon"

export type AuDropzoneProps = {
  /** Receives every accepted file, whether it was dropped or picked. */
  onFiles?: (files: File[]) => void
  /** Native `accept` filter (".pdf,.csv,image/*"). Dropped files honour it too. */
  accept?: string
  multiple?: boolean
  disabled?: boolean
  /** First line. Say what to do, not what the area is. */
  label: React.ReactNode
  /** Second line: formats, limits, anything that qualifies the first. */
  hint?: React.ReactNode
  /** Material Symbols name for the medium. */
  icon?: string
  id?: string
  className?: string
}

/** Mirrors what the native picker does with `accept`, for dropped files. */
function accepts(file: File, accept?: string) {
  const rules = (accept ?? "")
    .split(",")
    .map((rule) => rule.trim().toLowerCase())
    .filter(Boolean)
  if (rules.length === 0) return true

  const name = file.name.toLowerCase()
  const type = file.type.toLowerCase()
  return rules.some((rule) => {
    if (rule.startsWith(".")) return name.endsWith(rule)
    if (rule.endsWith("/*")) return type.startsWith(rule.slice(0, -1))
    return type === rule
  })
}

/**
 * The file drop target: a dashed region that takes a drop, a click, or the
 * keyboard, and hands the caller plain `File` objects.
 *
 * The whole region is a `<label>` around a visually hidden — but still
 * focusable — file input, so one element covers pointer, keyboard and screen
 * reader without a second control competing for the click.
 *
 * It owns the picking, never the queue: the selected-files list, its progress
 * and its errors belong to the surface that knows what the files are for.
 */
export function AuDropzone({
  onFiles,
  accept,
  multiple,
  disabled,
  label,
  hint,
  icon = "upload_file",
  id,
  className,
}: AuDropzoneProps) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  // Entering a child fires dragleave on the parent, so depth — not a boolean —
  // is what keeps the highlight from flickering across the inner elements.
  const depth = React.useRef(0)
  const [over, setOver] = React.useState(false)

  function emit(list: FileList | null) {
    const files = Array.from(list ?? []).filter((file) => accepts(file, accept))
    if (files.length > 0) onFiles?.(multiple ? files : files.slice(0, 1))
  }

  return (
    <label
      htmlFor={id}
      data-state={over ? "over" : "idle"}
      onDragEnter={(event) => {
        if (disabled) return
        event.preventDefault()
        depth.current += 1
        setOver(true)
      }}
      onDragOver={(event) => {
        if (disabled) return
        event.preventDefault()
      }}
      onDragLeave={() => {
        depth.current = Math.max(0, depth.current - 1)
        if (depth.current === 0) setOver(false)
      }}
      onDrop={(event) => {
        if (disabled) return
        event.preventDefault()
        depth.current = 0
        setOver(false)
        emit(event.dataTransfer.files)
      }}
      className={cn(
        "flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed px-6 py-8 text-center",
        "border-(--border-default) bg-(--bg-surface)",
        "hover:border-(--border-strong) hover:bg-(--bg-hover)",
        "has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-(--ring-focus)",
        "data-[state=over]:border-(--fg-primary) data-[state=over]:bg-(--bg-hover)",
        disabled && "pointer-events-none opacity-60",
        className
      )}
    >
      <input
        ref={inputRef}
        id={id}
        type="file"
        className="sr-only"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        onChange={(event) => {
          emit(event.target.files)
          // Same file twice in a row still has to fire a change.
          event.target.value = ""
        }}
      />
      <span className="flex size-10 items-center justify-center rounded-full bg-(--bg-muted) text-fg-secondary">
        <Icon name={icon} size={20} />
      </span>
      <span className="text-sm font-medium text-fg-primary">{label}</span>
      {hint ? <span className="text-xs text-fg-tertiary">{hint}</span> : null}
    </label>
  )
}
