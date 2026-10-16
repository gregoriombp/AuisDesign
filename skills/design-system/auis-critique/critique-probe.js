// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- the file is one function, passed whole to a browser evaluate tool
() => {
  // auis-critique browser probe. Pass this whole function to the browser's
  // evaluate tool (Playwright MCP `browser_evaluate`, or the preview's JS tool).
  //
  // It does two things:
  //   1. installs `window.__auisCritique` with `capture(target, fx?, fy?)`, which
  //      returns the pin fields of a ReviewComment (url, viewport metrics,
  //      anchor, context) for one element, and `ref(target)`, one reveal-path
  //      step for the trigger that opens an overlay;
  //   2. runs the deterministic accessibility scan and returns its findings,
  //      each already carrying its capture.
  //
  // The anchor helpers mirror kit/core/src/elementAnchor.ts and
  // kit/core/src/elementContext.ts on purpose: the bridge re-resolves a pin by
  // comparing the fingerprint text with strict equality, so `fpText` and
  // `cssPath` must stay byte-identical to the kit's. If you change one there,
  // change it here.
  //
  // Auis's own chrome (Review Mode, Edit Mode, the dot, State Mode) is never
  // scanned or captured.

  const CHROME =
    "[data-auis-ui],[data-auis-review],[data-auis-edit],[data-auis-states],[data-auis-dot],[data-auis-portal]"
  const inChrome = (el) => !!el.closest(CHROME)

  // ---- kit/core/src/elementAnchor.ts ------------------------------------
  const fpText = (el) => (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 60)
  const fingerprintOf = (el) => {
    const text = fpText(el)
    return { tag: el.tagName.toLowerCase(), text: text || undefined }
  }
  const cssPath = (start) => {
    const parts = []
    let node = start
    while (node && node.nodeType === 1 && node !== document.body && node !== document.documentElement) {
      const parent = node.parentElement
      if (!parent) break
      const tag = node.tagName.toLowerCase()
      const sameTag = Array.from(parent.children).filter((c) => c.tagName === node.tagName)
      parts.unshift(`${tag}:nth-of-type(${sameTag.indexOf(node) + 1})`)
      node = parent
    }
    return parts.length ? `body > ${parts.join(" > ")}` : null
  }

  // ---- kit/core/src/iconLigature.ts -------------------------------------
  const LEADING_LIGATURE = /^[a-z][a-z_]*(?=[A-ZÀ-Ý])/
  const TRAILING_LIGATURE =
    /(?<=[a-zà-ý])(?:expand_more|expand_less|arrow_drop_down|close|check|more_horiz|more_vert|chevron_right|chevron_left)$/
  const stripIconLigature = (raw) => {
    const flat = (raw ?? "").replace(/\s+/g, " ").trim()
    if (!flat) return ""
    const clean = flat.replace(LEADING_LIGATURE, "").replace(TRAILING_LIGATURE, "").trim()
    return clean || flat
  }

  // ---- kit/core/src/elementContext.ts -----------------------------------
  const snippet = (el, max) => (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, max)
  const attr = (el, name, max = 120) => {
    const v = el.getAttribute(name)?.trim()
    return v ? v.slice(0, max) : undefined
  }
  const elementAttributes = (el) => {
    const all = {
      id: attr(el, "id"),
      name: attr(el, "name"),
      type: attr(el, "type"),
      href: attr(el, "href", 200),
      ariaLabel: attr(el, "aria-label"),
      title: attr(el, "title"),
      placeholder: attr(el, "placeholder"),
      dataSlot: attr(el, "data-slot"),
      dataState: attr(el, "data-state"),
      dataValue: attr(el, "data-value"),
    }
    const entries = Object.entries(all).filter(([, v]) => Boolean(v))
    return entries.length ? Object.fromEntries(entries) : undefined
  }
  const uniquePush = (list, value) => {
    const n = value?.trim().replace(/\s+/g, " ")
    if (!n || list.includes(n)) return
    list.push(n)
  }
  const nearbyText = (el) => {
    const chunks = []
    let parent = el.parentElement
    for (let depth = 0; parent && depth < 2 && chunks.length < 5; depth += 1) {
      for (const child of Array.from(parent.children)) {
        if (child === el || child.contains(el)) continue
        uniquePush(chunks, snippet(child, 140))
        if (chunks.length >= 5) break
      }
      uniquePush(chunks, snippet(parent, 220))
      parent = parent.parentElement
    }
    return chunks.length ? chunks : undefined
  }
  const cleanName = (raw) => {
    const t = stripIconLigature(raw ?? "")
    return t ? t.slice(0, 60) : undefined
  }
  const containerName = (el) => {
    const aria = cleanName(el.getAttribute("aria-label"))
    if (aria) return aria
    const by = el.getAttribute("aria-labelledby")
    if (by) {
      const named = cleanName(
        by.split(/\s+/).map((id) => document.getElementById(id)?.textContent?.trim()).filter(Boolean).join(" "),
      )
      if (named) return named
    }
    return cleanName(el.getAttribute("title"))
  }
  const ownHeading = (el) => cleanName(el.querySelector("h1,h2,h3,h4,h5,h6,[role='heading']")?.textContent)
  const dialogName = (el) =>
    cleanName(el.querySelector(".au-modal__title")?.textContent) ?? containerName(el) ?? ownHeading(el)
  const describeLocation = (el) => {
    const trail = []
    const seen = new Set()
    const add = (kind, name) => {
      const label = name ? `${kind}: ${name}` : kind
      if (seen.has(label)) return
      seen.add(label)
      trail.push(label)
    }
    let node = el.parentElement
    let depth = 0
    while (node && depth < 24 && trail.length < 4) {
      const tag = node.tagName.toLowerCase()
      const role = node.getAttribute("role")
      if (tag === "dialog" || role === "dialog" || role === "alertdialog") add("Modal", dialogName(node))
      else if (role === "tabpanel") add("Tab", containerName(node))
      else if (tag === "nav" || role === "navigation") add("Navigation", containerName(node))
      else if (tag === "aside" || role === "complementary") add("Side panel", containerName(node))
      else if (tag === "header" || role === "banner") add("Header", containerName(node))
      else if (tag === "footer" || role === "contentinfo") add("Footer", containerName(node))
      else if (tag === "form" || role === "form") add("Form", containerName(node) ?? ownHeading(node))
      else if (tag === "section" || role === "region" || role === "group") {
        const name = containerName(node) ?? ownHeading(node)
        if (name) add("Section", name)
      }
      node = node.parentElement
      depth += 1
    }
    return trail.reverse()
  }

  // ---- capture ----------------------------------------------------------
  // `target` is a CSS selector, an Element, or { text, tag? } to find an
  // element by its visible text. fx/fy is where inside the box the pin sits.
  const findTarget = (target) => {
    if (target instanceof Element) return target
    if (typeof target === "string") return document.querySelector(target)
    if (target && typeof target.text === "string") {
      const want = target.text.trim().toLowerCase()
      const pool = Array.from(document.querySelectorAll(target.tag || "*")).filter((el) => !inChrome(el))
      const hits = pool.filter((el) => stripIconLigature(el.textContent || "").toLowerCase().includes(want))
      // The deepest match is the element itself, not one of its ancestors.
      return hits.find((el) => !hits.some((o) => o !== el && el.contains(o))) || null
    }
    return null
  }
  const capture = (target, fx = 0.5, fy = 0.5) => {
    const el = findTarget(target)
    if (!el) return { error: "element_not_found", target: String(target?.text ?? target) }
    if (inChrome(el)) return { error: "element_is_auis_chrome" }
    const r = el.getBoundingClientRect()
    if (r.width <= 0 || r.height <= 0) return { error: "element_not_visible" }
    const selector = cssPath(el)
    if (!selector) return { error: "no_selector" }
    const fingerprint = fingerprintOf(el)
    const location = describeLocation(el)
    const text = snippet(el, 80)
    const label = el.getAttribute("aria-label") || el.getAttribute("title") || el.getAttribute("placeholder") || undefined
    return {
      // The URL keeps its query: on a State Mode route (`?state=`, `?ge=`) the
      // pin only re-anchors on the variant it was dropped on.
      url: window.location.pathname + window.location.search,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      scrollY: window.scrollY,
      documentHeight: document.documentElement.scrollHeight,
      anchor: {
        kind: "pin",
        position: { x: r.left + window.scrollX + r.width * fx, y: r.top + window.scrollY + r.height * fy },
        el: { selector, fx, fy, fingerprint },
      },
      context: {
        capturedAt: Date.now(),
        pageUrl: window.location.pathname + window.location.search,
        ...(document.title ? { pageTitle: document.title } : {}),
        ...(location.length ? { location } : {}),
        target: {
          tag: el.tagName.toLowerCase(),
          ...(el.getAttribute("role") ? { role: el.getAttribute("role") } : {}),
          ...(label ? { label } : {}),
          ...(text ? { text } : {}),
          selector,
          fingerprint,
          ...(elementAttributes(el) ? { attributes: elementAttributes(el) } : {}),
          rect: { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) },
          pointer: { fx, fy },
        },
        ...(nearbyText(el) ? { nearbyText: nearbyText(el) } : {}),
      },
    }
  }

  // One step of a reveal path (kit/core/src/elementAnchor.ts captureElementRef):
  // the trigger that opens the overlay a finding lives in, so Review Mode can
  // replay it before drawing the pin.
  const ref = (target) => {
    const el = findTarget(target)
    if (!el) return { error: "element_not_found", target: String(target?.text ?? target) }
    const selector = cssPath(el)
    if (!selector) return { error: "no_selector" }
    const label = stripIconLigature(el.textContent || "").slice(0, 120)
    return { selector, fingerprint: fingerprintOf(el), ...(label ? { label } : {}) }
  }

  // ---- deterministic accessibility scan --------------------------------
  const isShown = (el) => {
    if (inChrome(el)) return false
    const r = el.getBoundingClientRect()
    if (r.width <= 0 || r.height <= 0) return false
    if (typeof el.checkVisibility === "function") {
      return el.checkVisibility({ opacityProperty: true, visibilityProperty: true })
    }
    const cs = getComputedStyle(el)
    return cs.display !== "none" && cs.visibility !== "hidden"
  }
  const describe = (el) => {
    const name = stripIconLigature(el.getAttribute("aria-label") || el.textContent || "").slice(0, 40)
    return `<${el.tagName.toLowerCase()}>${name ? ` "${name}"` : ""}`
  }

  // Accessible name, simplified: aria-labelledby, aria-label, <label>, title,
  // alt, then text content without aria-hidden descendants (Icon renders its
  // ligature with aria-hidden, so an icon-only button has no text name).
  const visibleText = (el) => {
    let out = ""
    for (const n of el.childNodes) {
      if (n.nodeType === 3) out += n.textContent
      else if (n.nodeType === 1) {
        if (n.getAttribute("aria-hidden") === "true") continue
        if (n.tagName === "IMG") out += n.getAttribute("alt") || ""
        else out += visibleText(n)
      }
    }
    return out
  }
  const nameOf = (el) => {
    const by = el.getAttribute("aria-labelledby")
    if (by) {
      const t = by.split(/\s+/).map((id) => document.getElementById(id)?.textContent || "").join(" ").trim()
      if (t) return t
    }
    const aria = el.getAttribute("aria-label")?.trim()
    if (aria) return aria
    if (el.id) {
      const lab = document.querySelector(`label[for="${CSS.escape(el.id)}"]`)
      if (lab && lab.textContent.trim()) return lab.textContent.trim()
    }
    const wrap = el.closest("label")
    if (wrap && wrap.textContent.trim()) return wrap.textContent.trim()
    const title = el.getAttribute("title")?.trim()
    if (title) return title
    if (el.tagName === "IMG") return el.getAttribute("alt")?.trim() || ""
    if (el.tagName === "INPUT" && ["submit", "button", "reset"].includes(el.type)) return el.value || ""
    if (["INPUT", "SELECT", "TEXTAREA"].includes(el.tagName)) return ""
    return visibleText(el).replace(/\s+/g, " ").trim()
  }

  // Any CSS color (oklch, color(srgb …), named, rgb) → [r, g, b, a] via canvas.
  const canvas = document.createElement("canvas")
  canvas.width = canvas.height = 1
  const ctx = canvas.getContext("2d", { willReadFrequently: true })
  const toRGBA = (color) => {
    ctx.clearRect(0, 0, 1, 1)
    ctx.fillStyle = "#000"
    ctx.fillStyle = color
    ctx.fillRect(0, 0, 1, 1)
    const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data
    return [r, g, b, a / 255]
  }
  const over = (top, bottom) => {
    const a = top[3]
    return [0, 1, 2].map((i) => top[i] * a + bottom[i] * (1 - a)).concat(1)
  }
  // Effective background: composite the ancestors' background colors from the
  // page root up to the element. A background image or gradient on the way
  // makes the result unreliable — reported as `uncertain`, never pinned blind.
  const backgroundOf = (el) => {
    const layers = []
    let uncertain = false
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
      const cs = getComputedStyle(n)
      if (cs.backgroundImage && cs.backgroundImage !== "none") uncertain = true
      const c = toRGBA(cs.backgroundColor)
      if (c[3] > 0) layers.push(c)
      if (c[3] >= 1) break
    }
    let bg = [255, 255, 255, 1]
    for (let i = layers.length - 1; i >= 0; i--) bg = over(layers[i], bg)
    return { bg, uncertain }
  }
  const lum = ([r, g, b]) => {
    const ch = (v) => {
      v /= 255
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
    }
    return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b)
  }
  const ratio = (a, b) => {
    const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x)
    return (hi + 0.05) / (lo + 0.05)
  }

  const findings = []
  const push = (rule, el, detail, extra = {}) => {
    const cap = capture(el)
    if (cap.error) return
    findings.push({ rule, element: describe(el), detail, ...extra, capture: cap })
  }

  // 1. Contrast of text (WCAG 1.4.3): 4.5:1, or 3:1 for large text.
  const seenText = new Set()
  for (const el of document.body.querySelectorAll("*")) {
    if (seenText.size > 600) break
    const ownText = Array.from(el.childNodes).some((n) => n.nodeType === 3 && n.textContent.trim())
    if (!ownText || !isShown(el)) continue
    if (el.closest("[aria-hidden='true']")) continue
    const cs = getComputedStyle(el)
    if (el.closest(":disabled, [aria-disabled='true']")) continue
    const fg = toRGBA(cs.color)
    const { bg, uncertain } = backgroundOf(el)
    const fgOnBg = over([fg[0], fg[1], fg[2], fg[3] * parseFloat(cs.opacity || "1")], bg)
    const size = parseFloat(cs.fontSize)
    const bold = parseInt(cs.fontWeight, 10) >= 700
    const large = size >= 24 || (bold && size >= 18.66)
    const need = large ? 3 : 4.5
    const got = ratio(fgOnBg, bg)
    const key = `${cs.color}|${bg.join(",")}|${large}`
    if (got < need && !seenText.has(key)) {
      seenText.add(key)
      push("contrast", el, `${got.toFixed(2)}:1, needs ${need}:1 (${size}px${bold ? " bold" : ""})`, {
        ratio: Number(got.toFixed(2)),
        uncertain,
      })
    }
  }

  // 2. Form controls and interactive elements without an accessible name (WCAG 4.1.2 / 1.3.1).
  const controls = document.body.querySelectorAll(
    "input:not([type=hidden]), select, textarea, button, a[href], [role=button], [role=link], [role=checkbox], [role=switch], [role=tab], [role=menuitem], [role=combobox], [role=textbox], img",
  )
  for (const el of controls) {
    if (!isShown(el)) continue
    if (el.tagName === "IMG") {
      if (!el.hasAttribute("alt") && el.getAttribute("role") !== "presentation") {
        push("img-alt", el, "image without an alt attribute")
      }
      continue
    }
    if (!nameOf(el)) {
      const isField = ["INPUT", "SELECT", "TEXTAREA"].includes(el.tagName) || ["textbox", "combobox"].includes(el.getAttribute("role"))
      push(isField ? "missing-label" : "missing-name", el, isField
        ? `form field without a label${el.getAttribute("placeholder") ? " (placeholder is not a label)" : ""}`
        : "interactive element with no accessible name (icon-only?)")
    }
  }

  // 3. Heading structure (WCAG 1.3.1): skipped levels, h1 count.
  const headings = Array.from(document.body.querySelectorAll("h1,h2,h3,h4,h5,h6")).filter(isShown)
  let prev = 0
  for (const h of headings) {
    const level = Number(h.tagName[1])
    if (prev && level > prev + 1) push("heading-skip", h, `h${prev} → h${level}`)
    prev = level
  }
  const h1s = headings.filter((h) => h.tagName === "H1")
  const headingSummary = { count: headings.length, h1: h1s.length, outline: headings.map((h) => `${h.tagName.toLowerCase()} ${stripIconLigature(h.textContent).slice(0, 50)}`) }

  // 4. Target size (WCAG 2.5.8, 24×24 CSS px minimum). Inline links inside a
  //    sentence are exempt, as WCAG allows.
  for (const el of document.body.querySelectorAll("button, a[href], input[type=checkbox], input[type=radio], [role=button], [role=checkbox], [role=switch], [role=tab], [role=menuitem]")) {
    if (!isShown(el)) continue
    const r = el.getBoundingClientRect()
    if (r.width >= 24 && r.height >= 24) continue
    if (el.tagName === "A" && getComputedStyle(el).display === "inline") {
      const p = el.parentElement
      if (p && snippet(p, 400).length > snippet(el, 400).length + 20) continue
    }
    push("target-size", el, `${Math.round(r.width)}×${Math.round(r.height)} px, needs 24×24`)
  }

  window.__auisCritique = { capture, ref, findings, headingSummary }
  return {
    url: window.location.pathname + window.location.search,
    viewport: `${window.innerWidth}×${window.innerHeight}`,
    headings: headingSummary,
    findings: findings.map(({ capture: c, ...rest }) => ({ ...rest, anchorSelector: c.anchor.el.selector, location: c.context.location })),
    note: "Full captures are in window.__auisCritique.findings[i].capture; call window.__auisCritique.capture(target) for any other element.",
  }
}
