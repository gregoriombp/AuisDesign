import * as React from "react"

/* Very small TSX/CSS highlighter. Not a full parser — enough to give
 * code examples in the styleguide an IDE-like read.
 *
 * Strategy: a single regex with named alternatives, executed in order,
 * produces a stream of tokens; remaining text falls through as punct. */

type TokenKind =
  | "comment"
  | "string"
  | "keyword"
  | "bool"
  | "number"
  | "tag"
  | "attr"
  | "type"
  | "fn"
  | "prop"
  | "punct"

const KEYWORDS = new Set([
  "import", "from", "export", "default", "as",
  "const", "let", "var", "function", "return",
  "if", "else", "for", "while", "do", "switch", "case", "break", "continue",
  "try", "catch", "finally", "throw", "new", "class", "extends", "super",
  "this", "typeof", "instanceof", "in", "of", "void", "delete",
  "async", "await", "yield",
  "interface", "type", "implements", "public", "private", "protected",
  "readonly", "static", "enum",
])

const BOOL_NULL = new Set(["true", "false", "null", "undefined"])

// Order matters: earlier alternatives win.
const TOKEN_RE =
  /(\/\*[\s\S]*?\*\/|\/\/[^\n]*)|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)|(\b\d+(?:\.\d+)?\b)|(\b[A-Z][A-Za-z0-9_]*\b)|(\b[a-z_$][A-Za-z0-9_$]*\b)(?=\s*\()|(\b[a-z_$][A-Za-z0-9_$]*\b)/g

// Highlight a fragment of code (no JSX detection — flat).
function tokenizeLine(line: string): React.ReactNode[] {
  const out: React.ReactNode[] = []
  let last = 0
  let m: RegExpExecArray | null
  TOKEN_RE.lastIndex = 0
  while ((m = TOKEN_RE.exec(line)) !== null) {
    const [full, comment, str, num, typeName, fnName, word] = m
    const start = m.index
    if (start > last) out.push(line.slice(last, start))
    if (comment) {
      out.push(wrap("comment", comment))
    } else if (str) {
      out.push(wrap("string", str))
    } else if (num) {
      out.push(wrap("number", num))
    } else if (typeName) {
      out.push(wrap("type", typeName))
    } else if (fnName) {
      out.push(wrap("fn", fnName))
    } else if (word) {
      if (KEYWORDS.has(word)) out.push(wrap("keyword", word))
      else if (BOOL_NULL.has(word)) out.push(wrap("bool", word))
      else out.push(word)
    }
    last = start + full.length
  }
  if (last < line.length) out.push(line.slice(last))
  return out
}

function wrap(kind: TokenKind, text: string) {
  return (
    <span key={`${kind}-${text}-${Math.random()}`} className={`tok-${kind}`}>
      {text}
    </span>
  )
}

/* JSX highlighter — a second pass that recognizes <Tag attr="..." ...> and
 * processes the surrounding regions with the plain tokenizer. Simple and
 * good enough for our styleguide snippets. */
const JSX_TAG_RE =
  /<\/?([A-Za-z][A-Za-z0-9]*)([^<>]*?)(\/?>)/g

function highlightJSX(source: string): React.ReactNode[] {
  const out: React.ReactNode[] = []
  let last = 0
  let m: RegExpExecArray | null
  JSX_TAG_RE.lastIndex = 0
  let i = 0
  while ((m = JSX_TAG_RE.exec(source)) !== null) {
    const [full, tag, attrs, end] = m
    const start = m.index
    if (start > last) {
      // Non-JSX region — run standard tokenizer line by line.
      const chunk = source.slice(last, start)
      chunk.split(/(\n)/).forEach((seg) => {
        if (seg === "\n") out.push("\n")
        else out.push(...tokenizeLine(seg))
      })
    }
    const isClosing = full.startsWith("</")
    out.push(
      <span key={`jsx-${i++}`} className="tok-punct">
        {isClosing ? "</" : "<"}
      </span>
    )
    // Tag name: uppercase = component (type color), lowercase = dom (tag color).
    const tagKind: TokenKind = /^[A-Z]/.test(tag) ? "type" : "tag"
    out.push(
      <span key={`jsx-tag-${i++}`} className={`tok-${tagKind}`}>
        {tag}
      </span>
    )
    if (attrs) out.push(...highlightAttrs(attrs, i))
    out.push(
      <span key={`jsx-end-${i++}`} className="tok-punct">
        {end}
      </span>
    )
    last = start + full.length
  }
  if (last < source.length) {
    const chunk = source.slice(last)
    chunk.split(/(\n)/).forEach((seg) => {
      if (seg === "\n") out.push("\n")
      else out.push(...tokenizeLine(seg))
    })
  }
  return out
}

const ATTR_RE =
  /\b([a-zA-Z_][a-zA-Z0-9_-]*)(=)?|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')|(\{(?:[^{}]|\{[^{}]*\})*\})|(\s+|[^\s])/g

function highlightAttrs(attrs: string, parentI: number): React.ReactNode[] {
  const out: React.ReactNode[] = []
  let m: RegExpExecArray | null
  ATTR_RE.lastIndex = 0
  let i = 0
  while ((m = ATTR_RE.exec(attrs)) !== null) {
    const [, name, eq, str, braced, rest] = m
    if (name) {
      out.push(
        <span key={`a-${parentI}-${i++}`} className="tok-attr">
          {name}
        </span>
      )
      if (eq) out.push("=")
    } else if (str) {
      out.push(
        <span key={`as-${parentI}-${i++}`} className="tok-string">
          {str}
        </span>
      )
    } else if (braced) {
      out.push(
        <span key={`ab-${parentI}-${i++}`} className="tok-punct">
          {"{"}
        </span>
      )
      // Highlight inside braces as regular JS expression.
      const inner = braced.slice(1, -1)
      inner.split(/(\n)/).forEach((seg) => {
        if (seg === "\n") out.push("\n")
        else out.push(...tokenizeLine(seg))
      })
      out.push(
        <span key={`ab-end-${parentI}-${i++}`} className="tok-punct">
          {"}"}
        </span>
      )
    } else if (rest) {
      out.push(rest)
    }
  }
  return out
}

export function CodeHighlight({
  children,
  lang = "tsx",
}: {
  children: string
  lang?: "tsx" | "ts" | "css" | "text"
}) {
  const source = children.replace(/\n+$/, "")
  const nodes =
    lang === "tsx" || lang === "ts"
      ? highlightJSX(source)
      : source
          .split(/(\n)/)
          .flatMap((seg) =>
            seg === "\n" ? [seg] : tokenizeLine(seg)
          )
  return (
    <pre className="au-code">
      <code>{nodes}</code>
    </pre>
  )
}
