import { NextResponse } from "next/server";
import { listIdentities } from "../_store";
import { deriveReviewerHandles } from "@/lib/auis-review/reviewerHandle";
import type { ReviewerRef } from "@/lib/auis-review/reviewers";
import { isReservedReviewAgentIdentity } from "@/lib/auis-review/agents";
import { withBridgeErrors } from "../_errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * List of HUMANS mentionable with "@" in the Review Bridge — the counterpart
 * of REVIEW_AGENTS (Claude/Codex/Grok), but for real people.
 *
 * Source: the identities already saved in the bridge store — every reviewer
 * who ever picked a name on this checkout. A deployment with an auth provider
 * can merge its user directory in front of this list (dedupe by id; the
 * directory version wins with fresher name/e-mail).
 *
 * The handle is derived HERE, on the server, NEVER the raw name — TRIGGER_RE
 * (autocomplete) and TOKEN_RE (parser) only match \w, so "José" or "Dev Team"
 * would break the match. See deriveReviewerHandles.
 */

let cache: { reviewers: ReviewerRef[]; at: number } | null = null;
const CACHE_TTL_MS = 60_000;

async function loadReviewers(): Promise<ReviewerRef[]> {
  const identities = await listIdentities();
  const normalized = identities
    .map((i) => ({ id: i.id, name: i.name, email: i.email }))
    .filter((person) => !isReservedReviewAgentIdentity(person))
    .map((p) => ({
      id: p.id,
      name: p.name?.trim() || p.email || "Reviewer",
      email: p.email,
    }));
  return deriveReviewerHandles(normalized);
}

async function handleGET() {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) {
    return NextResponse.json({ reviewers: cache.reviewers });
  }
  const reviewers = await loadReviewers();
  cache = { reviewers, at: Date.now() };
  return NextResponse.json({ reviewers });
}

export const GET = withBridgeErrors(handleGET);
