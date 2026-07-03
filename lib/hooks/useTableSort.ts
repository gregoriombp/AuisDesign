"use client"

import { useCallback, useMemo, useState } from "react"

export type SortDirection = "asc" | "desc"

export interface SortState<K extends string = string> {
  by: K | undefined
  direction: SortDirection | undefined
}

export interface UseTableSortOptions<
  T extends Record<string, unknown>,
  K extends string = Extract<keyof T, string>,
> {
  initialSort?: { by: K; direction: SortDirection }
  /**
   * Override the value used to compare rows for a given column.
   * Default: `row[key]`. Use when the rendered cell value (ex.: "há 2 horas",
   * "v12.4") doesn't sort the way the user expects and you have a better
   * primitive (ex.: an ISO timestamp, a numeric version).
   */
  getSortValue?: (
    row: T,
    key: K,
  ) => string | number | boolean | null | undefined
}

export interface SortableHeaderProps {
  type: "button"
  onClick: () => void
  "aria-sort"?: "ascending" | "descending"
}

/**
 * Tri-state sort cycle (none → asc → desc → none) for plain <table> usage.
 * Pair with the `au-th-sort` markup pattern documented in the Tabela
 * styleguide page — this hook supplies the props/icon, the markup stays
 * yours.
 */
export function useTableSort<
  T extends Record<string, unknown>,
  K extends string = Extract<keyof T, string>,
>(rows: readonly T[], options: UseTableSortOptions<T, K> = {}) {
  const { initialSort, getSortValue } = options

  const [sort, setSort] = useState<SortState<K>>(
    initialSort ?? { by: undefined, direction: undefined },
  )

  const toggleSort = useCallback((key: K) => {
    setSort((prev) => {
      if (prev.by !== key) return { by: key, direction: "asc" }
      if (prev.direction === "asc") return { by: key, direction: "desc" }
      return { by: undefined, direction: undefined }
    })
  }, [])

  const sortedRows = useMemo(() => {
    if (!sort.by || !sort.direction) return rows
    const key = sort.by
    const dir = sort.direction
    const resolve =
      getSortValue ?? ((row: T, k: K) => row[k] as unknown as string | number | boolean | null | undefined)
    return [...rows].sort((a, b) => {
      const av = resolve(a, key)
      const bv = resolve(b, key)
      if (av === bv) return 0
      if (av == null) return 1
      if (bv == null) return -1
      let cmp = 0
      if (typeof av === "string" && typeof bv === "string") {
        cmp = av.localeCompare(bv)
      } else if (av < bv) {
        cmp = -1
      } else if (av > bv) {
        cmp = 1
      }
      return dir === "asc" ? cmp : -cmp
    })
  }, [rows, sort, getSortValue])

  const getHeaderProps = useCallback(
    (key: K): SortableHeaderProps => ({
      type: "button",
      onClick: () => toggleSort(key),
      "aria-sort":
        sort.by === key && sort.direction
          ? sort.direction === "asc"
            ? "ascending"
            : "descending"
          : undefined,
    }),
    [sort, toggleSort],
  )

  const getSortIcon = useCallback(
    (key: K): "⇅" | "↑" | "↓" => {
      if (sort.by !== key || !sort.direction) return "⇅"
      return sort.direction === "asc" ? "↑" : "↓"
    },
    [sort],
  )

  return {
    sortedRows,
    sort,
    setSort,
    getHeaderProps,
    getSortIcon,
  }
}
