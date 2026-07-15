"use client"

import { useState, useRef, useEffect, useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { Icon } from "@/components/ui/Icon"
import { navigation, type NavSection } from "./navigation"

type Hit = {
  name: string
  href: string
  section: string
  aliases?: string[]
}

function buildItems(sections: NavSection[]): Hit[] {
  return sections.flatMap((section) =>
    section.items.flatMap((item) => {
      const parent = {
        name: item.name,
        href: item.href,
        section: section.title,
        aliases: item.aliases,
      }
      const children =
        item.children?.map((child) => ({
          name: child.name,
          href: child.href,
          section: `${section.title} / ${item.name}`,
          aliases: child.aliases,
        })) ?? []
      return [parent, ...children]
    }),
  )
}

function normalize(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
}

export function SidebarSearch({ sections }: { sections?: NavSection[] }) {
  const router = useRouter()
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const [cursor, setCursor] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const allItems = useMemo(() => buildItems(sections ?? navigation), [sections])

  const q = normalize(query.trim())
  const hits: Hit[] = q.length < 1 ? [] : allItems.filter((item) =>
    normalize(item.name).includes(q) ||
    normalize(item.section).includes(q) ||
    item.aliases?.some((alias) => normalize(alias).includes(q))
  )

  const navigate = useCallback((href: string) => {
    setQuery("")
    setOpen(false)
    router.push(href)
  }, [router])

  useEffect(() => {
    if (!open) return
    const hit = listRef.current?.children[cursor] as HTMLElement | undefined
    hit?.scrollIntoView({ block: "nearest" })
  }, [cursor, open])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!hits.length) return
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setCursor((c) => Math.min(c + 1, hits.length - 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setCursor((c) => Math.max(c - 1, 0))
    } else if (e.key === "Enter") {
      e.preventDefault()
      navigate(hits[cursor].href)
    } else if (e.key === "Escape") {
      setQuery("")
      setOpen(false)
      inputRef.current?.blur()
    }
  }

  return (
    <div className="relative">
      <div className={cn(
        "flex items-center gap-2 h-8 px-2.5 rounded-md border transition-colors duration-150",
        open && hits.length > 0
          ? "border-(--au-blue-500) bg-(--bg-canvas)"
          : "border-(--border-default) bg-(--bg-surface) hover:border-(--border-hover)"
      )}>
        <Icon name="search" size={14} className="text-(--fg-tertiary) shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setCursor(0)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={handleKeyDown}
          placeholder="Search…"
          className="flex-1 min-w-0 bg-transparent outline-hidden border-0 text-[13px] text-(--fg-primary) placeholder:text-(--fg-tertiary)"
        />
        {query && (
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault()
              setQuery("")
              setCursor(0)
              inputRef.current?.focus()
            }}
            className="flex items-center justify-center text-(--fg-tertiary) hover:text-(--fg-secondary) transition-colors"
          >
            <Icon name="cancel" size={14} />
          </button>
        )}
      </div>

      {open && hits.length > 0 && (
        <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-50 rounded-lg border border-(--border-default) bg-(--bg-raised) shadow-(--shadow-md) overflow-hidden">
          <ul ref={listRef} role="listbox" className="max-h-64 overflow-y-auto py-1">
            {hits.map((hit, i) => (
              <li key={hit.href} role="option" aria-selected={i === cursor}>
                <button
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); navigate(hit.href) }}
                  onMouseEnter={() => setCursor(i)}
                  className={cn(
                    "w-full flex items-start gap-2.5 px-3 py-2 text-left transition-colors",
                    i === cursor
                      ? "bg-(--bg-surface)"
                      : "hover:bg-(--bg-surface)"
                  )}
                >
                  <Icon name="article" size={14} className="mt-0.5 shrink-0 text-(--fg-tertiary)" />
                  <span className="flex-1 min-w-0">
                    <span className="block text-[13px] font-medium text-(--fg-primary) truncate">
                      {hit.name}
                    </span>
                    <span className="block text-[11px] text-(--fg-tertiary) mt-0.5">
                      {hit.section}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {open && query.trim().length > 0 && hits.length === 0 && (
        <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-50 rounded-lg border border-(--border-default) bg-(--bg-raised) shadow-(--shadow-md) px-3 py-4 text-center">
          <p className="text-[12px] text-(--fg-tertiary)">No results for &ldquo;{query}&rdquo;</p>
        </div>
      )}
    </div>
  )
}
