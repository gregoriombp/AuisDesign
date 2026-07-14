import { NextRequest, NextResponse } from "next/server"

// Server-side proxy to OpenAI's voice transcription for Review Mode. The key
// lives in OPENAI_API_KEY in .env.local and is NEVER exposed to the client —
// every server-side model call in this repo follows that pattern. The card
// records the audio with MediaRecorder and posts it here; we return only the text.
const OPENAI_TRANSCRIBE_URL = "https://api.openai.com/v1/audio/transcriptions"
const MODEL = "gpt-4o-mini-transcribe"
const MAX_AUDIO_BYTES = 25 * 1024 * 1024 // OpenAI endpoint limit

export async function POST(request: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey?.trim()) {
    return NextResponse.json(
      {
        error:
          "OpenAI key not found. Set OPENAI_API_KEY in .env.local at the project root and restart the server (npm run dev).",
      },
      { status: 503 }
    )
  }

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return NextResponse.json(
      { error: "Send the audio as multipart/form-data." },
      { status: 400 }
    )
  }

  const audio = form.get("audio")
  if (!(audio instanceof Blob) || audio.size === 0) {
    return NextResponse.json(
      { error: "The recording is empty. Record again." },
      { status: 400 }
    )
  }
  if (audio.size > MAX_AUDIO_BYTES) {
    return NextResponse.json(
      { error: "Audio too long (max. ~25MB). Record a shorter clip." },
      { status: 413 }
    )
  }

  // OpenAI detects the format from the filename extension — keep whatever the
  // client sent (webm on Chrome, mp4 on Safari).
  const filename =
    audio instanceof File && audio.name ? audio.name : "audio.webm"

  const upstream = new FormData()
  upstream.append("file", audio, filename)
  upstream.append("model", MODEL)
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
        { error: `OpenAI returned an error (${res.status}). Try again, or check OPENAI_API_KEY.` },
        { status: 502 }
      )
    }
    const data = (await res.json()) as { text?: string }
    const text = data.text?.trim()
    if (!text) {
      return NextResponse.json(
        { error: "Could not make out any speech. Record again, closer to the mic." },
        { status: 422 }
      )
    }
    return NextResponse.json({ text })
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : "Could not reach OpenAI. Check your connection and try again."
    console.error("[review/transcribe]", err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
