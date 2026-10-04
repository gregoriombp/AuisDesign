"use client"

/* ─────────────────────────────────────────────────────────────────────
 * Koru sign-in — compiled view (golden eye)
 *
 * Every way into Koru, compiled from Koru's auth code into ONE graph:
 *   1. Email and password — the browser sign-in form (/ and /login).
 *   2. Google or Apple — the OAuth buttons on the form and in the app.
 *   3. Installed app — the PWA HomeFlow at / (and /signed-out).
 *   4. Forgot password — /forgot-password → email link → /reset-password.
 *   5. No account yet — waitlist, invite code, registration, topics.
 *   6. Session gate — src/proxy.ts sending a protected link to sign-in.
 *
 * Source: the Koru frontend working tree on top of commit f7eacbf
 * (uncommitted there: / renders the sign-in form for browser visitors, and
 * Get early access points to /waitlist). Re-map when those land or change.
 *
 * The screens live in the Koru repo, not in Auis, and Koru answers with
 * X-Frame-Options: DENY — so no card carries an href and a click opens no
 * preview. Each card names its Koru route and lists its states instead.
 * The click handler and GoldenEyeScreenPreview stay wired so a card can
 * gain a real route later without touching the page logic.
 * ──────────────────────────────────────────────────────────────────── */

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  ReactFlow,
  Background,
  Controls,
  Panel,
  Handle,
  Position,
  MarkerType,
  type BuiltInEdge,
  type Edge,
  type Node,
  type NodeChange,
  type NodeProps,
  type ReactFlowInstance,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"

import { Icon } from "@/components/ui/Icon"
import { PageHero, Section } from "../../styleguide/_primitives"
import {
  GoldenEyeCommentComposer,
  GoldenEyeScreenPreview,
} from "../_components/golden-eye-overlays"
import { useGoldenEyeComments } from "../_components/use-golden-eye-comments"
import {
  FlowUpdatesBadge,
  FlowUpdatesHistorySection,
  type FlowUpdate,
} from "../_components/flow-updates"

/* ─── Scenarios ─────────────────────────────────────────────────────── */
/* Pink is left to the `cross` edge preset, so the sixth lens takes slate. */

type Scenario = "password" | "oauth" | "pwa" | "reset" | "access" | "gate"
type Focus = Scenario | "all"

const SCENARIO: Record<Scenario, { label: string; color: string }> = {
  password: { label: "Email and password", color: "var(--au-blue-600)" },
  oauth: { label: "Google or Apple", color: "var(--au-emerald-600)" },
  pwa: { label: "Installed app", color: "var(--au-purple-600)" },
  reset: { label: "Forgot password", color: "var(--au-teal-600)" },
  access: { label: "No account yet", color: "var(--au-lime-600)" },
  gate: { label: "Session gate", color: "var(--au-slate-600)" },
}
const ALL = Object.keys(SCENARIO) as Scenario[]

const FOCI: { id: Focus; label: string }[] = [
  { id: "all", label: "All" },
  ...ALL.map((s) => ({ id: s, label: SCENARIO[s].label })),
]

/* ─── Node data ─────────────────────────────────────────────────────── */

type ScreenVariant = { label: string; href: string }
type ScreenData = {
  step?: string
  title: string
  note?: string
  /** Koru route (or surface) the card stands for — shown on the card. */
  route?: string
  /** States of this one screen, listed on the card. */
  states?: string[]
  href?: string
  variants?: ScreenVariant[]
  scenarios: Scenario[]
  _comments?: number
}
type DecisionData = {
  step?: string
  title: string
  question?: string
  scenarios: Scenario[]
  _comments?: number
}
type SectionData = { title: string; scenario: Scenario }

/* Comment pin — shows on a card when it has notes. */
function CommentPin({ n }: { n: number }) {
  return (
    <span className="absolute -left-2 -top-2 z-20 inline-flex h-5 items-center justify-center gap-0.5 rounded-full border border-(--au-amber-300) bg-(--au-amber-500) px-1.5 text-3xs font-bold text-white shadow-(--shadow-sm)">
      <Icon name="chat_bubble" size={11} />
      {n}
    </span>
  )
}

/* ─── Scenario dots ─────────────────────────────────────────────────── */

function ScenarioDots({ scenarios }: { scenarios: Scenario[] }) {
  return (
    <div className="absolute right-2 top-2 flex gap-1">
      {scenarios.map((s) => (
        <span
          key={s}
          className="inline-block h-2 w-2 rounded-full"
          style={{ background: SCENARIO[s].color }}
          title={SCENARIO[s].label}
        />
      ))}
    </div>
  )
}

/* ─── Handles ───────────────────────────────────────────────────────── */

const SIDES: { id: string; pos: Position }[] = [
  { id: "t", pos: Position.Top },
  { id: "b", pos: Position.Bottom },
  { id: "l", pos: Position.Left },
  { id: "r", pos: Position.Right },
]
function NodeHandles() {
  const cls = "border-0! w-1.5! h-1.5! bg-(--border-strong)!"
  return (
    <>
      {SIDES.map((s) => (
        <Handle key={s.id + "-t"} id={s.id + "-t"} type="target" position={s.pos} style={{ opacity: 0 }} className={cls} />
      ))}
      {SIDES.map((s) => (
        <Handle key={s.id + "-s"} id={s.id + "-s"} type="source" position={s.pos} style={{ opacity: 0 }} className={cls} />
      ))}
    </>
  )
}

/* ─── Renderers ─────────────────────────────────────────────────────── */

function ScreenNode({ data }: NodeProps<Node<ScreenData>>) {
  const opens = Boolean(data.href || data.variants?.length)
  return (
    <div
      className={
        "relative w-52 rounded-lg border border-(--border-default) bg-(--bg-raised) shadow-(--shadow-sm) transition hover:border-(--au-blue-400) hover:shadow-(--shadow-md)" +
        (opens ? " cursor-pointer" : "")
      }
    >
      <NodeHandles />
      <ScenarioDots scenarios={data.scenarios} />
      {data._comments ? <CommentPin n={data._comments} /> : null}
      <div className="flex flex-col gap-1 px-4 py-3 pr-10">
        {data.step && <span className="au-eyebrow text-(--au-blue-700)">{data.step}</span>}
        <span className="text-sm font-medium leading-tight text-(--fg-primary)">{data.title}</span>
        {data.route && (
          <span className="text-2xs leading-snug text-(--fg-secondary)" style={{ fontFamily: "var(--font-mono)" }}>
            {data.route}
          </span>
        )}
        {data.note && <span className="caption text-(--fg-tertiary)">{data.note}</span>}
        {data.states && data.states.length > 0 && (
          <span className="caption flex items-start gap-1 text-(--fg-tertiary)">
            <Icon name="layers" size={12} className="mt-0.5 shrink-0" />
            <span>{data.states.join(" · ")}</span>
          </span>
        )}
        {data.variants && data.variants.length > 1 && (
          <span className="caption inline-flex items-center gap-1 text-(--fg-tertiary)">
            <Icon name="layers" size={12} />
            {data.variants.length} states
          </span>
        )}
      </div>
    </div>
  )
}

function DecisionNode({ data }: NodeProps<Node<DecisionData>>) {
  return (
    <div className="relative flex w-56 flex-col gap-1 rounded-lg border-2 border-dashed border-(--au-amber-400) bg-(--au-amber-100) px-4 py-3 pr-10">
      <NodeHandles />
      <ScenarioDots scenarios={data.scenarios} />
      {data._comments ? <CommentPin n={data._comments} /> : null}
      <span className="au-eyebrow text-(--au-amber-800)">decision</span>
      <span className="text-sm font-medium leading-tight text-(--au-amber-900)">{data.title}</span>
      {data.question && <span className="text-xs leading-snug text-(--au-amber-800)">{data.question}</span>}
    </div>
  )
}

function SectionNode({ data }: NodeProps<Node<SectionData>>) {
  const tint = SCENARIO[data.scenario].color
  return (
    <div
      className="pointer-events-none h-full w-full rounded-2xl"
      style={{
        background: `color-mix(in oklab, ${tint} 6%, transparent)`,
        border: `1.5px dashed color-mix(in oklab, ${tint} 30%, transparent)`,
      }}
    >
      <span
        className="au-eyebrow absolute left-3 top-2.5 rounded-sm px-1.5 py-0.5"
        style={{ color: tint, background: `color-mix(in oklab, ${tint} 12%, transparent)` }}
      >
        {data.title}
      </span>
    </div>
  )
}

const nodeTypes = { screen: ScreenNode, decision: DecisionNode, section: SectionNode }

/* ─── Edges ─────────────────────────────────────────────────────────── */

const base = {
  type: "smoothstep" as const,
  markerEnd: { type: MarkerType.ArrowClosed, width: 15, height: 15 },
  style: { stroke: "var(--border-strong)", strokeWidth: 1.4 },
}
const branch = {
  ...base,
  style: { stroke: "var(--au-amber-500)", strokeWidth: 1.4 },
  markerEnd: { type: MarkerType.ArrowClosed, width: 15, height: 15, color: "var(--au-amber-500)" },
}
const cross = {
  ...base,
  style: { stroke: "var(--au-pink-500)", strokeWidth: 1.4, strokeDasharray: "5 3" },
  markerEnd: { type: MarkerType.ArrowClosed, width: 15, height: 15, color: "var(--au-pink-500)" },
}

/* ─── Merged graph ──────────────────────────────────────────────────── */
/* The trunk runs down the middle: the session gate drops into Sign in, the
   shared form outcomes (inline error, pre-beta alert) sit under it, and the
   feed closes the column. Password and reset work to the left; Google/Apple,
   the no-account paths and the installed app to the right. Everything except
   reset converges on the feed; reset loops back to Sign in. */

const C0 = 0 // reset: invalid link
const C1 = 320 // reset stream
const C2 = 640 // password decision
const C3 = 960 // trunk: gate, Sign in, shared outcomes, feed
const C4 = 1280 // Google or Apple
const C5 = 1600 // no account yet
const C6 = 1920 // installed app
const C7 = 2240 // installed app: /signed-out entry

const R0 = 0
const R1 = 200
const R2 = 420
const R3 = 640
const R4 = 860
const R5 = 1080
const R6 = 1300
const R7 = 1520

const S = (id: string, x: number, y: number, d: ScreenData): Node => ({ id, type: "screen", position: { x, y }, zIndex: 10, data: d })
const D = (id: string, x: number, y: number, d: DecisionData): Node => ({ id, type: "decision", position: { x, y }, zIndex: 10, data: d })

const PW: Scenario[] = ["password"]
const OA: Scenario[] = ["oauth"]
const AP: Scenario[] = ["pwa"]
const RS: Scenario[] = ["reset"]
const AC: Scenario[] = ["access"]
const GT: Scenario[] = ["gate"]

const BASE_NODES: Node[] = [
  /* ═══ TRUNK (shared) ═══ */
  S("protected-link", C3, R0, {
    step: "gate · entry",
    title: "Open a protected page",
    route: "/feed, /article/[id], …",
    note: "Any path outside PUBLIC_ROUTES, often a shared link",
    scenarios: GT,
  }),
  D("d-session", C3 - 8, R1, {
    title: "Session check in the proxy",
    question: "src/proxy.ts reads koru-auth and koru-refresh, and refreshes silently within 8 s.",
    scenarios: GT,
  }),
  S("access-expired", C4, R1, {
    step: "dead end",
    title: "Pre-beta access unavailable",
    route: "/access-expired",
    note: "Clears client state. Email hello@korunews.com or go back to sign in",
    scenarios: ["gate", "pwa"],
  }),
  S("sign-in", C3, R2, {
    step: "entry",
    title: "Sign in",
    route: "/login · / in a browser",
    note: "Welcome back to Koru. Keeps ?returnTo= from the gate",
    states: ["Default", "Signing in...", "Inline error", "Pre-beta alert"],
    scenarios: ["password", "oauth", "reset", "access", "gate"],
  }),
  S("sign-in-error", C3, R3, {
    step: "form state",
    title: "Inline error on the form",
    route: "/login",
    note: "The form stays filled; the person retries",
    states: ["Invalid email or password", "Google sign-in failed", "Apple sign-in timed out", "New Apple account, no invite", "Something went wrong"],
    scenarios: ["password", "oauth"],
  }),
  S("prebeta-alert", C3, R4, {
    step: "dead end",
    title: "Pre-beta access expired alert",
    route: "/login (alert in the form)",
    note: "Email hello@korunews.com or Copy email. No session is created",
    scenarios: ["password", "oauth"],
  }),
  S("feed", C3, R7, {
    step: "end",
    title: "Feed, signed in",
    route: "/feed or the returnTo path",
    note: "AuthenticatedRouteGate rechecks the session every 5 min",
    scenarios: ["password", "oauth", "pwa", "access", "gate"],
  }),

  /* ═══ STREAM: email and password (left of the trunk) ═══ */
  D("d-password", C2 - 8, R3, {
    title: "loginAction answer",
    question: "What does POST /auth/token/ return for this email and password?",
    scenarios: PW,
  }),

  /* ═══ STREAM: forgot password (far left) ═══ */
  S("forgot", C1, R3, {
    step: "reset · 01",
    title: "Forgot your password?",
    route: "/forgot-password",
    note: "Always reports success, so an email cannot be probed",
    states: ["Enter email", "Check your inbox."],
    scenarios: RS,
  }),
  D("d-reset-link", C1 - 8, R4, {
    title: "Reset link from the email",
    question: "Does the link still carry a uid and a token?",
    scenarios: RS,
  }),
  S("reset-invalid", C0, R5, {
    step: "reset · dead end",
    title: "Invalid reset link.",
    route: "/reset-password",
    note: "Request a new link → /forgot-password",
    scenarios: RS,
  }),
  S("reset-form", C1, R5, {
    step: "reset · 02",
    title: "Set a new password",
    route: "/reset-password?uid=…&token=…",
    states: ["Form", "Passwords don't match", "Link expired on submit"],
    scenarios: RS,
  }),
  S("reset-done", C1, R6, {
    step: "reset · 03",
    title: "Password updated.",
    route: "/reset-password",
    note: "Sign in → /, the same form in a browser",
    scenarios: RS,
  }),

  /* ═══ STREAM: Google or Apple (right of the trunk) ═══ */
  S("oauth-popup", C4, R3, {
    step: "oauth · 01",
    title: "Google or Apple window",
    route: "provider popup",
    note: "Closing the popup only resets the button. Apple gives up after 30 s",
    scenarios: OA,
  }),
  D("d-oauth", C4 - 8, R4, {
    title: "/api/auth/oauth answer",
    question: "What does Django say about this Google or Apple account?",
    scenarios: OA,
  }),
  S("choose-username", C4, R5, {
    step: "oauth · 02",
    title: "Choose your username.",
    route: "/choose-username",
    note: "OnboardingGuard sends the person back here until it is confirmed",
    states: ["Pre-filled handle", "Confirm your username.", "Taken or invalid"],
    scenarios: OA,
  }),
  S("topics", C4, R6, {
    step: "onboarding",
    title: "Follow your interests.",
    route: "/onboarding/topics",
    note: "New accounts pick topics, then reach the feed",
    scenarios: ["oauth", "access"],
  }),

  /* ═══ STREAM: no account yet ═══ */
  S("waitlist", C5, R4, {
    step: "access · 01",
    title: "Get early access",
    route: "/waitlist",
    states: ["Email form", "On the list", "Joined through Google", "Too many attempts"],
    scenarios: ["access", "oauth"],
  }),
  S("invite", C5, R5, {
    step: "access · 02",
    title: "Welcome. Enter your invitation code",
    route: "/invite · ?code= pre-fills",
    note: "Also reached from the invite email",
    states: ["Code", "Not found", "Expired or already used"],
    scenarios: AC,
  }),
  S("register", C5, R6, {
    step: "access · 03",
    title: "Create your account.",
    route: "/invite (step 2)",
    note: "Email, username, password, date of birth, terms. Google and Apple carry the code too",
    scenarios: AC,
  }),

  /* ═══ STREAM: installed app (far right) ═══ */
  S("pwa-boot", C6, R0, {
    step: "app · entry",
    title: "Opening Koru...",
    route: "/ in the installed app",
    note: "Branded boot state while the session probe runs, 3 s timeout",
    scenarios: AP,
  }),
  D("d-probe", C6 - 8, R1, {
    title: "Session probe",
    question: "GET /api/v1/profiles/me/summary/. Offline with a saved feed counts as signed in.",
    scenarios: AP,
  }),
  S("signed-out", C7, R1, {
    step: "app · entry",
    title: "Signed out",
    route: "/signed-out",
    note: "After signing out in the app. No probe",
    scenarios: AP,
  }),
  S("pwa-hello", C6, R2, {
    step: "app · 01",
    title: "Hello",
    route: "/ (home panel)",
    note: "I have an account · Get started",
    scenarios: AP,
  }),
  S("pwa-login", C6, R3, {
    step: "app · 02",
    title: "Sign in panel",
    route: "/ (login panel)",
    note: "POST /api/auth/login. Errors show as plain text, pre-beta denial included",
    scenarios: ["pwa", "oauth"],
  }),
  S("welcome", C6, R4, {
    step: "app · 03",
    title: "Welcome view",
    route: "LoginSuccessView",
    note: "Warms the feed cache, then moves on. OAuth in the app lands here too",
    states: ["Finishing sign in...", "Continue", "Taking longer than usual"],
    scenarios: AP,
  }),
]

/* BuiltInEdge (not Edge) so the smoothstep edges can carry pathOptions. */
const EDGES: BuiltInEdge[] = [
  /* Session gate */
  { id: "g1", source: "protected-link", target: "d-session", sourceHandle: "b-s", targetHandle: "t-t", ...base },
  { id: "g2", source: "d-session", target: "sign-in", sourceHandle: "b-s", targetHandle: "t-t", label: "No session, or refresh rejected", ...branch },
  { id: "g3", source: "d-session", target: "feed", sourceHandle: "l-s", targetHandle: "l-t", label: "Valid session", pathOptions: { offset: 44 }, ...branch },
  { id: "g4", source: "d-session", target: "access-expired", sourceHandle: "r-s", targetHandle: "l-t", label: "Pre-beta denied", ...branch },
  { id: "g5", source: "access-expired", target: "sign-in", sourceHandle: "b-s", targetHandle: "r-t", label: "Back to sign in", ...cross },

  /* Email and password */
  { id: "p1", source: "sign-in", target: "d-password", sourceHandle: "l-s", targetHandle: "t-t", label: "Email and password", ...base },
  { id: "p2", source: "d-password", target: "feed", sourceHandle: "l-s", targetHandle: "l-t", label: "Signed in", ...branch },
  { id: "p3", source: "d-password", target: "sign-in-error", sourceHandle: "r-s", targetHandle: "l-t", label: "Wrong credentials", ...branch },
  { id: "p4", source: "d-password", target: "prebeta-alert", sourceHandle: "b-s", targetHandle: "l-t", label: "Pre-beta expired or required", ...branch },
  { id: "p5", source: "sign-in-error", target: "sign-in", sourceHandle: "t-s", targetHandle: "b-t", label: "Try again", ...cross },

  /* Forgot password */
  { id: "r1", source: "sign-in", target: "forgot", sourceHandle: "l-s", targetHandle: "t-t", label: "Forgot your password?", ...base },
  { id: "r2", source: "forgot", target: "d-reset-link", sourceHandle: "b-s", targetHandle: "t-t", label: "Email link opened", ...base },
  { id: "r3", source: "d-reset-link", target: "reset-form", sourceHandle: "b-s", targetHandle: "t-t", label: "uid and token present", ...branch },
  { id: "r4", source: "d-reset-link", target: "reset-invalid", sourceHandle: "l-s", targetHandle: "t-t", label: "Missing", ...branch },
  { id: "r5", source: "reset-invalid", target: "forgot", sourceHandle: "l-s", targetHandle: "l-t", label: "Request a new link", ...cross },
  { id: "r6", source: "reset-form", target: "reset-done", sourceHandle: "b-s", targetHandle: "t-t", ...base },
  { id: "r7", source: "reset-form", target: "forgot", sourceHandle: "r-s", targetHandle: "r-t", label: "Expired", ...cross },
  { id: "r8", source: "reset-done", target: "sign-in", sourceHandle: "l-s", targetHandle: "t-t", label: "Sign in", pathOptions: { offset: 40 }, ...cross },

  /* Google or Apple */
  { id: "o1", source: "sign-in", target: "oauth-popup", sourceHandle: "r-s", targetHandle: "t-t", label: "Continue with Google or Apple", ...base },
  { id: "o2", source: "pwa-login", target: "oauth-popup", sourceHandle: "l-s", targetHandle: "r-t", label: "Same buttons in the app", ...base },
  { id: "o3", source: "oauth-popup", target: "d-oauth", sourceHandle: "b-s", targetHandle: "t-t", ...base },
  { id: "o4", source: "d-oauth", target: "sign-in-error", sourceHandle: "l-s", targetHandle: "r-t", label: "Error", ...branch },
  { id: "o5", source: "d-oauth", target: "prebeta-alert", sourceHandle: "l-s", targetHandle: "r-t", label: "Pre-beta expired", ...branch },
  { id: "o6", source: "d-oauth", target: "choose-username", sourceHandle: "b-s", targetHandle: "t-t", label: "First sign-in", ...branch },
  { id: "o7", source: "d-oauth", target: "waitlist", sourceHandle: "r-s", targetHandle: "l-t", label: "No invite, Google only", ...branch },
  { id: "o8", source: "d-oauth", target: "feed", sourceHandle: "r-s", targetHandle: "r-t", label: "Returning", ...branch },
  { id: "o9", source: "choose-username", target: "topics", sourceHandle: "b-s", targetHandle: "t-t", label: "Username confirmed", ...base },
  { id: "o10", source: "topics", target: "feed", sourceHandle: "l-s", targetHandle: "t-t", ...base },

  /* No account yet */
  { id: "a1", source: "sign-in", target: "waitlist", sourceHandle: "r-s", targetHandle: "t-t", label: "Get early access", data: { scenarios: AC }, ...base },
  { id: "a2", source: "waitlist", target: "invite", sourceHandle: "b-s", targetHandle: "t-t", label: "I have an invite code", ...base },
  { id: "a3", source: "invite", target: "register", sourceHandle: "b-s", targetHandle: "t-t", label: "Code valid", ...base },
  { id: "a4", source: "register", target: "topics", sourceHandle: "l-s", targetHandle: "r-t", label: "Account created", ...base },
  { id: "a5", source: "pwa-hello", target: "invite", sourceHandle: "l-s", targetHandle: "r-t", label: "Get started with a code", ...cross },

  /* Installed app */
  { id: "w1", source: "pwa-boot", target: "d-probe", sourceHandle: "b-s", targetHandle: "t-t", ...base },
  { id: "w2", source: "d-probe", target: "pwa-hello", sourceHandle: "b-s", targetHandle: "t-t", label: "Signed out", ...branch },
  { id: "w3", source: "d-probe", target: "access-expired", sourceHandle: "l-s", targetHandle: "r-t", label: "Pre-beta denied", ...branch },
  { id: "w4", source: "d-probe", target: "feed", sourceHandle: "r-s", targetHandle: "r-t", label: "Signed in", ...branch },
  { id: "w5", source: "signed-out", target: "pwa-hello", sourceHandle: "b-s", targetHandle: "r-t", ...base },
  { id: "w6", source: "pwa-hello", target: "pwa-login", sourceHandle: "b-s", targetHandle: "t-t", label: "I have an account", ...base },
  { id: "w7", source: "pwa-login", target: "welcome", sourceHandle: "b-s", targetHandle: "t-t", label: "Signed in", ...base },
  { id: "w8", source: "welcome", target: "feed", sourceHandle: "b-s", targetHandle: "r-t", label: "Continue", ...base },
]

const NODE_SCENARIOS: Record<string, Scenario[]> = Object.fromEntries(
  BASE_NODES.map((n) => [n.id, (n.data as ScreenData | DecisionData).scenarios]),
)

/* Band of the focused scenario: bounding box of its nodes. */
const FOOTPRINT = { w: 230, h: 120 }
const PAD = 40
function focusBand(focus: Scenario): Node {
  const members = BASE_NODES.filter((n) => (n.data as ScreenData | DecisionData).scenarios.includes(focus))
  const xs = members.map((n) => n.position.x)
  const ys = members.map((n) => n.position.y)
  const minX = Math.min(...xs) - PAD
  const minY = Math.min(...ys) - PAD
  return {
    id: "band",
    type: "section",
    position: { x: minX, y: minY },
    style: {
      width: Math.max(...xs) + FOOTPRINT.w + PAD - minX,
      height: Math.max(...ys) + FOOTPRINT.h + PAD - minY,
    },
    zIndex: 0,
    selectable: false,
    draggable: false,
    data: { title: SCENARIO[focus].label, scenario: focus },
  }
}

/* ─── Changelog ─────────────────────────────────────────────────────── */

const updates: FlowUpdate[] = [
  {
    date: "2026-10-03",
    summary:
      "Compiled view created from the Koru frontend working tree on top of f7eacbf: 6 scenarios merged into one graph (email and password, Google or Apple, installed app, forgot password, no account yet, session gate), with 3 sign-in asymmetries marked.",
    tags: ["new-page"],
  },
]

/* ─── Page ──────────────────────────────────────────────────────────── */

export default function KoruLoginGoldenEyePage() {
  const [focus, setFocus] = useState<Focus>("all")
  const [openScreen, setOpenScreen] = useState<{ title: string; variants: ScreenVariant[] } | null>(null)
  const [screenPreviewOpen, setScreenPreviewOpen] = useState(false)
  const [screenVariant, setScreenVariant] = useState(0)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [commentMode, setCommentMode] = useState(false)
  const { comments, addComment } = useGoldenEyeComments({ flow: "koru-login-golden-eye" })
  const [composer, setComposer] = useState<{ id: string; title: string } | null>(null)
  const [composerOpen, setComposerOpen] = useState(false)
  const [draft, setDraft] = useState("")
  const [sending, setSending] = useState(false)
  /* Positions dragged by the user (override the base layout). */
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>({})
  const rfRef = useRef<ReactFlowInstance | null>(null)

  const nodes = useMemo<Node[]>(() => {
    const dimmed = BASE_NODES.map((n) => {
      const scenarios = (n.data as ScreenData | DecisionData).scenarios
      const dim = focus !== "all" && !scenarios.includes(focus as Scenario)
      return {
        ...n,
        position: positions[n.id] ?? n.position,
        data: { ...n.data, _comments: comments[n.id]?.length },
        className: dim
          ? "opacity-15 saturate-0 transition-all duration-300"
          : "opacity-100 transition-all duration-300",
      }
    })
    return focus === "all" ? dimmed : [focusBand(focus as Scenario), ...dimmed]
  }, [focus, comments, positions])

  /* Persist drags: without this the controlled ReactFlow snaps the card back. */
  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setPositions((prev) => {
      let next = prev
      for (const ch of changes) {
        if (ch.type === "position" && ch.position && ch.id !== "band") {
          next = { ...next, [ch.id]: ch.position }
        }
      }
      return next
    })
  }, [])

  const edges = useMemo<Edge[]>(() => {
    if (focus === "all") return EDGES
    return EDGES.map((e) => {
      /* An edge may name its own scenarios when both of its cards are shared
         more widely than the step itself (Get early access is not a step of
         the Google or Apple journey, though both of its cards are). */
      const own = (e.data as { scenarios?: Scenario[] } | undefined)?.scenarios
      const on = own
        ? own.includes(focus as Scenario)
        : NODE_SCENARIOS[e.source]?.includes(focus as Scenario) &&
          NODE_SCENARIOS[e.target]?.includes(focus as Scenario)
      return on ? e : { ...e, label: undefined, style: { ...(e.style as object), opacity: 0.1 } }
    })
  }, [focus])

  /* Fullscreen: re-fit on enter/exit + Escape to leave. */
  useEffect(() => {
    const t = setTimeout(() => rfRef.current?.fitView({ padding: 0.08, duration: 200 }), 60)
    return () => clearTimeout(t)
  }, [isFullscreen])
  useEffect(() => {
    if (!isFullscreen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsFullscreen(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [isFullscreen])

  const sendComment = useCallback(async () => {
    if (!composer || !draft.trim()) return
    setSending(true)
    try {
      const saved = await addComment(composer, draft)
      if (saved) setDraft("")
    } catch (error) {
      console.error("[golden-eye-comments] save", error)
    } finally {
      setSending(false)
    }
  }, [addComment, composer, draft])

  /* Focus chips — reused above the canvas and inside fullscreen. */
  const focusTabs = (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="caption mr-1 text-(--fg-tertiary)">Focus:</span>
      {FOCI.map((f) => {
        const on = focus === f.id
        const color = f.id === "all" ? "var(--au-blue-600)" : SCENARIO[f.id as Scenario].color
        return (
          <button
            key={f.id}
            type="button"
            onClick={() => setFocus(f.id)}
            className={
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition " +
              (on
                ? "border-(--au-blue-300) bg-(--au-blue-100) text-(--au-blue-800)"
                : "border-(--border-default) bg-(--bg-raised) text-(--fg-secondary) hover:border-(--au-blue-300) hover:text-(--au-blue-700)")
            }
          >
            {f.id !== "all" && <span className="inline-block h-2 w-2 rounded-full" style={{ background: color }} />}
            {f.label}
          </button>
        )
      })}
    </div>
  )

  return (
    <>
      <PageHero
        title="Koru sign-in"
        trailing={
          <>
            <span className="inline-flex items-center rounded-full border border-(--au-amber-300) bg-(--au-amber-100) px-2 py-0.5 text-2xs font-medium text-(--au-amber-800)">
              compiled view
            </span>
            <FlowUpdatesBadge updates={updates} />
          </>
        }
      >
        Every way into Koru on one board: the browser sign-in form with email and
        password or Google and Apple, the installed app, password reset, the paths
        for people without an account, and the session gate that sends a protected
        link to sign-in. Mapped from the Koru frontend working tree on top of commit
        f7eacbf, where / renders the sign-in form. Koru refuses to be framed, so each
        card names its route and lists its states instead of opening a preview.
      </PageHero>

      {/* Full-width canvas (outside the text column) */}
      <div className="w-full px-10 pb-10">
        <Section
          id="flow"
          title="Compiled flowchart"
          lead="2+ dots on a card = screen shared between scenarios. The lens dims what is outside the focused scenario and draws its band. In Move mode: drag cards. In Comment mode: click a card to leave a note. Fullscreen button in the corner."
        >
          {/* Focus tabs */}
          <div className="mb-3">{focusTabs}</div>

          {/* Legend */}
          <div className="caption mb-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-(--fg-tertiary)">
            {ALL.map((s) => (
              <span key={s} className="inline-flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: SCENARIO[s].color }} />
                {SCENARIO[s].label}
              </span>
            ))}
            <span className="text-(--fg-tertiary)">·</span>
            <span>2+ dots = shared card · dashed pink = loop back or jump between scenarios</span>
          </div>

          <div
            className={
              isFullscreen
                ? "fixed inset-0 z-40 bg-(--bg-canvas) p-3"
                : "overflow-hidden rounded-xl border border-(--border-default) bg-(--bg-canvas)"
            }
            style={isFullscreen ? undefined : { height: 880 }}
          >
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              nodeTypes={nodeTypes}
              fitView
              fitViewOptions={{ padding: 0.08 }}
              minZoom={0.15}
              maxZoom={1.75}
              nodesConnectable={false}
              nodesDraggable={!commentMode}
              proOptions={{ hideAttribution: true }}
              onInit={(inst) => {
                rfRef.current = inst as ReactFlowInstance
              }}
              onNodeClick={(_, node) => {
                const d = node.data as ScreenData
                if (commentMode) {
                  setComposer({ id: node.id, title: d.title })
                  setComposerOpen(true)
                  return
                }
                if (node.type === "screen" && (d.variants?.length || d.href)) {
                  const variants = d.variants?.length ? d.variants : [{ label: d.title, href: d.href! }]
                  setScreenVariant(0)
                  setOpenScreen({ title: d.title, variants })
                  setScreenPreviewOpen(true)
                }
              }}
            >
              <Background color="var(--border-default)" gap={24} size={1.5} />
              <Controls showInteractive={false} />

              {/* Focus — fullscreen only (outside it the chips already sit above the canvas) */}
              {isFullscreen && (
                <Panel position="top-left">
                  <div className="rounded-xl border border-(--border-default) bg-(--bg-raised)/95 px-3 py-2 shadow-(--shadow-md) backdrop-blur">
                    {focusTabs}
                  </div>
                </Panel>
              )}

              {/* Fullscreen (top-right corner) */}
              <Panel position="top-right">
                <button
                  type="button"
                  onClick={() => setIsFullscreen((v) => !v)}
                  title={isFullscreen ? "Exit fullscreen (Esc)" : "Fullscreen"}
                  className="inline-flex items-center gap-1.5 rounded-md border border-(--border-default) bg-(--bg-raised) px-2.5 py-1.5 text-xs font-medium text-(--fg-secondary) shadow-(--shadow-sm) transition hover:border-(--au-blue-300) hover:text-(--au-blue-700)"
                >
                  <Icon name={isFullscreen ? "fullscreen_exit" : "fullscreen"} size={14} />
                  {isFullscreen ? "Exit fullscreen" : "Fullscreen"}
                </button>
              </Panel>

              {/* Move / Comment toolbar (bottom centre) */}
              <Panel position="bottom-center">
                <div className="mb-2 flex items-center gap-1 rounded-full border border-(--border-default) bg-(--bg-raised) p-1 shadow-(--shadow-md)">
                  <button
                    type="button"
                    onClick={() => setCommentMode(false)}
                    aria-pressed={!commentMode}
                    className={
                      "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition " +
                      (!commentMode ? "bg-(--au-blue-100) text-(--au-blue-800)" : "text-(--fg-secondary) hover:bg-(--bg-muted)")
                    }
                  >
                    Move
                  </button>
                  <button
                    type="button"
                    onClick={() => setCommentMode(true)}
                    aria-pressed={commentMode}
                    title="Comment — goes to the Review Bridge, where the agent reads it"
                    className={
                      "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition " +
                      (commentMode ? "bg-(--au-amber-100) text-(--au-amber-800)" : "text-(--fg-secondary) hover:bg-(--bg-muted)")
                    }
                  >
                    Comment
                  </button>
                  {commentMode && <span className="px-2 text-2xs text-(--fg-tertiary)">click a card to leave a note</span>}
                </div>
              </Panel>
            </ReactFlow>
          </div>
        </Section>
      </div>

      {/* Docs — regular text column */}
      <div className="mx-auto flex max-w-6xl flex-col gap-16 px-10 pb-14">
        {/* Compiled scenarios */}
        <Section id="scenarios" title="Compiled scenarios" lead="Each journey overlaid on this map: what it is, where it enters, where it converges.">
          <ul className="flex max-w-3xl flex-col gap-4">
            <li className="flex gap-3">
              <span className="mt-1.5 inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: SCENARIO.password.color }} />
              <div className="text-(--body-md-size) text-(--fg-secondary)">
                <strong className="text-(--fg-primary)">Email and password.</strong> Enters at{" "}
                <em>Sign in</em>, the same <code>LoginForm</code> at <code>/login</code> and at{" "}
                <code>/</code> in a browser. <code>loginAction</code> either sets the cookies and
                sends the person to <code>returnTo</code> (else <code>/feed</code>), keeps them on
                the form with an inline error, or shows the pre-beta alert.{" "}
                <strong>Converges on the feed.</strong>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="mt-1.5 inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: SCENARIO.oauth.color }} />
              <div className="text-(--body-md-size) text-(--fg-secondary)">
                <strong className="text-(--fg-primary)">Google or Apple.</strong> Enters from the
                buttons on <em>Sign in</em> or on the app’s sign-in panel. <code>/api/auth/oauth</code>{" "}
                decides: a returning account reaches the feed (through the welcome view inside the
                app), a first sign-in goes through <em>Choose your username.</em> and{" "}
                <em>Follow your interests.</em>, a new Google account without an invite lands on the
                waitlist, and errors or pre-beta denial stay on the form.
              </div>
            </li>
            <li className="flex gap-3">
              <span className="mt-1.5 inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: SCENARIO.pwa.color }} />
              <div className="text-(--body-md-size) text-(--fg-secondary)">
                <strong className="text-(--fg-primary)">Installed app.</strong> The PWA opens on{" "}
                <em>Opening Koru...</em> while a session probe runs, or straight on <em>Hello</em>{" "}
                from <code>/signed-out</code>. Signed-in or offline-with-a-saved-feed visitors go to
                the feed; the rest sign in on the panel and pass through the welcome view. Pre-beta
                denial at the probe ends on <em>Pre-beta access unavailable</em>.
              </div>
            </li>
            <li className="flex gap-3">
              <span className="mt-1.5 inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: SCENARIO.reset.color }} />
              <div className="text-(--body-md-size) text-(--fg-secondary)">
                <strong className="text-(--fg-primary)">Forgot password.</strong> From{" "}
                <em>Forgot your password?</em> on the form to <code>/forgot-password</code>, which
                always reports success, then the email link to <code>/reset-password</code>. A link
                without uid or token, or one that expires on submit, loops back to request a new
                one. The only scenario that does not reach the feed:{" "}
                <strong>it loops back to Sign in.</strong>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="mt-1.5 inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: SCENARIO.access.color }} />
              <div className="text-(--body-md-size) text-(--fg-secondary)">
                <strong className="text-(--fg-primary)">No account yet.</strong>{" "}
                <em>Get early access</em> on the form leads to <code>/waitlist</code>; an invite
                code (from the waitlist page, the invite email or the app’s Get started panel)
                opens <code>/invite</code>, then <em>Create your account.</em> and topics.{" "}
                <strong>Converges on the feed.</strong>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="mt-1.5 inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: SCENARIO.gate.color }} />
              <div className="text-(--body-md-size) text-(--fg-secondary)">
                <strong className="text-(--fg-primary)">Session gate.</strong> A protected page
                opened without a live session. <code>src/proxy.ts</code> lets a valid or silently
                refreshed session through, sends a missing or rejected one to{" "}
                <code>/login?returnTo=</code> with the cookies cleared, and a pre-beta denial to{" "}
                <code>/access-expired</code>. If Django is slow it keeps the cookies and lets the
                page open, and the client gate checks again. A signed-in visitor who opens{" "}
                <code>/login</code> is sent to <code>/feed</code>.
              </div>
            </li>
          </ul>
        </Section>

        {/* Shared screens and convergence */}
        <Section id="shared" title="Shared screens and convergence" lead="Why these screens became a single card — and where the scenarios meet again.">
          <ol className="flex max-w-3xl list-decimal flex-col gap-3 pl-5 text-(--body-md-size) text-(--fg-secondary)">
            <li>
              <strong className="text-(--fg-primary)">Sign in carries 5 dots.</strong> Browser
              visitors at <code>/</code> and <code>/login</code> get the same form; the gate,
              the reset loop and the no-account link all pass through it. Only the installed app
              has its own sign-in panel.
            </li>
            <li>
              <strong className="text-(--fg-primary)">The feed is the convergence.</strong> Five
              scenarios end there. The form and the gate arrive from the left, Google or Apple and
              the app arrive from the right, and new accounts arrive from topics.
            </li>
            <li>
              <strong className="text-(--fg-primary)">Two form outcomes are shared.</strong>{" "}
              <em>Inline error on the form</em> and <em>Pre-beta access expired alert</em> are
              states of the same sign-in screen, reached from both the password and the
              Google or Apple decisions.
            </li>
            <li>
              <strong className="text-(--fg-primary)">Onboarding is shared by both kinds of new account.</strong>{" "}
              <em>Follow your interests.</em> follows a first Google or Apple sign-in and an
              invite registration alike. <em>Get early access</em> is shared too: people reach it
              by choice, or after a Google sign-in without an invite.
            </li>
            <li>
              <strong className="text-(--fg-primary)">One dead end, two ways in.</strong>{" "}
              <em>Pre-beta access unavailable</em> is reached from the proxy’s refresh and from the
              app’s probe; the browser form shows its own alert instead.
            </li>
            <li>
              <strong className="text-(--fg-primary)">Five gates.</strong> The proxy session
              check, <code>loginAction</code>, <code>/api/auth/oauth</code>, the reset link and the
              app’s session probe. The invite code check is folded into the invite card’s states.
            </li>
          </ol>
        </Section>

        {/* Gaps the map exposes */}
        <Section id="gaps" title="Asymmetries the map exposes" lead="Places where the same situation ends differently depending on the way in. Found while mapping; not changed in Koru.">
          <ol className="flex max-w-3xl list-decimal flex-col gap-3 pl-5 text-(--body-md-size) text-(--fg-secondary)">
            <li>
              <strong className="text-(--fg-primary)">Apple has no waitlist branch.</strong> A new
              Google account without an invite goes to <code>/waitlist?joined=oauth_google</code>.
              The Apple handler in <code>components/oauth-buttons.tsx</code> never checks{" "}
              <code>onWaitlist</code>, so a new Apple account sees an error on the form. The
              waitlist page accepts <code>oauth_apple</code>, but nothing sends it.
            </li>
            <li>
              <strong className="text-(--fg-primary)">The app shows pre-beta denial as plain text.</strong>{" "}
              <code>/api/auth/login</code> returns only the error message and drops the{" "}
              <code>code</code>. The app’s sign-in panel cannot tell a pre-beta denial from a wrong
              password, while the browser form shows the alert with the contact email.
            </li>
            <li>
              <strong className="text-(--fg-primary)">The Google or Apple alert matches one code of two.</strong>{" "}
              The form shows the alert for <code>pre_beta_access_expired</code> and{" "}
              <code>pre_beta_access_required</code>; the OAuth buttons only for the first. A
              required-access denial through Google or Apple shows as a plain error.
            </li>
          </ol>
        </Section>

        {/* Changelog */}
        <FlowUpdatesHistorySection updates={updates} />
      </div>

      <GoldenEyeScreenPreview
        open={screenPreviewOpen}
        screen={openScreen}
        activeVariant={screenVariant}
        onActiveVariantChange={setScreenVariant}
        onClose={() => setScreenPreviewOpen(false)}
      />

      <GoldenEyeCommentComposer
        open={composerOpen}
        target={composer}
        comments={composer ? comments[composer.id] ?? [] : []}
        draft={draft}
        onDraftChange={setDraft}
        sending={sending}
        onSend={sendComment}
        onClose={() => setComposerOpen(false)}
        placeholder="What is missing here? e.g. 'the rate-limit state after too many attempts is not mapped'…"
      />
    </>
  )
}
