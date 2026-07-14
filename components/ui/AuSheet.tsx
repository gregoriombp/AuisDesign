"use client"

import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { cn } from "@/lib/utils"
import { Icon } from "./Icon"

export type AuSheetSize = "default" | "wide" | "xwide"

export type AuSheetProps = {
  open: boolean
  onClose: () => void
  title?: React.ReactNode
  meta?: React.ReactNode
  tabs?: React.ReactNode
  footer?: React.ReactNode
  children: React.ReactNode
  dismissible?: boolean
  /** "default" (520px) for detail views, "wide" (1080px) for two-pane editors, "xwide" (1440px) for full prototype previews. */
  size?: AuSheetSize
  /** Hotkeys to navigate between items in the parent list (↑/↓). */
  onPrev?: () => void
  onNext?: () => void
  /** Override the default stacking (content `1001`, scrim `1000`). The scrim
   * is placed one below. Used by Review Mode to sit above app-level modals. */
  zIndex?: number
}

export function AuSheet({
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
}: AuSheetProps) {
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
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className="au-sheet-scrim"
          style={zIndex !== undefined ? { zIndex: zIndex - 1 } : undefined}
        />
        {/* Radix Portal renders Overlay and Content as siblings; the original
         * .au-sheet-scrim used flex justify-end to dock its child .au-sheet
         * to the right edge. This wrapper recreates that dock without
         * touching globals.css. */}
        <div
          className="fixed inset-0 z-1001 flex justify-end pointer-events-none"
          style={zIndex !== undefined ? { zIndex } : undefined}
        >
          <DialogPrimitive.Content
            aria-label={typeof title === "string" ? title : "Painel lateral"}
            className={cn(
              "au-sheet pointer-events-auto",
              `au-sheet--${size}`
            )}
            onPointerDownOutside={(e) => {
              if (!dismissible) e.preventDefault()
            }}
            onInteractOutside={(e) => {
              if (!dismissible) e.preventDefault()
            }}
          >
            {(title || meta) && (
              <header className="au-sheet__top">
                <div>
                  {title &&
                    (typeof title === "string" ? (
                      <DialogPrimitive.Title className="au-sheet__title">
                        {title}
                      </DialogPrimitive.Title>
                    ) : (
                      <DialogPrimitive.Title asChild>
                        <h2 className="au-sheet__title">{title}</h2>
                      </DialogPrimitive.Title>
                    ))}
                  {meta && <div className="au-sheet__meta">{meta}</div>}
                </div>
                <DialogPrimitive.Close
                  className="au-sheet__close"
                  aria-label="Close"
                >
                  <Icon name="close" size={18} />
                </DialogPrimitive.Close>
              </header>
            )}
            {!title && !meta && (
              <DialogPrimitive.Title className="sr-only">
                Painel lateral
              </DialogPrimitive.Title>
            )}
            {tabs && <div className="au-sheet__tabs">{tabs}</div>}
            <div className="au-sheet__body">{children}</div>
            {footer && <footer className="au-sheet__foot">{footer}</footer>}
          </DialogPrimitive.Content>
        </div>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

export function AuSheetTab({
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
        "au-sheet__tab",
        active && "au-sheet__tab--active"
      )}
    >
      {children}
    </button>
  )
}

export function AuSheetRow({
  label,
  children,
  mono,
}: {
  label: React.ReactNode
  children: React.ReactNode
  mono?: boolean
}) {
  return (
    <div className="au-sheet__row">
      <span className="au-sheet__row-k">{label}</span>
      <span className={cn("au-sheet__row-v", mono && "mono")}>
        {children}
      </span>
    </div>
  )
}
