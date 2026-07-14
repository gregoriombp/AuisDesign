import { NextResponse } from "next/server";
import { dataSignature } from "../_store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Cheap client polling (replaces the Express server's SSE): returns a signature
// that changes whenever the data files change (written by the app OR a skill).
export async function GET() {
  return NextResponse.json({ signature: await dataSignature() });
}
