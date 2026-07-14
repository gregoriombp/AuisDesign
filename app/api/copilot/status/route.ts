import { NextResponse } from "next/server";

/**
 * GET /api/copilot/status
 * Reports whether the Gemini key is available on the server (never reveals it).
 * Useful for debugging: if keyConfigured is false, restart the server after
 * editing .env.local.
 */
export async function GET() {
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  const keyConfigured = Boolean(key?.trim());
  return NextResponse.json({
    keyConfigured,
    hint: keyConfigured
      ? "Key found. If the chat still fails, the error may come from the Gemini API (e.g. an invalid key)."
      : "Key not found. Set GEMINI_API_KEY in .env.local at the project root and restart the server (Ctrl+C, then npm run dev).",
  });
}
