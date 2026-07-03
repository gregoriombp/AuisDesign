"use client"

import * as React from "react"
import { useReviewStore } from "@/lib/auis-review/store"
import { useCommentsForUrl, useCurrentUrl } from "@/lib/auis-review/hooks"
import {
  useCumulativeScrollOffset,
  useLayoutVersion,
} from "@/lib/auis-review/scrollOffset"
import {
  captureDrawAnchor,
  captureElementAnchor,
  resolveDrawPoints,
  resolveElementPoint,
} from "@/lib/auis-review/elementAnchor"
import { OVERLAY_DATA_ATTR, REVIEW_Z } from "./constants"
import { ReviewPinMarker } from "./ReviewPinMarker"
import type { ReviewDrawPath, ReviewPoint } from "./types"

// Converte o evento de ponteiro pra doc-coords usando a MESMA base de scroll
// que o render usa (o container de conteúdo principal). Antes usava o scroll
// por-elemento do alvo, que divergia do render quando um modal/sidebar mudava
// o scroll-chain — e o pino caía fora. Compartilhar a base garante captura e
// render coincidirem.
function pointFromEvent(
  e: PointerEvent | React.PointerEvent,
  scroll: ReviewPoint,
): ReviewPoint {
  return {
    x: e.clientX + scroll.x,
    y: e.clientY + scroll.y,
  }
}

function pointsToPolyline(points: ReviewPoint[]): string {
  return points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")
}

function centroidOf(points: ReviewPoint[]): ReviewPoint {
  if (points.length === 0) return { x: 0, y: 0 }
  let x = 0
  let y = 0
  for (const p of points) {
    x += p.x
    y += p.y
  }
  return { x: x / points.length, y: y / points.length }
}

function PathPolyline({
  path,
  opacity = 1,
}: {
  path: ReviewDrawPath
  opacity?: number
}) {
  return (
    <polyline
      points={pointsToPolyline(path.points)}
      fill="none"
      stroke={path.strokeColorToken}
      strokeWidth={path.strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      opacity={opacity}
      style={{ pointerEvents: "none" }}
    />
  )
}

export function ReviewCanvas() {
  const active = useReviewStore((s) => s.active)
  const mode = useReviewStore((s) => s.mode)
  const identity = useReviewStore((s) => s.identity)
  const drawingPath = useReviewStore((s) => s.drawingPath)
  const pendingAnchor = useReviewStore((s) => s.pendingAnchor)
  const selectedCommentId = useReviewStore((s) => s.selectedCommentId)

  const openThread = useReviewStore((s) => s.openThread)

  const url = useCurrentUrl()
  const comments = useCommentsForUrl(url)

  const svgRef = React.useRef<SVGSVGElement>(null)
  const isDrawingRef = React.useRef(false)
  const rafRef = React.useRef<number | null>(null)
  const pendingPointRef = React.useRef<ReviewPoint | null>(null)
  const scroll = useCumulativeScrollOffset()
  const layoutVersion = useLayoutVersion()
  // Latest scroll for the native pointer handlers (attached once, read fresh).
  const scrollRef = React.useRef(scroll)
  React.useEffect(() => {
    scrollRef.current = scroll
  }, [scroll])

  // Posições renderizadas, em coords do grupo (que já é transladado por
  // -scroll). Quando a âncora de elemento resolve, pins e traços seguem o
  // reflow horizontal (sidebars) e o zoom do browser (o box escala junto);
  // senão, caímos nas coords absolutas salvas. `layoutVersion` força recálculo
  // quando o layout muda sem scroll/resize.
  //   `pins`  — ponto do marcador de cada comentário (pin ou centroide do traço)
  //   `draws` — pontos da polyline de cada marcação livre
  //   `hidden`— comentários ancorados a um elemento que NÃO existe mais (ex.: um
  //             modal fechou). Some o marcador em vez de cair na coord absoluta
  //             velha — senão o dot fica "fantasma" sobre o conteúdo/sidebar. Se
  //             o elemento voltar (modal reabre), o seletor resolve e ele volta.
  const rendered = React.useMemo(() => {
    void layoutVersion
    const pins = new Map<string, ReviewPoint>()
    const draws = new Map<string, ReviewPoint[]>()
    const hidden = new Set<string>()
    for (const c of comments) {
      // ux-flow vive no canvas do diagrama; backlog ("ideia futura") é avulso —
      // nenhum dos dois vira pino aqui.
      if (c.origin === "ux-flow" || c.status === "backlog") continue
      if (c.anchor.kind === "pin") {
        const vp = c.anchor.el ? resolveElementPoint(c.anchor.el) : null
        if (c.anchor.el && !vp) {
          hidden.add(c.id)
          continue
        }
        pins.set(
          c.id,
          vp ? { x: vp.x + scroll.x, y: vp.y + scroll.y } : c.anchor.position,
        )
      } else {
        const vps = c.anchor.el ? resolveDrawPoints(c.anchor.el) : null
        if (c.anchor.el && !vps) {
          hidden.add(c.id)
          continue
        }
        const docPts = vps
          ? vps.map((p) => ({ x: p.x + scroll.x, y: p.y + scroll.y }))
          : c.anchor.path.points
        draws.set(c.id, docPts)
        pins.set(c.id, vps ? centroidOf(docPts) : c.anchor.centroid)
      }
    }
    return { pins, draws, hidden }
  }, [comments, scroll.x, scroll.y, layoutVersion])

  const captureMode =
    pendingAnchor === null &&
    (mode === "draw" || mode === "pin" || mode === "magic")

  // Pointer handling is done with NATIVE listeners on the <svg>, not React's
  // onPointer* props. React 19 delegates events from `document` — the same node
  // a Radix dialog's outside-dismiss listener lives on — so a synthetic
  // stopPropagation runs too late to keep the modal open while you annotate it.
  // A real listener on the element stops the event during the svg's own bubble
  // step, before it reaches `document`. Handlers read live store state via
  // getState() so the listeners can be attached once.
  React.useEffect(() => {
    const svg = svgRef.current
    if (!svg) return

    const flush = () => {
      rafRef.current = null
      const p = pendingPointRef.current
      if (p) {
        useReviewStore.getState().appendDrawPoint(p)
        pendingPointRef.current = null
      }
    }

    const onDown = (e: PointerEvent) => {
      // Shield underlying Radix dialogs from dismissing on the annotation press.
      e.stopPropagation()
      const s = useReviewStore.getState()
      if (!s.identity) return
      if (s.mode === "draw") {
        isDrawingRef.current = true
        s.startDraw(pointFromEvent(e, scrollRef.current), s.identity.colorToken)
        ;(e.target as Element).setPointerCapture?.(e.pointerId)
      } else if (s.mode === "pin" || s.mode === "magic") {
        // No modo mágico o pino ancora ao elemento sob o cursor — o mesmo que o
        // realce destaca (ambos via elementBelowOverlayAt) — então fica grudado
        // ao elemento e acompanha o reflow, em vez de cair num x/y solto.
        const el = captureElementAnchor(e.clientX, e.clientY)
        s.placePin(pointFromEvent(e, scrollRef.current), el ?? undefined)
      }
    }

    const onMove = (e: PointerEvent) => {
      if (!isDrawingRef.current || useReviewStore.getState().mode !== "draw")
        return
      pendingPointRef.current = pointFromEvent(e, scrollRef.current)
      if (rafRef.current === null) {
        rafRef.current = requestAnimationFrame(flush)
      }
    }

    const onUp = () => {
      if (!isDrawingRef.current) return
      isDrawingRef.current = false
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
      const s = useReviewStore.getState()
      if (pendingPointRef.current) {
        s.appendDrawPoint(pendingPointRef.current)
        pendingPointRef.current = null
      }
      // Ancora o traço ao elemento sob o centroide (em coords de viewport) pra
      // que sobreviva a zoom e reflow das sidebars, como os pins. Os pontos
      // salvos estão em doc coords; tira o scroll atual pra voltar ao viewport.
      const path = useReviewStore.getState().drawingPath
      const sc = scrollRef.current
      const el = path
        ? captureDrawAnchor(
            path.map((p) => ({ x: p.x - sc.x, y: p.y - sc.y })),
          )
        : null
      s.endDraw(el ?? undefined)
    }

    svg.addEventListener("pointerdown", onDown)
    svg.addEventListener("pointermove", onMove)
    svg.addEventListener("pointerup", onUp)
    svg.addEventListener("pointercancel", onUp)
    return () => {
      svg.removeEventListener("pointerdown", onDown)
      svg.removeEventListener("pointermove", onMove)
      svg.removeEventListener("pointerup", onUp)
      svg.removeEventListener("pointercancel", onUp)
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
    }
  }, [active])

  if (!active) return null

  const cursor =
    mode === "draw"
      ? "crosshair"
      : mode === "pin"
        ? "copy"
        : mode === "magic"
          ? "crosshair"
          : "default"

  return (
    <svg
      ref={svgRef}
      {...{ [OVERLAY_DATA_ATTR]: "" }}
      className="fixed inset-0"
      width="100%"
      height="100%"
      style={{
        zIndex: REVIEW_Z.canvas,
        pointerEvents: captureMode ? "auto" : "none",
        cursor,
        touchAction: captureMode ? "none" : "auto",
        overflow: "visible",
      }}
    >
      <g transform={`translate(${-scroll.x} ${-scroll.y})`}>
        {/* ux-flow comments live on the diagram canvas (rendered by the flow
            editor) — their document-coord pins would drift here, so skip them. */}
        {comments
          .filter(
            (c) =>
              c.origin !== "ux-flow" &&
              c.status !== "backlog" &&
              !rendered.hidden.has(c.id),
          )
          .map((c) => {
          if (c.anchor.kind === "draw") {
            return (
              <g key={c.id} style={{ pointerEvents: "auto" }}>
                <PathPolyline
                  path={{
                    ...c.anchor.path,
                    points: rendered.draws.get(c.id) ?? c.anchor.path.points,
                  }}
                  opacity={c.status === "resolved" ? 0.3 : 0.85}
                />
                <ReviewPinMarker
                  position={rendered.pins.get(c.id) ?? c.anchor.centroid}
                  comment={c}
                  selected={selectedCommentId === c.id}
                  onClick={(e) => {
                    e.stopPropagation()
                    openThread(c.id)
                  }}
                />
              </g>
            )
          }
          return (
            <ReviewPinMarker
              key={c.id}
              position={rendered.pins.get(c.id) ?? c.anchor.position}
              comment={c}
              selected={selectedCommentId === c.id}
              onClick={(e) => {
                e.stopPropagation()
                openThread(c.id)
              }}
            />
          )
        })}

        {drawingPath && drawingPath.length > 0 && identity && (
          <PathPolyline
            path={{
              points: drawingPath,
              strokeColorToken: identity.colorToken,
              strokeWidth: 3,
            }}
          />
        )}

        {pendingAnchor?.kind === "draw" && (
          <PathPolyline path={pendingAnchor.path} />
        )}

        {pendingAnchor?.kind === "pin" && identity && (
          <circle
            cx={pendingAnchor.position.x}
            cy={pendingAnchor.position.y}
            r={10}
            fill={identity.colorToken}
            opacity={0.6}
          />
        )}
      </g>
    </svg>
  )
}
