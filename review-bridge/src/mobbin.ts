import { randomUUID } from "node:crypto"
import type {
  MobbinPlatform,
  MobbinScreenResult,
  MobbinSearch,
  MobbinSearchElement,
  MobbinSearchStatus,
} from "./types.js"

// Ephemeral Mobbin search queue. Lives only in memory — a search starts
// `pending`, the agent posts back results (`done`) or a failure (`error`), the
// app attaches the chosen image and moves on. Never persisted, never migrated,
// never touches lowdb.
const MAX_SEARCHES = 50

const searches = new Map<string, MobbinSearch>()

function trim(): void {
  if (searches.size <= MAX_SEARCHES) return
  const oldestFirst = [...searches.values()].sort(
    (a, b) => a.createdAt - b.createdAt
  )
  for (const stale of oldestFirst.slice(0, searches.size - MAX_SEARCHES)) {
    searches.delete(stale.id)
  }
}

export interface CreateSearchInput {
  query: string
  platform?: MobbinPlatform
  page?: string
  element?: MobbinSearchElement
}

export function createSearch(input: CreateSearchInput): MobbinSearch {
  const now = Date.now()
  const search: MobbinSearch = {
    id: randomUUID(),
    query: input.query,
    platform: input.platform === "ios" ? "ios" : "web",
    page: input.page ?? "",
    element: input.element,
    status: "pending",
    results: [],
    createdAt: now,
    updatedAt: now,
  }
  searches.set(search.id, search)
  trim()
  return search
}

export function listSearches(filter?: {
  status?: MobbinSearchStatus
}): MobbinSearch[] {
  const all = [...searches.values()].sort((a, b) => b.createdAt - a.createdAt)
  if (!filter?.status) return all
  return all.filter((s) => s.status === filter.status)
}

export function getSearch(id: string): MobbinSearch | null {
  return searches.get(id) ?? null
}

export function setResults(
  id: string,
  results: MobbinScreenResult[]
): MobbinSearch | null {
  const existing = searches.get(id)
  if (!existing) return null
  const updated: MobbinSearch = {
    ...existing,
    status: "done",
    results,
    error: undefined,
    updatedAt: Date.now(),
  }
  searches.set(id, updated)
  return updated
}

export function setError(id: string, message: string): MobbinSearch | null {
  const existing = searches.get(id)
  if (!existing) return null
  const updated: MobbinSearch = {
    ...existing,
    status: "error",
    error: message,
    updatedAt: Date.now(),
  }
  searches.set(id, updated)
  return updated
}
