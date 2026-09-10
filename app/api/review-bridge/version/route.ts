import { NextResponse } from "next/server";
import { dataSignature } from "../_store";
import { withBridgeErrors } from "../_errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Cheap polling for the client: returns a signature that changes when the data
// files change (the app OR a skill wrote).
async function handleGET() {
  return NextResponse.json({ signature: await dataSignature() });
}

export const GET = withBridgeErrors(handleGET);
