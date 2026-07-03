"use client"

import * as React from "react"

export type HotkeySpec = {
  key: string
  meta?: boolean
  ctrl?: boolean
  shift?: boolean
  alt?: boolean
}

function matches(e: KeyboardEvent, spec: HotkeySpec): boolean {
  if (e.key.toLowerCase() !== spec.key.toLowerCase()) return false
  if (Boolean(spec.meta) !== e.metaKey) return false
  if (Boolean(spec.ctrl) !== e.ctrlKey) return false
  if (Boolean(spec.shift) !== e.shiftKey) return false
  if (Boolean(spec.alt) !== e.altKey) return false
  return true
}

export function useGlobalHotkey(
  spec: HotkeySpec,
  handler: (e: KeyboardEvent) => void
): void {
  const handlerRef = React.useRef(handler)
  handlerRef.current = handler

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (matches(e, spec)) {
        e.preventDefault()
        handlerRef.current(e)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [spec.key, spec.meta, spec.ctrl, spec.shift, spec.alt])
}
