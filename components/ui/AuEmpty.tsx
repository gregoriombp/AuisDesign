import * as React from "react"

/**
 * AuEmpty — empty / zero-state container. Composed primitives so each slot
 * can be styled independently. Port of shadcn/ui's `Empty` adapted to the
 * Auis token system (no shadcn dependency).
 *
 * <AuEmpty>
 *   <AuEmptyHeader>
 *     <AuEmptyMedia variant="icon"><Icon name="search_off" /></AuEmptyMedia>
 *     <AuEmptyTitle>No integrations found</AuEmptyTitle>
 *     <AuEmptyDescription>Try another term.</AuEmptyDescription>
 *   </AuEmptyHeader>
 *   <AuEmptyContent>...buttons...</AuEmptyContent>
 * </AuEmpty>
 */

type DivProps = React.HTMLAttributes<HTMLDivElement>

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ")
}

export function AuEmpty({ className, ...rest }: DivProps) {
  return (
    <div
      data-slot="au-empty"
      className={cx("au-empty", className)}
      {...rest}
    />
  )
}

export function AuEmptyHeader({ className, ...rest }: DivProps) {
  return (
    <div
      data-slot="au-empty-header"
      className={cx("au-empty__header", className)}
      {...rest}
    />
  )
}

export type AuEmptyMediaVariant = "default" | "icon"

export function AuEmptyMedia({
  variant = "default",
  className,
  ...rest
}: DivProps & { variant?: AuEmptyMediaVariant }) {
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

export function AuEmptyTitle({
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

export function AuEmptyDescription({
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

export function AuEmptyContent({ className, ...rest }: DivProps) {
  return (
    <div
      data-slot="au-empty-content"
      className={cx("au-empty__content", className)}
      {...rest}
    />
  )
}
