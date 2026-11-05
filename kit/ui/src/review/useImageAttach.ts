"use client"

import * as React from "react"
import { fileToHighResDataUrl } from "./imageScale"

export const MAX_ATTACH_IMAGES = 4

/**
 * The raster types the bridge stores. An SVG is a document that can run script,
 * so the server answers it with 415; filtering here keeps it out of the draft.
 */
const RASTER_TYPE = /^image\/(png|jpe?g|gif|webp|avif)$/i

/** The file picker's `accept`, the same list. */
export const ATTACH_ACCEPT = "image/png,image/jpeg,image/gif,image/webp,image/avif"

export function isAttachableImage(type: string): boolean {
  return RASTER_TYPE.test(type)
}

/** Extract the image files from a clipboard payload (Cmd+V paste). */
export function extractImagesFromClipboard(items: DataTransferItemList): File[] {
  const files: File[] = []
  for (const item of Array.from(items)) {
    if (isAttachableImage(item.type)) {
      const file = item.getAsFile()
      if (file) files.push(file)
    }
  }
  return files
}

/**
 * Image-attachment state + handlers (data URLs), shared by the reply composer,
 * the comment editor and the future-idea card. Converts to the same base64 data
 * URL the main composer's file picker produces.
 */
export function useImageAttach(initial: string[] = [], max = MAX_ATTACH_IMAGES) {
  const [images, setImages] = React.useState<string[]>(initial)

  const add = React.useCallback(
    async (files: File[]) => {
      const eligible = files.filter((f) => isAttachableImage(f.type)).slice(0, max)
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
