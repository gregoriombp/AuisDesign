import fs from "node:fs";
import http from "node:http";
const config = JSON.parse(fs.readFileSync("fixture.json", "utf8"));
fs.writeFileSync("server.pid", String(process.pid));
const server = http.createServer((req, res) => {
  if (config.hangHttp) return;
  res.end("fixture");
});
const lock = ".next/dev/lock";
server.listen(0, "127.0.0.1", () => {
  const port = server.address().port;
  fs.mkdirSync(".next/dev", { recursive: true });
  if (!config.noLock)
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
  console.log("fixture: listening");
});
process.on("SIGTERM", () => {
  if (config.ignoreTerm) return;
  if (!config.noLock) fs.rmSync(lock, { force: true });
  server.closeAllConnections();
  server.close(() => process.exit(0));
});
