import * as React from "react"
import { Button } from "@auis/ui/primitives/Button"
import { Icon } from "@auis/ui/primitives/Icon"
import { dataUrl, request } from "./client"
import type { Note } from "./domain"
import { COMPOSER_SHELL_CLASS, COMPOSER_TEXTAREA_CLASS, ComposerRecording, ComposerSendButton, ComposerThumbnails, ComposerToolButton, useComposerAutosize } from "@auis/ui/review/ComposerControls"
import { useTabRecording } from "./useTabRecording"

export function NoteEditor({ note, onSaved, onCancel }: { note: Note; onSaved: (note: Note) => void; onCancel: () => void }) {
  const [text, setText] = React.useState(note.text)
  const [audio, setAudio] = React.useState(note.audio)
  const [images, setImages] = React.useState(note.images || [])
  const [busy, setBusy] = React.useState("")
  const [error, setError] = React.useState("")
  const file = React.useRef<HTMLInputElement>(null)
  const textarea = React.useRef<HTMLTextAreaElement>(null)
  const shell = React.useRef<HTMLDivElement>(null)
  useComposerAutosize(textarea, shell, text)
  const current = (patch: Partial<Note> = {}): Note => ({ ...note, text, audio, images, updatedAt: Date.now(), ...patch })
  async function transcribe(value: Note) {
    setBusy("Transcrevendo…")
    // Persist audio before network access; an expired login cannot lose a recording.
    await request("save", { note: value })
    const transcript = await request<string>("transcribe", { id: value.id })
    setText(prev => prev ? `${prev.trimEnd()}\n${transcript}` : transcript)
  }
  const voice = useTabRecording(recorded => {
    setAudio(recorded)
    void transcribe(current({ audio: recorded })).catch(e => setError(e.message)).finally(() => setBusy(""))
  })
  const recording = voice.recording
  async function startVoice() {
    setError(""); setBusy("Aguardando o microfone…")
    try { await voice.start() } catch (e) { setError((e as Error).message) } finally { setBusy("") }
  }
  async function save() {
    setBusy("Salvando…"); setError("")
    try { const next = current(); await request("save", { note: next }); onSaved(next) }
    catch (e) { setError((e as Error).message) }
    finally { setBusy("") }
  }
  async function attach(files: FileList | File[]) {
    setError("")
    try {
      const additions: string[] = []
      for (const image of Array.from(files).slice(0, 4 - images.length)) {
        if (!/^image\/(png|jpeg|webp)$/.test(image.type) || image.size > 6 * 1024 * 1024) throw new Error("Use PNG, JPEG ou WebP de até 6 MB.")
        additions.push(await dataUrl(image))
      }
      setImages(prev => [...prev, ...additions])
    } catch (e) { setError((e as Error).message) }
  }
  return <form className="ar-editor ar-bridge-editor" onSubmit={e => { e.preventDefault(); if (!busy && !recording) void save() }}>
    <ComposerThumbnails images={images} onRemove={i => setImages(v => v.filter((_, n) => n !== i))} onAdd={() => file.current?.click()} canAdd={images.length < 4} />
    <div ref={shell} className={COMPOSER_SHELL_CLASS}>
      {recording ? <ComposerRecording stream={voice.stream} onDiscard={voice.cancel} onStop={voice.stop} labels={{ group: "Gravando comentário", discard: "Descartar gravação", stop: "Parar e transcrever" }} /> : <>
        <div className="relative flex-1 min-w-0"><textarea ref={textarea} className={COMPOSER_TEXTAREA_CLASS} aria-label="Comentário" autoFocus rows={1} placeholder="Escreva o feedback…" value={text} maxLength={50000} onChange={e => setText(e.target.value)}
          onPaste={e => { const files = Array.from(e.clipboardData.files); if (files.length) { e.preventDefault(); void attach(files) } }}
          onKeyDown={e => { e.stopPropagation(); if (e.key === "Escape" && !busy) onCancel(); if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && !busy && (text.trim() || audio || images.length)) { e.preventDefault(); void save() } }} /></div>
        <ComposerToolButton icon="image" label="Anexar imagem" disabled={images.length >= 4 || !!busy} onClick={() => file.current?.click()} />
        <ComposerToolButton icon="mic" label="Gravar comentário" busy={!!busy && busy !== "Salvando…"} disabled={!!busy} onClick={() => void startVoice()} />
        <ComposerSendButton label="Salvar comentário" type="submit" disabled={!!busy || (!text.trim() && !audio && !images.length)} loading={busy === "Salvando…"} />
      </>}
    </div>
    {audio && !recording && <div className="ar-audio"><audio controls src={audio.data} aria-label="Áudio do comentário" /><div className="ar-row"><Button size="sm" variant="ghost" disabled={!!busy} onClick={() => { setError(""); void transcribe(current()).catch(e => setError(e.message)).finally(() => setBusy("")) }}>Transcrever novamente</Button><Button size="sm" variant="ghost" aria-label="Remover áudio" iconOnly="delete" onClick={() => setAudio(undefined)} /></div></div>}
    {error && <p className="ar-error" role="alert">{error}</p>}
    <div className="ar-composer-footer"><span className="ar-row"><Icon name="lock" size={16} />Neste navegador</span><span>{busy || (recording ? "Até 3 min" : "⌘↵ envia · Esc fecha")}</span><Button type="button" size="sm" variant="ghost" iconOnly="close" iconSize={16} aria-label="Fechar" disabled={recording || (!!busy && busy !== "Aguardando o microfone…")} onClick={() => { voice.cancel(); onCancel() }} /></div>
    <input ref={file} hidden type="file" multiple accept="image/png,image/jpeg,image/webp" onChange={e => { if (e.target.files) void attach(e.target.files); e.target.value = "" }} />
  </form>
}
