"use client"

import * as React from "react"
import { Icon } from "@/components/ui/Icon"
import { ICON_GROUPS } from "@/lib/auis-edit/icon-presets"

// Seletor de ícone (Material Symbols). Grade de presets comuns + busca/ligadura
// livre pra qualquer ícone fora da lista. `current` é a ligadura atual.

export function IconPicker({
  current,
  onPick,
}: {
  current: string
  onPick: (name: string) => void
}) {
  const [query, setQuery] = React.useState("")
  const q = query.trim().toLowerCase()

  const groups = React.useMemo(() => {
    if (!q) return ICON_GROUPS
    return ICON_GROUPS.map((g) => ({
      ...g,
      icons: g.icons.filter((n) => n.includes(q)),
    })).filter((g) => g.icons.length > 0)
  }, [q])

  // Permite aplicar uma ligadura digitada que não está nos presets.
  const customName = q.replace(/\s+/g, "_")
  const showCustom = q.length > 0 && groups.every((g) => !g.icons.includes(customName))

  return (
    <div className="flex flex-col gap-2">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Buscar ícone (ex.: rocket_launch)"
        className="w-full rounded-(--radius-sm) border border-(--border-default) bg-(--bg-canvas) px-2.5 py-1.5 body-sm text-(--fg-primary) outline-hidden placeholder:text-(--fg-tertiary) focus:border-(--accent-brand)"
      />
      <div className="flex max-h-[220px] flex-col gap-2 overflow-y-auto">
        {showCustom && (
          <button
            type="button"
            onClick={() => onPick(customName)}
            className="flex items-center gap-2 rounded-(--radius-sm) border border-dashed border-(--border-default) px-2 py-1.5 text-left body-xs text-(--fg-secondary) hover:bg-(--bg-hover)"
          >
            <Icon name={customName} size={18} />
            Usar &quot;{customName}&quot;
          </button>
        )}
        {groups.map((g) => (
          <div key={g.label} className="flex flex-col gap-1">
            <span className="text-3xs uppercase tracking-(--tracking-label) text-(--fg-tertiary)">
              {g.label}
            </span>
            <div className="grid grid-cols-7 gap-1">
              {g.icons.map((name) => {
                const active = name === current
                return (
                  <button
                    key={name}
                    type="button"
                    title={name}
                    onClick={() => onPick(name)}
                    className={[
                      "flex h-8 w-8 items-center justify-center rounded-(--radius-sm) transition-colors",
                      active
                        ? "bg-(--bg-inverse) text-(--fg-on-inverse)"
                        : "text-(--fg-secondary) hover:bg-(--bg-hover) hover:text-(--fg-primary)",
                    ].join(" ")}
                  >
                    <Icon name={name} size={18} />
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
