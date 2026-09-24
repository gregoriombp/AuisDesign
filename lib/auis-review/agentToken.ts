/**
 * Lets AGENTS (the mention runner, the solve skill) talk to the
 * bridge APIs without a browser session when the app runs behind an auth
 * layer: the `x-bridge-agent-token` header is compared with the
 * BRIDGE_AGENT_TOKEN secret of the environment. Unset locally — the local dev
 * server trusts every caller (see app/api/review-bridge/_session.ts).
 *
 * Constant-time comparison WITHOUT node:crypto so the helper also works in an
 * edge middleware, should the product add one.
 */
export function isValidAgentToken(req: Request): boolean {
  const expected = process.env.BRIDGE_AGENT_TOKEN ?? "";
  const got = req.headers.get("x-bridge-agent-token") ?? "";
  if (!expected || got.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ got.charCodeAt(i);
  }
  return diff === 0;
}
