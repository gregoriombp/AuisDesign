"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { AuButton } from "@/components/ui/AuButton"
import { AuPill, type AuPillVariant } from "@/components/ui/AuPill"
import { AuSheet } from "@/components/ui/AuSheet"
import { Icon } from "@/components/ui/Icon"
import type { ProjectScreen, ScreenStatus } from "../_data/projects"

type ActionKind = "restyle" | "build"
type ReqState = "idle" | "loading" | "sent" | "error"

const STATUS_PILL: Record<
  ScreenStatus,
  { variant: AuPillVariant; label: string }
> = {
  imported: { variant: "neutral", label: "Importada" },
  restyled: { variant: "beta", label: "No DS" },
  built: { variant: "live", label: "No repo" },
}

function figmaDeepLink(fileKey: string, nodeId: string): string {
  return `https://www.figma.com/design/${fileKey}?node-id=${nodeId.replace(":", "-")}`
}

/**
 * Grade de telas de UMA seção. Cliente porque (1) abre o preview em tamanho
 * grande (AuSheet com paginação ↑/↓) e (2) dispara os pedidos de ação por tela
 * pro /api/project-builds. O feedback é inline (sem toast — evita depender do
 * AuToastProvider no shell do Auis).
 */
export function ScreenGrid({
  projectSlug,
  figmaFileKey,
  screens,
}: {
  projectSlug: string
  figmaFileKey: string
  screens: ProjectScreen[]
}) {
  const [openIndex, setOpenIndex] = React.useState<number | null>(null)
  const [req, setReq] = React.useState<Record<string, ReqState>>({})

  const current = openIndex !== null ? screens[openIndex] : null

  async function requestAction(screen: ProjectScreen, kind: ActionKind) {
    const key = `${screen.id}:${kind}`
    setReq((r) => ({ ...r, [key]: "loading" }))
    try {
      const res = await fetch("/api/project-builds", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          projectSlug,
          screenId: screen.id,
          screenName: screen.name,
          kind,
          figmaFileKey,
          figmaNodeId: screen.figmaNodeId,
          thumbnail: screen.thumbnail,
        }),
      })
      if (!res.ok) throw new Error(String(res.status))
      setReq((r) => ({ ...r, [key]: "sent" }))
    } catch {
      setReq((r) => ({ ...r, [key]: "error" }))
    }
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {screens.map((s, i) => {
          const pill = STATUS_PILL[s.status]
          const isBuilt = s.status === "built" && s.builtRoute
          return (
            <div
              key={s.id}
              className="flex flex-col gap-3 rounded-2xl border border-(--border-subtle) bg-(--bg-raised) p-3"
            >
              <button
                type="button"
                onClick={() => setOpenIndex(i)}
                className="group relative aspect-video w-full overflow-hidden rounded-lg border border-(--border-subtle) bg-(--bg-surface) cursor-pointer"
                aria-label={`Ver ${s.name} em tamanho grande`}
              >
                <Image
                  src={s.thumbnail}
                  alt={s.name}
                  fill
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                  className="object-contain transition-transform duration-200 group-hover:scale-[1.02]"
                />
                <span className="absolute inset-0 flex items-center justify-center bg-black/0 transition group-hover:bg-black/20">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-(--bg-inverse) px-3 py-1.5 text-xs text-(--fg-on-inverse) opacity-0 transition group-hover:opacity-100">
                    <Icon name="fullscreen" size={16} /> Ampliar
                  </span>
                </span>
              </button>

              <div className="flex items-center justify-between gap-2 px-1">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{s.name}</p>
                  <p className="text-[11px] text-(--fg-tertiary)">{s.step}</p>
                </div>
                {isBuilt ? (
                  <Link href={s.builtRoute!} className="no-underline shrink-0">
                    <AuPill variant={pill.variant}>{pill.label}</AuPill>
                  </Link>
                ) : (
                  <AuPill variant={pill.variant}>{pill.label}</AuPill>
                )}
              </div>

              <div className="flex flex-col gap-2 px-1 pb-1">
                <ActionButton
                  variant="ai"
                  icon="auto_fix_high"
                  label="Atualizar pro design system"
                  state={req[`${s.id}:restyle`] ?? "idle"}
                  onClick={() => requestAction(s, "restyle")}
                />
                {isBuilt ? (
                  <Link href={s.builtRoute!} className="no-underline">
                    <AuButton variant="secondary" block iconRight="open_in_new">
                      Ver no repo
                    </AuButton>
                  </Link>
                ) : (
                  <ActionButton
                    variant="primary"
                    icon="terminal"
                    label="Construir no repo"
                    state={req[`${s.id}:build`] ?? "idle"}
                    onClick={() => requestAction(s, "build")}
                  />
                )}
              </div>
            </div>
          )
        })}
      </div>

      <AuSheet
        open={openIndex !== null}
        onClose={() => setOpenIndex(null)}
        size="xwide"
        title={current?.name}
        meta={current ? `${current.step} · ${current.section}` : undefined}
        onPrev={
          openIndex !== null && openIndex > 0
            ? () => setOpenIndex(openIndex - 1)
            : undefined
        }
        onNext={
          openIndex !== null && openIndex < screens.length - 1
            ? () => setOpenIndex(openIndex + 1)
            : undefined
        }
      >
        {current && (
          <div className="flex flex-col gap-4">
            <div className="w-full overflow-hidden rounded-lg border border-(--border-subtle) bg-(--bg-surface)">
              <Image
                src={current.thumbnail}
                alt={current.name}
                width={current.w}
                height={current.h}
                className="h-auto w-full"
              />
            </div>
            <div className="flex items-center justify-between gap-3 text-xs text-(--fg-tertiary)">
              <span>
                Tela {openIndex! + 1} de {screens.length} · use ↑ / ↓ pra navegar
              </span>
              <a
                href={figmaDeepLink(figmaFileKey, current.figmaNodeId)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-(--fg-secondary) no-underline hover:text-(--fg-primary)"
              >
                Ver no Figma <Icon name="open_in_new" size={14} />
              </a>
            </div>
          </div>
        )}
      </AuSheet>
    </>
  )
}

function ActionButton({
  variant,
  icon,
  label,
  state,
  onClick,
}: {
  variant: "ai" | "primary"
  icon: string
  label: string
  state: ReqState
  onClick: () => void
}) {
  if (state === "sent") {
    return (
      <AuButton variant="subtle" block iconLeft="check" disabled>
        Pedido enviado
      </AuButton>
    )
  }
  return (
    <AuButton
      variant={variant}
      block
      iconLeft={icon}
      loading={state === "loading"}
      onClick={onClick}
    >
      {state === "error" ? "Falhou — tentar de novo" : label}
    </AuButton>
  )
}
