"use client"

import * as React from "react"
import {
  AuEmpty,
  AuEmptyDescription,
  AuEmptyHeader,
  AuEmptyMedia,
  AuEmptyTitle,
} from "@/components/ui/AuEmpty"
import { AuButton } from "@/components/ui/AuButton"
import { AuPill } from "@/components/ui/AuPill"
import { Icon } from "@/components/ui/Icon"

/**
 * Team tab of the Review Bridge — who is who and who can do what. Lists the
 * review identities (the "who are you?" members) and, when a deployment wires
 * an auth provider into `_session.ts`, its accounts with the resolved role. An
 * admin removes an obsolete identity from here; the real role comes from the
 * server (it is not editable by click — on purpose: the hierarchy must never
 * be self-assignable from the UI).
 */

interface MemberRow {
  id: string
  name: string
  email?: string
  source: "session" | "identity"
  role?: "admin" | "reviewer"
  shared?: boolean
  colorToken?: string
  createdAt?: number
}

interface MembersPayload {
  members: MemberRow[]
  hierarchyActive: boolean
  adminEmails: string[]
  sharedEmails: string[]
}

export function MembersPanel() {
  const [data, setData] = React.useState<MembersPayload | null>(null)
  const [forbidden, setForbidden] = React.useState(false)
  const [loading, setLoading] = React.useState(true)
  const [removing, setRemoving] = React.useState<string | null>(null)

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/review-bridge/members", { cache: "no-store" })
      if (res.status === 403) {
        setForbidden(true)
        return
      }
      if (!res.ok) throw new Error(String(res.status))
      setData((await res.json()) as MembersPayload)
      setForbidden(false)
    } catch {
      /* transient — keep the previous state */
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void load()
  }, [load])

  const removeIdentity = async (id: string) => {
    setRemoving(id)
    try {
      await fetch(`/api/review-bridge/identity/${encodeURIComponent(id)}`, {
        method: "DELETE",
      })
      await load()
    } finally {
      setRemoving(null)
    }
  }

  if (forbidden) {
    return (
      <AuEmpty>
        <AuEmptyHeader>
          <AuEmptyMedia variant="icon">
            <Icon name="lock" size={20} />
          </AuEmptyMedia>
          <AuEmptyTitle>Only admins see the team</AuEmptyTitle>
          <AuEmptyDescription>
            Ask the bridge administrator if you need to change someone here.
          </AuEmptyDescription>
        </AuEmptyHeader>
      </AuEmpty>
    )
  }

  if (loading && !data) {
    return (
      <p className="body-sm text-(--fg-tertiary) py-8 text-center">
        Loading team…
      </p>
    )
  }

  if (!data) {
    return (
      <p className="body-sm text-(--fg-tertiary) py-8 text-center">
        Could not load the team right now.
      </p>
    )
  }

  const accounts = data.members.filter((m) => m.source === "session")
  const identities = data.members.filter((m) => m.source === "identity")

  return (
    <div className="flex flex-col gap-8">
      <div className="rounded-lg border border-(--border-subtle) bg-(--bg-raised) px-4 py-3 flex items-start gap-3">
        <Icon
          name={data.hierarchyActive ? "verified_user" : "gpp_maybe"}
          size={18}
          className={
            data.hierarchyActive ? "text-(--accent-success)" : "text-(--au-amber-600)"
          }
        />
        <div className="body-sm leading-relaxed text-(--fg-secondary)">
          {data.hierarchyActive ? (
            <>
              Hierarchy <strong className="text-(--fg-primary)">active</strong>: admins
              ({data.adminEmails.join(", ")}) command agents, approve and control
              visibility. Every other login comments and replies.
            </>
          ) : (
            <>
              Hierarchy <strong className="text-(--fg-primary)">off</strong> — every
              session counts as admin. Auis ships without an auth provider; to
              split admins from reviewers, resolve the session in{" "}
              <code className="text-(--fg-primary)">app/api/review-bridge/_session.ts</code>{" "}
              and every route inherits the roles.
            </>
          )}
        </div>
      </div>

      {accounts.length > 0 && (
        <section className="flex flex-col">
          <header className="flex items-center gap-2 pb-2 border-b border-(--border-subtle)">
            <Icon name="badge" size={16} className="text-(--fg-tertiary)" />
            <h2 className="m-0 text-sm font-semibold text-(--fg-primary)">
              Access accounts
            </h2>
            <span className="body-xs text-(--fg-tertiary)">
              logins of the auth provider · role comes from the server
            </span>
          </header>
          <ul className="m-0 p-0 list-none divide-y divide-(--border-subtle)">
            {accounts.map((m) => (
              <li key={m.id} className="flex items-center gap-3 py-3">
                <span className="h-8 w-8 rounded-full bg-(--bg-muted) flex items-center justify-center text-(--fg-secondary) body-xs font-semibold">
                  {m.name.charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0 flex flex-col">
                  <span className="text-sm font-medium text-(--fg-primary) truncate">
                    {m.name}
                  </span>
                  {m.email && (
                    <span className="body-xs text-(--fg-tertiary) truncate">
                      {m.email}
                    </span>
                  )}
                </div>
                <div className="ml-auto flex items-center gap-1.5">
                  {m.shared && (
                    <AuPill variant="beta" dot={false}>
                      Shared
                    </AuPill>
                  )}
                  {m.role === "admin" ? (
                    <AuPill variant="live" dot={false}>
                      Admin
                    </AuPill>
                  ) : (
                    <AuPill variant="draft" dot={false}>
                      Guest
                    </AuPill>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="flex flex-col">
        <header className="flex items-center gap-2 pb-2 border-b border-(--border-subtle)">
          <Icon name="group" size={16} className="text-(--fg-tertiary)" />
          <h2 className="m-0 text-sm font-semibold text-(--fg-primary)">
            Members (review identities)
          </h2>
          <span className="body-xs text-(--fg-tertiary)">
            who signs the comments · mentionable with @
          </span>
        </header>
        {identities.length === 0 ? (
          <p className="body-sm text-(--fg-tertiary) py-4">
            No identity created yet — they are born when someone reviews for the
            first time.
          </p>
        ) : (
          <ul className="m-0 p-0 list-none divide-y divide-(--border-subtle)">
            {identities.map((m) => (
              <li key={m.id} className="flex items-center gap-3 py-3">
                <span
                  className="h-8 w-8 rounded-full flex items-center justify-center text-(--fg-on-inverse) body-xs font-semibold"
                  style={{ background: m.colorToken ?? "var(--fg-tertiary)" }}
                >
                  {m.name.charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0 flex flex-col">
                  <span className="text-sm font-medium text-(--fg-primary) truncate">
                    {m.name}
                  </span>
                  <span className="body-xs text-(--fg-tertiary) truncate">
                    {m.email ?? "no personal e-mail"}
                    {m.createdAt
                      ? ` · since ${new Date(m.createdAt).toLocaleDateString("en-GB")}`
                      : ""}
                  </span>
                </div>
                <div className="ml-auto flex items-center gap-1.5">
                  {m.id.startsWith("rev-member-") && (
                    <AuPill variant="draft" dot={false}>
                      Mentionable
                    </AuPill>
                  )}
                  <AuButton
                    variant="ghost"
                    size="sm"
                    iconLeft="delete"
                    loading={removing === m.id}
                    disabled={removing !== null}
                    onClick={() => void removeIdentity(m.id)}
                  >
                    Remove
                  </AuButton>
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="body-xs text-(--fg-tertiary) mt-3">
          Removing an identity only takes the name out of the mention list — the
          comments already signed by it stay intact.
        </p>
      </section>
    </div>
  )
}
