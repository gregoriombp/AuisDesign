import * as React from "react"
import { cn } from "@/lib/utils"

export type AuCardVariant = "default" | "ai" | "ai-warm" | "ai-cool"

export type AuCardProps = React.HTMLAttributes<HTMLDivElement> & {
  variant?: AuCardVariant
  interactive?: boolean
}

export const AuCard = React.forwardRef<HTMLDivElement, AuCardProps>(
  function AuCard(
    { variant = "default", interactive, className, children, tabIndex, ...rest },
    ref,
  ) {
    return (
      <div
        ref={ref}
        data-slot="card"
        className={cn(
          "au-card",
          `au-card--${variant}`,
          interactive && "au-card--interactive",
          className,
        )}
        tabIndex={interactive && tabIndex === undefined ? 0 : tabIndex}
        {...rest}
      >
        {children}
      </div>
    )
  },
)

export const AuCardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(function AuCardHeader({ className, ...rest }, ref) {
  return (
    <div
      ref={ref}
      data-slot="card-header"
      className={cn("au-card__header", className)}
      {...rest}
    />
  )
})

export const AuCardTitle = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(function AuCardTitle({ className, ...rest }, ref) {
  return (
    <div
      ref={ref}
      data-slot="card-title"
      className={cn("au-card__title", className)}
      {...rest}
    />
  )
})

export const AuCardDescription = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(function AuCardDescription({ className, ...rest }, ref) {
  return (
    <div
      ref={ref}
      data-slot="card-description"
      className={cn("au-card__description", className)}
      {...rest}
    />
  )
})

export const AuCardAction = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(function AuCardAction({ className, ...rest }, ref) {
  return (
    <div
      ref={ref}
      data-slot="card-action"
      className={cn("au-card__action", className)}
      {...rest}
    />
  )
})

export const AuCardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(function AuCardContent({ className, ...rest }, ref) {
  return (
    <div
      ref={ref}
      data-slot="card-content"
      className={cn("au-card__content", className)}
      {...rest}
    />
  )
})

export const AuCardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(function AuCardFooter({ className, ...rest }, ref) {
  return (
    <div
      ref={ref}
      data-slot="card-footer"
      className={cn("au-card__footer", className)}
      {...rest}
    />
  )
})
