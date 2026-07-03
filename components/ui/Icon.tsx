import * as React from "react"

export type IconWeight = 200 | 300 | 400 | 500 | 600 | 700
export type IconGrade = -25 | 0 | 200

export type IconProps = {
  name: string
  size?: number
  fill?: 0 | 1
  weight?: IconWeight
  grade?: IconGrade
  /** Material Symbols optical-size axis. Defaults to a legibility clamp:
   *  small UI icons still render with opsz >= 20 instead of becoming hairlines. */
  opticalSize?: number
  /** Only the agent glyph (`name="agent"`) reads this — set `false` to render
   *  it as a still line (dense lists, perf-sensitive surfaces). Default `true`. */
  animated?: boolean
  /** Only the agent glyph (`name="agent"`) reads this — set `true` to stroke
   *  the gesture with the brand iridescent gradient (azul → lavanda → pêssego)
   *  instead of `currentColor`. For heros / agent hero moments. Default `false`. */
  gradient?: boolean
  className?: string
  style?: React.CSSProperties
}

export function Icon({
  name,
  size = 20,
  fill = 0,
  weight,
  grade,
  opticalSize,
  animated = true,
  gradient = false,
  className,
  style,
}: IconProps) {
  const optics = resolveIconOptics({ size, fill, weight, grade, opticalSize })

  if (name === "agent" || name === "gesture") {
    // The brand mark for "an Agent" in icon form — replaces the robot
    // (`smart_toy`). A self-drawing gesture line; see AgentGlyph below.
    return (
      <AgentGlyph
        size={size}
        weight={optics.weight}
        animated={animated}
        gradient={gradient}
        className={className}
        style={style}
      />
    )
  }
  if (name === "agent_studio") {
    return (
      <AgentStudioGlyph size={size} className={className} style={style} />
    )
  }
  // (memory_base custom glyph removed — was an origin-product icon; falls through
  //  to the default Material Symbols rendering.)
  return (
    <span
      aria-hidden="true"
      className={
        "material-symbols-rounded au-icon" + (className ? " " + className : "")
      }
      style={{
        fontSize: size,
        lineHeight: 1,
        fontVariationSettings: `'FILL' ${fill}, 'wght' ${optics.weight}, 'GRAD' ${optics.grade}, 'opsz' ${optics.opticalSize}`,
        ...style,
      }}
    >
      {name}
    </span>
  )
}

export function resolveIconOptics({
  size,
  fill,
  weight,
  grade,
  opticalSize,
}: {
  size: number
  fill?: IconProps["fill"]
  weight?: IconWeight
  grade?: IconGrade
  opticalSize?: number
}) {
  return {
    weight: weight ?? defaultIconWeight(size, fill),
    grade: grade ?? defaultIconGrade(size),
    opticalSize: clampIconOpticalSize(opticalSize ?? size),
  }
}

function defaultIconWeight(size: number, fill: IconProps["fill"] = 0): number {
  // Compensação óptica: glifos pequenos precisam de mais traço pra não virar
  // fio (somem em cor de baixo contraste); glifos grandes podem afinar. Contínuo
  // no eixo wght do Material Symbols (100–700). 12→~480, 20→~420, 32→~340, 48→~250.
  const base = Math.max(250, Math.min(520, Math.round((560 - size * 7) / 10) * 10))
  return fill ? Math.min(600, base + 40) : base
}

function defaultIconGrade(size: number): number {
  // GRAD engrossa o traço SEM mudar o footprint do glifo — reforço extra de
  // legibilidade nos tamanhos pequenos / cores fracas.
  if (size <= 16) return 200
  if (size <= 20) return 50
  return 0
}

function clampIconOpticalSize(size: number) {
  return Math.min(48, Math.max(20, size))
}

/** Agent Studio brand glyph. The design is a multi-tone radial dot pattern
 *  with intentionally hand-tuned variants at each canonical size — so we ship
 *  one SVG per size and snap to the nearest master, rather than scaling one
 *  vector. Colors are baked into the asset and don't follow currentColor. */
const AGENT_STUDIO_SIZES = [12, 16, 20, 24, 28, 32] as const

function AgentStudioGlyph({
  size,
  className,
  style,
}: {
  size: number
  className?: string
  style?: React.CSSProperties
}) {
  const snap = AGENT_STUDIO_SIZES.reduce((best, candidate) =>
    Math.abs(candidate - size) < Math.abs(best - size) ? candidate : best,
  )
  return (
    <span
      aria-hidden="true"
      className={"au-icon" + (className ? " " + className : "")}
      style={{
        display: "inline-flex",
        width: size,
        height: size,
        lineHeight: 0,
        ...style,
      }}
    >
      <img
        src={`/assets/icons/agent-studio/${snap}.svg`}
        alt=""
        width={size}
        height={size}
        style={{ display: "block" }}
      />
    </span>
  )
}

/** The "gesture" mark — how an **Agent** is drawn as an icon, the brand
 *  alternative to a robot/`smart_toy`. One continuous stroke that draws itself
 *  in an endless loop (the motion lives in `.au-agent-glyph` in globals.css).
 *
 *  It still behaves like any glyph: inherits `currentColor`, scales with
 *  `size`, and its stroke thickness tracks the `weight` axis so it sits beside
 *  the Material Symbols set. Exposed through `Icon` so it's a drop-in for
 *  `<Icon name="smart_toy" />`. The animation auto-stops under
 *  `prefers-reduced-motion`; pass `animated={false}` to force a still line.
 *  A sanctioned raw-SVG agent visual (see AGENTS.md → Icons). */
const AGENT_GESTURE_PATH =
  "M2.7 15.6 C4.3 11.3 6.6 10.8 8 13.2 C8.95 14.9 8.4 16.8 7.1 16.5 C5.8 16.2 5.9 13.8 8.1 12.9 C10.5 11.9 12.3 13.1 13.5 15 C14.4 16.4 16 16.5 17.3 15.2 C19 13.5 18.3 10.7 16.4 10.9 C15.1 11.05 14.8 12.7 16.1 13.3"

function AgentGlyph({
  size,
  weight,
  animated,
  gradient,
  className,
  style,
}: {
  size: number
  weight: number
  animated: boolean
  gradient: boolean
  className?: string
  style?: React.CSSProperties
}) {
  // 200 (thin) ≈ 1.5; heavier `weight` reads heavier.
  const strokeWidth = 1.5 + ((weight - 200) / 100) * 0.3
  return (
    <span
      aria-hidden="true"
      className={
        "au-icon au-agent-glyph" +
        (animated ? " is-animated" : "") +
        (gradient ? " is-gradient" : "") +
        (className ? " " + className : "")
      }
      style={{ width: size, height: size, ...style }}
    >
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        {gradient && (
          <defs>
            {/* Brand iridescent stroke — sky blue → lavender → peach. Colors are
             *  existing ramp tokens (no new tokens; AGENTS.md → Tokens).
             *  gradientUnits is objectBoundingBox (default) so this one shared
             *  id maps to each glyph's own box — correct at every size. CSS in
             *  globals.css points the stroke at it (`.is-gradient path`). */}
            <linearGradient id="au-agent-gradient" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" style={{ stopColor: "var(--au-blue-500)" }} />
              <stop offset="50%" style={{ stopColor: "var(--au-purple-500)" }} />
              <stop offset="100%" style={{ stopColor: "var(--au-pink-400)" }} />
            </linearGradient>
          </defs>
        )}
        <path d={AGENT_GESTURE_PATH} strokeWidth={strokeWidth} pathLength={1} />
      </svg>
    </span>
  )
}
