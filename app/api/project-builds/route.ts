import { NextRequest, NextResponse } from "next/server";
import {
  createBuild,
  listBuilds,
  type BuildKind,
  type ProjectBuildStatus,
} from "./_store";

// Touches the filesystem (flow-bridge/data/project-builds.json) — Node only,
// never cached.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUSES: ProjectBuildStatus[] = ["open", "in_review", "applied", "discarded"];
const KINDS: BuildKind[] = ["restyle", "build"];

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const statusParam = sp.get("status");
  const kindParam = sp.get("kind");
  const builds = await listBuilds({
    projectSlug: sp.get("projectSlug") ?? undefined,
    screenId: sp.get("screenId") ?? undefined,
    kind: KINDS.includes(kindParam as BuildKind) ? (kindParam as BuildKind) : undefined,
    status: STATUSES.includes(statusParam as ProjectBuildStatus)
      ? (statusParam as ProjectBuildStatus)
      : undefined,
  });
  return NextResponse.json({ builds });
}

export async function POST(request: NextRequest) {
  let body: {
    projectSlug?: unknown;
    screenId?: unknown;
    screenName?: unknown;
    kind?: unknown;
    figmaFileKey?: unknown;
    figmaNodeId?: unknown;
    thumbnail?: unknown;
    note?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corpo inválido." }, { status: 400 });
  }
  if (
    typeof body.projectSlug !== "string" ||
    typeof body.screenId !== "string" ||
    !KINDS.includes(body.kind as BuildKind)
  ) {
    return NextResponse.json(
      { error: "projectSlug, screenId e kind (restyle|build) são obrigatórios." },
      { status: 400 },
    );
  }
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  const build = await createBuild({
    projectSlug: body.projectSlug,
    screenId: body.screenId,
    screenName: str(body.screenName),
    kind: body.kind as BuildKind,
    figmaFileKey: str(body.figmaFileKey),
    figmaNodeId: str(body.figmaNodeId),
    thumbnail: str(body.thumbnail),
    note: typeof body.note === "string" ? body.note : undefined,
  });
  return NextResponse.json({ build }, { status: 201 });
}
