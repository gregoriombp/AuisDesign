// Timestamp helpers shared between the comment sheet card and the anchored
// thread popover so both render dates identically.

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}

/** "03/06/2026 · 14:08" — absolute, for the comment header. */
export function formatFullTimestamp(ts: number): string {
  const d = new Date(ts)
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()} · ${pad2(
    d.getHours()
  )}:${pad2(d.getMinutes())}`
}

/** "now" / "12m" / "3h" / "2d" / locale date — relative, for replies. */
export function formatRelative(timestamp: number): string {
  const diff = Date.now() - timestamp
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) return "now"
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d`
  // en-GB, not en-US: the repo standardizes on DD/MM/YYYY (same as the absolute
  // timestamp above and the persisted resolution summary).
  return new Date(timestamp).toLocaleDateString("en-GB")
}
