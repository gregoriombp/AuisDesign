/**
 * A comment's `revealPath` is replayed in the browser of whoever opens the
 * comment (the admin, during review). Any commenter writes it, so the server
 * only accepts the shape the `revealTrail.ts` replay produces: up to 6 steps,
 * each with a short selector and an optional label.
 */
export const REVEAL_PATH_MAX_STEPS = 6;
const SELECTOR_MAX = 1024;
const LABEL_MAX = 120;

export function isValidRevealPath(value: unknown): boolean {
  if (!Array.isArray(value) || value.length > REVEAL_PATH_MAX_STEPS) return false;
  return value.every((step) => {
    if (!step || typeof step !== "object" || Array.isArray(step)) return false;
    const s = step as Record<string, unknown>;
    if (typeof s.selector !== "string" || s.selector.length === 0 || s.selector.length > SELECTOR_MAX) {
      return false;
    }
    if (s.label !== undefined && (typeof s.label !== "string" || s.label.length > LABEL_MAX)) {
      return false;
    }
    if (s.fingerprint !== undefined && (typeof s.fingerprint !== "object" || s.fingerprint === null)) {
      return false;
    }
    return true;
  });
}
