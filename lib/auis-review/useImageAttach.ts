"use client"

import * as React from "react"
import { fileToHighResDataUrl } from "@/lib/auis-review/imageScale"

export const MAX_ATTACH_IMAGES = 4

/** Extrai os arquivos de imagem de um clipboard (colar Cmd+V). */
export function extractImagesFromClipboard(items: DataTransferItemList): File[] {
  const files: File[] = []
  for (const item of Array.from(items)) {
    if (item.type.startsWith("image/")) {
      const file = item.getAsFile()
      if (file) files.push(file)
    }
  }
  return files
}

/**
 * Estado + handlers de anexo de imagem (data URLs), reusado pelo compositor de
 * resposta, pela edição de comentário e pelo card de ideia futura. Converte no
 * mesmo data URL base64 do seletor de arquivos do composer principal.
 */
export function useImageAttach(initial: string[] = [], max = MAX_ATTACH_IMAGES) {
  const [images, setImages] = React.useState<string[]>(initial)

  const add = React.useCallback(
    async (files: File[]) => {
      const eligible = files.filter((f) => f.type.startsWith("image/")).slice(0, max)
      if (eligible.length === 0) return
      const dataUrls = await Promise.all(eligible.map(fileToHighResDataUrl))
      setImages((prev) => [...prev, ...dataUrls].slice(0, max))
    },
    [max]
  )

  const onPaste = React.useCallback(
    async (e: React.ClipboardEvent) => {
      if (!e.clipboardData) return
      const files = extractImagesFromClipboard(e.clipboardData.items)
      if (files.length > 0) {
        e.preventDefault()
        await add(files)
      }
    },
    [add]
  )

  const remove = React.useCallback(
    (idx: number) => setImages((prev) => prev.filter((_, i) => i !== idx)),
    []
  )

  const reset = React.useCallback((next: string[] = []) => setImages(next), [])

  return {
    images,
    add,
    onPaste,
    remove,
    reset,
    max,
    canAddMore: images.length < max,
  }
}
