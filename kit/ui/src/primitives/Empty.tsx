import * as React from "react"

/**
 * Empty — empty / zero-state container. Composed primitives so each slot
 * can be styled independently. Port of shadcn/ui's `Empty` adapted to the
 * Auis token system (no shadcn dependency).
 *
 * <Empty>
 *   <EmptyHeader>
 *     <EmptyMedia variant="icon"><Icon name="search_off" /></EmptyMedia>
 *     <EmptyTitle>No integrations found</EmptyTitle>
 *     <EmptyDescription>Try another term.</EmptyDescription>
 *   </EmptyHeader>
 *   <EmptyContent>...buttons...</EmptyContent>
 * </Empty>
 */

type DivProps = React.HTMLAttributes<HTMLDivElement>

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ")
}

export function Empty({ className, ...rest }: DivProps) {
  return (
    <div
      data-slot="auis-empty"
      className={cx("auis-empty", className)}
      {...rest}
    />
  )
}

export function EmptyHeader({ className, ...rest }: DivProps) {
  return (
    <div
      data-slot="auis-empty-header"
      className={cx("auis-empty__header", className)}
      {...rest}
    />
  )
}

export type EmptyMediaVariant = "default" | "icon"

export function EmptyMedia({
  variant = "default",
  className,
  ...rest
}: DivProps & { variant?: EmptyMediaVariant }) {
  return (
    <div
      data-slot="auis-empty-media"
      data-variant={variant}
      className={cx(
        "auis-empty__media",
        variant === "icon" && "auis-empty__media--icon",
        className
      )}
      {...rest}
    />
  )
}

export function EmptyTitle({
  className,
  ...rest
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      data-slot="auis-empty-title"
      className={cx("auis-empty__title", className)}
      {...rest}
    />
  )
}

export function EmptyDescription({
  className,
  ...rest
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      data-slot="auis-empty-description"
      className={cx("auis-empty__description", className)}
      {...rest}
    />
  )
}

export function EmptyContent({ className, ...rest }: DivProps) {
  return (
    <div
      data-slot="auis-empty-content"
      className={cx("auis-empty__content", className)}
      {...rest}
    />
  )
}
