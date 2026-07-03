import { NextRequest, NextResponse } from "next/server"

// Proxy server-side da transcrição de voz da OpenAI pro Review Mode. A chave
// vive em OPENAI_API_KEY no .env.local e NUNCA é exposta ao cliente — mesmo
// padrão do app/api/copilot/chat. O card grava o áudio com MediaRecorder e
// posta aqui; devolvemos só o texto.
const OPENAI_TRANSCRIBE_URL = "https://api.openai.com/v1/audio/transcriptions"
const MODEL = "gpt-4o-mini-transcribe"
const MAX_AUDIO_BYTES = 25 * 1024 * 1024 // limite do endpoint da OpenAI

export async function POST(request: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey?.trim()) {
    return NextResponse.json(
      {
        error:
          "Chave da OpenAI não encontrada. Defina OPENAI_API_KEY em .env.local na raiz do projeto e reinicie o servidor (npm run dev).",
      },
      { status: 503 }
    )
  }

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return NextResponse.json(
      { error: "Envie o áudio como multipart/form-data." },
      { status: 400 }
    )
  }

  const audio = form.get("audio")
  if (!(audio instanceof Blob) || audio.size === 0) {
    return NextResponse.json(
      { error: "Áudio ausente ou vazio." },
      { status: 400 }
    )
  }
  if (audio.size > MAX_AUDIO_BYTES) {
    return NextResponse.json(
      { error: "Áudio muito longo (máx. ~25MB). Grave um trecho mais curto." },
      { status: 413 }
    )
  }

  // A OpenAI detecta o formato pela extensão do filename — preserva o que o
  // cliente mandou (webm no Chrome, mp4 no Safari).
  const filename =
    audio instanceof File && audio.name ? audio.name : "audio.webm"

  const upstream = new FormData()
  upstream.append("file", audio, filename)
  upstream.append("model", MODEL)
  upstream.append("language", "pt")
  upstream.append("response_format", "json")

  try {
    const res = await fetch(OPENAI_TRANSCRIBE_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey.trim()}` },
      body: upstream,
    })
    if (!res.ok) {
      const detail = await res.text().catch(() => "")
      console.error("[review/transcribe] OpenAI error", res.status, detail)
      return NextResponse.json(
        { error: `Falha na transcrição (${res.status}).` },
        { status: 502 }
      )
    }
    const data = (await res.json()) as { text?: string }
    const text = data.text?.trim()
    if (!text) {
      return NextResponse.json(
        { error: "Não consegui entender o áudio. Tente de novo." },
        { status: 422 }
      )
    }
    return NextResponse.json({ text })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao transcrever."
    console.error("[review/transcribe]", err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
