"use client"

import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { cn } from "./cn"
import { Icon } from "./Icon"
import { useChromePortal } from "../ChromeScope"

export type SheetSize = "default" | "wide" | "xwide"

export type SheetProps = {
  open: boolean
  onClose: () => void
  title?: React.ReactNode
  meta?: React.ReactNode
  tabs?: React.ReactNode
  footer?: React.ReactNode
  children: React.ReactNode
  dismissible?: boolean
  /** "default" (520px) for detail views, "wide" (1080px) for two-pane editors, "xwide" (1440px) for full prototype previews. */
  size?: SheetSize
  /** Hotkeys to navigate between items in the parent list (↑/↓). */
  onPrev?: () => void
  onNext?: () => void
  /** Override the default stacking (content `1001`, scrim `1000`). The scrim
   * is placed one below. Used by Review Mode to sit above app-level modals. */
  zIndex?: number
  /** Escape hatch for compound layouts that own their inner padding/scroll. */
  bodyClassName?: string
}

export function Sheet({
  open,
  onClose,
  title,
  meta,
  tabs,
  footer,
  children,
  dismissible = true,
  size = "default",
  onPrev,
  onNext,
  zIndex,
  bodyClassName,
}: SheetProps) {
  const container = useChromePortal()
  React.useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowUp" && onPrev) {
        e.preventDefault()
        onPrev()
      } else if (e.key === "ArrowDown" && onNext) {
        e.preventDefault()
        onNext()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onPrev, onNext])

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
    >
      <DialogPrimitive.Portal container={container}>
        <DialogPrimitive.Overlay
          className="auis-sheet-scrim"
          style={zIndex !== undefined ? { zIndex: zIndex - 1 } : undefined}
        />
        {/* Radix Portal renders Overlay and Content as siblings; the original
         * .auis-sheet-scrim used flex justify-end to dock its child .auis-sheet
         * to the right edge. This wrapper recreates that dock without
         * touching globals.css. */}
        <div
          className="fixed inset-0 z-1001 flex justify-end pointer-events-none"
          style={zIndex !== undefined ? { zIndex } : undefined}
        >
          <DialogPrimitive.Content
            aria-label={typeof title === "string" ? title : "Side panel"}
            className={cn(
              "auis-sheet pointer-events-auto",
              `auis-sheet--${size}`
            )}
            onPointerDownOutside={(e) => {
              if (!dismissible) e.preventDefault()
            }}
            onInteractOutside={(e) => {
              if (!dismissible) e.preventDefault()
            }}
          >
            {(title || meta) && (
              <header className="auis-sheet__top">
                <div>
                  {title &&
                    (typeof title === "string" ? (
                      <DialogPrimitive.Title className="auis-sheet__title">
                        {title}
                      </DialogPrimitive.Title>
                    ) : (
                      <DialogPrimitive.Title asChild>
                        <h2 className="auis-sheet__title">{title}</h2>
                      </DialogPrimitive.Title>
                    ))}
                  {meta && <div className="auis-sheet__meta">{meta}</div>}
                </div>
                <DialogPrimitive.Close
                  className="auis-sheet__close"
                  aria-label="Close"
                >
                  <Icon name="close" size={18} />
                </DialogPrimitive.Close>
              </header>
            )}
            {!title && !meta && (
              <DialogPrimitive.Title className="sr-only">
                Side panel
              </DialogPrimitive.Title>
            )}
            {tabs && <div className="auis-sheet__tabs">{tabs}</div>}
            <div className={cn("auis-sheet__body", bodyClassName)}>{children}</div>
            {footer && <footer className="auis-sheet__foot">{footer}</footer>}
          </DialogPrimitive.Content>
        </div>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

export function SheetTab({
  active,
  children,
  onClick,
}: {
  active?: boolean
  children: React.ReactNode
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "auis-sheet__tab",
        active && "auis-sheet__tab--active"
      )}
    >
      {children}
    </button>
  )
}

export function SheetRow({
  label,
  children,
  mono,
}: {
  label: React.ReactNode
  children: React.ReactNode
  mono?: boolean
}) {
  return (
    <div className="auis-sheet__row">
      <span className="auis-sheet__row-k">{label}</span>
      <span className={cn("auis-sheet__row-v", mono && "mono")}>
        {children}
      </span>
    </div>
  )
}
