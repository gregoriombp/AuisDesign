// Offline HTTP fixture for the Electron gate. It implements Next's dev-lock
// contract, not Next itself; real Next/Finder/HMR checks are W5's manual gate.
import fs from "node:fs";
import path from "node:path";
import http from "node:http";

const lock = path.join(process.cwd(), ".next/dev/lock");
const delay = Number(process.argv[2] ?? 250);
const stopDelay = Number(process.argv[3] ?? 0);
let requests = 0;
const names = {
  "/auis": "Fixture hub",
  "/auis/styleguide": "Fixture styleguide",
  "/": "Fixture home",
};
const server = http.createServer((req, res) => {
  const route = new URL(req.url, "http://localhost").pathname;
  requests++;
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(`<!doctype html><html lang="en"><head><title>Auis smoke fixture</title></head>
    <body><main><h1>${names[route] ?? "Fixture page"}</h1>
    <a href="/">Home</a> <a href="/auis">Hub</a>
    <a href="https://example.org/auis-smoke">External link</a>
    <a href="https://example.org/auis-smoke-window" target="_blank">External window</a>
    <label>Fixture input <input aria-label="Fixture input" value="Editable text"></label>
    <p data-testid="requests">${requests}</p></main></body></html>`);
});
const ready = setTimeout(() => {
  server.listen(0, "127.0.0.1", () => {
    const port = server.address().port;
    fs.mkdirSync(path.dirname(lock), { recursive: true });
    fs.writeFileSync(
      lock,
      JSON.stringify({
        pid: process.pid,
        port,
        hostname: "127.0.0.1",
        appUrl: `http://127.0.0.1:${port}`,
        startedAt: Date.now(),
      }),
    );
    console.log("SMOKE_READY");
  });
}, delay);
console.log("SMOKE_STARTING");
// Record both the manager and server: the gate verifies the complete owned tree.
fs.appendFileSync(
  "smoke-pids.jsonl",
  JSON.stringify({ pid: process.pid, parent: process.ppid }) + "\n",
);
process.on("SIGTERM", () => {
  setTimeout(() => {
    clearTimeout(ready);
    fs.rmSync(lock, { force: true });
    server.closeAllConnections();
    server.close(() => process.exit(0));
  }, stopDelay);
});
