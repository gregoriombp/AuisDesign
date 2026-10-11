import { listIdentities } from "../store";
import { getBridgeSession } from "../session";

/**
 * TEAM directory for the admin panel (/auis/review-bridge → Team tab): the
 * review identities saved in the bridge store (the "who are you?" members).
 * Admin-only — it is the management view, not the mention list (that one is
 * /reviewers, open).
 *
 * A deployment with an auth provider can merge its user directory here (rows
 * with `source: "session"` and a resolved role); `hierarchyActive` tells the
 * panel whether the admin × reviewer split is in effect.
 */

export interface MemberRow {
  id: string;
  name: string;
  email?: string;
  source: "session" | "identity";
  role?: "admin" | "reviewer";
  shared?: boolean;
  colorToken?: string;
  createdAt?: number;
}

async function handleGET(request: Request) {
  const session = await getBridgeSession(request);
  if (session.role === "reviewer") {
    return Response.json({ error: "forbidden_role" }, { status: 403 });
  }
  const identities = await listIdentities();
  const rows: MemberRow[] = identities.map((i) => ({
    id: i.id,
    name: i.name,
    email: i.email,
    source: "identity" as const,
    colorToken: i.colorToken,
    createdAt: i.createdAt,
  }));
  return Response.json({
    members: rows,
    hierarchyActive: session.authEnabled,
    adminEmails: [] as string[],
    sharedEmails: [] as string[],
  });
}

export const GET = handleGET;
