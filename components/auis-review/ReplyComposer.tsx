"use client"

import * as React from "react"
import { AuButton } from "@/components/ui/AuButton"
import { Icon } from "@/components/ui/Icon"
import { useReviewStore } from "@/lib/auis-review/store"
import { useImageAttach } from "@/lib/auis-review/useImageAttach"
import { useReviewCommandAutocomplete } from "@/lib/auis-review/useReviewCommandAutocomplete"
import { ReviewCommandMenu } from "./ReviewCommandMenu"

/**
 * Compositor de resposta com anexo de imagem (colar ou botão), reusado pelo card
 * do drawer e pelo thread popover ancorado — pra não duplicar a lógica de voz/
 * paste/thumbs. Texto OU imagem habilita o envio; ⌘↵ envia.
 */
export function ReplyComposer({
  commentId,
  onDone,
  autoFocus,
}: {
  commentId: string
  onDone?: () => void
  autoFocus?: boolean
}) {
  const addReply = useReviewStore((s) => s.addReply)
  const [text, setText] = React.useState("")
  const [submitting, setSubmitting] = React.useState(false)
  const img = useImageAttach()
  const fileRef = React.useRef<HTMLInputElement>(null)
  const taRef = React.useRef<HTMLTextAreaElement>(null)
  const commands = useReviewCommandAutocomplete({
    textareaRef: taRef,
    value: text,
    setValue: setText,
  })

  React.useEffect(() => {
    if (autoFocus) taRef.current?.focus()
  }, [autoFocus])

  const canSubmit = (text.trim().length > 0 || img.images.length > 0) && !submitting

  const submit = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    try {
      await addReply(commentId, text, img.images.length > 0 ? img.images : undefined)
      setText("")
      img.reset()
      onDone?.()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <textarea
        ref={taRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onPaste={img.onPaste}
        placeholder="Escreva uma resposta… cole uma imagem"
        rows={2}
        className="w-full rounded-sm border border-(--border-subtle) bg-(--bg-surface) p-2 body-sm text-(--fg-primary) focus:outline-hidden focus:border-(--accent-brand) resize-none"
        onKeyDown={(e) => {
          if (commands.onKeyDown(e)) return
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") void submit()
        }}
        onSelect={() => commands.sync()}
        onBlur={() => commands.close()}
      />

      <ReviewCommandMenu ac={commands} />

      {img.images.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {img.images.map((src, idx) => (
            <div key={idx} className="relative group/thumb">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt=""
                className="h-14 w-14 rounded-sm object-cover border border-(--border-subtle)"
              />
              <button
                type="button"
                onClick={() => img.remove(idx)}
                aria-label="Remover imagem"
                className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-(--bg-raised) border border-(--border-subtle) flex items-center justify-center text-(--fg-tertiary) hover:text-(--fg-primary) opacity-0 group-hover/thumb:opacity-100 transition-opacity"
              >
                <Icon name="close" size={9} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between gap-1">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={!img.canAddMore}
          aria-label="Anexar imagem"
          title="Anexar imagem (ou cole com ⌘V)"
          className="h-7 w-7 inline-flex items-center justify-center rounded-sm text-(--fg-tertiary) hover:text-(--fg-primary) hover:bg-(--bg-hover) transition-colors disabled:opacity-40"
        >
          <Icon name="image" size={14} weight={600} />
        </button>
        <div className="flex items-center gap-1">
          <AuButton
            variant="ghost"
            size="sm"
            onClick={() => {
              setText("")
              img.reset()
              onDone?.()
            }}
          >
            Cancelar
          </AuButton>
          <AuButton
            variant="primary"
            size="sm"
            loading={submitting}
            disabled={!canSubmit}
            onClick={() => void submit()}
          >
            Responder
          </AuButton>
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
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
