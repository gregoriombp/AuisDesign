import * as React from "react"

export type AuLogoProps = {
  variant?: "wordmark" | "mark" | "horizontal"
  height?: number
  className?: string
  style?: React.CSSProperties
  "aria-label"?: string
}

/**
 * The Auis mark — the brand of the *builder itself*, not of the design system
 * it generates. It belongs to Auis's own chrome (`/auis/*`: the hub, the
 * styleguide shell, the floating dot) and must never be hardcoded into a
 * component that ships into the user's product. Components that need a brand
 * expose a `logo` slot the consumer fills instead.
 *
 * Inside the app, use the `<AuLogo />` component below: inline SVG with
 * `fill="currentColor"`, so it inherits the color of its context and needs no
 * light/dark asset pair.
 *
 * The single static export is for contexts where `currentColor` does not work
 * (email, decks, favicon, CSS `mask-image`). It is the only brand file this
 * repo ships, and it is the only path listed here.
 */
export const AU_LOGO_ASSET = "/assets/brand/auis-wordmark.svg"

/* Official geometry of the symbol: three blades fanned out, joined at the base,
 * with a harmonic 6° progression of tilt (15° · 21° · 27°). */
const SYMBOL_POLYGONS = (
  <>
    <polygon points="0,300 62.12,300 142.50,0 80.39,0" />
    <polygon points="62.12,300 126.39,300 209.30,84 145.03,84" />
    <polygon points="126.39,300 193.73,300 260.98,168 193.64,168" />
  </>
)

const WORDMARK_PATHS = (
  <>
    <path d="M201.58,275.02l-28.59-82.02h-102.98l-28.97,82.02H0L101.16,0h42.19l101.55,275.02h-43.31ZM161.52,159.53l-29.5-86.33c-3.29-9.39-7.19-21.96-9.65-30.05-2.57,8-6.6,20.46-9.88,30.05l-30.57,86.33h79.6Z" />
    <path d="M326.98,280.67c-54.3,0-85.97-25.45-89.16-71.65l-.22-3.21h37.1l.32,2.64c3.44,28.1,19.69,40.63,52.71,40.63,27.18,0,42.15-10.29,42.15-28.98s-11.49-24.28-48.41-32.06c-36.87-7.59-75-15.44-75-61.26,0-17.09,6.64-31.33,19.21-41.21,12.67-9.96,31.27-15.22,53.78-15.22,46.97,0,74.42,21.99,79.36,63.6l.4,3.35h-37.27l-.31-2.65c-2.82-23.99-15.66-34.22-42.92-34.22-23.3,0-36.13,8.82-36.13,24.84,0,18.18,15.3,22.04,49.9,29.04,34.81,7.03,74.27,15,74.27,64.27,0,19.66-7.89,35.79-22.82,46.64-13.9,10.1-33.58,15.44-56.93,15.44Z" />
    <path d="M568.14,275.02l-32.97-119.97c-2.49-8.94-5.12-10.47-6.97-19-1.95,8.53-4.69,10.07-7.19,19.02l-33.35,119.96h-36.08l-63.61-200.53h39.1l34.86,122.2c2.62,9.4,5.77,22.05,7.95,30.98,2.03-8.85,4.95-21.26,7.34-30.18l33.34-113h36.59l32.19,113.02c2.36,9.03,5.11,21.2,7.04,29.97,2.22-8.93,5.44-21.49,8.26-30.83l36.76-122.16h37.97l-65.55,200.53h-35.69Z" />
    <path d="M755.89,280.29c-28.63,0-53.19-10.73-71.01-31.03-16.8-19.13-26.05-45.52-26.05-74.32s9.25-55.19,26.05-74.32c17.83-20.3,42.38-31.03,71.01-31.03s53.3,10.73,70.98,31.04c16.58,19.05,25.71,45.43,25.71,74.31s-9.13,55.26-25.71,74.31c-17.68,20.3-42.22,31.04-70.98,31.04ZM755.89,100.82c-18.6,0-34,7.36-44.55,21.29-10,13.22-15.29,31.49-15.29,52.84s5.29,39.52,15.28,52.65c10.52,13.81,25.93,21.11,44.55,21.11s33.93-7.3,44.36-21.1c9.88-13.08,15.1-31.29,15.1-52.66s-5.22-39.67-15.11-52.85c-10.44-13.92-25.78-21.28-44.35-21.28Z" />
    <path d="M954.29,72.24c.17.28,11.91.96,15.42,3.23,0,0,0,34.38,0,34.38-33.38-7.6-70.64,8.85-71.11,54.19,0,0,0,110.99,0,110.99,0,0-36.48,0-36.48,0V74.5s36.48,0,36.48,0v26.83c14.06-18.35,34.37-29.08,55.7-29.08Z" />
    <polygon points="1116.54 275.02 1048.76 171.69 1023.71 195.43 1023.71 275.02 987.23 275.02 987.23 0 1023.71 0 1023.71 153.54 1104.9 74.5 1152.45 74.5 1074.28 147.93 1159.53 275.02 1116.54 275.02" />
    <text
      x="1171"
      y="60"
      fontFamily="Arial, Helvetica, sans-serif"
      fontSize="58"
    >
      ™
    </text>
  </>
)

/** Auis logo. Fill is currentColor so it adapts to light/dark surfaces. */
export function AuLogo({
  variant = "wordmark",
  height = 20,
  className,
  style,
  "aria-label": ariaLabel = "Auis",
}: AuLogoProps) {
  if (variant === "mark") {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 261 300"
        height={height}
        style={{ height, width: "auto", ...style }}
        className={className}
        role="img"
        aria-label={ariaLabel}
        fill="currentColor"
      >
        {SYMBOL_POLYGONS}
      </svg>
    )
  }
  if (variant === "horizontal") {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 1570.25 275"
        height={height}
        style={{ height, width: "auto", ...style }}
        className={className}
        role="img"
        aria-label={ariaLabel}
        fill="currentColor"
      >
        <g transform="scale(0.9166666666666666)">{SYMBOL_POLYGONS}</g>
        <g transform="translate(335.25,0)">{WORDMARK_PATHS}</g>
      </svg>
    )
  }
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 1235 275"
      height={height}
      style={{ height, width: "auto", ...style }}
      className={className}
      role="img"
      aria-label={ariaLabel}
      fill="currentColor"
    >
      {WORDMARK_PATHS}
    </svg>
  )
}
