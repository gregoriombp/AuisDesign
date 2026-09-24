# Giving every screen state an address

Read this document only when making a screen's live state visible in its URL —
the step of a wizard, the open tab of a table, the selected entity of a detail
view. It is the prerequisite for `auis-update-states`: that skill registers
params in `lib/auis-states/registry.ts`, and this one is about making the real
flow actually *write* them.

## Why it matters

A screen that keeps its step in React state has one address for every state it
can be in. Two tools break on that, silently:

- **Review Bridge.** `saveComment` stamps the pin with `window.location`. Every
  pin left anywhere in the flow records the same bare path, so opening one lands
  the reviewer on the default step — a different entity, a different tab — with
  a comment that describes something they cannot see.
- **State Mode and UX flows.** A scenario with no address cannot be opened in
  the `/auis/states` matrix, linked from a flow node, or handed to anyone.

The symptom is always the same sentence: *the pins are not showing the real
state*.

## How to spot it

A screen needs this work when it holds view state that survives a reload in the
user's head but not in the URL:

```bash
grep -rnE "const \[(tab|step|phase|view|mode|filter|section), set" \
  --include="*.tsx" app components
```

Judge each hit. It qualifies when the state **names a screen someone could want
to link to or comment on**. It does not qualify when the state is transient —
an animation phase, an onboarding tour, the internal steps of a modal. Pins
dropped inside an overlay are already handled by the reveal trail
(`comment.revealPath`), not by the URL, and the State Mode rule is explicit that
transient state does not become an axis.

## The pattern

Mirror the live state into the URL and let
[`useMirroredScenario`](../lib/auis-states/useMirroredScenario.ts) decide when
the screen remounts.

```tsx
// app/<route>/page.tsx — `connection()` keeps the step out of the static HTML
import { connection } from "next/server"

export default async function Page() {
  await connection()
  return <Suspense fallback={null}><Screen /></Suspense>
}

// _components/Screen.tsx — client
const AXES = ["state", "tab"] as const // a module constant

export function Screen() {
  const { key, seed, mirror } = useMirroredScenario(AXES)
  return <Wizard key={key} state={parseState(seed.get("state") ?? undefined)} mirror={mirror} />
}

// inside the Wizard
React.useEffect(() => {
  mirror((params) => {
    if (step === DEFAULT) params.delete("state")
    else params.set("state", step)
  })
}, [mirror, step])
```

### Why the key is decided on the client

The param has **two authors**, and they need opposite outcomes:

| Author | Writes with | Must remount? |
|---|---|---|
| State Mode toolbar, its exit, a Review permalink | `router.replace` | **Yes** — a chosen scenario has to be seeded from scratch |
| The live flow | `mirror` (`history.replaceState`) | **No** — remounting throws away the work the person just built |

The hook separates them by authorship: `mirror` notes every signature it writes,
so when the router shows a signature nobody here wrote, the change came from
outside and `key` advances with `seed` holding the params to seed. `?ge=` and the
Review params stay out of the signature — an interaction never remounts.

### Choosing the params

One param per axis someone would name out loud: the step (`?state=`), the entity
under review (`?item=`), the table open inside it (`?tab=`). Leave triage state
— an All/Pending/Done filter someone flips ten times a minute — out of the URL:
it would make every flip a different screen and stop the same pin from matching
across them.

Delete a param instead of writing its default value, so the clean URL is the
real default, and delete child params when their parent goes away (`?tab=`
means nothing outside the step that has tabs).

When the value is not a closed union, derive it. A step that maps many-to-one
onto scenarios needs an explicit inverse.

## Four traps, all already sprung once

**1. Old pins go orphan.** Comments saved before the screen had the param
recorded the bare path. Once the live URL always carries the param, strict
comparison exiles every one of them. `LEGACY_AXES` in
[`lib/auis-review/urlMatch.ts`](../lib/auis-review/urlMatch.ts) is a literal
table for this: a stored comment that says *nothing* about the axis matches any
value of it, while a new pin stays strict. The looseness is one-directional — it
belongs to the stored side, never to the current screen. **Add an entry whenever
a screen with live comments starts writing a param**, and cover it in
`lib/auis-review/__tests__/urlMatch.test.ts`.

**2. `useSearchParams` does not see `replaceState(window.history.state, …)`.**
Passing Next's own history state as `data` makes the write invisible to the App
Router, so anything reading the router snapshot reports the address of the last
real navigation. `mirror` writes with `null` and the router follows. Either way,
the toolbar and `useCurrentUrl` read
[`useLiveLocation`](../lib/auis-review/liveLocation.ts), which sees every write.
Without it the canvas hides the pin that was just dropped, because the pin knows
the live URL and the canvas does not.

**3. A server-derived `key` only sees the last navigation.** `key={state}` on a
server page remounts on a toolbar pick only when the picked value differs from
the one the server last rendered. Two cases slip through: a secondary axis
outside the key, and — after the live flow has moved on — picking the scenario
the screen opened with, or exiting the mode. The URL changes and the screen
stays put. That is what `useMirroredScenario` fixes.

**4. A page rendered behind the screen reads the same URL.** A flow that opens
as a window over a list, with the list still rendered under the scrim, shares
the URL with it. If the list treats one of the flow's params as its own deep
link, it switches section and consumes the param with `router.replace` —
erasing the flow's address. A route embedded as scenery must only honor its URL
when it is the addressed page (a `usePathname()` check).

## Checklist

1. Map the axes; decide what stays local.
2. Move the client body to `_components/` behind a host that calls
   `useMirroredScenario` and hands `key`, `seed` and `mirror` down.
3. Mirror each axis through `mirror`; delete defaults and orphaned children.
4. Add a `LEGACY_AXES` entry if the screen already has comments, with a test.
5. Register the axes with the `auis-update-states` skill.
6. Verify in the browser, all of them:
   - the URL follows as you walk the flow, and the screen does **not** reset;
   - loading that URL cold restores the same screen;
   - the State Mode toolbar remounts on every axis, reports the live step, and
     — after walking the flow — still brings back the scenario the screen
     opened with; exiting the mode returns to the default;
   - the drawer still counts the screen's old pins.
7. `npm run typecheck` · `npm test` · `npm run ds:check`.
