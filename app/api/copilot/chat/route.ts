import { GoogleGenAI } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";

const SYSTEM_INSTRUCTION = `Você é o assistente do Auis, uma plataforma de vendas e atendimento.
Responda de forma clara, objetiva e em português brasileiro.
Ajude com dúvidas sobre relatórios, métricas, integrações e uso da plataforma.`;

export async function POST(request: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey?.trim()) {
    return NextResponse.json(
      {
        error:
          "Chave da API não encontrada. Defina GEMINI_API_KEY (ou GOOGLE_API_KEY) em .env.local na raiz do projeto e reinicie o servidor (npm run dev).",
      },
      { status: 503 }
    );
  }

  let body: { messages: { role: "user" | "bot"; text: string }[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Corpo da requisição inválido." },
      { status: 400 }
    );
  }

  const { messages } = body;
  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json(
      { error: "Envie pelo menos uma mensagem." },
      { status: 400 }
    );
  }

  try {
    const ai = new GoogleGenAI({ apiKey: apiKey.trim() });

    const contents = messages.map((m) =>
      m.role === "user"
        ? { role: "user" as const, parts: [{ text: m.text }] }
        : { role: "model" as const, parts: [{ text: m.text }] }
    );

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.7,
        maxOutputTokens: 1024,
      },
    });

    const text = response.text?.trim();
    if (!text) {
      return NextResponse.json(
        { error: "Resposta vazia do modelo." },
        { status: 502 }
      );
    }

    return NextResponse.json({ text });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao chamar Gemini.";
    console.error("[Copilot API]", err);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
