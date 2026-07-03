import { NextRequest, NextResponse } from "next/server";
import { setError, setResults } from "../../../../_mobbin";
import type { MobbinScreenResult } from "@/components/auis-review/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isValidResults(value: unknown): value is MobbinScreenResult[] {
  if (!Array.isArray(value)) return false;
  return value.every((r) => {
    if (!r || typeof r !== "object") return false;
    const v = r as Record<string, unknown>;
    return (
      typeof v.id === "string" &&
      typeof v.imageUrl === "string" &&
      typeof v.mobbinUrl === "string"
    );
  });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  let body: Record<string, unknown> | null;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_results" }, { status: 400 });
  }

  // Agente reporta falha em vez de resultados.
  if (typeof body?.error === "string" && body.error.trim()) {
    const updated = setError(id, body.error.trim());
    if (!updated) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json({ search: updated });
  }

  if (!isValidResults(body?.results)) {
    return NextResponse.json({ error: "invalid_results" }, { status: 400 });
  }
  const updated = setResults(id, body.results);
  if (!updated) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ search: updated });
}
