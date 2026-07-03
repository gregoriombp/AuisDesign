import { NextResponse } from "next/server";
import { dataSignature } from "../_store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Polling barato do cliente (substitui o SSE do servidor Express): devolve uma
// assinatura que muda quando os arquivos de dados mudam (app OU skill escreveu).
export async function GET() {
  return NextResponse.json({ signature: await dataSignature() });
}
