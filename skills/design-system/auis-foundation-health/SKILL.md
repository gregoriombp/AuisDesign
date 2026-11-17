---
name: auis-foundation-health
description: >
  Read-only health check of the design-system foundation in app/globals.css.
  Reports incomplete color scales, channels out of sync, semantic aliases that
  collapse into a parallel ramp, loose hex values, contrast of the existing
  fg/bg pairs (WCAG and APCA, light and dark), typography drift and the font
  contract. Edits nothing and proposes no new values; approved fixes go to
  auis-foundation-update. Use for "/auis-foundation-health", "is my
  foundation healthy", "audit the tokens", "check contrast of my palette".
---

# Auis Foundation Health

A read-only diagnosis of the foundation that already exists. Sibling of
`auis-foundation-update` (which applies an approved delta) and of
`auis-design-system-foundation` (which bootstraps). This skill is **not** a
third skill allowed to edit tokens.

Use it to organize, audit or explain the health of the foundation: an
incomplete color scale, a semantic alias, the contrast of pairs already
defined, typography outside the local contract. Do not use it to sweep
components, showcases or pages: that is `auis-design-system-audit`.

## Hard rules

- Do not edit `app/globals.css`, the foundation pages or any token. Do not
  propose a hex to fill a missing step.
- Do not treat a shadcn or component compatibility alias as a defect. An alias
  may point at a semantic role (`foreground` → `fg-primary`); what it may not
  be is a second ramp running parallel to `fg-*`.
- Do not install a design-token generator, do not move the source of truth to
  DTCG JSON, and do not rewrite the palette in OKLCH. The source of truth stays
  the CSS.
- Classify each finding as `safe`, `needs review` or `breaking`, with the same
  meaning as in `auis-foundation-update`.
- Whoever applies a delta is `auis-foundation-update`, and only after explicit
  approval of the `needs review` and `breaking` items.

## Where to read

Only these parts of `app/globals.css`:

- `@theme`: the primitive scale (`--color-au-*` in the shipped foundation),
  semantic `--color-*`, authored `--text-*`
- `:root`: the primitive mirror (`--au-*`) and the light semantic layer
- `.dark`: the semantic reassignment
- the type recipes: `@utility display-*`, `body-*`, `au-eyebrow`, and any
  other recipe the foundation declares
- `--font-*` in `@theme` and `:root`, the comment at the top of the file, and
  the family rules in `@layer base` (`code`, `pre`, `kbd`, `samp`)

Outside the CSS, only how fonts are loaded in `app/layout.tsx` (`<link>` tags
or `next/font`).

Do not sweep product pages, `.next/`, `node_modules/` or the bridges.

## The yardstick

The foundation is a three-layer model: primitive scale, semantic role
(`fg-*`, `bg-*`, `border-*`, `accent-*`, `ring-*`) and component/shadcn alias.
Health measures holes and collapse; it does not ask for a new system.

- A 12-step scale in the format already used (the shipped one is 100–1200),
  in the spirit of [Radix Colors](https://www.radix-ui.com/colors). Alpha is
  not required.
- Theme colors enter by live reference (`var()`), as in
  [Tailwind v4 theme](https://tailwindcss.com/docs/theme) and
  [shadcn theming](https://ui.shadcn.com/docs/theming).
- Names by role, not appearance:
  [Naming Tokens](https://medium.com/eightshapes-llc/naming-tokens-in-design-systems-9e86c7444676).
- Normal text contrast: [WCAG 2.2 1.4.3](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)
  ≥ 4.5:1. A second reading in [APCA](https://git.apcacontrast.com/documentation/APCAeasyIntro.html)
  (0.0.98G): a pair misses the floor when `|Lc| < 60`. Never suggest the
  replacement color.
- Typography: a composed recipe carries no color; body text has leading
  ≥ 1.5. Two rules are house rules, not WCAG, and the report says so: a size
  under 12px is a broken floor (WCAG sets no minimum size), and an authored
  size in `px` does not follow the default font size a person chose in the
  browser. `px` does **not** fail [WCAG 1.4.4](https://www.w3.org/WAI/WCAG22/Understanding/resize-text.html):
  browser zoom meets the criterion. Never write "violates WCAG" for these two.

## Checks

### 1. Primitive scales

List the color families the foundation declares (the shipped neutral
foundation has ten: `gray`, `blue`, `emerald`, `red`, `purple`, `amber`,
`pink`, `lime`, `slate`, `teal`).

Required steps, in the shipped format: `100` to `1200` in hundreds. Optional,
so their absence is not a finding: `25`, `50`, `150`. Outside the scale
contract: `white`, `black`, and any chart or illustration palette.

For each family, compare `--color-au-{family}-{step}` in `@theme` with
`--au-{family}-{step}` in `:root`.

- A required step missing in both channels: `needs review`. Group by family.
  Do not invent the hex; the value is a scale decision.
- A step present in one channel and missing in the other, or a different hex
  between the channels: `needs review`.

### 2. Aliases and loose hex

An alias whose value is a `var()` to a semantic role passes. Findings:

- `--color-text-*` (or any similar ramp) whose value is only `var(--fg-*)`,
  with no role `fg-*` lacks: `needs review`. Removing the name, if it is in
  use, would be `breaking`: file it as `needs review` and note that removal
  needs a usage check first.
- `--color-*` in `@theme` with a literal hex, outside the primitive scale and
  a chart palette: `needs review`. The primitive scale's hex is the source of
  truth, not loose.

### 3. Contrast of the existing pairs

Resolve the chain down to the hex, in light (`:root`) and dark (`.dark`):

- `fg-primary` on `bg-canvas`
- `fg-secondary` on `bg-canvas`
- `fg-tertiary` on `bg-canvas` (eyebrows and metadata)
- `fg-muted` on `bg-canvas`
- `fg-on-inverse` on `bg-inverse`

Create no new pair. Compute WCAG and APCA with the snippet below, in a
read-only `node` run, without writing a script into the repository. File a
`needs review` only when a pair is under 4.5:1 or `|Lc| < 60`. In the report,
show all ten results (five pairs × two themes), including the ones that pass.

WCAG 1.4.3 exempts the text of a disabled component. If the token's comment
says the role is only for disabled or decorative use, record the exemption in
the finding; without that comment, treat it as readable text.

```js
function lin(c) {
  const x = c / 255;
  return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
}
function luminance(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}
function wcag(a, b) {
  const L1 = luminance(a), L2 = luminance(b);
  const [hi, lo] = L1 > L2 ? [L1, L2] : [L2, L1];
  return (hi + 0.05) / (lo + 0.05);
}
function y(hex) {
  const n = parseInt(hex.slice(1), 16);
  const ch = (c) => {
    const x = c / 255;
    return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126729 * ch((n >> 16) & 255) + 0.7151522 * ch((n >> 8) & 255) + 0.072175 * ch(n & 255);
}
function apca(text, bg) {
  const clamp = (Y) => (Y >= 0.022 ? Y : Y + (0.022 - Y) ** 1.414);
  const Yt = clamp(y(text)), Yb = clamp(y(bg));
  if (Math.abs(Yb - Yt) < 0.0005) return 0;
  if (Yb > Yt) {
    const sapc = (Yb ** 0.56 - Yt ** 0.57) * 1.14;
    return (sapc < 0.1 ? 0 : sapc - 0.027) * 100;
  }
  const sapc = (Yb ** 0.65 - Yt ** 0.62) * 1.14;
  return (sapc > -0.1 ? 0 : sapc + 0.027) * 100;
}
```

### 4. Typography

Group by cause. Do not open one finding per recipe.

- A recipe whose block declares `color:`: `needs review`. Color belongs to the
  `fg-*` channel.
- An authored size token under 12px, and the recipes that consume it:
  `needs review`, unless a comment beside the token records an approved
  exception (for example, chips and counters). Say which exception you
  accepted.
- A `body-*` recipe with a numeric `line-height` under 1.5: `needs review`.
  Display, heading and UI recipes are outside this rule.
- Authored text size tokens declared in `px`: one `needs review` finding.
  Changing the unit does not change the pixel at a 16px root; it changes the
  response to the font-size preference. It is good practice, not a WCAG
  violation. Do not rewrite the values.

### 5. Fonts

- Every family named in `--font-*` (`@theme` and `:root`) needs a load path in
  `app/layout.tsx`. A family declared and never loaded: `needs review` (it
  falls silently to the fallback stack). A different stack between the two
  channels: `needs review`.
- List what consumes `var(--font-mono)` among recipes and base rules. Code
  (`code`, `pre`, `samp`, code recipes) passes; anything else (keyboard
  shortcuts, IDs, numbers): `needs review`. Numbers that must align use
  `tabular-nums` on the text family.
- If the foundation restricts a display family to display recipes, list what
  consumes it; any other consumer is `needs review`.
- A comment in `globals.css` that describes font usage differently from the
  contract: `safe` (documentation only).
- Font use on product pages is not this skill's: point at
  `auis-design-system-audit`.

## Classification

- `safe`: documentation, or a mirror/alias that changes no value in use. Zero
  visual change. In this skill `safe` only applies when the fix moves no
  value. Do not apply even the `safe` ones.
- `needs review`: a missing required step, channels out of sync, a parallel
  `text-*` ramp, a loose hex, a contrast pair under the floor, color inside a
  recipe, a size under 12px, `body-*` leading under 1.5, a scale in `px`, a
  family never loaded, mono outside code.
- `breaking`: only when the single fix is to remove or rename a token in use.
  Do not classify a whole finding as `breaking` while an additive alternative
  exists; add the caveat.

## Workflow

1. Read the parts of `app/globals.css` listed above.
2. Run the five checks. Contrast comes from the read-only `node` run.
3. Deliver the report and stop. Edit no file.
4. If the user approves a delta, end here and point at
   `auis-foundation-update`. Do not apply it yourself.

## Output

A report, in this order:

- Checked: complete families, aliases that passed, contrast pairs that passed
  (with the ratio and the Lc).
- Findings, grouped by `needs review`, `breaking` and `safe`. Each finding
  names the token or recipe, what failed, and that no new value was proposed.
- Outside this skill: applying belongs to `auis-foundation-update`; recipe
  coverage in the styleguide belongs to `npm run ds:check` and
  `auis-design-system-audit`.
- Files edited: none.
