"use client"

import * as React from "react"
import { AuButton } from "@/components/ui/AuButton"
import { AuModal } from "@/components/ui/AuModal"
import { Icon } from "@/components/ui/Icon"
import { useToast } from "@/components/ui/AuToast"
import { useReviewStore } from "@/lib/auis-review/store"
import { OVERLAY_DATA_ATTR, REVIEW_Z } from "./constants"
import type { ReviewExportPayload } from "./types"

export function ReviewExportModal() {
  const open = useReviewStore((s) => s.exportOpen)
  const setExportOpen = useReviewStore((s) => s.setExportOpen)
  const storage = useReviewStore((s) => s.storage)
  const { push } = useToast()

  const [payload, setPayload] = React.useState<ReviewExportPayload | null>(null)
  const json = React.useMemo(
    () => (payload ? JSON.stringify(payload, null, 2) : ""),
    [payload]
  )

  React.useEffect(() => {
    if (!open) {
      setPayload(null)
      return
    }
    void storage.exportAll().then(setPayload)
  }, [open, storage])

  const copy = async () => {
    if (!json) return
    try {
      await navigator.clipboard.writeText(json)
      push({
        title: "Copiado",
        description: "JSON na área de transferência.",
        variant: "success",
      })
    } catch {
      push({
        title: "Não consegui copiar",
        description: "Selecione o texto manualmente.",
        variant: "error",
      })
    }
  }

  const download = () => {
    if (!json) return
    const blob = new Blob([json], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `auis-review-${new Date()
      .toISOString()
      .slice(0, 10)}.json`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
    push({
      title: "Arquivo baixado",
      description: a.download,
      variant: "success",
    })
  }

  const count = payload?.comments.length ?? 0

  return (
    <AuModal
      open={open}
      onClose={() => setExportOpen(false)}
      zIndex={REVIEW_Z.modal}
      title="Exportar comentários"
      footer={
        <div
          {...{ [OVERLAY_DATA_ATTR]: "" }}
          className="flex items-center justify-between gap-2 w-full"
        >
          <span className="body-xs text-(--fg-tertiary)">
            {count} {count === 1 ? "comentário" : "comentários"}
          </span>
          <div className="flex items-center gap-2">
            <AuButton variant="ghost" onClick={() => setExportOpen(false)}>
              Fechar
            </AuButton>
            <AuButton
              variant="secondary"
              iconLeft="content_copy"
              onClick={copy}
              disabled={!json}
            >
              Copiar
            </AuButton>
            <AuButton
              variant="primary"
              iconLeft="download"
              onClick={download}
              disabled={!json}
            >
              Baixar .json
            </AuButton>
          </div>
        </div>
      }
    >
      <div
        {...{ [OVERLAY_DATA_ATTR]: "" }}
        className="flex flex-col gap-3"
      >
        <p className="body-sm text-(--fg-secondary) leading-relaxed flex items-start gap-2">
          <Icon
            name="info"
            size={16}
            className="text-(--fg-tertiary) mt-0.5"
          />
          <span>
            Esses dados ficam só no seu navegador. Compartilhe o JSON
            manualmente até subirmos a v2 do servidor local.
          </span>
        </p>
        <pre className="rounded-sm bg-(--bg-muted) border border-(--border-subtle) p-3 max-h-[40vh] overflow-auto body-xs mono text-(--fg-primary) whitespace-pre">
          {json || "Carregando…"}
        </pre>
      </div>
    </AuModal>
  )
}
