import { NextResponse } from "next/server"

import { SCREEN_STATES } from "@/lib/auis-states/registry"

// The State Mode registry as read-only JSON — consumed by the matrix PDF
// generator (scripts/states-matrix-pdf.mjs), which runs outside the bundler
// and cannot import the TS registry directly.
export function GET() {
  return NextResponse.json({ screens: SCREEN_STATES })
}
