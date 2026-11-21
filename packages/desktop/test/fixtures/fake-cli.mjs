// A stand-in for `npx @auis/cli` in the unit tests: `node fake-cli.mjs <target> <mode>`.
// It prints what the real CLI prints when it is not on a terminal, and then:
//
//   ok       writes a project with a dev script, exits 0
//   offline  fails the way a template download fails without a network, exits 1
//   partial  leaves a file in the folder, then exits 1, so the folder is no longer empty
//   nodev    writes a package.json with no dev script, exits 0
//   hang     records its pid in <target>.pid and waits to be stopped
import fs from "node:fs";
import path from "node:path";

const [target, mode = "ok"] = process.argv.slice(2);

console.log("\n  auis  0.5.1\n  code-native design builder\n");
console.log("  … Fetching the Auis template (main)…");

if (mode === "offline") {
  console.error('\n  ✗ could not download the template for ref "main".');
  console.error("    https://codeload.github.com/gregoriombp/AuisDesign/tar.gz/refs/heads/main: fetch failed\n");
  process.exit(1);
}
if (mode === "hang") {
  fs.writeFileSync(`${target}.pid`, String(process.pid));
  setInterval(() => {}, 1000);
} else {
  fs.mkdirSync(target, { recursive: true });
  if (mode === "partial") {
    fs.writeFileSync(path.join(target, "package.json"), "{");
    console.error("\n  ✗ could not write the project: ENOSPC\n");
    process.exit(1);
  }
  const scripts = mode === "nodev" ? {} : { dev: "node server.mjs" };
  fs.writeFileSync(path.join(target, "package.json"), JSON.stringify({ name: path.basename(target), scripts }));
  console.log("  ✓ Template  main · tarball");
  console.log(`  ✓ Project   ${path.basename(target)} → ${target}`);
  console.log("\n  Ready.\n");
}
