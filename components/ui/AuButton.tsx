import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cn } from "@/lib/utils"
import { Icon } from "./Icon"

export type AuButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "subtle"
  | "danger"
  | "ai"
  | "ai-spectrum"
  | "ai-outline"

export type AuButtonSize = "sm" | "md" | "lg"

export type AuButtonProps = Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  "size"
> & {
  variant?: AuButtonVariant
  size?: AuButtonSize
  iconLeft?: string
  iconRight?: string
  iconOnly?: string
  loading?: boolean
  block?: boolean
  asChild?: boolean
}

export const AuButton = React.forwardRef<HTMLButtonElement, AuButtonProps>(
  function AuButton(
    {
      variant = "secondary",
      size = "md",
      iconLeft,
      iconRight,
      iconOnly,
      loading,
      block,
      disabled,
      asChild,
      children,
      className,
      ...rest
    },
    ref
  ) {
    const iconSize = iconOnly
      ? size === "sm"
        ? 22
        : size === "lg"
          ? 26
          : 24
      : size === "sm"
        ? 18
        : size === "lg"
          ? 24
          : 22
    const className_ = cn(
      "au-btn",
      `au-btn--${variant}`,
      `au-btn--${size}`,
      iconOnly && "au-btn--icon",
      block && "au-btn--block",
      loading && "au-btn--loading",
      className,
    )

    if (asChild) {
      // Slot precisa de um único child. Clonamos o elemento passado
      // (geralmente um <Link>) e injetamos o label dele DENTRO,
      // cercado pelos ícones — assim o markup final tem 1 root só.
      const child = React.Children.only(
        children as React.ReactElement<{ children?: React.ReactNode }>,
      )
      const childLabel = child.props.children
      const newChild = React.cloneElement(
        child,
        {},
        iconOnly ? (
          <Icon name={iconOnly} size={iconSize} weight={300} />
        ) : (
          <>
            {iconLeft && <Icon name={iconLeft} size={iconSize} weight={300} />}
            <span className="au-btn__label">{childLabel}</span>
            {iconRight && <Icon name={iconRight} size={iconSize} weight={300} />}
            {loading && <span aria-hidden="true" className="au-btn__spinner" />}
          </>
        ),
      )
      return (
        <Slot
          ref={ref}
          aria-busy={loading || undefined}
          className={className_}
          {...rest}
        >
          {newChild}
        </Slot>
      )
    }

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        className={className_}
        {...rest}
      >
        {iconOnly ? (
          <Icon name={iconOnly} size={iconSize} weight={300} />
        ) : (
          <>
            {iconLeft && <Icon name={iconLeft} size={iconSize} weight={300} />}
            <span className="au-btn__label">{children}</span>
            {iconRight && <Icon name={iconRight} size={iconSize} weight={300} />}
          </>
        )}
        {loading && <span aria-hidden="true" className="au-btn__spinner" />}
      </button>
    )
  }
)

