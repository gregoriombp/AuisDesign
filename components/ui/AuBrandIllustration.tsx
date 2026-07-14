import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * AuBrandIllustration — ilustrações line-art da marca Auis.
 *
 * Linguagem: geometria 1px, nada orgânico. Stroke/fill = currentColor, então a
 * mesma arte funciona em painel claro (tinta) e escuro (branco). As duas artes
 * oficiais do rebranding ("layers", "ignition") são geradas aqui de forma
 * paramétrica, fiéis aos vetores em public/assets/brand/illustrations/ — que
 * permanecem como fonte para export (deck, social, print). As demais estendem
 * a família com os símbolos da narrativa (constelação, órbita, whitefield,
 * ascensão).
 */

export type AuBrandIllustrationName =
  | "layers"
  | "ignition"
  | "constellation"
  | "orbit"
  | "field"
  | "ascent"
  // Geometric-Strokes do rebranding — vetores reais em /public, renderizados
  // via CSS mask para herdar currentColor (themeáveis como as paramétricas).
  | "shape-01"
  | "shape-02"
  | "shape-03"
  | "shape-04"
  | "shape-05"

export type AuBrandIllustrationProps = {
  name: AuBrandIllustrationName
  /** Lado do quadrado em px. */
  size?: number
  strokeWidth?: number
  className?: string
  /** Acessibilidade: descrição curta; omita para decorativo (aria-hidden). */
  title?: string
}

/* Determinístico (sem Math.random): variações estáveis entre SSR e cliente. */
function jitter(i: number, mod: number): number {
  return ((i * 7919 + 104729) % mod) / mod
}

/* ── layers — 6 losangos isométricos empilhados (Knowledge Layers) ───────── */
const LAYERS_DIAMONDS = Array.from({ length: 6 }, (_, i) => {
  const cy = 72 + i * 51
  return `200,${cy - 51} 350,${cy} 200,${cy + 51} 50,${cy}`
})

/* ── ignition — explosão radial (a saída da atmosfera) ───────────────────── */
const IGNITION_RAYS = Array.from({ length: 36 }, (_, i) => {
  const angle = (i / 36) * Math.PI * 2 + jitter(i, 97) * 0.16
  const inner = 6 + jitter(i + 7, 53) * 8
  const len = 64 + jitter(i + 3, 89) * 116
  const cx = 200
  const cy = 208
  return {
    x1: cx + Math.cos(angle) * inner,
    y1: cy + Math.sin(angle) * inner,
    x2: cx + Math.cos(angle) * (inner + len),
    y2: cy + Math.sin(angle) * (inner + len),
  }
})

/* ── constellation — Copilot (hexágono) cercado de agentes (círculos) ─────── */
const HEX_POINTS = Array.from({ length: 6 }, (_, i) => {
  const a = (i / 6) * Math.PI * 2 - Math.PI / 2
  return `${200 + Math.cos(a) * 34},${200 + Math.sin(a) * 34}`
}).join(" ")

const CONSTELLATION_NODES = Array.from({ length: 7 }, (_, i) => {
  const a = (i / 7) * Math.PI * 2 - Math.PI / 2 + jitter(i, 71) * 0.5
  const r = 104 + jitter(i + 2, 61) * 52
  return { x: 200 + Math.cos(a) * r, y: 200 + Math.sin(a) * r }
})

/* ── orbit — operação contínua (elipses concêntricas + nós) ──────────────── */
const ORBIT_RINGS = [150, 110, 70]
const ORBIT_NODES = [
  { rx: 150, t: 0.62 },
  { rx: 110, t: 0.13 },
  { rx: 110, t: 0.78 },
  { rx: 70, t: 0.4 },
].map(({ rx, t }) => {
  const a = t * Math.PI * 2
  // Ponto sobre a elipse (antes da rotação do grupo).
  return { x: 200 + Math.cos(a) * rx, y: 200 + Math.sin(a) * rx * 0.38 }
})

/* ── field — o whitefield em perspectiva (grade de pontos) ───────────────── */
const FIELD_DOTS = (() => {
  const dots: { x: number; y: number; r: number }[] = []
  const horizon = 150
  for (let row = 0; row < 8; row++) {
    const t = row / 7
    const y = horizon + 14 + Math.pow(t, 1.65) * 196
    const spread = 60 + t * 140
    const count = 9
    for (let col = 0; col < count; col++) {
      const u = col / (count - 1)
      dots.push({
        x: 200 + (u - 0.5) * 2 * spread,
        y,
        r: 1.2 + t * 1.9,
      })
    }
  }
  return dots
})()

/* ── ascent — receita/ignição em ritmo (linhas verticais crescentes) ─────── */
const ASCENT_BARS = Array.from({ length: 14 }, (_, i) => {
  const t = i / 13
  const x = 64 + i * 21
  const h = 24 + Math.pow(t, 1.7) * 232 + jitter(i, 37) * 14
  return { x, y1: 332, y2: 332 - h }
})

/* Geometric-Strokes importadas: o vetor mora em /public e é pintado via CSS
 * mask, então a arte herda currentColor (claro/escuro) como as paramétricas.
 * O traço já vem encorpado no arquivo; `strokeWidth` não se aplica a estas. */
const STROKE_SHAPE_SRC: Partial<Record<AuBrandIllustrationName, string>> = {
  "shape-01": "/assets/brand/illustrations/auis-shape-01.svg",
  "shape-02": "/assets/brand/illustrations/auis-shape-02.svg",
  "shape-03": "/assets/brand/illustrations/auis-shape-03.svg",
  "shape-04": "/assets/brand/illustrations/auis-shape-04.svg",
  "shape-05": "/assets/brand/illustrations/auis-shape-05.svg",
}

export function AuBrandIllustration({
  name,
  size = 240,
  strokeWidth = 1.4,
  className,
  title,
}: AuBrandIllustrationProps) {
  const strokeSrc = STROKE_SHAPE_SRC[name]
  if (strokeSrc) {
    return (
      <span
        role={title ? "img" : undefined}
        aria-label={title}
        aria-hidden={title ? undefined : true}
        className={cn("inline-block shrink-0", className)}
        style={{
          width: size,
          height: size,
          backgroundColor: "currentColor",
          WebkitMaskImage: `url("${strokeSrc}")`,
          maskImage: `url("${strokeSrc}")`,
          WebkitMaskRepeat: "no-repeat",
          maskRepeat: "no-repeat",
          WebkitMaskPosition: "center",
          maskPosition: "center",
          WebkitMaskSize: "contain",
          maskSize: "contain",
        }}
      />
    )
  }

  return (
    <svg
      viewBox="0 0 400 400"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("shrink-0", className)}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
    >
      {title ? <title>{title}</title> : null}

      {name === "layers" &&
        LAYERS_DIAMONDS.map((points) => <polygon key={points} points={points} />)}

      {name === "ignition" &&
        IGNITION_RAYS.map((r, i) => (
          <line key={i} x1={r.x1} y1={r.y1} x2={r.x2} y2={r.y2} />
        ))}

      {name === "constellation" && (
        <>
          {CONSTELLATION_NODES.map((n, i) => (
            <React.Fragment key={i}>
              <line x1={200} y1={200} x2={n.x} y2={n.y} opacity={0.55} />
              <circle cx={n.x} cy={n.y} r={7} />
            </React.Fragment>
          ))}
          <line
            x1={CONSTELLATION_NODES[1].x}
            y1={CONSTELLATION_NODES[1].y}
            x2={CONSTELLATION_NODES[2].x}
            y2={CONSTELLATION_NODES[2].y}
            opacity={0.35}
          />
          <line
            x1={CONSTELLATION_NODES[4].x}
            y1={CONSTELLATION_NODES[4].y}
            x2={CONSTELLATION_NODES[5].x}
            y2={CONSTELLATION_NODES[5].y}
            opacity={0.35}
          />
          <polygon points={HEX_POINTS} fill="currentColor" stroke="none" />
        </>
      )}

      {name === "orbit" && (
        <g transform="rotate(-18 200 200)">
          {ORBIT_RINGS.map((rx) => (
            <ellipse key={rx} cx={200} cy={200} rx={rx} ry={rx * 0.38} />
          ))}
          {ORBIT_NODES.map((n, i) => (
            <circle key={i} cx={n.x} cy={n.y} r={5.5} fill="currentColor" stroke="none" />
          ))}
        </g>
      )}

      {name === "field" && (
        <>
          <line x1={36} y1={150} x2={364} y2={150} opacity={0.4} />
          {FIELD_DOTS.map((d, i) => (
            <circle key={i} cx={d.x} cy={d.y} r={d.r} fill="currentColor" stroke="none" />
          ))}
        </>
      )}

      {name === "ascent" &&
        ASCENT_BARS.map((b, i) => (
          <line key={i} x1={b.x} y1={b.y1} x2={b.x} y2={b.y2} />
        ))}
    </svg>
  )
}
