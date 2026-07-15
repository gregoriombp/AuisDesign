"use client"

import * as React from "react"
import Link from "next/link"
import { AuCard } from "@/components/ui/AuCard"
import { AuButton } from "@/components/ui/AuButton"
import { AuInput, AuField } from "@/components/ui/AuInput"
import { AuAlert } from "@/components/ui/AuAlert"
import { AuToastProvider, useToast } from "@/components/ui/AuToast"
import { Icon } from "@/components/ui/Icon"
import type { Brand } from "@/app/auis/_data/brand"

const ACCEPT = "image/svg+xml,image/png,image/jpeg,image/webp"
const MAX_LOGO_BYTES = 2 * 1024 * 1024
const SETUP_COMMAND = "/auis-setup"

export function WelcomeForm({ initialBrand }: { initialBrand: Brand }) {
  return (
    <AuToastProvider>
      <WelcomeFormInner initialBrand={initialBrand} />
    </AuToastProvider>
  )
}

function WelcomeFormInner({ initialBrand }: { initialBrand: Brand }) {
  const { push } = useToast()
  const [name, setName] = React.useState(
    initialBrand.configured ? initialBrand.name : "",
  )
  const [tagline, setTagline] = React.useState(initialBrand.tagline)
  const [logo, setLogo] = React.useState<File | null>(null)
  const [preview, setPreview] = React.useState<string | null>(
    initialBrand.configured ? initialBrand.logo : null,
  )
  const [error, setError] = React.useState<string | null>(null)
  const [submitting, setSubmitting] = React.useState(false)
  const [saved, setSaved] = React.useState<Brand | null>(null)
  const [copied, setCopied] = React.useState(false)
  const fileInputRef = React.useRef<HTMLInputElement | null>(null)

  // Revoke the object URL we created for the preview when it changes/unmounts.
  React.useEffect(() => {
    if (!logo) return
    const url = URL.createObjectURL(logo)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [logo])

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null)
    const file = e.target.files?.[0] ?? null
    if (!file) {
      setLogo(null)
      return
    }
    if (!ACCEPT.split(",").includes(file.type)) {
      setError("That file type is not supported. Choose an SVG, PNG, JPEG or WebP image.")
      setLogo(null)
      return
    }
    if (file.size > MAX_LOGO_BYTES) {
      setError("The logo is over 2 MB. Compress it or pick a smaller file.")
      setLogo(null)
      return
    }
    setLogo(file)
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!name.trim()) {
      setError("Project name is required.")
      return
    }
    if (!logo) {
      setError("Choose a logo image to upload.")
      return
    }
    setSubmitting(true)
    try {
      const body = new FormData()
      body.set("name", name.trim())
      body.set("tagline", tagline.trim())
      body.set("logo", logo)
      const res = await fetch("/api/setup", { method: "POST", body })
      const data = (await res.json()) as { ok?: boolean; brand?: Brand; error?: string }
      if (!res.ok || !data.ok || !data.brand) {
        setError(data.error ?? "Setup failed. Try again.")
        return
      }
      setSaved(data.brand)
      push({ title: "Brand saved", variant: "success" })
    } catch {
      setError("Setup failed to reach the server. Check that the app is running and try again.")
    } finally {
      setSubmitting(false)
    }
  }

  async function copyCommand() {
    try {
      await navigator.clipboard.writeText(SETUP_COMMAND)
      setCopied(true)
      push({ title: "Command copied", variant: "info" })
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // clipboard blocked — the command is visible on screen to copy by hand
    }
  }

  if (saved) {
    return (
      <AuCard className="p-6 flex flex-col gap-5">
        <div className="flex items-center gap-3">
          <span className="auis-welcome-check">
            <Icon name="check_circle" size={22} fill={1} />
          </span>
          <div className="flex flex-col gap-0.5">
            <h2 className="text-lg font-semibold m-0">Your brand is saved</h2>
            <p className="text-sm text-(--fg-secondary) m-0">
              {saved.name}
              {saved.tagline ? ` — ${saved.tagline}` : ""}
            </p>
          </div>
        </div>

        <p className="text-sm text-(--fg-secondary) m-0 leading-relaxed">
          Now run this in your agent to build your design system:
        </p>

        <div className="auis-welcome-command">
          <code className="auis-welcome-command__text">{SETUP_COMMAND}</code>
          <AuButton
            type="button"
            variant="secondary"
            size="sm"
            iconLeft={copied ? "check" : "content_copy"}
            onClick={copyCommand}
          >
            {copied ? "Copied" : "Copy"}
          </AuButton>
        </div>

        <p className="text-xs text-(--fg-tertiary) m-0 leading-relaxed">
          It runs brand → foundation → voice: seeds your brand, extracts your
          design tokens, then bootstraps your product voice.
        </p>

        <div className="flex gap-2 pt-1">
          <Link href="/auis" className="no-underline">
            <AuButton variant="primary" iconRight="arrow_forward">
              Go to the hub
            </AuButton>
          </Link>
        </div>
      </AuCard>
    )
  }

  return (
    <AuCard className="p-6">
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        {error && <AuAlert variant="danger">{error}</AuAlert>}

        <AuField variant="framed" label="Project name" htmlFor="brand-name">
          <AuInput
            id="brand-name"
            placeholder="Acme"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </AuField>

        <AuField
          variant="framed"
          label="What is your product"
          htmlFor="brand-tagline"
          helper="One line — the promise, in your own words."
        >
          <AuInput
            id="brand-tagline"
            placeholder="Invoicing that runs itself"
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
          />
        </AuField>

        <div className="flex flex-col gap-2">
          <span className="au-field__label">Logo</span>
          <div className="auis-welcome-upload">
            <span className="auis-welcome-upload__preview">
              {preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview} alt="" className="auis-welcome-upload__img" />
              ) : (
                <Icon name="image" size={22} className="text-(--fg-tertiary)" />
              )}
            </span>
            <div className="flex flex-col gap-1.5">
              <AuButton
                type="button"
                variant="secondary"
                size="sm"
                iconLeft="upload"
                onClick={() => fileInputRef.current?.click()}
              >
                {logo ? "Change logo" : "Choose logo"}
              </AuButton>
              <span className="text-xs text-(--fg-tertiary)">
                {logo ? logo.name : "SVG, PNG, JPEG or WebP · up to 2 MB"}
              </span>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPT}
              onChange={onPickFile}
              className="sr-only"
              tabIndex={-1}
            />
          </div>
        </div>

        <AuButton
          type="submit"
          variant="primary"
          iconRight={submitting ? undefined : "arrow_forward"}
          loading={submitting}
          disabled={submitting}
          className="mt-2"
        >
          {submitting ? "Saving…" : "Save brand"}
        </AuButton>
      </form>
    </AuCard>
  )
}
