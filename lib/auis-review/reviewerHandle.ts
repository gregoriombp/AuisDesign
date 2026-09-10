// Pure and isomorphic (server + client). Extracted from ./reviewers because that
// file is "use client" — a server route cannot import a client module.

/** NFD + strip accents. The parser/autocomplete only accept `\w` — an accented
 *  handle would never close. */
export function foldAscii(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
}

/** First name, else the local part of the email. Collisions are the caller's. */
export function deriveReviewerHandleBase(input: {
  name?: string
  email?: string
}): string {
  const firstName = input.name?.trim().split(/\s+/)[0] ?? ""
  const raw = firstName || input.email?.split("@")[0] || "reviewer"
  const folded = foldAscii(raw).replace(/[^a-z0-9-]/g, "")
  // Must start with a letter (the parser's alphabet has no leading digit).
  return /^[a-z]/.test(folded) ? folded : `reviewer-${folded || "0"}`
}

/** Collision (two "Alex") → alex, alex2… Input order is preserved. */
export function deriveReviewerHandles<T extends { name?: string; email?: string }>(
  people: readonly T[],
): (T & { handle: string })[] {
  const seen = new Map<string, number>()
  return people.map((p) => {
    const base = deriveReviewerHandleBase(p)
    const count = seen.get(base) ?? 0
    seen.set(base, count + 1)
    const handle = count === 0 ? base : `${base}${count + 1}`
    return { ...p, handle }
  })
}
