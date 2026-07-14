import * as React from "react"
import { cn } from "@/lib/utils"

export type AuSliderProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "type" | "className"
> & {
  label?: React.ReactNode
  valueDisplay?: React.ReactNode
  help?: React.ReactNode
  className?: string
}

export const AuSlider = React.forwardRef<HTMLInputElement, AuSliderProps>(
  function AuSlider(
    { label, valueDisplay, help, className, min = 0, max = 100, value, defaultValue, style, ...rest },
    ref
  ) {
    // Progress from the left up to the thumb — fills the track with a dark bg.
    // Reads value (controlled) or defaultValue (uncontrolled); falls back to min.
    const current = Number(value ?? defaultValue ?? min)
    const lo = Number(min)
    const hi = Number(max)
    const progress = hi > lo ? Math.min(100, Math.max(0, ((current - lo) / (hi - lo)) * 100)) : 0
    return (
      <div className={cn("au-slider", className)}>
        {(label || valueDisplay !== undefined) && (
          <div className="au-slider__top">
            <span>{label}</span>
            {valueDisplay !== undefined && <b>{valueDisplay}</b>}
          </div>
        )}
        <input
          ref={ref}
          type="range"
          min={min}
          max={max}
          value={value}
          defaultValue={defaultValue}
          className="au-slider__rng"
          style={{ ["--au-slider-progress" as string]: `${progress}%`, ...style }}
          {...rest}
        />
        {help && <div className="au-slider__help">{help}</div>}
      </div>
    )
  }
)
