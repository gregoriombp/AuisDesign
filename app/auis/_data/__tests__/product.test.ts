import assert from "node:assert/strict"
import test from "node:test"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"

import { findFirstProductPage, listProductPages } from "../product"

const HUB_REDIRECT = `import { redirect } from "next/navigation"

export default function Home() {
  redirect("/auis")
}
`
const A_PAGE = "export default function Page() {\n  return null\n}\n"

/** A throwaway project whose `app/` holds exactly these files. */
function project(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "auis-product-"))
  for (const [rel, body] of Object.entries(files)) {
    const full = join(root, "app", rel)
    mkdirSync(dirname(full), { recursive: true })
    writeFileSync(full, body)
  }
  return root
}

test("as shipped, the product has no page: the root only forwards to the hub", () => {
  const root = project({
    "page.tsx": HUB_REDIRECT,
    "auis/page.tsx": A_PAGE,
    "auis/styleguide/page.tsx": A_PAGE,
    "api/setup/route.ts": "export const GET = () => new Response()\n",
  })
  try {
    assert.deepEqual(listProductPages(root), [])
    assert.equal(findFirstProductPage(root), null)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test("the shallowest route wins, then alphabetical", () => {
  const root = project({
    "page.tsx": HUB_REDIRECT,
    "settings/profile/page.tsx": A_PAGE,
    "dashboard/page.tsx": A_PAGE,
    "billing/page.tsx": A_PAGE,
  })
  try {
    assert.deepEqual(
      listProductPages(root).map((p) => p.href),
      ["/billing", "/dashboard", "/settings/profile"],
    )
    assert.deepEqual(findFirstProductPage(root), {
      href: "/billing",
      file: "app/billing/page.tsx",
    })
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test("a real root page is the product's first page", () => {
  const root = project({ "page.tsx": A_PAGE, "dashboard/page.tsx": A_PAGE })
  try {
    assert.deepEqual(findFirstProductPage(root), { href: "/", file: "app/page.tsx" })
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test("route groups add no segment; private, slot and dynamic folders are skipped", () => {
  const root = project({
    "page.tsx": HUB_REDIRECT,
    "(marketing)/pricing/page.tsx": A_PAGE,
    "_components/page.tsx": A_PAGE,
    "@modal/page.tsx": A_PAGE,
    "orders/[id]/page.tsx": A_PAGE,
  })
  try {
    assert.deepEqual(listProductPages(root).map((p) => p.href), ["/pricing"])
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test("auis and api are the builder's only at the top level", () => {
  const root = project({
    "page.tsx": HUB_REDIRECT,
    "auis/page.tsx": A_PAGE,
    "docs/api/page.tsx": A_PAGE,
  })
  try {
    assert.deepEqual(listProductPages(root).map((p) => p.href), ["/docs/api"])
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test("a project without an app directory has no pages", () => {
  const root = mkdtempSync(join(tmpdir(), "auis-product-"))
  try {
    assert.equal(findFirstProductPage(root), null)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
