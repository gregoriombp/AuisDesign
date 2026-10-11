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
      data-slot="au-empty"
      className={cx("au-empty", className)}
      {...rest}
    />
  )
}

export function EmptyHeader({ className, ...rest }: DivProps) {
  return (
    <div
      data-slot="au-empty-header"
      className={cx("au-empty__header", className)}
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
      data-slot="au-empty-media"
      data-variant={variant}
      className={cx(
        "au-empty__media",
        variant === "icon" && "au-empty__media--icon",
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
      data-slot="au-empty-title"
      className={cx("au-empty__title", className)}
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
      data-slot="au-empty-description"
      className={cx("au-empty__description", className)}
      {...rest}
    />
  )
}

export function EmptyContent({ className, ...rest }: DivProps) {
  return (
    <div
      data-slot="au-empty-content"
      className={cx("au-empty__content", className)}
      {...rest}
    />
  )
}
