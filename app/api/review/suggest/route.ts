import { NextRequest, NextResponse } from "next/server"

// Server-side proxy to the OpenAI Chat API for Review Mode. Two modes:
//  - "complete": inline autocomplete (Cursor-style ghost text) — returns only
//    the CONTINUATION of what the reviewer is typing.
//  - "rewrite":  magic wand — rewrites the whole comment.
// In both, the reader is an AI AGENT that will implement the change, so the
// output has to be specific and actionable. The key lives in OPENAI_API_KEY
// (.env.local), never in the client.
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

const SYSTEM_COMPLETE = `You complete, in real time, the comment a UI/UX reviewer is typing.
The comment will be READ BY AN AI AGENT that implements the change — so the continuation must make the request specific and actionable (what, where, and the expected result).
Rules:
- Write in the same language as the comment you are given.
- Return ONLY the continuation: what comes AFTER what is already written, repeating nothing.
- Very short: a few words, one sentence at most.
- Continue naturally from the last character (mid-word or mid-sentence is fine).
- No quotes, no labels, no explanation.`

const SYSTEM_REWRITE = `You rewrite a UI/UX reviewer's comment for an AI AGENT that will implement the change in the product.
Make it specific, unambiguous and actionable: what, where (referencing the selected element when there is one) and the expected result.
Rules:
- Write in the same language as the comment you are given.
- 1 to 3 sentences, straight to the point. No greeting, no preamble, no surrounding quotes.
- Preserve the draft's intent; do not invent requirements.
- Return ONLY the rewritten comment.`

export async function POST(request: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey?.trim()) {
    return NextResponse.json(
      {
        error:
          "OpenAI key not found. Set OPENAI_API_KEY in .env.local and restart the server (npm run dev).",
      },
      { status: 503 }
    )
  }

  let body: SuggestBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid body." }, { status: 400 })
  }

  const draft = body.draft?.trim()
  if (!draft) {
    return NextResponse.json(
      { error: "The comment draft is empty. Type something before asking for a suggestion." },
      { status: 400 }
    )
  }
  const mode: AssistMode = body.mode === "complete" ? "complete" : "rewrite"

  const el = body.element
  const elementCtx = el
    ? [
        el.tag ? `tag: ${el.tag}` : null,
        el.role ? `role: ${el.role}` : null,
        el.label ? `accessible label: ${el.label}` : null,
        el.text ? `visible text: "${el.text}"` : null,
      ]
        .filter(Boolean)
        .join("; ")
    : ""

  const elementLine = elementCtx
    ? `Element selected on screen — ${elementCtx}.`
    : "No specific element selected."
  const pageLine = body.page ? `Screen: ${body.page}.` : null

  const userMsg =
    mode === "complete"
      ? [elementLine, pageLine, `Text so far: "${body.draft}"`, "Continue."]
          .filter(Boolean)
          .join("\n")
      : [elementLine, pageLine, `Reviewer's draft: "${draft}"`, "Rewrite the comment."]
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
        { error: `OpenAI returned an error (${res.status}). Try again, or check OPENAI_API_KEY.` },
        { status: 502 }
      )
    }
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[]
    }
    const suggestion = data.choices?.[0]?.message?.content?.trim()
    if (!suggestion) {
      return NextResponse.json(
        { error: "The model returned an empty suggestion. Try again." },
        { status: 422 }
      )
    }
    return NextResponse.json({ suggestion })
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : "Could not reach OpenAI. Check your connection and try again."
    console.error("[review/suggest]", err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
