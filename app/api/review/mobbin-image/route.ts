import { NextRequest, NextResponse } from "next/server"

// Same-origin proxy for a Mobbin result's image. The browser can't turn a
// cross-origin image into base64 (CORS / canvas taint), so the server fetches
// the bytes and serves them from here, same-origin. Only https URLs on
// mobbin.com are accepted — this must never become an open proxy.
const ALLOWED_HOSTS = new Set(["mobbin.com", "www.mobbin.com"])

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("url")
  if (!raw) {
    return NextResponse.json({ error: "missing_url" }, { status: 400 })
  }

  let target: URL
  try {
    target = new URL(raw)
  } catch {
    return NextResponse.json({ error: "invalid_url" }, { status: 400 })
  }
  if (target.protocol !== "https:" || !ALLOWED_HOSTS.has(target.hostname)) {
    return NextResponse.json({ error: "host_not_allowed" }, { status: 400 })
  }

  try {
    const upstream = await fetch(target.toString(), {
      headers: { Accept: "image/*" },
    })
    if (!upstream.ok) {
      return NextResponse.json(
        { error: `upstream_${upstream.status}` },
        { status: 502 }
      )
    }
    const contentType = upstream.headers.get("content-type") ?? "image/jpeg"
    if (!contentType.startsWith("image/")) {
      return NextResponse.json({ error: "not_an_image" }, { status: 415 })
    }
    const buffer = await upstream.arrayBuffer()
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=300",
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "proxy_error"
    console.error("[review/mobbin-image]", err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
