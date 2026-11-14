// Stands in for `next dev` in the server tests. What matters to the app is
// what Next 16 does around its lock, so that is what this reproduces: answer
// HTTP, then write `<cwd>/.next/dev/lock` with the server's own address, and
// remove it on a clean exit.
//
//   node dev-server.mjs <mode>
//
//   ok         a well-behaved server
//   site       the same, serving small HTML pages with links (for the app's smoke test)
//   fail       prints an error and exits 1 before it is ready
//   silent     stays alive and never takes the lock
//   stubborn   a server that ignores the request to stop
//   deaf       takes the lock for a port nothing listens on
//   duplicate  finds another server already holding the lock, as Next reports it
//   holder     the "other server" of `duplicate`: holds the lock, in its own process group

import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const mode = process.argv[2] ?? "ok";
const lock = path.join(process.cwd(), ".next", "dev", "lock");

// Not something Next does: it lets a test find this process when there is no lock to read.
if (mode !== "holder") fs.writeFileSync(path.join(process.cwd(), "fixture.pid"), String(process.pid));

function writeLock(port, startedAt = Date.now()) {
  fs.mkdirSync(path.dirname(lock), { recursive: true });
  fs.writeFileSync(
    lock,
    JSON.stringify({
      pid: process.pid,
      port,
      hostname: "127.0.0.1",
      appUrl: `http://127.0.0.1:${port}`,
      startedAt,
    }),
  );
}

/** A page per path: its own path as a heading, and one link of each kind the app has a rule for. */
function page(url) {
  const shown = url.replace(/[&<>"]/g, (char) => `&#${char.charCodeAt(0)};`);
  return `<!doctype html>
<meta charset="utf-8">
<title>fixture ${shown}</title>
<h1 id="path">${shown}</h1>
<p><a id="internal" href="/somewhere">a page of this project</a></p>
<p><a id="external" href="https://example.com/outside">another site</a></p>
<p><a id="new-tab" href="https://example.com/new-tab" target="_blank" rel="noopener">another site, in a new tab</a></p>
<p><a id="custom-scheme" href="auis-smoke-nothing://nowhere">not a web link, and a scheme no app handles</a></p>`;
}

function serve(onListening) {
  const server = http.createServer((request, response) => {
    if (mode !== "site") return response.end("fixture");
    response.setHeader("content-type", "text/html; charset=utf-8");
    response.end(page(request.url ?? "/"));
  });
  server.listen(0, "127.0.0.1", () => onListening(server.address().port));
}

const leaveCleanly = () => {
  fs.rmSync(lock, { force: true });
  process.exit(0);
};

if (mode === "fail") {
  console.error("Error: DATABASE_URL is not set");
  process.exit(1);
} else if (mode === "silent") {
  console.log("warming up, forever");
  setInterval(() => {}, 1000);
  process.on("SIGTERM", () => process.exit(0));
} else if (mode === "deaf") {
  // A port that was free a moment ago and that nothing listens on now.
  const probe = http.createServer();
  probe.listen(0, "127.0.0.1", () => {
    const { port } = probe.address();
    probe.close(() => writeLock(port));
  });
  setInterval(() => {}, 1000);
  process.on("SIGTERM", leaveCleanly);
} else if (mode === "duplicate") {
  // Next takes the lock after it listens, so a second instance gets this far
  // and then reports the first. The first is started here, so the lock shows
  // up only after the app has looked for one.
  const holder = spawn(process.execPath, [fileURLToPath(import.meta.url), "holder"], {
    cwd: process.cwd(),
    detached: true,
    stdio: "ignore",
  });
  holder.unref();
  const waiting = setInterval(() => {
    if (!fs.existsSync(lock)) return;
    clearInterval(waiting);
    console.error("\u001b[31m⨯\u001b[39m Another \u001b[36mnext dev\u001b[39m server is already running.");
    process.exit(1);
  }, 20);
} else if (mode === "holder") {
  // An old `startedAt`: this server was running before the app's own start.
  serve((port) => writeLock(port, 1));
  process.on("SIGTERM", leaveCleanly);
} else {
  serve((port) => {
    writeLock(port);
    console.log(`\u001b[32m✓\u001b[39m Ready on http://127.0.0.1:${port}`);
  });
  process.on("SIGTERM", mode === "stubborn" ? () => console.log("not yet") : leaveCleanly);
}
