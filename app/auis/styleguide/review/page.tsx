"use client"

import * as React from "react"
import Link from "next/link"
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
import { PageHero } from "../_primitives"

type Tab = "open" | "in_review" | "archive"
type SortKey = "createdAt" | "author" | "url" | "status"
type SortDir = "asc" | "desc"

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}

function formatTimestamp(ts: number): string {
  const d = new Date(ts)
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()} · ${pad2(
    d.getHours()
  )}:${pad2(d.getMinutes())}`
}

function relative(ts: number): string {
  const diff = Date.now() - ts
  const m = Math.floor(diff / 60_000)
  if (m < 1) return "agora"
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d`
  return new Date(ts).toLocaleDateString("pt-BR")
}

function SortHeader({
  label,
  sortKey,
  current,
  direction,
  onClick,
}: {
  label: string
  sortKey: SortKey
  current: SortKey
  direction: SortDir
  onClick: (k: SortKey) => void
}) {
  const active = current === sortKey
  return (
    <button
      type="button"
      onClick={() => onClick(sortKey)}
      className={[
        "inline-flex items-center gap-1 text-[11px] uppercase tracking-wide font-medium",
        active
          ? "text-(--fg-primary)"
          : "text-(--fg-tertiary) hover:text-(--fg-secondary)",
      ].join(" ")}
    >
      {label}
      {active && (
        <Icon
          name={direction === "asc" ? "arrow_upward" : "arrow_downward"}
          size={12}
        />
      )}
    </button>
  )
}

function StatusPill({ status }: { status: ReviewComment["status"] }) {
  if (status === "in_review") return <AuPill variant="beta">Em revisão</AuPill>
  if (status === "resolved") return <AuPill variant="live">Resolvido</AuPill>
  return <AuPill variant="draft">Aberto</AuPill>
}

function CommentRow({
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
  onToggleSelected?: () => void
}) {
  const archiveDirect = useReviewStore((s) => s.archiveDirect)
  const approveComment = useReviewStore((s) => s.approveComment)
  const rejectComment = useReviewStore((s) => s.rejectComment)
  const reopenFromArchive = useReviewStore((s) => s.reopenFromArchive)
  const deleteComment = useReviewStore((s) => s.deleteComment)
  const selectComment = useReviewStore((s) => s.selectComment)
  const setSheetOpen = useReviewStore((s) => s.setSheetOpen)

  const dropdownItems: AuDropdownItem[] = [
    {
      id: "open",
      label: "Abrir tela",
      icon: "open_in_new",
      onSelect: () => {
        selectComment(comment.id)
        setSheetOpen(true)
        window.location.href = comment.url
      },
    },
  ]

  if (archived) {
    dropdownItems.push({
      id: "reopen",
      label: "Reabrir",
      icon: "refresh",
      onSelect: () => void reopenFromArchive(comment.id),
    })
  } else if (comment.status === "in_review") {
    dropdownItems.push(
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
    dropdownItems.push({
      id: "archive",
      label: "Marcar como resolvido",
      icon: "check_circle",
      onSelect: () => void archiveDirect(comment.id),
    })
  }

  dropdownItems.push(
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
    <tr className="border-b border-(--border-subtle) hover:bg-(--bg-hover)">
      {selectable && (
        <td className="px-3 py-3 align-top w-8">
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onToggleSelected?.()}
            aria-label="Selecionar"
            className="accent-(--accent-brand)"
          />
        </td>
      )}
      <td className="px-3 py-3 align-top">
        <StatusPill status={comment.status} />
      </td>
      <td className="px-3 py-3 align-top">
        <Link
          href={comment.url}
          className="inline-flex items-center gap-1 text-[11px] text-(--fg-secondary) hover:text-(--accent-brand)"
          title={comment.url}
        >
          <Icon name="open_in_new" size={11} />
          <span className="truncate max-w-[200px]">{comment.url}</span>
        </Link>
      </td>
      <td className="px-3 py-3 align-top">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="h-6 w-6 shrink-0 rounded-full flex items-center justify-center text-[11px] font-semibold text-(--fg-on-inverse)"
            style={{ background: comment.authorColorToken }}
          >
            {comment.authorName.charAt(0).toUpperCase()}
          </span>
          <span className="text-sm text-(--fg-primary) truncate">
            {comment.authorName}
          </span>
        </div>
      </td>
      <td className="px-3 py-3 align-top max-w-[420px]">
        <p className="m-0 text-sm text-(--fg-primary) line-clamp-3 whitespace-pre-wrap">
          {comment.text}
        </p>
        {comment.resolution?.summary && (
          <p className="m-0 mt-1 text-[11px] text-(--fg-tertiary) italic">
            {comment.resolution.summary}
          </p>
        )}
      </td>
      <td className="px-3 py-3 align-top">
        <div
          className="text-xs text-(--fg-tertiary) tabular-nums"
          title={formatTimestamp(comment.createdAt)}
        >
          {formatTimestamp(comment.createdAt)}
        </div>
        <div className="text-[11px] text-(--fg-tertiary)">
          {relative(comment.createdAt)}
        </div>
      </td>
      <td className="px-3 py-3 align-top text-right">
        <AuDropdownMenu
          trigger={
            <button
              type="button"
              aria-label="Ações"
              className="h-7 w-7 inline-flex items-center justify-center rounded-sm text-(--fg-tertiary) hover:text-(--fg-primary) hover:bg-(--bg-hover)"
            >
              <Icon name="more_horiz" size={14} />
            </button>
          }
          items={dropdownItems}
        />
      </td>
    </tr>
  )
}

export default function ReviewInboxPage() {
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
  const [authorId, setAuthorId] = React.useState<string>("all")
  const [search, setSearch] = React.useState("")
  const [sortKey, setSortKey] = React.useState<SortKey>("createdAt")
  const [sortDir, setSortDir] = React.useState<SortDir>("desc")
  const [groupByUrl, setGroupByUrl] = React.useState(true)
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set())
  const [bulkBusy, setBulkBusy] = React.useState(false)

  React.useEffect(() => {
    setSelectedIds(new Set())
  }, [tab])

  const openCount = comments.filter((c) => c.status === "open").length
  const inReviewCount = comments.filter((c) => c.status === "in_review").length
  const archivedCount = archivedComments.length

  const allForAuthors = React.useMemo(
    () => [...comments, ...archivedComments],
    [comments, archivedComments]
  )

  const authors = React.useMemo(() => {
    const seen = new Map<string, string>()
    for (const c of allForAuthors) {
      if (!seen.has(c.authorId)) seen.set(c.authorId, c.authorName)
    }
    return Array.from(seen.entries())
  }, [allForAuthors])

  const source: ReviewComment[] = React.useMemo(() => {
    if (tab === "open") return comments.filter((c) => c.status === "open")
    if (tab === "in_review") return comments.filter((c) => c.status === "in_review")
    return archivedComments
  }, [tab, comments, archivedComments])

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase()
    return source.filter((c) => {
      if (authorId !== "all" && c.authorId !== authorId) return false
      if (q && !c.text.toLowerCase().includes(q)) return false
      return true
    })
  }, [source, authorId, search])

  const sorted = React.useMemo(() => {
    const arr = [...filtered]
    arr.sort((a, b) => {
      let cmp = 0
      switch (sortKey) {
        case "createdAt":
          cmp = a.createdAt - b.createdAt
          break
        case "author":
          cmp = a.authorName.localeCompare(b.authorName)
          break
        case "url":
          cmp = a.url.localeCompare(b.url)
          break
        case "status":
          cmp = a.status.localeCompare(b.status)
          break
      }
      return sortDir === "asc" ? cmp : -cmp
    })
    return arr
  }, [filtered, sortKey, sortDir])

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

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortKey(key)
      setSortDir("desc")
    }
  }

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectAllVisible = () => {
    setSelectedIds(new Set(sorted.map((c) => c.id)))
  }

  const clearSelection = () => setSelectedIds(new Set())

  const bulkApprove = async () => {
    setBulkBusy(true)
    try {
      for (const id of Array.from(selectedIds)) {
        await approveComment(id)
      }
      setSelectedIds(new Set())
    } finally {
      setBulkBusy(false)
    }
  }

  const bulkReject = async () => {
    setBulkBusy(true)
    try {
      for (const id of Array.from(selectedIds)) {
        await rejectComment(id)
      }
      setSelectedIds(new Set())
    } finally {
      setBulkBusy(false)
    }
  }

  const selectableTab = tab === "in_review"

  const renderTable = (items: ReviewComment[]) => (
    <div className="rounded-lg border border-(--border-subtle) bg-(--bg-raised) overflow-hidden">
      <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
        <thead className="bg-(--bg-surface) border-b border-(--border-subtle)">
          <tr>
            {selectableTab && (
              <th className="px-3 py-2 text-left w-8">
                <input
                  type="checkbox"
                  checked={items.length > 0 && items.every((c) => selectedIds.has(c.id))}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedIds((prev) => {
                        const next = new Set(prev)
                        items.forEach((c) => next.add(c.id))
                        return next
                      })
                    } else {
                      setSelectedIds((prev) => {
                        const next = new Set(prev)
                        items.forEach((c) => next.delete(c.id))
                        return next
                      })
                    }
                  }}
                  aria-label="Selecionar tudo"
                  className="accent-(--accent-brand)"
                />
              </th>
            )}
            <th className="px-3 py-2 text-left">
              <SortHeader
                label="Status"
                sortKey="status"
                current={sortKey}
                direction={sortDir}
                onClick={toggleSort}
              />
            </th>
            <th className="px-3 py-2 text-left">
              <SortHeader
                label="Tela"
                sortKey="url"
                current={sortKey}
                direction={sortDir}
                onClick={toggleSort}
              />
            </th>
            <th className="px-3 py-2 text-left">
              <SortHeader
                label="Autor"
                sortKey="author"
                current={sortKey}
                direction={sortDir}
                onClick={toggleSort}
              />
            </th>
            <th className="px-3 py-2 text-left">
              <span className="text-[11px] uppercase tracking-wide font-medium text-(--fg-tertiary)">
                Comentário
              </span>
            </th>
            <th className="px-3 py-2 text-left">
              <SortHeader
                label="Data"
                sortKey="createdAt"
                current={sortKey}
                direction={sortDir}
                onClick={toggleSort}
              />
            </th>
            <th className="px-3 py-2 w-12" />
          </tr>
        </thead>
        <tbody>
          {items.map((c) => (
            <CommentRow
              key={c.id}
              comment={c}
              archived={tab === "archive"}
              selectable={selectableTab}
              selected={selectedIds.has(c.id)}
              onToggleSelected={() => toggleSelected(c.id)}
            />
          ))}
        </tbody>
      </table>
    </div>
  )

  return (
    <>
      <PageHero title="Review · Inbox">
        Painel completo dos comentários do Review Mode. Filtra por autor,
        status ou texto, agrupa por tela, aprova/rejeita em lote os que estão
        em revisão. Lê do mesmo storage que o overlay (localStorage ou bridge local).
      </PageHero>

      <div className="max-w-[1200px] mx-auto px-10 pb-14 flex flex-col gap-8">
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <AuStatCard
          icon="forum"
          label="Total ativos"
          value={comments.length}
        />
        <AuStatCard
          icon="pending"
          label="Abertos"
          value={openCount}
          hint={
            comments.length > 0
              ? `${Math.round((openCount / comments.length) * 100)}%`
              : "—"
          }
        />
        <AuStatCard
          icon="hourglass_top"
          label="Em revisão"
          value={inReviewCount}
        />
        <AuStatCard
          icon="archive"
          label="Arquivados"
          value={archivedCount}
        />
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

        {authors.length > 1 && (
          <select
            value={authorId}
            onChange={(e) => setAuthorId(e.target.value)}
            className="text-sm px-3 py-1.5 rounded-sm border border-(--border-subtle) bg-(--bg-raised) text-(--fg-primary) focus:outline-hidden focus:border-(--accent-brand)"
          >
            <option value="all">Todos os autores</option>
            {authors.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        )}

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
          <Icon
            name={backend === "bridge" ? "cloud_done" : "save"}
            size={13}
          />
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
            <AuButton variant="ghost" size="sm" onClick={selectAllVisible}>
              Selecionar visíveis
            </AuButton>
            <AuButton variant="ghost" size="sm" onClick={clearSelection}>
              Limpar
            </AuButton>
            <AuButton
              variant="primary"
              size="sm"
              iconLeft="check_circle"
              loading={bulkBusy}
              disabled={bulkBusy}
              onClick={() => void bulkApprove()}
            >
              Aprovar selecionados
            </AuButton>
            <AuButton
              variant="secondary"
              size="sm"
              iconLeft="undo"
              disabled={bulkBusy}
              onClick={() => void bulkReject()}
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
                : "Tente afrouxar os filtros ou trocar o autor."}
            </AuEmptyDescription>
          </AuEmptyHeader>
        </AuEmpty>
      ) : grouped ? (
        <div className="flex flex-col gap-6">
          {grouped.map(([url, items]) => {
            const groupOpen = items.filter((c) => c.status === "open").length
            return (
              <section key={url} className="flex flex-col gap-3">
                <header className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Icon
                      name="web_asset"
                      size={14}
                      className="text-(--fg-tertiary) shrink-0"
                    />
                    <Link
                      href={url}
                      className="text-sm text-(--fg-primary) hover:text-(--accent-brand) truncate"
                    >
                      {url}
                    </Link>
                    <span className="text-xs text-(--fg-tertiary) shrink-0">
                      {items.length} no total
                      {tab === "open" ? ` · ${groupOpen} aberto${groupOpen === 1 ? "" : "s"}` : ""}
                    </span>
                  </div>
                </header>
                {renderTable(items)}
              </section>
            )
          })}
        </div>
      ) : (
        renderTable(sorted)
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
    </>
  )
}
