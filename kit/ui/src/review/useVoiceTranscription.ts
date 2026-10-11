"use client"

import * as React from "react"

export type VoiceStatus = "idle" | "recording" | "transcribing"

function extFor(mime: string): string {
  if (mime.includes("mp4")) return "mp4"
  if (mime.includes("ogg")) return "ogg"
  if (mime.includes("wav")) return "wav"
  return "webm"
}

/**
 * Voice recording → text for the comment card. Records with MediaRecorder and
 * posts the audio to /api/review/transcribe (a server-side OpenAI proxy). The
 * recognized text comes back through `onText`. The key never touches the client.
 */
export function useVoiceTranscription(onText: (text: string) => void) {
  const [status, setStatus] = React.useState<VoiceStatus>("idle")
  const [error, setError] = React.useState<string | null>(null)
  const recorderRef = React.useRef<MediaRecorder | null>(null)
  const chunksRef = React.useRef<Blob[]>([])
  const streamRef = React.useRef<MediaStream | null>(null)
  // When true, the next `onstop` DISCARDS the audio (no transcription) — this is
  // the "interrupted" path: leaving/clicking outside cancels the speech without
  // turning it into text.
  const discardRef = React.useRef(false)

  const cleanupStream = React.useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }, [])

  React.useEffect(() => () => cleanupStream(), [cleanupStream])

  const transcribe = React.useCallback(
    async (blob: Blob) => {
      setStatus("transcribing")
      try {
        const form = new FormData()
        form.append("audio", blob, `audio.${extFor(blob.type)}`)
        const res = await fetch("/api/review/transcribe", {
          method: "POST",
          body: form,
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          setError(data?.error || "Could not transcribe the audio. Record again.")
          return
        }
        if (data?.text) onText(data.text)
      } catch {
        setError("Lost connection while transcribing. Try again.")
      } finally {
        setStatus("idle")
      }
    },
    [onText]
  )

  const start = React.useCallback(async () => {
    setError(null)
    if (status !== "idle") return
    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      setError("This browser does not support voice recording. Try another browser.")
      return
    }
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      setError("Microphone access denied. Allow it in your browser to dictate.")
      return
    }
    streamRef.current = stream
    chunksRef.current = []
    const recorder = new MediaRecorder(stream)
    recorderRef.current = recorder
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data)
    }
    recorder.onstop = () => {
      cleanupStream()
      const blob = new Blob(chunksRef.current, {
        type: recorder.mimeType || "audio/webm",
      })
      chunksRef.current = []
      if (discardRef.current) {
        discardRef.current = false
        setStatus("idle")
        return
      }
      if (blob.size > 0) void transcribe(blob)
      else setStatus("idle")
    }
    discardRef.current = false
    recorder.start()
    setStatus("recording")
  }, [status, cleanupStream, transcribe])

  const stop = React.useCallback(() => {
    const recorder = recorderRef.current
    if (recorder && recorder.state !== "inactive") recorder.stop()
  }, [])

  // Stop without transcribing (discards the audio). For leaving/clicking outside.
  const cancel = React.useCallback(() => {
    const recorder = recorderRef.current
    if (recorder && recorder.state !== "inactive") {
      discardRef.current = true
      recorder.stop()
    } else {
      cleanupStream()
      setStatus("idle")
    }
  }, [cleanupStream])

  const toggle = React.useCallback(() => {
    if (status === "recording") stop()
    else if (status === "idle") void start()
  }, [status, start, stop])

  return { status, error, toggle, stop, cancel }
}
