import { AuPill } from "@/components/ui/AuPill"
import { Icon } from "@/components/ui/Icon"
import { PageHero, Section } from "../../_primitives"

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center px-1.5 py-0.5 rounded-sm bg-(--bg-muted) border border-(--border-subtle) text-(--fg-primary) text-[11px] mx-0.5">
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

export default function ReviewModeFoundationPage() {
  return (
    <div className="flex flex-col gap-12">
      <PageHero title="Review Mode">
        Auis&apos; internal tool for annotating screens during live reviews. Freehand
        marks and pins with a comment, saved in the browser or in a local bridge
        for an agent to resolve and hand back for approval.
      </PageHero>

      <Section
        id="ativar"
        title="How to turn it on"
        lead="Review Mode is always mounted — no env flag. It gates itself on the store's state, so you just open it."
      >
        <div className="rounded-lg border border-(--border-subtle) bg-(--bg-raised) p-5 flex flex-col gap-4">
          <div className="flex items-start gap-3">
            <Icon
              name="draw"
              size={20}
              className="text-(--fg-tertiary) mt-0.5"
            />
            <p className="m-0 text-sm text-(--fg-secondary)">
              Open the <strong>Auis dot</strong> (bottom corner) and pick{" "}
              <strong>Enter Review Mode</strong> — or hit <Kbd>⌘</Kbd>+<Kbd>⇧</Kbd>+
              <Kbd>Y</Kbd>. No env flag, no rebuild.
            </p>
          </div>
          <p className="m-0 text-sm text-(--fg-secondary)">
            In the normal flow, <code className="font-mono text-xs">npm run dev</code>{" "}
            prepares the token, starts the local bridge and points the frontend at{" "}
            <code className="font-mono text-xs">127.0.0.1:9878</code>. Without the
            bridge, comments stay in the browser&apos;s{" "}
            <code className="font-mono text-xs">localStorage</code>.
          </p>
        </div>
      </Section>

      <Section
        id="usar"
        title="How to use it"
        lead="Freehand marks to circle regions; a pin to point at an exact spot."
      >
        <ol className="list-none p-0 m-0 flex flex-col gap-5">
          <Step number={1} title="Identify yourself">
            The first time you turn it on, pick a name and a color. Both are saved
            in your browser and show up on comments and approvals.
          </Step>
          <Step number={2} title="Pick a mode">
            In the bottom bar: <Kbd>cursor</Kbd> captures nothing,{" "}
            <Kbd>freehand</Kbd> lets you draw with the mouse, <Kbd>pin</Kbd> drops a
            marker on a click. <Kbd>⌘</Kbd>+<Kbd>⇧</Kbd>+<Kbd>K</Kbd> cycles through
            the modes.
          </Step>
          <Step number={3} title="Annotate">
            Release the mouse (or click the pin) and the popover appears. Write the
            feedback and <Kbd>⌘</Kbd>+<Kbd>↵</Kbd> to save. <Kbd>Esc</Kbd> cancels.
          </Step>
          <Step number={4} title="Review in the side panel">
            The <Icon name="forum" size={14} /> icon opens the list. Filter by open /
            in review / archived, jump between screens, approve or reject agent
            deliveries and delete comments. Clicking a card smooth-scrolls to the
            anchor on the screen itself.
          </Step>
          <Step number={5} title="Export">
            <Icon name="ios_share" size={14} /> opens a modal with the full JSON.
            Handy for archiving a review session or inspecting the payload the agent
            is receiving.
          </Step>
        </ol>
      </Section>

      <Section
        id="bridge"
        title="Local bridge (agent queue)"
        lead="The bridge runs on your own machine, on 127.0.0.1, and persists the queue that local agents read to resolve comments. It is not a server for other people on the network."
      >
        <div className="flex flex-col gap-5">
          <div className="rounded-lg border border-(--border-subtle) bg-(--bg-raised) p-5 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <AuPill variant="ai" dot={false}>
                Server
              </AuPill>
              <span className="text-xs text-(--fg-tertiary)">
                review-bridge/
              </span>
            </div>
            <ol className="list-decimal pl-5 m-0 text-sm text-(--fg-secondary) space-y-1.5 leading-relaxed">
              <li>
                <code className="font-mono text-xs">npm install</code> installs the
                root deps. If the bridge is missing its deps, run{" "}
                <code className="font-mono text-xs">npm run review-bridge:install</code>.
              </li>
              <li>
                <code className="font-mono text-xs">npm run dev</code> runs{" "}
                <code className="font-mono text-xs">review-bridge:prepare</code>,
                generates or reuses the token and starts the bridge on{" "}
                <code className="font-mono text-xs">127.0.0.1:9878</code>.
              </li>
            </ol>
          </div>

          <div className="rounded-lg border border-(--border-subtle) bg-(--bg-raised) p-5 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <AuPill variant="beta" dot={false}>
                Frontend
              </AuPill>
              <span className="text-xs text-(--fg-tertiary)">
                .env.local
              </span>
            </div>
            <p className="m-0 text-sm text-(--fg-secondary)">
              The prepare step in <code className="font-mono text-xs">npm run dev</code>{" "}
              keeps the two vars below in <code className="font-mono text-xs">.env.local</code>.
              With them, the overlay uses the bridge instead of localStorage.
            </p>
            <pre className="m-0 rounded-sm bg-(--bg-muted) border border-(--border-subtle) p-3 text-[12px] font-mono whitespace-pre-wrap">
              {`NEXT_PUBLIC_AUIS_REVIEW_BRIDGE_URL=http://127.0.0.1:9878
NEXT_PUBLIC_AUIS_REVIEW_TOKEN=<same-token-as-the-server>`}
            </pre>
            <p className="m-0 text-xs text-(--fg-tertiary) flex items-start gap-1.5">
              <Icon name="info" size={13} className="mt-0.5" />
              <span>
                If you already had comments in localStorage, the overlay detects them
                the first time it opens and offers an <strong>Import</strong> toast to
                push everything to the bridge.
              </span>
            </p>
          </div>

          <div className="rounded-lg border border-(--border-subtle) bg-(--bg-raised) p-5 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <AuPill variant="error" dot={false}>
                Security
              </AuPill>
              <span className="text-xs text-(--fg-tertiary)">
                Local-only, don&apos;t expose it to the network
              </span>
            </div>
            <p className="m-0 text-sm text-(--fg-secondary) leading-relaxed">
              Auth is a token in a header (
              <code className="font-mono text-xs">X-Review-Token</code>). That is
              enough for the local development flow, but it is not a public product
              model. The server must listen on{" "}
              <code className="font-mono text-xs">127.0.0.1</code>; don&apos;t use{" "}
              <code className="font-mono text-xs">0.0.0.0</code>, don&apos;t port
              forward, and don&apos;t put sensitive data in these comments.
            </p>
          </div>
        </div>
      </Section>

      <Section
        id="atalhos"
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
                desc: "Turns the overlay on/off",
              },
              {
                keys: (
                  <>
                    <Kbd>⌘</Kbd>+<Kbd>⇧</Kbd>+<Kbd>K</Kbd>
                  </>
                ),
                desc: "Cycles cursor → freehand → pin",
              },
              {
                keys: (
                  <>
                    <Kbd>⌘</Kbd>+<Kbd>↵</Kbd>
                  </>
                ),
                desc: "Saves the comment in the open popover",
              },
              {
                keys: <Kbd>Esc</Kbd>,
                desc: "Cancels the popover; back to cursor; closes the panel",
              },
            ].map((row, i) => (
              <li
                key={i}
                className="flex items-center justify-between gap-4 px-5 py-3"
              >
                <span className="text-sm text-(--fg-secondary)">
                  {row.desc}
                </span>
                <span className="flex items-center text-[11px]">
                  {row.keys}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </Section>

      <Section
        id="limitacoes"
        title="Known limitations"
        lead="v1 favors simplicity — a few documented trade-offs so you can decide when to trust it."
      >
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="rounded-lg border border-(--border-subtle) bg-(--bg-raised) p-5">
            <div className="flex items-center gap-2 mb-2">
              <AuPill variant="draft" dot={false}>
                Stale
              </AuPill>
              <span className="text-xs text-(--fg-tertiary)">
                The anchor can drift
              </span>
            </div>
            <p className="m-0 text-sm text-(--fg-secondary) leading-relaxed">
              Coords are saved as a % of the viewport + scrollY. If the screen&apos;s
              content changed (a list grew, new data loaded), the anchor can end up in
              the wrong place. We mark it <strong>stale</strong> when the document
              height changed by more than 20%.
            </p>
          </div>
          <div className="rounded-lg border border-(--border-subtle) bg-(--bg-raised) p-5">
            <div className="flex items-center gap-2 mb-2">
              <AuPill variant="neutral" dot={false}>
                Local bridge
              </AuPill>
              <span className="text-xs text-(--fg-tertiary)">
                Local agent queue
              </span>
            </div>
            <p className="m-0 text-sm text-(--fg-secondary) leading-relaxed">
              With no bridge configured, everything stays in the browser&apos;s
              localStorage. With the bridge, comments go to local JSON files and can be
              consumed by agents on the same machine. Other machines are not supported
              in this mode.
            </p>
          </div>
          <div className="rounded-lg border border-(--border-subtle) bg-(--bg-raised) p-5">
            <div className="flex items-center gap-2 mb-2">
              <AuPill variant="neutral" dot={false}>
                Local identity
              </AuPill>
              <span className="text-xs text-(--fg-tertiary)">
                Identity is just a name
              </span>
            </div>
            <p className="m-0 text-sm text-(--fg-secondary) leading-relaxed">
              You type the name once. There is no real login; the identity only exists
              to attribute comments and to approve or reject agent deliveries.
            </p>
          </div>
          <div className="rounded-lg border border-(--border-subtle) bg-(--bg-raised) p-5">
            <div className="flex items-center gap-2 mb-2">
              <AuPill variant="neutral" dot={false}>
                Coexistence
              </AuPill>
              <span className="text-xs text-(--fg-tertiary)">
                Lives alongside Claude Edit
              </span>
            </div>
            <p className="m-0 text-sm text-(--fg-secondary) leading-relaxed">
              Every Review layer carries{" "}
              <code className="font-mono text-xs">
                data-auis-review
              </code>{" "}
              so that the Claude Edit picker (<Kbd>⌘</Kbd>+<Kbd>⇧</Kbd>+<Kbd>L</Kbd>)
              ignores the canvas, and vice versa.
            </p>
          </div>
        </div>
      </Section>
    </div>
  )
}
