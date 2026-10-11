// The chrome's stylesheet goes into apps Auis did not author, so what it may
// contain is a rule, checked here: it is built from the current source, every
// rule stays under the chrome's root, and nothing global is left for a host's
// own CSS to collide with. See kit/ui/scripts/build-css.mjs.
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import postcss from "postcss"
import { OUTPUT, SCOPE, buildChromeCss } from "../../scripts/build-css.mjs"

const parsed = () => postcss.parse(readFileSync(OUTPUT, "utf8"))

test("chrome.css is built from the current source", async () => {
  assert.equal(
    readFileSync(OUTPUT, "utf8"),
    await buildChromeCss(),
    "chrome.css is stale — run `npm run ui:css`",
  )
})

test("every rule of the chrome stays under its root", () => {
  const leaks: string[] = []
  parsed().walkRules((rule) => {
    const parent = rule.parent
    if (parent?.type === "atrule" && /keyframes$/.test((parent as postcss.AtRule).name)) return
    for (const selector of rule.selectors) {
      if (!selector.includes(SCOPE)) leaks.push(selector)
    }
  })
  assert.deepEqual(leaks, [])
})

test("nothing global is left for a host to collide with", () => {
  const problems: string[] = []
  const root = parsed()
  root.walkAtRules((at) => {
    if (at.name === "layer") problems.push(`@layer ${at.params}`)
    if (/keyframes$/.test(at.name) && !at.params.startsWith("auis-")) {
      problems.push(`@keyframes ${at.params}`)
    }
    if (at.name === "property" && !at.params.startsWith("--auis-")) {
      problems.push(`@property ${at.params}`)
    }
  })
  root.walkDecls((decl) => {
    if (/--tw-/.test(`${decl.prop}:${decl.value}`)) problems.push(`${decl.prop}: ${decl.value}`)
    if (/\drem\b/.test(decl.value)) problems.push(`rem in ${decl.prop}: ${decl.value}`)
  })
  assert.deepEqual(problems, [])
})
