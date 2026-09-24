/**
 * `auis doctor` — what Auis can and cannot do in THIS repository.
 *
 * It reads. It never writes, never installs, never asks. And it exits 0 even
 * when every capability comes back unsupported: a non-zero exit teaches people
 * to stop running the one command whose whole job is to tell them the truth
 * before they let us near their code. Exit 1 is reserved for "I could not read
 * the repository at all".
 *
 * Every verdict carries a `because`, and anything less than `supported` carries
 * a `remedy` — the honest alternative, or the thing the host would have to
 * provide. "May not work" is not a verdict.
 */

import fs from "node:fs";
import path from "node:path";
import { color, write } from "./ui.mjs";
import { detect, detectAgentFiles } from "./detect.mjs";

export const DOCTOR_VERSION = 1;

const supported = (id, because) => ({ id, verdict: "supported", because });
const degraded = (id, because, remedy) => ({ id, verdict: "degraded", because, remedy });
const unsupported = (id, because, remedy) => ({ id, verdict: "unsupported", because, remedy });

/**
 * Capability verdicts, derived from the detections.
 *
 * A capability is something a person would notice losing — not a module. The
 * three registries Edit Mode leans on (variant, typography, style tokens) are
 * keyed to Auis's own class names and its own palette, so in a host they are
 * unsupported until the host supplies a map. That is a verdict, not a bug.
 */
export function capabilities(d) {
  const out = [];
  const reactOk = d.react.major !== null && d.react.major >= 18;
  const serverBacked = d.devServer.fileWriting;

  // --- Review -------------------------------------------------------------
  if (reactOk) {
    out.push(supported("review.pins", "Pins anchor through plain DOM — no markup, no wrapper, no provider in your components."));
    out.push(supported("review.draw", "Freehand marks use the same DOM anchoring as pins."));
  } else {
    const why = d.react.major === null
      ? "No React dependency found; the builder chrome is a React tree today."
      : `React ${d.react.major} is below the 18 the chrome needs.`;
    out.push(unsupported("review.pins", why, "A framework-agnostic mount that carries its own React is planned; it does not exist yet."));
    out.push(unsupported("review.draw", why, "Same mount work as review.pins."));
  }

  if (d.webComponents.present) {
    out.push(degraded(
      "review.anchoring",
      `This app calls attachShadow (${d.webComponents.evidence[0]}); anchors cannot resolve inside a shadow root.`,
      "Pins on those regions fall back to absolute document coordinates and drift when the layout changes."
    ));
  } else {
    out.push(supported("review.anchoring", "No shadow roots in your source — a structural selector plus a text fingerprint can address every element."));
  }

  if (serverBacked) {
    out.push(supported("review.persistence", `${d.devServer.command} runs a server that can write files, so comments land in a shared queue.`));
    out.push(supported("review.mentions", "Agent mentions need the same server-backed queue, which you have."));
    out.push(supported("skills.bridges", "The bridge skills talk to that queue over HTTP while the dev server is up."));
  } else {
    const why = d.framework.name === "unknown"
      ? "No JavaScript framework detected, so there is no dev server for Auis to mount routes on."
      : `${d.framework.name}${d.router.name === "pages-router" ? " on the Pages Router" : ""} gives Auis no file-writing route to persist through.`;
    out.push(degraded("review.persistence", why, "Comments live in each reviewer's browser; Export/Import moves them. Run `npx @auis/server` for a shared queue."));
    out.push(degraded("review.mentions", why, "Mentions are recorded locally but no agent can read the queue until a server backs it."));
    out.push(unsupported("skills.bridges", why, "The bridge skills read a queue over HTTP; without one they have nothing to read."));
  }

  // --- Edit ---------------------------------------------------------------
  out.push(supported("edit.text", "Text edits are contenteditable on the live DOM — they work regardless of stack."));
  out.push(supported("edit.reorder", "Reordering moves DOM siblings; no knowledge of your components is needed."));

  const props = d.tokens.customProperties;
  if (props >= 12) {
    out.push(supported("edit.style", `${props} CSS custom properties declared in ${d.css.entry} — the style picker offers yours.`));
  } else if (props > 0) {
    out.push(degraded("edit.style", `Only ${props} custom properties in ${d.css.entry ?? "your stylesheet"}.`, "The picker offers raw values instead of tokens, so edits will not be token-safe."));
  } else {
    out.push(unsupported("edit.style", "No CSS custom properties found, so there is no token vocabulary to offer.", "Declare tokens on :root, or edit text and layout only."));
  }

  out.push(unsupported(
    "edit.variant",
    "Variant swapping recognises components by Auis's own class names (au-btn, au-card); yours are different.",
    "Supply a variant map in auis.config so Auis can name your components. Auis will not guess them."
  ));
  out.push(unsupported(
    "edit.typography",
    "Type swapping uses Auis's own utility names (body-sm, display-lg), which this app does not define.",
    "Same variant map as edit.variant."
  ));

  if (d.icons.system === "material-symbols") {
    out.push(supported("edit.icon", "This app already loads Material Symbols, the ligature set the icon picker writes."));
  } else {
    out.push(unsupported(
      "edit.icon",
      d.icons.system === "none"
        ? "No icon system detected; the picker writes Material Symbols ligature names into your DOM."
        : `This app uses ${d.icons.system}; the picker writes Material Symbols ligature names, which would render as text.`,
      "Edit other properties; icon swapping needs an icon adapter Auis does not have yet."
    ));
  }

  if (d.framework.name === "next" && d.router.name === "app-router") {
    out.push(supported("edit.materialize", "Routes map to app/<route>/page.tsx, so an agent can find the source behind an edit."));
  } else {
    out.push(unsupported(
      "edit.materialize",
      `Turning an edit into a code change infers the source file from the route, which only holds for the Next App Router (found: ${d.router.name}).`,
      "Edits are still recorded and exportable as JSON — a precise spec a person or an agent can apply by hand."
    ));
  }

  // --- Flows, states, rulebook -------------------------------------------
  out.push(supported("flow.driver", "Deep links replay clicks by visible text or selector, which needs nothing from your stack."));
  out.push(degraded(
    "states.mode",
    "State Mode needs a hand-written registry of your screens and a hook call inside each page.",
    "Expect to write those entries yourself; nothing about it is automatic."
  ));
  out.push(supported("skills.rulebook", "The skills and conventions are plain files with no runtime — they work in any repository."));

  return out;
}

/** Paths Auis may want, that the host may already own. */
export function collisions(root) {
  const out = [];
  for (const entry of detectAgentFiles(root)) {
    const tracked = entry.gitignored ? "gitignored" : "tracked";
    if (entry.path === "AGENTS.md" || entry.path === "CLAUDE.md") {
      out.push({
        path: entry.path, exists: true, gitignored: entry.gitignored, plan: "append-block",
        note: `exists, ${tracked} — auis appends a delimited block and never rewrites what is above it`,
      });
    } else if (entry.kind === "dir") {
      out.push({
        path: entry.path, exists: true, entries: entry.entries, names: entry.names, gitignored: entry.gitignored,
        plan: "merge-namespaced",
        note: `${entry.entries} ${entry.entries === 1 ? "entry" : "entries"}, ${tracked} — auis writes only names it owns and never deletes yours`,
      });
    } else {
      out.push({
        path: entry.path, exists: true, gitignored: entry.gitignored, plan: "leave",
        note: `exists, ${tracked} — auis leaves it alone`,
      });
    }
  }
  return out;
}

/** Exactly what `auis init` would touch. Same code path, so the two cannot drift. */
export function installPlan(d, root = ".") {
  const steps = [];
  if (d.framework.name === "next" && d.router.name === "app-router") {
    // The router detection already resolved which of the two roots is real;
    // reuse it rather than testing the CLI's own working directory.
    const base = d.rootLayout.path?.startsWith("src/") || fs.existsSync(path.join(root, "src/app"))
      ? "src/app"
      : "app";
    steps.push({ action: "create", path: `${base}/api/auis/[...auis]/route.ts`, detail: "6 lines — re-exports the bridge handlers" });
  }
  steps.push({ action: "create", path: ".auis/manifest.json", detail: "what auis wrote, so update and uninstall can reverse it" });
  steps.push({ action: "create", path: ".auis/data/", detail: "the comment and edit queues" });
  if (d.rootLayout.path && d.rootLayout.patchable) {
    steps.push({ action: "edit", path: d.rootLayout.path, detail: "+2 lines — one import, one <AuisBuilder /> before </body>" });
  } else if (d.rootLayout.path) {
    steps.push({ action: "print", path: d.rootLayout.path, detail: `${d.rootLayout.bodies} <body> tags — auis prints the two lines for you to place` });
  }
  steps.push({ action: "append", path: ".gitignore", detail: "2 lines, in a delimited block" });
  steps.push({ action: "edit", path: "package.json", detail: "+1 dependency" });
  return steps;
}

export function buildReport(root, cliVersion) {
  const d = detect(root);
  const caps = capabilities(d);
  const summary = { supported: 0, degraded: 0, unsupported: 0 };
  for (const c of caps) summary[c.verdict]++;
  return {
    auisDoctorVersion: DOCTOR_VERSION,
    generatedAt: new Date().toISOString(),
    cliVersion,
    repo: { root, name: d.name, vcs: d.repo.vcs },
    detections: d,
    collisions: collisions(root),
    capabilities: caps,
    plan: installPlan(d, root),
    summary,
  };
}

const MARK = {
  supported: () => color.green("✓"),
  degraded: () => color.yellow("!"),
  unsupported: () => color.red("✗"),
};

function field(label, value) {
  write(`  ${color.dim(label.padEnd(12))}${value}`);
}

export function report(doc) {
  const d = doc.detections;

  write();
  field("Repository", `${color.bold(doc.repo.name)} ${color.dim(doc.repo.root)}`);
  const stack = [
    d.framework.name === "unknown" ? null : `${d.framework.name} ${d.framework.version ?? ""}`.trim(),
    d.router.name === "unknown" || d.router.name === "other" ? null : d.router.name,
    d.react.major ? `react ${d.react.major}` : null,
    d.css.solution === "plain-css" ? "plain css" : `${d.css.solution}${d.css.major ? ` ${d.css.major}` : ""}`,
  ].filter(Boolean);
  field("Stack", stack.join(color.dim(" · ")));
  field("Tokens", d.tokens.customProperties > 0
    ? `${d.tokens.customProperties} custom properties ${color.dim(`in ${d.css.entry}`)}`
    : color.dim("none declared"));
  field("Icons", d.icons.system === "none" ? color.dim("none detected") : d.icons.system);
  field("Reset", `${d.reset.level}${d.reset.signals.length ? color.dim(` · ${d.reset.signals.join(", ")}`) : ""}`);
  field("Dev server", d.devServer.fileWriting
    ? `writes files ${color.dim(`· ${d.devServer.command}`)}`
    : color.dim(d.devServer.command ? `${d.devServer.command} — cannot persist for Auis` : "none found"));

  write();
  write(`  ${color.bold("Capabilities")}  ${color.dim(`${doc.summary.supported} supported · ${doc.summary.degraded} degraded · ${doc.summary.unsupported} unsupported`)}`);
  write();
  for (const c of doc.capabilities) {
    write(`    ${MARK[c.verdict]()} ${color.bold(c.id.padEnd(20))}${c.because}`);
    if (c.remedy) write(`      ${color.dim(" ".repeat(20) + c.remedy)}`);
  }

  if (doc.collisions.length > 0) {
    write();
    write(`  ${color.bold("Already yours")}  ${color.dim("auis will not overwrite any of these")}`);
    write();
    for (const c of doc.collisions) {
      write(`    ${color.cyan(c.path.padEnd(20))}${color.dim(c.note)}`);
    }
  }

  write();
  write(`  ${color.bold("What installing would touch")}  ${color.dim(`${doc.plan.length} places`)}`);
  write();
  for (const step of doc.plan) {
    write(`    ${color.dim(step.action.padEnd(8))}${step.path.padEnd(34)}${color.dim(step.detail)}`);
  }
  write();
  write(`  ${color.dim("There is no `auis init` yet — this is the footprint it will have.")}`);

  write();
  write(`  ${color.dim("Nothing was written — doctor only reads.")}`);
  write();
}

export async function doctor({ directory = ".", json = false, cliVersion } = {}) {
  const root = path.resolve(directory);
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
    process.stderr.write(`\n  ${color.red("✗")} ${root} is not a directory.\n\n`);
    return 1;
  }

  const doc = buildReport(root, cliVersion);
  if (json) {
    process.stdout.write(`${JSON.stringify(doc, null, 2)}\n`);
    return 0;
  }
  report(doc);
  return 0;
}
