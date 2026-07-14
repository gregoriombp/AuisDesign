"use client"

import * as React from "react"
import { Icon } from "./Icon"

export type AuInputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  invalid?: boolean
  dense?: boolean
  iconLeft?: string
  /** When the input is type="password", shows a reveal button (the eye) that
   *  toggles between password and text. */
  revealable?: boolean
}

export const AuInput = React.forwardRef<HTMLInputElement, AuInputProps>(
  function AuInput(
    {
      invalid,
      dense,
      iconLeft,
      revealable,
      type,
      className,
      disabled,
      value,
      defaultValue,
      onChange,
      ...rest
    },
    ref
  ) {
    const isSearch = iconLeft === "search"
    const innerRef = React.useRef<HTMLInputElement | null>(null)
    React.useImperativeHandle(
      ref,
      () => innerRef.current as HTMLInputElement
    )

    const isControlled = value !== undefined
    const [internalValue, setInternalValue] = React.useState<string>(
      typeof defaultValue === "string" ? defaultValue : ""
    )
    const currentValue = isControlled
      ? value == null
        ? ""
        : String(value)
      : internalValue
    const showClear = isSearch && !disabled && currentValue.length > 0

    const [revealed, setRevealed] = React.useState(false)
    const canReveal = !!revealable && type === "password" && !disabled
    const inputType = canReveal && revealed ? "text" : type

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!isControlled) setInternalValue(e.target.value)
      onChange?.(e)
    }

    // Native input.value setter + bubbling input event is the React-compatible
    // way to clear a controlled input from outside the consumer's onChange.
    const clearValue = () => {
      const node = innerRef.current
      if (!node) return
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value"
      )?.set
      setter?.call(node, "")
      node.dispatchEvent(new Event("input", { bubbles: true }))
      if (!isControlled) setInternalValue("")
      node.focus()
    }

    const wrapperClasses = [
      "au-input",
      invalid && "au-input--invalid",
      dense && "au-input--dense",
      disabled && "au-input--disabled",
      isSearch && "au-input--search",
      className,
    ]
      .filter(Boolean)
      .join(" ")
    return (
      <div className={wrapperClasses}>
        {iconLeft && <Icon name={iconLeft} size={isSearch ? 18 : 16} />}
        <input
          ref={innerRef}
          type={inputType}
          disabled={disabled}
          value={isControlled ? currentValue : undefined}
          defaultValue={isControlled ? undefined : defaultValue}
          onChange={handleChange}
          {...rest}
        />
        {showClear && (
          <button
            type="button"
            className="au-input__clear"
            aria-label="Clear search"
            tabIndex={-1}
            onClick={clearValue}
          >
            <Icon name="cancel" size={18} />
          </button>
        )}
        {canReveal && (
          <button
            type="button"
            className="au-input__reveal"
            aria-label={revealed ? "Hide password" : "Show password"}
            aria-pressed={revealed}
            tabIndex={-1}
            onClick={() => setRevealed((r) => !r)}
          >
            <Icon name={revealed ? "visibility_off" : "visibility"} size={18} />
          </button>
        )}
      </div>
    )
  }
)

export type AuFieldProps = {
  label: string
  error?: string
  helper?: string
  htmlFor?: string
  children: React.ReactNode
  className?: string
  /**
   * "default" — label stacked above the field (the system default, used by
   * dense/multi-field forms). "framed" — notched-outline style where the label
   * sits on the field's border and the value renders large; reserved for
   * low-density, high-touch screens (login, account identity). Both pull from
   * the same tokens — framed is opt-in, never the global default.
   */
  variant?: "default" | "framed"
}

export function AuField({
  label,
  error,
  helper,
  htmlFor,
  children,
  className,
  variant = "default",
}: AuFieldProps) {
  if (variant === "framed") {
    // Native <fieldset>/<legend> gives us a real notch — the border genuinely
    // breaks around the label, so it works on any surface and in dark mode
    // without matching a background color. The inner AuInput's own frame is
    // neutralized in CSS; the fieldset owns the border + focus ring.
    const invalid = Boolean(error)
    return (
      <div
        className={["au-field-framed-wrap", className].filter(Boolean).join(" ")}
      >
        <fieldset
          className={[
            "au-field--framed",
            invalid && "au-field--framed-invalid",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <legend className="au-field__legend">{label}</legend>
          {children}
        </fieldset>
        {error ? (
          <div className="au-field__error">
            <Icon name="error" size={12} /> {error}
          </div>
        ) : helper ? (
          <div className="au-field__helper">{helper}</div>
        ) : null}
      </div>
    )
  }

  return (
    <div className={["au-field", className].filter(Boolean).join(" ")}>
      <label className="au-field__label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {error ? (
        <div className="au-field__error">
          <Icon name="error" size={12} /> {error}
        </div>
      ) : helper ? (
        <div className="au-field__helper">{helper}</div>
      ) : null}
    </div>
  )
}
