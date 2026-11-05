"use client"

import * as React from "react"
import { useReviewStore } from "./store"
import { ATTACH_ACCEPT, useImageAttach } from "./useImageAttach"
import { useReviewCommandAutocomplete } from "./useReviewCommandAutocomplete"
import { useVoiceTranscription } from "./useVoiceTranscription"
import { fetchRewrite } from "./commentAssist"
import type { ReviewElementContext } from "@auis/core/elementContext"
import { ReviewCommandMenu } from "./ReviewCommandMenu"
import {
  COMPOSER_SHELL_CLASS,
  COMPOSER_TEXTAREA_CLASS,
  ComposerRecording,
  ComposerSendButton,
  ComposerThumbnails,
  ComposerToolButton,
  useComposerAutosize,
} from "./ComposerControls"

/**
 * Reply composer with image attachments (paste or button), voice dictation and
 * "improve prompt" (wand) — the same toolbox as the pin composer, reused by the
 * drawer card and the anchored thread popover, in the shared pill frame
 * (ComposerControls). Text OR image enables sending; ⌘↵ sends, and Esc gives up
 * when there is an onDone.
 */
export function ReplyComposer({
  commentId,
  element = null,
  onDone,
  autoFocus,
}: {
  commentId: string
  /** Context of the comment's element — lets the wand know WHERE it is. */
  element?: ReviewElementContext | null
  onDone?: () => void
  autoFocus?: boolean
}) {
  const addReply = useReviewStore((s) => s.addReply)
  const identity = useReviewStore((s) => s.identity)
  const openIdentityModal = useReviewStore((s) => s.openIdentityModal)
  const sessionRole = useReviewStore((s) => s.sessionRole)
  const [text, setText] = React.useState("")
  const [submitting, setSubmitting] = React.useState(false)
  const [rewriting, setRewriting] = React.useState(false)
  const [assistError, setAssistError] = React.useState<string | null>(null)
  const [undoText, setUndoText] = React.useState<string | null>(null)
  const img = useImageAttach()
  const fileRef = React.useRef<HTMLInputElement>(null)
  const taRef = React.useRef<HTMLTextAreaElement>(null)
  const shellRef = React.useRef<HTMLDivElement>(null)
  useComposerAutosize(taRef, shellRef, text)
  // A reviewer does not command agents — their "@" only suggests people.
  const commands = useReviewCommandAutocomplete({
    textareaRef: taRef,
    value: text,
    setValue: setText,
    allowAgents: sessionRole === "admin",
  })

  // Voice → text: appends what was recognized to whatever is already written.
  const voice = useVoiceTranscription(
    React.useCallback((spoken: string) => {
      setText((prev) => (prev ? `${prev.trimEnd()} ${spoken}` : spoken))
      requestAnimationFrame(() => taRef.current?.focus())
    }, [])
  )
  // Stops the voice on unmount (Cancel/close) without re-firing effects per render.
  const voiceCancelRef = React.useRef(voice.cancel)
  const pendingSubmitRef = React.useRef(false)
  React.useEffect(() => {
    voiceCancelRef.current = voice.cancel
  })
  React.useEffect(() => () => voiceCancelRef.current(), [])

  React.useEffect(() => {
    if (autoFocus) taRef.current?.focus()
  }, [autoFocus])

  const canSubmit = (text.trim().length > 0 || img.images.length > 0) && !submitting

  const doSubmit = React.useCallback(async () => {
    setSubmitting(true)
    try {
      await addReply(commentId, text, img.images.length > 0 ? img.images : undefined)
      setText("")
      img.reset()
      setUndoText(null)
      onDone?.()
    } finally {
      setSubmitting(false)
    }
  }, [addReply, commentId, text, img, onDone])

  // Sending with the voice active: stop the recording first and only send for
  // real once the transcribed text settles (status back to "idle").
  React.useEffect(() => {
    if (!pendingSubmitRef.current || voice.status !== "idle") return
    pendingSubmitRef.current = false
    void doSubmit()
  }, [voice.status, doSubmit])

  const submit = async () => {
    if (submitting) return
    // No identity (new person on a shared account): identify first — the typed
    // text stays intact; just pick the name and send again.
    if (!identity) {
      openIdentityModal("new")
      return
    }
    if (voice.status === "recording" || voice.status === "transcribing") {
      setSubmitting(true)
      pendingSubmitRef.current = true
      if (voice.status === "recording") voice.stop()
      return
    }
    if (!canSubmit) return
    await doSubmit()
  }

  const handleRewrite = React.useCallback(async () => {
    if (rewriting || text.trim().length === 0) return
    setAssistError(null)
    setRewriting(true)
    const r = await fetchRewrite({ draft: text, element })
    setRewriting(false)
    if (r.status === 503) {
      setAssistError("Set OPENAI_API_KEY to use the wand.")
      return
    }
    if (!r.ok || !r.text) {
      setAssistError("Could not improve it right now. Try again.")
      return
    }
    setUndoText(text)
    setText(r.text)
    requestAnimationFrame(() => taRef.current?.focus())
  }, [rewriting, text, element])

  const undoRewrite = () => {
    if (undoText === null) return
    setText(undoText)
    setUndoText(null)
  }

  const cancel = () => {
    voiceCancelRef.current()
    setText("")
    img.reset()
    setUndoText(null)
    setAssistError(null)
    onDone?.()
  }

  const recording = voice.status === "recording"
  const transcribing = voice.status === "transcribing"
  const status = transcribing
    ? "Transcribing…"
    : rewriting
      ? "Improving the text…"
      : null

  return (
    <div className="flex flex-col gap-1.5">
      <ComposerThumbnails images={img.images} onRemove={img.remove} />

      <div ref={shellRef} className={COMPOSER_SHELL_CLASS}>
        {recording && (
          <ComposerRecording
            stream={voice.stream}
            onDiscard={voice.cancel}
            onStop={voice.stop}
          />
        )}
        <div className={recording ? "hidden" : "flex-1 min-w-0"}>
          <textarea
            ref={taRef}
            value={text}
            onChange={(e) => {
              setText(e.target.value)
              if (undoText !== null) setUndoText(null)
            }}
            onPaste={img.onPaste}
            placeholder="Write a reply…"
            aria-label="Reply"
            rows={1}
            className={COMPOSER_TEXTAREA_CLASS}
            onKeyDown={(e) => {
              if (commands.onKeyDown(e)) return
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") void submit()
              if (e.key === "Escape" && onDone) {
                e.preventDefault()
                cancel()
              }
            }}
            onSelect={() => commands.sync()}
            onBlur={() => commands.close()}
          />
        </div>
        {!recording && (
          <>
            <ComposerToolButton
              icon="image"
              label="Attach image (or paste with ⌘V)"
              onClick={() => fileRef.current?.click()}
              disabled={!img.canAddMore}
            />
            <ComposerToolButton
              icon="mic"
              label="Dictate"
              onClick={voice.toggle}
              busy={transcribing}
            />
            <ComposerToolButton
              icon="auto_fix_high"
              label="Improve the reply"
              onClick={() => void handleRewrite()}
              disabled={text.trim().length === 0}
              busy={rewriting}
            />
            <ComposerSendButton
              label="Send"
              onClick={() => void submit()}
              disabled={!canSubmit && !transcribing}
              loading={submitting}
            />
          </>
        )}
      </div>

      <ReviewCommandMenu ac={commands} />

      {(assistError || voice.error || status || undoText !== null) && (
        <div className="flex items-center gap-2 px-3 body-xs text-(--auis-fg-tertiary)">
          {assistError || voice.error ? (
            <span className="text-(--auis-accent-danger)">{assistError ?? voice.error}</span>
          ) : status ? (
            <span>{status}</span>
          ) : (
            <button
              type="button"
              onClick={undoRewrite}
              className="text-(--auis-fg-secondary) hover:text-(--auis-fg-primary) underline underline-offset-2"
            >
              Undo
            </button>
          )}
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept={ATTACH_ACCEPT}
        multiple
        className="hidden"
        onChange={async (e) => {
          await img.add(Array.from(e.target.files ?? []))
          if (fileRef.current) fileRef.current.value = ""
        }}
      />
    </div>
  )
}
