"use client"

import * as React from "react"
import { AuButton } from "@/components/ui/AuButton"
import { Icon } from "@/components/ui/Icon"
import { useReviewStore } from "@/lib/auis-review/store"
import { useImageAttach } from "@/lib/auis-review/useImageAttach"
import { useReviewCommandAutocomplete } from "@/lib/auis-review/useReviewCommandAutocomplete"
import { ReviewCommandMenu } from "./ReviewCommandMenu"

/**
 * "Adicionar ideia futura" no drawer de review — cria um card de backlog avulso
 * (sem pino) via store.addBacklogIdea. Colapsado vira um botão tracejado; aberto,
 * um mini-compositor com texto + imagem opcional (colar ou anexar).
 */
export function BacklogComposer() {
  const addBacklogIdea = useReviewStore((s) => s.addBacklogIdea)
  const [open, setOpen] = React.useState(false)
  const [text, setText] = React.useState("")
  const [saving, setSaving] = React.useState(false)
  const img = useImageAttach()
  const fileRef = React.useRef<HTMLInputElement>(null)
  const taRef = React.useRef<HTMLTextAreaElement>(null)
  const commands = useReviewCommandAutocomplete({
    textareaRef: taRef,
    value: text,
    setValue: setText,
  })

  React.useEffect(() => {
    if (open) taRef.current?.focus()
  }, [open])

  const canSave = (text.trim().length > 0 || img.images.length > 0) && !saving

  const close = () => {
    setText("")
    img.reset()
    setOpen(false)
  }

  const save = async () => {
    if (!canSave) return
    setSaving(true)
    try {
      await addBacklogIdea(text, img.images.length > 0 ? img.images : undefined)
      close()
    } finally {
      setSaving(false)
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-md border border-dashed border-(--border-default) px-3 py-2.5 body-sm text-(--fg-secondary) hover:text-(--fg-primary) hover:border-(--border-strong) inline-flex items-center justify-center gap-1.5 transition-colors"
      >
        <Icon name="lightbulb" size={15} weight={500} />
        Adicionar ideia futura
      </button>
    )
  }

  return (
    <div className="rounded-md border border-(--border-subtle) bg-(--bg-raised) p-2 flex flex-col gap-2">
      <textarea
        ref={taRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onPaste={img.onPaste}
        rows={3}
        placeholder="Descreva a ideia futura… cole uma imagem"
        className="w-full rounded-sm border border-(--border-subtle) bg-(--bg-surface) p-2 body-sm text-(--fg-primary) focus:outline-hidden focus:border-(--accent-brand) resize-none"
        onKeyDown={(e) => {
          if (commands.onKeyDown(e)) return
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") void save()
          if (e.key === "Escape") close()
        }}
        onSelect={() => commands.sync()}
        onBlur={() => commands.close()}
      />

      <ReviewCommandMenu ac={commands} />
      {img.images.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {img.images.map((src, idx) => (
            <div key={idx} className="relative group/bthumb">
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
                className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-(--bg-raised) border border-(--border-subtle) flex items-center justify-center text-(--fg-tertiary) hover:text-(--fg-primary) opacity-0 group-hover/bthumb:opacity-100 transition-opacity"
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
          <AuButton variant="ghost" size="sm" onClick={close}>
            Cancelar
          </AuButton>
          <AuButton
            variant="primary"
            size="sm"
            loading={saving}
            disabled={!canSave}
            onClick={() => void save()}
          >
            Adicionar
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
