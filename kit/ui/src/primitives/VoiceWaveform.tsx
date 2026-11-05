"use client"

/**
 * VoiceWaveform — bars that follow the voice while the microphone records.
 *
 * With `stream`, each bar is the microphone's real volume, read by a Web Audio
 * AnalyserNode. Without one, a simulated speech fills in: it serves previews and
 * the instant before the microphone opens. Readings enter on the right and run
 * left, one every 55 ms (180 ms with reduced motion). The color comes from the
 * container's `color` (`currentColor`).
 *
 * The component only reads the stream: whoever opened it stops its tracks.
 */

import * as React from "react"
import { cn } from "./cn"

export type VoiceWaveformSize = "sm" | "md"

export type VoiceWaveformProps = Omit<React.HTMLAttributes<HTMLDivElement>, "children"> & {
  /** An open microphone. Without one, the wave simulates speech. */
  stream?: MediaStream | null
  /** false leaves the bars at the floor, still (paused, silent). */
  active?: boolean
  /** How many bars. Each takes 3px plus a 2px gap. */
  bars?: number
  /** Height: 20px (`sm`) or 28px (`md`). */
  size?: VoiceWaveformSize
}

const SAMPLE_MS = 55
const SAMPLE_MS_REDUCED = 180
/** The bar's minimum height, as a fraction of the total: silence does not vanish. */
const FLOOR = 0.14

const HEIGHT: Record<VoiceWaveformSize, string> = {
  sm: "h-5",
  md: "h-7",
}

type AudioContextCtor = typeof AudioContext

function audioContextCtor(): AudioContextCtor | null {
  if (typeof window === "undefined") return null
  const w = window as Window & { webkitAudioContext?: AudioContextCtor }
  return window.AudioContext ?? w.webkitAudioContext ?? null
}

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)"

function subscribeReducedMotion(onChange: () => void): () => void {
  if (typeof window === "undefined" || !window.matchMedia) return () => {}
  const query = window.matchMedia(REDUCED_MOTION)
  query.addEventListener("change", onChange)
  return () => query.removeEventListener("change", onChange)
}

function usePrefersReducedMotion(): boolean {
  return React.useSyncExternalStore(
    subscribeReducedMotion,
    () => !!window.matchMedia?.(REDUCED_MOTION).matches,
    () => false,
  )
}

/** The stretch's volume (RMS), compressed to the scale the ear perceives. */
function readLevel(analyser: AnalyserNode, buffer: Uint8Array<ArrayBuffer>): number {
  analyser.getByteTimeDomainData(buffer)
  let sum = 0
  for (let i = 0; i < buffer.length; i++) {
    const v = (buffer[i]! - 128) / 128
    sum += v * v
  }
  const rms = Math.sqrt(sum / buffer.length)
  return Math.min(1, Math.sqrt(rms) * 1.7)
}

/** Pretend speech: phrases that rise and fall, syllables on top, a little noise. */
function simulatedLevel(now: number): number {
  const s = now / 1000
  const phrase = 0.55 + 0.45 * Math.sin(s * 1.1) * Math.sin(s * 0.45 + 0.6)
  const syllable = Math.abs(Math.sin(s * 6.4)) * 0.65 + Math.abs(Math.sin(s * 2.6 + 0.8)) * 0.35
  return Math.min(1, Math.max(0.04, phrase * syllable + Math.random() * 0.16))
}

export function VoiceWaveform({
  stream = null,
  active = true,
  bars = 24,
  size = "md",
  className,
  "aria-label": ariaLabel,
  ...rest
}: VoiceWaveformProps) {
  const reduceMotion = usePrefersReducedMotion()
  const barRefs = React.useRef<(HTMLSpanElement | null)[]>([])
  const count = Math.max(4, Math.round(bars))

  React.useEffect(() => {
    const paint = (values: number[]) => {
      for (let i = 0; i < values.length; i++) {
        const el = barRefs.current[i]
        if (el) el.style.transform = `scaleY(${FLOOR + values[i]! * (1 - FLOOR)})`
      }
    }

    const history = Array.from({ length: count }, () => 0)
    paint(history)
    if (!active) return

    let ctx: AudioContext | null = null
    let analyser: AnalyserNode | null = null
    let source: MediaStreamAudioSourceNode | null = null
    const Ctor = stream ? audioContextCtor() : null
    if (stream && Ctor) {
      try {
        ctx = new Ctor()
        analyser = ctx.createAnalyser()
        analyser.fftSize = 512
        source = ctx.createMediaStreamSource(stream)
        source.connect(analyser)
      } catch {
        analyser = null
      }
    }
    const buffer = analyser ? new Uint8Array(new ArrayBuffer(analyser.fftSize)) : null
    const step = reduceMotion ? SAMPLE_MS_REDUCED : SAMPLE_MS

    let raf = 0
    let last = 0
    const loop = (now: number) => {
      if (now - last >= step) {
        last = now
        const level =
          analyser && buffer ? readLevel(analyser, buffer) : stream ? 0 : simulatedLevel(now)
        history.shift()
        history.push(level)
        paint(history)
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(raf)
      source?.disconnect()
      void ctx?.close().catch(() => {})
    }
  }, [stream, active, count, reduceMotion])

  return (
    <div
      {...rest}
      role={ariaLabel ? "img" : undefined}
      aria-label={ariaLabel}
      aria-hidden={ariaLabel ? undefined : true}
      className={cn("inline-flex items-center gap-0.5", HEIGHT[size], className)}
    >
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          ref={(el) => {
            barRefs.current[i] = el
          }}
          className="h-full w-0.75 shrink-0 rounded-full bg-current origin-center transition-transform duration-75 ease-out motion-reduce:transition-none"
          style={{ transform: `scaleY(${FLOOR})` }}
        />
      ))}
    </div>
  )
}
