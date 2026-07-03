"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ReviewAvatar } from "@/components/auis-review/ReviewAvatar"
import { AuButton } from "@/components/ui/AuButton"
import { AuDropdownMenu, type AuDropdownItem } from "@/components/ui/AuDropdownMenu"
import {
  AuEmpty,
  AuEmptyDescription,
  AuEmptyHeader,
  AuEmptyMedia,
  AuEmptyTitle,
} from "@/components/ui/AuEmpty"
import { AuInput } from "@/components/ui/AuInput"
import { AuPill } from "@/components/ui/AuPill"
import { AuStatCard } from "@/components/ui/AuStatCard"
import { Icon } from "@/components/ui/Icon"
import { useReviewStore } from "@/lib/auis-review/store"
import type { ReviewComment } from "@/components/auis-review/types"

type Tab = "open" | "in_review" | "archive"

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}

function formatTimestamp(ts: number): string {
  const d = new Date(ts)
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()} · ${pad2(
    d.getHours()
  )}:${pad2(d.getMinutes())}`
}

function StatusPill({ status }: { status: ReviewComment["status"] }) {
  if (status === "in_review") return <AuPill variant="beta">Em revisão</AuPill>
  if (status === "resolved") return <AuPill variant="live">Resolvido</AuPill>
  return <AuPill variant="draft">Aberto</AuPill>
}

function CommentCard({
  comment,
  archived,
  selectable,
  selected,
  onToggleSelected,
}: {
  comment: ReviewComment
  archived: boolean
  selectable: boolean
  selected: boolean
  onToggleSelected: () => void
}) {
  const router = useRouter()
  const archiveDirect = useReviewStore((s) => s.archiveDirect)
  const approveComment = useReviewStore((s) => s.approveComment)
  const rejectComment = useReviewStore((s) => s.rejectComment)
  const reopenFromArchive = useReviewStore((s) => s.reopenFromArchive)
  const deleteComment = useReviewStore((s) => s.deleteComment)
  const selectComment = useReviewStore((s) => s.selectComment)
  const setSheetOpen = useReviewStore((s) => s.setSheetOpen)
  const setActive = useReviewStore((s) => s.setActive)

  // Abre a tela do comentário mantendo o Review Mode ligado e o comentário
  // destacado (permalink), via navegação client-side — sem reload.
  const openOnScreen = () => {
    selectComment(comment.id)
    setActive(true)
    setSheetOpen(true)
    const sep = comment.url.includes("?") ? "&" : "?"
    router.push(`${comment.url}${sep}reviewCommentId=${encodeURIComponent(comment.id)}`)
  }

  const items: AuDropdownItem[] = [
    {
      id: "open",
      label: "Abrir tela",
      icon: "open_in_new",
      onSelect: openOnScreen,
    },
  ]
  if (archived) {
    items.push({
      id: "reopen",
      label: "Reabrir",
      icon: "refresh",
      onSelect: () => void reopenFromArchive(comment.id),
    })
  } else if (comment.status === "in_review") {
    items.push(
      {
        id: "approve",
        label: "Aprovar",
        icon: "check_circle",
        onSelect: () => void approveComment(comment.id),
      },
      {
        id: "reject",
        label: "Rejeitar",
        icon: "undo",
        onSelect: () => void rejectComment(comment.id),
      }
    )
  } else {
    items.push({
      id: "archive",
      label: "Marcar como resolvido",
      icon: "check_circle",
      onSelect: () => void archiveDirect(comment.id),
    })
  }
  items.push(
    { id: "sep", separator: true },
    {
      id: "delete",
      label: "Excluir",
      icon: "delete",
      danger: true,
      onSelect: () => void deleteComment(comment.id),
    }
  )

  return (
    <div className="flex items-start gap-3 px-4 py-3 rounded-md border border-(--border-subtle) bg-(--bg-raised) hover:bg-(--bg-hover)">
      {selectable && (
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelected}
          aria-label="Selecionar"
          className="mt-1 accent-(--accent-brand)"
        />
      )}
      <ReviewAvatar
        authorId={comment.authorId}
        authorName={comment.authorName}
        colorToken={comment.authorColorToken}
        size={28}
        className="mt-0.5"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-medium text-(--fg-primary) truncate">
            {comment.authorName}
          </span>
          <StatusPill status={comment.status} />
          <span className="text-[11px] text-(--fg-tertiary) tabular-nums ml-auto">
            {formatTimestamp(comment.createdAt)}
          </span>
        </div>
        <p className="m-0 text-sm text-(--fg-primary) whitespace-pre-wrap line-clamp-3">
          {comment.text}
        </p>
        {comment.resolution?.summary && (
          <p className="m-0 mt-1 text-[11px] text-(--fg-tertiary) italic">
            {comment.resolution.summary}
          </p>
        )}
        <button
          type="button"
          onClick={openOnScreen}
          className="mt-1 inline-flex items-center gap-1 text-[11px] text-(--fg-tertiary) hover:text-(--accent-brand)"
          title={`Ir para ${comment.url}`}
        >
          <Icon name="web_asset" size={11} />
          <span className="truncate max-w-[280px]">{comment.url}</span>
          <Icon name="arrow_outward" size={11} />
        </button>
      </div>
      <AuDropdownMenu
        align="end"
        trigger={
          <button
            type="button"
            aria-label="Ações"
            className="h-7 w-7 inline-flex items-center justify-center rounded-sm text-(--fg-tertiary) hover:text-(--fg-primary) hover:bg-(--bg-hover)"
          >
            <Icon name="more_horiz" size={14} />
          </button>
        }
        items={items}
      />
    </div>
  )
}

export function CommentsPanel() {
  const comments = useReviewStore((s) => s.comments)
  const archivedComments = useReviewStore((s) => s.archivedComments)
  const archiveLoaded = useReviewStore((s) => s.archiveLoaded)
  const archiveCursor = useReviewStore((s) => s.archiveCursor)
  const refresh = useReviewStore((s) => s.refreshFromStorage)
  const loadArchivePage = useReviewStore((s) => s.loadArchivePage)
  const approveComment = useReviewStore((s) => s.approveComment)
  const rejectComment = useReviewStore((s) => s.rejectComment)
  const backend = useReviewStore((s) => s.backend)
  const storage = useReviewStore((s) => s.storage)

  React.useEffect(() => {
    void refresh()
    void loadArchivePage(true)
    const unsubscribe = storage.subscribe?.(() => {
      void refresh()
      void loadArchivePage(true)
    })
    return unsubscribe
  }, [refresh, loadArchivePage, storage])

  const [tab, setTab] = React.useState<Tab>("open")
  const [search, setSearch] = React.useState("")
  const [groupByUrl, setGroupByUrl] = React.useState(true)
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set())
  const [bulkBusy, setBulkBusy] = React.useState(false)

  React.useEffect(() => {
    setSelectedIds(new Set())
  }, [tab])

  const openCount = comments.filter((c) => c.status === "open").length
  const inReviewCount = comments.filter((c) => c.status === "in_review").length
  const archivedCount = archivedComments.length

  const source: ReviewComment[] = React.useMemo(() => {
    if (tab === "open") return comments.filter((c) => c.status === "open")
    if (tab === "in_review") return comments.filter((c) => c.status === "in_review")
    return archivedComments
  }, [tab, comments, archivedComments])

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return source
    return source.filter((c) => c.text.toLowerCase().includes(q))
  }, [source, search])

  const sorted = React.useMemo(
    () => [...filtered].sort((a, b) => b.createdAt - a.createdAt),
    [filtered]
  )

  const grouped = React.useMemo(() => {
    if (!groupByUrl) return null
    const map = new Map<string, ReviewComment[]>()
    for (const c of sorted) {
      const arr = map.get(c.url) ?? []
      arr.push(c)
      map.set(c.url, arr)
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]))
  }, [sorted, groupByUrl])

  const selectableTab = tab === "in_review"

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const runBulk = async (action: (id: string) => Promise<void>) => {
    setBulkBusy(true)
    try {
      for (const id of Array.from(selectedIds)) await action(id)
      setSelectedIds(new Set())
    } finally {
      setBulkBusy(false)
    }
  }

  const renderList = (items: ReviewComment[]) => (
    <div className="flex flex-col gap-2">
      {items.map((c) => (
        <CommentCard
          key={c.id}
          comment={c}
          archived={tab === "archive"}
          selectable={selectableTab}
          selected={selectedIds.has(c.id)}
          onToggleSelected={() => toggleSelected(c.id)}
        />
      ))}
    </div>
  )

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <AuStatCard icon="forum" label="Total ativos" value={comments.length} />
        <AuStatCard icon="pending" label="Abertos" value={openCount} />
        <AuStatCard icon="hourglass_top" label="Em revisão" value={inReviewCount} />
        <AuStatCard icon="archive" label="Arquivados" value={archivedCount} />
      </div>

      <div className="rounded-lg border border-(--border-subtle) bg-(--bg-raised) p-4 flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[200px] max-w-md">
          <AuInput
            iconLeft="search"
            placeholder="Buscar texto…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-1 p-1 rounded-full bg-(--bg-muted) text-[11px] font-medium">
          {(["open", "in_review", "archive"] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={[
                "px-3 py-1 rounded-full transition-colors inline-flex items-center gap-1.5",
                tab === t
                  ? "bg-(--bg-raised) text-(--fg-primary) shadow-sm"
                  : "text-(--fg-secondary) hover:text-(--fg-primary)",
              ].join(" ")}
            >
              {t === "open" ? "Abertos" : t === "in_review" ? "Em revisão" : "Arquivados"}
              {t === "in_review" && inReviewCount > 0 && (
                <span className="min-w-4 h-4 px-1 inline-flex items-center justify-center rounded-full text-[10px] font-semibold bg-(--au-amber-100) text-(--au-amber-700) tabular-nums">
                  {inReviewCount}
                </span>
              )}
            </button>
          ))}
        </div>

        <label className="flex items-center gap-2 text-xs text-(--fg-secondary) cursor-pointer">
          <input
            type="checkbox"
            checked={groupByUrl}
            onChange={(e) => setGroupByUrl(e.target.checked)}
            className="accent-(--accent-brand)"
          />
          Agrupar por tela
        </label>

        <span className="ml-auto inline-flex items-center gap-2 text-[11px] text-(--fg-tertiary)">
          <Icon name={backend === "bridge" ? "cloud_done" : "save"} size={13} />
          {backend === "bridge" ? "Bridge local" : "localStorage"}
        </span>

        <AuButton
          variant="ghost"
          size="sm"
          iconLeft="refresh"
          onClick={() => {
            void refresh()
            void loadArchivePage(true)
          }}
        >
          Atualizar
        </AuButton>
      </div>

      {selectableTab && selectedIds.size > 0 && (
        <div className="flex items-center justify-between gap-3 px-4 py-2 rounded-md bg-(--bg-muted) border border-(--border-subtle)">
          <span className="text-sm text-(--fg-secondary)">
            {selectedIds.size} selecionado{selectedIds.size === 1 ? "" : "s"}
          </span>
          <div className="flex items-center gap-2">
            <AuButton
              variant="primary"
              size="sm"
              iconLeft="check_circle"
              loading={bulkBusy}
              disabled={bulkBusy}
              onClick={() => void runBulk(approveComment)}
            >
              Aprovar selecionados
            </AuButton>
            <AuButton
              variant="secondary"
              size="sm"
              iconLeft="undo"
              disabled={bulkBusy}
              onClick={() => void runBulk(rejectComment)}
            >
              Rejeitar selecionados
            </AuButton>
          </div>
        </div>
      )}

      {sorted.length === 0 ? (
        <AuEmpty>
          <AuEmptyHeader>
            <AuEmptyMedia variant="icon">
              <Icon name="forum" size={20} />
            </AuEmptyMedia>
            <AuEmptyTitle>
              {tab === "archive" && !archiveLoaded
                ? "Carregando arquivados…"
                : tab === "in_review"
                ? "Nada esperando revisão"
                : tab === "archive"
                ? "Nenhum arquivado ainda"
                : comments.length === 0
                ? "Nenhum comentário ainda"
                : "Nada com esses filtros"}
            </AuEmptyTitle>
            <AuEmptyDescription>
              {tab === "open" && comments.length === 0
                ? "Ative o Review Mode (⌘⇧Y) em qualquer tela e desenhe o primeiro comentário."
                : tab === "in_review"
                ? "Quando um agente marcar algo como resolvido, ele aparece aqui pra você aprovar ou rejeitar."
                : "Tente afrouxar a busca."}
            </AuEmptyDescription>
          </AuEmptyHeader>
        </AuEmpty>
      ) : grouped ? (
        <div className="flex flex-col gap-6">
          {grouped.map(([url, items]) => (
            <section key={url} className="flex flex-col gap-3">
              <header className="flex items-center gap-2 min-w-0">
                <Icon name="web_asset" size={14} className="text-(--fg-tertiary) shrink-0" />
                <Link
                  href={url}
                  className="text-sm text-(--fg-primary) hover:text-(--accent-brand) truncate"
                >
                  {url}
                </Link>
                <span className="text-xs text-(--fg-tertiary) shrink-0">
                  {items.length} no total
                </span>
              </header>
              {renderList(items)}
            </section>
          ))}
        </div>
      ) : (
        renderList(sorted)
      )}

      {tab === "archive" && archiveCursor && (
        <div className="flex justify-center">
          <AuButton
            variant="ghost"
            size="sm"
            iconLeft="expand_more"
            onClick={() => void loadArchivePage(false)}
          >
            Carregar mais arquivados
          </AuButton>
        </div>
      )}
    </div>
  )
}
