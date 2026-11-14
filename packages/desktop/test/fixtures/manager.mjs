// Real process fixture, not a mock of child_process. Its children share its group.
import fs from "node:fs";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
const config = JSON.parse(fs.readFileSync("fixture.json", "utf8"));
fs.writeFileSync("manager.pid", String(process.pid));
if (process.argv[2] === "install") {
  console.log("fixture: installing");
  if (config.installHang) setInterval(() => {}, 1000);
  else if (config.installFail) process.exit(9);
  else {
    fs.mkdirSync("node_modules/next", { recursive: true });
    fs.writeFileSync(
      "node_modules/next/package.json",
      JSON.stringify({ name: "next", version: "16.4.0" }),
    );
  }
} else {
  fs.appendFileSync("starts", "start\n");
  console.log("\u001b[32mfixture: starting\u001b[0m");
  if (config.crash) process.exit(7);
  const child = spawn(
    process.execPath,
    [fileURLToPath(new URL("./server.mjs", import.meta.url))],
    { stdio: "inherit" },
  );
  // npm is a parent process too. Do not let it orphan a child on a normal exit.
  process.on("SIGTERM", () => child.kill("SIGTERM"));
  child.on("exit", (code) => process.exit(code ?? 0));
  if (config.parentExit) setTimeout(() => process.exit(7), 100);
}
