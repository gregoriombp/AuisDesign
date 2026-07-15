import fs from "node:fs/promises"
import path from "node:path"
import { NextRequest, NextResponse } from "next/server"
import { getBrand, saveBrand, type Brand } from "@/app/auis/_data/brand"

// Writes the uploaded logo to public/ and the brand overlay to
// app/auis/_data/brand.runtime.json — filesystem work, so Node only, never
// cached. Mirrors app/api/page-edits/route.ts.
export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const MAX_LOGO_BYTES = 2 * 1024 * 1024 // 2 MB
const BRAND_PUBLIC_DIR = path.join(process.cwd(), "public", "assets", "brand")

// Allowed image types → the extension we write. The extension is derived from
// the MIME type, never from the client-supplied filename, so a hostile filename
// (e.g. "../../etc/passwd") can never reach the filesystem.
const EXT_BY_MIME: Record<string, string> = {
  "image/svg+xml": "svg",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
}

/** Current brand — lets the client read setup state. */
export async function GET() {
  const brand = await getBrand()
  return NextResponse.json({ brand })
}

export async function POST(request: NextRequest) {
  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return NextResponse.json(
      { error: "Send the form as multipart/form-data with name, tagline and logo." },
      { status: 400 },
    )
  }

  const nameRaw = form.get("name")
  const name = typeof nameRaw === "string" ? nameRaw.trim() : ""
  if (!name) {
    return NextResponse.json(
      { error: "Project name is required. Add a name and submit again." },
      { status: 400 },
    )
  }

  const taglineRaw = form.get("tagline")
  const tagline = typeof taglineRaw === "string" ? taglineRaw.trim() : ""

  const logo = form.get("logo")
  if (!(logo instanceof File) || logo.size === 0) {
    return NextResponse.json(
      { error: "A logo image is required. Choose an SVG, PNG, JPEG or WebP file." },
      { status: 400 },
    )
  }

  const ext = EXT_BY_MIME[logo.type]
  if (!ext) {
    return NextResponse.json(
      {
        error:
          "That file type is not supported. Upload an SVG, PNG, JPEG or WebP image.",
      },
      { status: 400 },
    )
  }

  if (logo.size > MAX_LOGO_BYTES) {
    return NextResponse.json(
      { error: "The logo is over 2 MB. Compress it or pick a smaller file." },
      { status: 400 },
    )
  }

  // Fixed, sanitized destination — the client filename is discarded entirely.
  const fileName = `logo.${ext}`
  const bytes = Buffer.from(await logo.arrayBuffer())
  try {
    await fs.mkdir(BRAND_PUBLIC_DIR, { recursive: true })
    await fs.writeFile(path.join(BRAND_PUBLIC_DIR, fileName), bytes)
  } catch {
    return NextResponse.json(
      { error: "Could not save the logo. Check write access to public/assets/brand." },
      { status: 500 },
    )
  }

  const brand: Brand = {
    name,
    tagline,
    logo: `/assets/brand/${fileName}`,
    configured: true,
  }

  try {
    await saveBrand(brand)
  } catch {
    return NextResponse.json(
      { error: "Could not save the brand. Check write access to app/auis/_data." },
      { status: 500 },
    )
  }

  return NextResponse.json({ ok: true, brand })
}
