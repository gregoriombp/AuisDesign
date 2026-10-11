"use client"

import * as React from "react"
import * as ToastPrimitives from "@radix-ui/react-toast"
import { cn } from "./cn"
import { Icon } from "./Icon"

export type ToastVariant = "success" | "ai" | "error" | "warning" | "info"

type ToastAction = { label: string; onClick: () => void }

export type ToastOptions = {
  title: React.ReactNode
  description?: React.ReactNode
  variant?: ToastVariant
  icon?: string
  /** Auto-dismiss timeout in ms. 0 keeps the toast until manually dismissed. */
  duration?: number
  action?: ToastAction
}

type ToastEntry = ToastOptions & {
  id: number
  leaving?: boolean
}

type ToastContextValue = {
  push: (opts: ToastOptions) => number
  dismiss: (id: number) => void
}

const ToastContext = React.createContext<ToastContextValue | null>(null)

const DEFAULT_ICON: Record<ToastVariant, string> = {
  success: "check_circle",
  ai: "auto_awesome",
  error: "error",
  warning: "warning",
  info: "info",
}

/** Max 3 visible toasts at once; extras wait in the queue. */
const MAX_VISIBLE = 3

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastEntry[]>([])
  const idRef = React.useRef(1)

  const dismiss = React.useCallback((id: number) => {
    setToasts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, leaving: true } : t))
    )
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 160)
  }, [])

  const push = React.useCallback(
    (opts: ToastOptions) => {
      const id = idRef.current++
      const duration =
        opts.duration === undefined
          ? opts.action
            ? 8000
            : 4000
          : opts.duration
      setToasts((prev) => [...prev, { ...opts, id }])
      if (duration > 0) {
        window.setTimeout(() => dismiss(id), duration)
      }
      return id
    },
    [dismiss]
  )

  const value = React.useMemo(() => ({ push, dismiss }), [push, dismiss])
  const visible = toasts.slice(0, MAX_VISIBLE)

  return (
    <ToastContext.Provider value={value}>
      <ToastPrimitives.Provider swipeDirection="right" duration={Infinity}>
        {children}
        <ToastPrimitives.Viewport
          className="auis-toast-stack"
          aria-label="Notifications"
        >
          {visible.map((t) => (
            <ToastItem
              key={t.id}
              toast={t}
              onDismiss={() => dismiss(t.id)}
            />
          ))}
        </ToastPrimitives.Viewport>
      </ToastPrimitives.Provider>
    </ToastContext.Provider>
  )
}

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: ToastEntry
  onDismiss: () => void
}) {
  const variant = toast.variant ?? "success"
  const glyph = toast.icon ?? DEFAULT_ICON[variant]
  return (
    <ToastPrimitives.Root
      open={true}
      onOpenChange={(open) => {
        if (!open) onDismiss()
      }}
      duration={Infinity}
      className={cn(
        "auis-toast",
        `auis-toast--${variant}`,
        toast.leaving && "auis-toast--leaving"
      )}
    >
      <span className="auis-toast__icon">
        <Icon name={glyph} size={18} />
      </span>
      <div className="auis-toast__body">
        <ToastPrimitives.Title className="auis-toast__title">
          {toast.title}
        </ToastPrimitives.Title>
        {(toast.description || toast.action) && (
          <ToastPrimitives.Description className="auis-toast__desc">
            {toast.description}
            {toast.description && toast.action && " · "}
            {toast.action && (
              <ToastPrimitives.Action
                altText={toast.action.label}
                asChild
                onClick={() => {
                  toast.action!.onClick()
                  onDismiss()
                }}
              >
                <button type="button" className="auis-toast__action">
                  {toast.action.label}
                </button>
              </ToastPrimitives.Action>
            )}
          </ToastPrimitives.Description>
        )}
      </div>
      <ToastPrimitives.Close
        className="auis-toast__close"
        aria-label="Close notification"
      >
        ×
      </ToastPrimitives.Close>
    </ToastPrimitives.Root>
  )
}

export function useToast() {
  const ctx = React.useContext(ToastContext)
  if (!ctx) {
    throw new Error(
      "useToast must be used within <ToastProvider>. Wrap your tree in the provider at the layout root."
    )
  }
  return ctx
}
