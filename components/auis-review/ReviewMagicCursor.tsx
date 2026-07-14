"use client"

import * as React from "react"
import { useReviewStore } from "@/lib/auis-review/store"
import { elementBelowOverlayAt } from "@/lib/auis-review/scrollOffset"
import { shortLabelFor } from "@/lib/auis-review/elementContext"
import { OVERLAY_DATA_ATTR, REVIEW_Z } from "./constants"

interface Rect {
  top: number
  left: number
  width: number
  height: number
}

interface Target {
  rect: Rect
  label: string
}

// Magic pointer: while the reviewer hovers in "magic" mode, it highlights the
// element under the cursor with an animated gradient border (Stitch/AI style)
// plus a chip identifying it. The click itself is handled by ReviewCanvas (which
// is capturing the pointers) — here we only draw the highlight, with
// pointer-events:none so it never blocks the click. The pin capture reuses the
// same `elementBelowOverlayAt`, so what gets highlighted is exactly what gets
// anchored.
export function ReviewMagicCursor() {
  const active = useReviewStore((s) => s.active)
  const mode = useReviewStore((s) => s.mode)
  const pendingAnchor = useReviewStore((s) => s.pendingAnchor)
  const enabled = active && mode === "magic" && pendingAnchor === null

  const [target, setTarget] = React.useState<Target | null>(null)
  const lastElRef = React.useRef<Element | null>(null)
  const ptrRef = React.useRef<{ x: number; y: number } | null>(null)

  React.useEffect(() => {
    if (!enabled) {
      setTarget(null)
      lastElRef.current = null
      ptrRef.current = null
      return
    }
    let raf: number | null = null

    const recompute = () => {
      raf = null
      const p = ptrRef.current
      if (!p) return
      const el = elementBelowOverlayAt(p.x, p.y)
      if (
        !el ||
        el === document.body ||
        el === document.documentElement
      ) {
        if (lastElRef.current) {
          lastElRef.current = null
          setTarget(null)
        }
        return
      }
      const r = el.getBoundingClientRect()
      if (r.width <= 0 || r.height <= 0) {
        if (lastElRef.current) {
          lastElRef.current = null
          setTarget(null)
        }
        return
      }
      const rect: Rect = {
        top: r.top,
        left: r.left,
        width: r.width,
        height: r.height,
      }
      if (el === lastElRef.current) {
        // Same element (scroll/resize) → just update the position.
        setTarget((prev) => (prev ? { ...prev, rect } : prev))
        return
      }
      lastElRef.current = el
      setTarget({ rect, label: shortLabelFor(el) })
    }

    const schedule = () => {
      if (raf === null) raf = requestAnimationFrame(recompute)
    }
    const onMove = (e: PointerEvent) => {
      ptrRef.current = { x: e.clientX, y: e.clientY }
      schedule()
    }
    const onScrollOrResize = () => schedule()

    window.addEventListener("pointermove", onMove, {
      capture: true,
      passive: true,
    })
    document.addEventListener("scroll", onScrollOrResize, {
      capture: true,
      passive: true,
    })
    window.addEventListener("resize", onScrollOrResize)
    return () => {
      window.removeEventListener("pointermove", onMove, true)
      document.removeEventListener("scroll", onScrollOrResize, true)
      window.removeEventListener("resize", onScrollOrResize)
      if (raf !== null) cancelAnimationFrame(raf)
    }
  }, [enabled])

  if (!enabled || !target) return null
  const { rect, label } = target
  const pad = 2

  return (
    <>
      <style>{MAGIC_CSS}</style>
      <div
        {...{ [OVERLAY_DATA_ATTR]: "" }}
        className="au-magic-box"
        style={{
          position: "fixed",
          top: rect.top - pad,
          left: rect.left - pad,
          width: rect.width + pad * 2,
          height: rect.height + pad * 2,
          zIndex: REVIEW_Z.highlight,
          pointerEvents: "none",
        }}
      >
        <span className="au-magic-box__label">{label}</span>
      </div>
    </>
  )
}

// The feature's CSS is inlined through <style> (repo convention: globals.css
// does not recompile on the local dev server). The gradient is built only from
// Auis tokens (--au-*), no raw hex.
const MAGIC_CSS = `
@property --au-magic-angle { syntax: "<angle>"; initial-value: 0deg; inherits: false; }
@keyframes au-magic-spin { to { --au-magic-angle: 360deg; } }
.au-magic-box {
  border-radius: 10px;
  background: color-mix(in srgb, var(--au-blue-600) 8%, transparent);
  box-shadow:
    0 0 0 1px color-mix(in srgb, var(--au-purple-600) 30%, transparent),
    0 0 22px color-mix(in srgb, var(--au-blue-600) 22%, transparent);
  transition: top .08s linear, left .08s linear, width .08s linear, height .08s linear;
}
.au-magic-box::before {
  content: "";
  position: absolute; inset: 0; border-radius: inherit; padding: 1.5px;
  background: conic-gradient(
    from var(--au-magic-angle),
    var(--au-blue-600), var(--au-purple-600), var(--au-pink-600),
    var(--au-teal-600), var(--au-blue-600)
  );
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
          mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
          mask-composite: exclude;
  animation: au-magic-spin 3s linear infinite;
}
.au-magic-box__label {
  position: absolute; bottom: 100%; left: -1.5px; margin-bottom: 6px;
  display: inline-flex; align-items: center;
  max-width: 280px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  padding: 2px 8px; border-radius: 6px;
  font-size: 11px; font-weight: 600; line-height: 1.5;
  color: var(--fg-on-inverse);
  background: linear-gradient(110deg, var(--au-blue-600), var(--au-purple-600), var(--au-pink-600));
  box-shadow: 0 2px 8px color-mix(in srgb, var(--au-purple-600) 35%, transparent);
}
@media (prefers-reduced-motion: reduce) {
  .au-magic-box::before { animation: none; }
  .au-magic-box { transition: none; }
}
`
