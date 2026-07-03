import { NextResponse } from "next/server";

/**
 * GET /api/copilot/status
 * Verifica se a chave do Gemini está disponível no servidor (não revela a chave).
 * Útil para debug: se keyConfigured for false, reinicie o servidor após editar .env.local
 */
export async function GET() {
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  const keyConfigured = Boolean(key?.trim());
  return NextResponse.json({
    keyConfigured,
    hint: keyConfigured
      ? "Chave encontrada. Se o chat ainda falhar, o erro pode ser da API do Gemini (ex.: chave inválida)."
      : "Chave não encontrada. Defina GEMINI_API_KEY em .env.local na raiz do projeto e reinicie o servidor (Ctrl+C e npm run dev).",
  });
}
