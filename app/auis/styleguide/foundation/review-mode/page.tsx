import { AuPill } from "@/components/ui/AuPill"
import { Icon } from "@/components/ui/Icon"
import { PageHero, Section } from "../../_primitives"

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center px-1.5 py-0.5 rounded-sm bg-(--bg-muted) border border-(--border-subtle) text-(--fg-primary) text-2xs mx-0.5">
      {children}
    </kbd>
  )
}

function Step({
  number,
  title,
  children,
}: {
  number: number
  title: string
  children: React.ReactNode
}) {
  return (
    <li className="flex gap-4">
      <span className="shrink-0 h-7 w-7 rounded-full bg-(--bg-inverse) text-(--fg-on-inverse) text-xs font-semibold inline-flex items-center justify-center">
        {number}
      </span>
      <div className="flex-1">
        <h3 className="m-0 text-base font-semibold text-(--fg-primary)">
          {title}
        </h3>
        <p className="mt-1 mb-0 text-sm text-(--fg-secondary) leading-relaxed">
          {children}
        </p>
      </div>
    </li>
  )
}

function Card({
  pill,
  variant = "neutral",
  meta,
  children,
}: {
  pill: string
  variant?: "neutral" | "beta" | "ai" | "error" | "draft" | "live"
  meta?: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-lg border border-(--border-subtle) bg-(--bg-raised) p-5">
      <div className="flex items-center gap-2 mb-2">
        <AuPill variant={variant} dot={false}>
          {pill}
        </AuPill>
        {meta && <span className="text-xs text-(--fg-tertiary)">{meta}</span>}
      </div>
      <div className="m-0 text-sm text-(--fg-secondary) leading-relaxed">{children}</div>
    </div>
  )
}

export default function ReviewModeFoundationPage() {
  return (
    <div className="flex flex-col gap-12">
      <PageHero title="Review Mode">
        Auis&apos; built-in tool for annotating screens during live reviews.
        Freehand marks and pins with a comment, saved by the serverless Review
        Bridge for an agent to resolve and hand back for approval.
      </PageHero>

      <Section
        id="turn-on"
        title="How to turn it on"
        lead="Review Mode is always mounted — no env flag. It gates itself on the store's state, so you just open it."
      >
        <div className="rounded-lg border border-(--border-subtle) bg-(--bg-raised) p-5 flex flex-col gap-4">
          <div className="flex items-start gap-3">
            <Icon name="draw" size={20} className="text-(--fg-tertiary) mt-0.5" />
            <p className="m-0 text-sm text-(--fg-secondary)">
              Open the <strong>Auis dot</strong> (bottom-right corner) and pick{" "}
              <strong>Enter Review Mode</strong>, click the <strong>Review</strong>{" "}
              pill at the bottom of the screen, or hit <Kbd>⌘</Kbd>+<Kbd>⇧</Kbd>+
              <Kbd>Y</Kbd>. Review, Edit and State modes are mutually exclusive —
              the switch on the left of the pill jumps between them.
            </p>
          </div>
          <p className="m-0 text-sm text-(--fg-secondary)">
            <code className="font-mono text-xs">npm run dev</code> already brings up
            the bridge: the routes live in the Next app under{" "}
            <code className="font-mono text-xs">/api/review-bridge/*</code> and
            persist to <code className="font-mono text-xs">review-bridge/data/</code>.
            No second process, no port, no token.
          </p>
        </div>
      </Section>

      <Section
        id="use"
        title="How to use it"
        lead="Freehand marks to circle regions; a pin to point at an exact spot; the magic pointer to snap the pin to an element."
      >
        <ol className="list-none p-0 m-0 flex flex-col gap-5">
          <Step number={1} title="Identify yourself">
            The first time you turn it on, pick a name, a color and an optional
            e-mail. Several accounts can live in the same browser — switch or add
            one from the avatar in the pill.
          </Step>
          <Step number={2} title="Pick a mode">
            In the bottom bar: <Kbd>cursor</Kbd> captures nothing,{" "}
            <Kbd>freehand</Kbd> lets you draw, <Kbd>pin</Kbd> drops a marker on a
            click and the <Kbd>magic pointer</Kbd> highlights the element under the
            cursor and anchors the pin to it, so it follows reflow and zoom.{" "}
            <Kbd>⌘</Kbd>+<Kbd>⇧</Kbd>+<Kbd>K</Kbd> cycles through the modes.
          </Step>
          <Step number={3} title="Annotate">
            Release the mouse (or click the pin) and the composer appears. Type,
            paste images, dictate by voice or let the wand rewrite the draft into
            something an agent can act on. <Kbd>⌘</Kbd>+<Kbd>↵</Kbd> saves,{" "}
            <Kbd>Esc</Kbd> cancels. The lock keeps a comment between admins.
          </Step>
          <Step number={4} title="Mention people and agents">
            <code className="font-mono text-xs">@</code> lists the reviewers and
            the agents (<strong>@Claude</strong>, <strong>@Grok</strong>,{" "}
            <strong>@Codex</strong>); <code className="font-mono text-xs">/</code>{" "}
            lists the skills the mentioned agent can run. Nothing else is needed:
            the mention is the request, and the agent&apos;s ceiling in the dot decides
            how far it may go. An agent switched off shows &quot;off&quot; in the menu.
          </Step>
          <Step number={5} title="Follow the thread">
            Clicking a pin opens the thread next to it: replies, edits, approve or
            reject a delivery. The <Icon name="forum" size={14} /> icon opens the
            side panel with search, filters and bulk approval; the inbox and the
            Review Bridge page list everything across screens.
          </Step>
          <Step number={6} title="Share a permalink">
            Every comment has a link with <code className="font-mono text-xs">?reviewCommentId=</code>.
            Opening it turns Review Mode on, replays the clicks that opened the
            modal or drawer holding the pin, and scrolls to it.
          </Step>
        </ol>
      </Section>

      <Section
        id="agents"
        title="Agents"
        lead="The mention is the request. Switch an agent on in the Auis dot, set its ceiling and mention it — the write itself opens the agent."
      >
        <div className="grid sm:grid-cols-2 gap-4">
          <Card pill="Reply" variant="beta">
            The lower ceiling: the agent reads the code and the thread and answers
            — an answer, a question back — without touching code. Its final
            message is posted in the thread by the runner.
          </Card>
          <Card pill="Edit" variant="ai" meta="the model is yours to pick">
            The higher ceiling: the agent runs the referenced (or inferred) skill,
            moves the comment to <strong>in review</strong> and replies a summary.
            You approve or reject the delivery. Never commit, push, archive or approve.
          </Card>
          <Card pill="@Claude · @Grok" variant="live">
            Executors with a CLI (<code className="font-mono text-xs">claude -p</code>,{" "}
            <code className="font-mono text-xs">grok -p</code>). They resolve comments
            (<code className="font-mono text-xs">auis-review-bridge-solve</code>), run
            the UX writing pass and materialize live edits.
          </Card>
          <Card pill="@Codex" variant="neutral">
            Registered with the same contracts, but no engine is wired yet — the
            row shows in the panel and stays off.
          </Card>
        </div>
        <p className="mt-4 mb-0 text-sm text-(--fg-secondary) leading-relaxed">
          Local dev only, with{" "}
          <code className="font-mono text-xs">AUIS_MENTION_TRIGGER=1</code>. Five
          gates: never in production, only the admin&apos;s own writes, never a write
          authored by an agent, only on creation, only for an agent switched on.{" "}
          <code className="font-mono text-xs">scripts/mention-run.mjs</code> runs one
          editor at a time behind a working-tree lock and posts the failure in the
          thread when nothing comes back. The contract is in{" "}
          <code className="font-mono text-xs">review-bridge/README.md</code>.
        </p>
      </Section>

      <Section
        id="bridge"
        title="Serverless bridge"
        lead="Same-origin routes, JSON on disk, backups before every write. Agents on this machine read the same files."
      >
        <div className="flex flex-col gap-5">
          <Card pill="Routes" variant="ai" meta="app/api/review-bridge/">
            <code className="font-mono text-xs">GET /comments?view=lean</code> for
            triage, <code className="font-mono text-xs">PUT /comments/:id</code> with
            a transition to move status, <code className="font-mono text-xs">POST …/replies</code>{" "}
            to answer. The full contract is in{" "}
            <code className="font-mono text-xs">review-bridge/README.md</code>.
          </Card>
          <Card pill="Data" variant="beta" meta="review-bridge/data/">
            <code className="font-mono text-xs">comments.json</code> (open, in
            review, future ideas, identities, agent settings),{" "}
            <code className="font-mono text-xs">comments.archive.json</code>{" "}
            (resolved) and <code className="font-mono text-xs">images/</code>{" "}
            (content-addressed attachments). Snapshots go to{" "}
            <code className="font-mono text-xs">~/.auis/review-bridge-backups</code>.
          </Card>
          <Card pill="Hierarchy" variant="draft" meta="app/api/review-bridge/_session.ts">
            Locally every browser is an admin. Put Auis behind a login and resolve
            the session in one file: admins command agents and approve, reviewers
            comment, agents authenticate with{" "}
            <code className="font-mono text-xs">x-bridge-agent-token</code>.
          </Card>
          <Card pill="Security" variant="error" meta="Local-only">
            The bridge is a development tool. Keep the dev server on{" "}
            <code className="font-mono text-xs">127.0.0.1</code>, don&apos;t expose it
            to the network and don&apos;t put sensitive data in the comments.
          </Card>
        </div>
      </Section>

      <Section
        id="shortcuts"
        title="Shortcuts"
        lead="Everything from the keyboard, so it never gets in the way of navigating the product."
      >
        <div className="rounded-lg border border-(--border-subtle) bg-(--bg-raised) overflow-hidden">
          <ul className="divide-y divide-(--border-subtle) m-0 p-0 list-none">
            {[
              {
                keys: (
                  <>
                    <Kbd>⌘</Kbd>+<Kbd>⇧</Kbd>+<Kbd>Y</Kbd>
                  </>
                ),
                desc: "Turns Review Mode on/off",
              },
              {
                keys: (
                  <>
                    <Kbd>⌘</Kbd>+<Kbd>⇧</Kbd>+<Kbd>K</Kbd>
                  </>
                ),
                desc: "Cycles cursor → freehand → pin → magic pointer",
              },
              {
                keys: (
                  <>
                    <Kbd>⌘</Kbd>+<Kbd>⇧</Kbd>+<Kbd>E</Kbd>
                  </>
                ),
                desc: "Edit Mode (live edits materialized by a skill)",
              },
              {
                keys: (
                  <>
                    <Kbd>⌘</Kbd>+<Kbd>⇧</Kbd>+<Kbd>S</Kbd>
                  </>
                ),
                desc: "State Mode (switch the screen's registered scenarios)",
              },
              {
                keys: (
                  <>
                    <Kbd>⌘</Kbd>+<Kbd>↵</Kbd>
                  </>
                ),
                desc: "Saves the comment or reply in the open composer",
              },
              {
                keys: <Kbd>Esc</Kbd>,
                desc: "Cancels the composer; back to cursor; closes the thread or panel",
              },
            ].map((row, i) => (
              <li
                key={i}
                className="flex items-center justify-between gap-4 px-5 py-3"
              >
                <span className="text-sm text-(--fg-secondary)">{row.desc}</span>
                <span className="flex items-center text-2xs">{row.keys}</span>
              </li>
            ))}
          </ul>
        </div>
      </Section>

      <Section
        id="limitations"
        title="Known limitations"
        lead="A few documented trade-offs so you can decide when to trust it."
      >
        <div className="grid sm:grid-cols-2 gap-4">
          <Card pill="Stale" variant="draft" meta="The anchor can drift">
            Pins remember the element they were dropped on (selector + text
            fingerprint) and re-resolve on render. When the element is gone the
            pin is hidden and the card says where it was; when the document height
            changed by more than 20% the comment is marked <strong>stale</strong>.
          </Card>
          <Card pill="Local identity" meta="Identity is just a name">
            You type the name once. There is no login; the identity attributes
            comments and approvals. A deployment can adopt a session identity
            through the same store.
          </Card>
          <Card pill="One machine" meta="Files on disk">
            The bridge writes JSON files in the checkout. Agents on the same
            machine read them; other machines are not supported without a
            different store driver.
          </Card>
          <Card pill="Coexistence" meta="Lives alongside Edit and State modes">
            Every Review layer carries{" "}
            <code className="font-mono text-xs">data-auis-review</code> so the Edit
            picker ignores the canvas, and vice versa. Turning one mode on turns
            the others off.
          </Card>
        </div>
      </Section>
    </div>
  )
}
