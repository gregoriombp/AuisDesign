import { NextRequest, NextResponse } from "next/server"

// Proxy server-side do OpenAI Chat pro Review Mode. Dois modos:
//  - "complete": autocomplete inline (ghost text estilo Cursor) — devolve só a
//    CONTINUAÇÃO do que o revisor está digitando.
//  - "rewrite":  varinha mágica — reescreve o comentário inteiro.
// Em ambos, o alvo é um AGENTE DE IA que vai implementar a mudança, então a
// saída precisa ser específica e acionável. Chave em OPENAI_API_KEY (.env.local),
// nunca no cliente.
const OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions"
const MODEL = "gpt-4o-mini"

type AssistMode = "complete" | "rewrite"

interface SuggestBody {
  mode?: AssistMode
  draft?: string
  element?: {
    tag?: string
    role?: string
    label?: string
    text?: string
    selector?: string
  }
  page?: string
}

const SYSTEM_COMPLETE = `Você completa, em tempo real, o comentário que um revisor de UI/UX está digitando.
O comentário será LIDO POR UM AGENTE DE IA que vai implementar a mudança — então a continuação deve deixar o pedido específico e acionável (o quê, onde, e o resultado esperado).
Regras:
- Português do Brasil.
- Devolva APENAS a continuação do texto: o que vem DEPOIS do que já foi escrito, sem repetir nada.
- Curtíssimo: de algumas palavras a no máximo uma frase.
- Continue naturalmente a partir do último caractere (inclusive no meio de uma palavra/frase).
- Nada de aspas, rótulos ou explicação.`

const SYSTEM_REWRITE = `Você reescreve o comentário de um revisor de UI/UX para um AGENTE DE IA que vai implementar a mudança no produto.
Deixe específico, sem ambiguidade e acionável: o quê, onde (referenciando o elemento selecionado quando houver) e o resultado esperado.
Regras:
- Português do Brasil.
- 1 a 3 frases, direto ao ponto. Sem saudação, sem preâmbulo, sem aspas em volta.
- Preserve a intenção do rascunho; não invente requisitos.
- Devolva APENAS o comentário reescrito.`

export async function POST(request: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey?.trim()) {
    return NextResponse.json(
      {
        error:
          "Chave da OpenAI não encontrada. Defina OPENAI_API_KEY em .env.local e reinicie o servidor (npm run dev).",
      },
      { status: 503 }
    )
  }

  let body: SuggestBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Corpo inválido." }, { status: 400 })
  }

  const draft = body.draft?.trim()
  if (!draft) {
    return NextResponse.json(
      { error: "Envie o rascunho do comentário." },
      { status: 400 }
    )
  }
  const mode: AssistMode = body.mode === "complete" ? "complete" : "rewrite"

  const el = body.element
  const elementCtx = el
    ? [
        el.tag ? `tag: ${el.tag}` : null,
        el.role ? `papel: ${el.role}` : null,
        el.label ? `rótulo acessível: ${el.label}` : null,
        el.text ? `texto visível: "${el.text}"` : null,
      ]
        .filter(Boolean)
        .join("; ")
    : ""

  const elementLine = elementCtx
    ? `Elemento selecionado na tela — ${elementCtx}.`
    : "Sem elemento específico selecionado."
  const pageLine = body.page ? `Tela: ${body.page}.` : null

  const userMsg =
    mode === "complete"
      ? [elementLine, pageLine, `Texto até agora: "${body.draft}"`, "Continue."]
          .filter(Boolean)
          .join("\n")
      : [elementLine, pageLine, `Rascunho do revisor: "${draft}"`, "Reescreva o comentário."]
          .filter(Boolean)
          .join("\n")

  try {
    const res = await fetch(OPENAI_CHAT_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey.trim()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: mode === "complete" ? 0.3 : 0.4,
        max_tokens: mode === "complete" ? 48 : 180,
        messages: [
          {
            role: "system",
            content: mode === "complete" ? SYSTEM_COMPLETE : SYSTEM_REWRITE,
          },
          { role: "user", content: userMsg },
        ],
      }),
    })
    if (!res.ok) {
      const detail = await res.text().catch(() => "")
      console.error("[review/suggest] OpenAI error", res.status, detail)
      return NextResponse.json(
        { error: `Falha na sugestão (${res.status}).` },
        { status: 502 }
      )
    }
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[]
    }
    const suggestion = data.choices?.[0]?.message?.content?.trim()
    if (!suggestion) {
      return NextResponse.json({ error: "Sem sugestão." }, { status: 422 })
    }
    return NextResponse.json({ suggestion })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao sugerir."
    console.error("[review/suggest]", err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
