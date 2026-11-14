import * as React from "react"
import { dataUrl } from "./client"
import type { Note } from "./domain"

/** Permission is requested by the current tab, on the microphone click. */
export function useTabRecording(onRecorded: (audio: NonNullable<Note["audio"]>) => void) {
  const [stream, setStream] = React.useState<MediaStream | null>(null)
  const [recording, setRecording] = React.useState(false)
  const recorder = React.useRef<MediaRecorder | null>(null)
  const activeStream = React.useRef<MediaStream | null>(null)
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const discarded = React.useRef(false)
  const generation = React.useRef(0)
  const callback = React.useRef(onRecorded)
  React.useEffect(() => { callback.current = onRecorded }, [onRecorded])
  const cleanup = React.useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    activeStream.current?.getTracks().forEach(t => t.stop()); activeStream.current = null
    setStream(null); setRecording(false)
  }, [])
  const cancel = React.useCallback(() => {
    generation.current++; discarded.current = true
    if (recorder.current?.state === "recording") recorder.current.stop()
    cleanup()
  }, [cleanup])
  React.useEffect(() => () => { generation.current++; discarded.current = true; if (timer.current) clearTimeout(timer.current); activeStream.current?.getTracks().forEach(t => t.stop()) }, [])
  const start = React.useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error("O microfone precisa de uma página HTTPS. Abra a versão segura deste site.")
    const current = ++generation.current
    let media: MediaStream
    try { media = await navigator.mediaDevices.getUserMedia({ audio: true }) }
    catch (e) {
      const name = (e as DOMException).name
      throw new Error(name === "NotFoundError" ? "Nenhum microfone encontrado. Conecte um e tente novamente." : "Permita o microfone no aviso ou nas permissões desta aba e tente novamente.")
    }
    if (generation.current !== current) { media.getTracks().forEach(t => t.stop()); return }
    activeStream.current = media; setStream(media); discarded.current = false
    const chunks: Blob[] = [], started = Date.now()
    const rec = new MediaRecorder(media); recorder.current = rec
    rec.ondataavailable = e => { if (e.data.size) chunks.push(e.data) }
    rec.onstop = () => {
      const discard = discarded.current; cleanup()
      if (discard || !chunks.length) return
      const mime = rec.mimeType.split(";")[0]
      void dataUrl(new Blob(chunks, { type: mime })).then(data => callback.current({ data, mime, duration: (Date.now() - started) / 1000 }))
    }
    rec.start(1000); setRecording(true)
    timer.current = setTimeout(() => { if (rec.state === "recording") rec.stop() }, 180000)
  }, [cleanup])
  const stop = React.useCallback(() => { if (recorder.current?.state === "recording") recorder.current.stop() }, [])
  return { start, stop, cancel, stream, recording }
}
