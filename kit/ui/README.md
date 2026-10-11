# @auis/ui

The [Auis](https://github.com/gregoriombp/AuisDesign) review chrome: pins, the
comment popovers, the drawer, the toolbar. It brings its own CSS, scoped under
`[data-auis-ui]` (no cascade layers, `--auis-*` variables, prefixed keyframes),
so it renders the same in any React 18+ app and leaves the app's own styles
alone.

```tsx
import { ReviewChrome } from "@auis/ui"

<ReviewChrome />
```

It talks to a Review Bridge at `/api/review-bridge` on the same origin
([`@auis/server`](https://www.npmjs.com/package/@auis/server)). By default it
reads the location from `window` and navigates with a page load; wrap it in a
`ReviewRouterProvider` to use your router. In Next.js use
[`@auis/next`](https://www.npmjs.com/package/@auis/next), which does both.

MIT.
