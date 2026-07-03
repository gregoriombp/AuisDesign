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
 * Gravação de voz → texto pro card de comentário. Grava com MediaRecorder e
 * posta o áudio em /api/review/transcribe (proxy server-side da OpenAI). O
 * texto reconhecido volta via `onText`. A chave nunca toca o cliente.
 */
export function useVoiceTranscription(onText: (text: string) => void) {
  const [status, setStatus] = React.useState<VoiceStatus>("idle")
  const [error, setError] = React.useState<string | null>(null)
  const recorderRef = React.useRef<MediaRecorder | null>(null)
  const chunksRef = React.useRef<Blob[]>([])
  const streamRef = React.useRef<MediaStream | null>(null)
  // Quando true, o próximo `onstop` DESCARTA o áudio (não transcreve) — é o
  // "interrompido": sair/clicar fora cancela a fala sem virar texto.
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
          setError(data?.error || "Falha ao transcrever.")
          return
        }
        if (data?.text) onText(data.text)
      } catch {
        setError("Falha de rede ao transcrever.")
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
      setError("Gravação de voz indisponível neste navegador.")
      return
    }
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      setError("Permita o acesso ao microfone para ditar.")
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

  // Interrompe sem transcrever (descarta o áudio). Pro caso de sair/clicar fora.
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
