"use client"

import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { cn } from "@/lib/utils"
import { Icon } from "./Icon"

export type AuModalSize = "md" | "cockpit"

export type AuModalProps = {
  open: boolean
  onClose: () => void
  title?: string
  /** Optional adornment rendered to the right of the title (e.g. a status pill). */
  titleAdornment?: React.ReactNode
  children: React.ReactNode
  footer?: React.ReactNode
  dismissible?: boolean
  size?: AuModalSize
  /** Override the default stacking (content `1001`, scrim `1000`). The scrim
   * is placed one below. Used by Review Mode to sit above app-level modals. */
  zIndex?: number
  /** For sequential (wizard) modals: change `stepKey` on every step. The body is
   * remounted and re-animates (`au-wizard-step-in`), giving you the forward
   * transition without the caller asking for it. Without `stepKey`, behavior is
   * unchanged. */
  stepKey?: string | number
}

export function AuModal({
  open,
  onClose,
  title,
  titleAdornment,
  children,
  footer,
  dismissible = true,
  size = "md",
  zIndex,
  stepKey,
}: AuModalProps) {
  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className="au-modal-scrim"
          style={zIndex !== undefined ? { zIndex: zIndex - 1 } : undefined}
        />
        {/* Radix Portal renders Overlay and Content as siblings; the original
         * .au-modal-scrim relied on flex centering of its child .au-modal.
         * This wrapper recreates that centering layer without touching globals.css. */}
        <div
          className="fixed inset-0 z-1001 flex items-center justify-center p-6 pointer-events-none"
          style={zIndex !== undefined ? { zIndex } : undefined}
        >
          <DialogPrimitive.Content
            className={cn(
              "au-modal pointer-events-auto",
              `au-modal--${size}`
            )}
            onPointerDownOutside={(e) => {
              if (!dismissible) e.preventDefault()
            }}
            onInteractOutside={(e) => {
              if (!dismissible) e.preventDefault()
            }}
          >
            {title ? (
              <header className="au-modal__head">
                <div className="flex min-w-0 items-center gap-2">
                  <DialogPrimitive.Title className="au-modal__title">
                    {title}
                  </DialogPrimitive.Title>
                  {titleAdornment}
                </div>
                <DialogPrimitive.Close
                  className="au-modal__close"
                  aria-label="Close"
                >
                  <Icon name="close" size={18} />
                </DialogPrimitive.Close>
              </header>
            ) : (
              <DialogPrimitive.Title className="sr-only">
                Modal
              </DialogPrimitive.Title>
            )}
            <div
              key={stepKey}
              className={cn(
                "au-modal__body",
                stepKey !== undefined && "au-wizard-step"
              )}
            >
              {children}
            </div>
            {footer && <footer className="au-modal__foot">{footer}</footer>}
          </DialogPrimitive.Content>
        </div>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
