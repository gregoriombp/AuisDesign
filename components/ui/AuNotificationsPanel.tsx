"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Icon } from "@/components/ui/Icon"
import { NotificationRow } from "@/components/NotificationRow"
import { NOTIFICATIONS, type AppNotification } from "@/lib/notifications"

/**
 * Painel de notificações da plataforma (sino da topbar). Feed simples de itens
 * recentes — SEM abas/toggle — reusando o NotificationRow do design system.
 * A única ação de navegação fica no rodapé: "Ver todas as notificações".
 *
 * É um produto-componente (não um primitivo): compõe header + lista + rodapé.
 * Posiciona-se ancorado ao gatilho (canto superior direito), igual a um popover.
 */
export type AuNotificationsPanelProps = {
  isOpen: boolean
  onClose: () => void
  /** Feed a exibir. Default = fixture NOTIFICATIONS. */
  notifications?: AppNotification[]
  /** Quantos itens mostrar antes do "Ver todas". Default 6. */
  limit?: number
  /** Rota da página com todas as notificações. */
  seeAllHref?: string
  /** Classe extra no wrapper posicionado. */
  className?: string
}

export function AuNotificationsPanel({
  isOpen,
  onClose,
  notifications = NOTIFICATIONS,
  limit = 6,
  seeAllHref = "/notifications",
  className,
}: AuNotificationsPanelProps) {
  const router = useRouter()
  const [readIds, setReadIds] = React.useState<Set<string>>(new Set())

  if (!isOpen) return null

  const withRead = notifications.map((n) =>
    readIds.has(n.id) ? { ...n, read: true } : n
  )
  const items = withRead.slice(0, limit)
  const unread = withRead.filter((n) => !n.read).length

  const markAllRead = () =>
    setReadIds(new Set(notifications.map((n) => n.id)))

  const activate = (n: AppNotification) => {
    setReadIds((prev) => {
      const next = new Set(prev)
      next.add(n.id)
      return next
    })
    onClose()
    if (n.href) router.push(n.href)
  }

  return (
    <div
      className={["absolute right-0 top-[calc(100%+14px)] z-50", className ?? ""].join(" ")}
    >
      {/* Caret apontando pro sino */}
      <div className="absolute -top-2 right-9 h-4 w-4 rotate-45 border-l border-t border-(--border-subtle) bg-(--bg-raised)" />

      <div
        role="dialog"
        aria-label="Notificações"
        className="w-[420px] max-w-[calc(100vw-32px)] overflow-hidden rounded-xl border border-(--border-subtle) bg-(--bg-raised) shadow-(--shadow-lg)"
      >
        {/* Header — sem abas/toggle, só título + contagem + marcar todas */}
        <div className="flex items-center justify-between gap-2 border-b border-(--border-subtle) px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="body-md font-semibold text-(--fg-primary)">
              Notificações
            </span>
            {unread > 0 && (
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-(--au-blue-100) px-1.5 body-xs font-semibold tabular-nums text-(--au-blue-700)">
                {unread}
              </span>
            )}
          </div>
          {unread > 0 && (
            <button
              type="button"
              onClick={markAllRead}
              className="inline-flex items-center gap-1 rounded-sm px-2 py-1 body-xs font-medium text-(--fg-tertiary) transition-colors hover:bg-(--bg-muted) hover:text-(--fg-primary)"
            >
              <Icon name="done_all" size={14} />
              Marcar todas como lidas
            </button>
          )}
        </div>

        {/* Feed */}
        {items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-(--bg-muted) text-(--fg-tertiary)">
              <Icon name="notifications" size={20} />
            </span>
            <p className="m-0 body-sm text-fg-secondary">
              Tudo em dia — nenhuma notificação por aqui.
            </p>
          </div>
        ) : (
          <ul className="m-0 flex max-h-[60vh] list-none flex-col divide-y divide-(--border-subtle) overflow-auto p-0">
            {items.map((n) => (
              <li key={n.id}>
                <NotificationRow notification={n} onActivate={activate} />
              </li>
            ))}
          </ul>
        )}

        {/* Rodapé — única entrada pra "ver todas" */}
        <Link
          href={seeAllHref}
          onClick={onClose}
          className="flex items-center justify-center gap-1 border-t border-(--border-subtle) px-4 py-3 body-sm font-medium text-(--fg-secondary) transition-colors hover:bg-(--bg-muted) hover:text-(--fg-primary)"
        >
          Ver todas as notificações
          <Icon name="arrow_forward" size={14} />
        </Link>
      </div>
    </div>
  )
}
