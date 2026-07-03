import { NextResponse } from "next/server";
import { exportAll } from "../_store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await exportAll());
}
