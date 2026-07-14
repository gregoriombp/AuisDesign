import { GoogleGenAI } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";

const SYSTEM_INSTRUCTION = `You are the Auis assistant, embedded in the product being built.
Answer clearly and concisely, in the same language the user wrote to you in.
Help with questions about the product's screens, data and how to use it.`;

export async function POST(request: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey?.trim()) {
    return NextResponse.json(
      {
        error:
          "API key not found. Set GEMINI_API_KEY (or GOOGLE_API_KEY) in .env.local at the project root and restart the server (npm run dev).",
      },
      { status: 503 }
    );
  }

  let body: { messages: { role: "user" | "bot"; text: string }[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 }
    );
  }

  const { messages } = body;
  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json(
      { error: "Send at least one message." },
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
        { error: "The model returned an empty response. Try again." },
        { status: 502 }
      );
    }

    return NextResponse.json({ text });
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : "Could not reach Gemini. Check your connection and try again.";
    console.error("[Copilot API]", err);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
