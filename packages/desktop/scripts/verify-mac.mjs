// Verify the built bundle, or the installed copy supplied as argv[2].
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import config from "../electron-builder.config.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const manifest = JSON.parse(
  fs.readFileSync(path.join(root, "package.json"), "utf8"),
);
const bundle = path.resolve(
  process.argv[2] ?? path.join(root, "release/mac-arm64/Auis Design.app"),
);
const plist = path.join(bundle, "Contents/Info.plist");
const value = (key) =>
  execFileSync("/usr/libexec/PlistBuddy", ["-c", `Print :${key}`, plist], {
    encoding: "utf8",
  }).trim();
assert.equal(value("CFBundleIdentifier"), config.appId);
assert.equal(value("CFBundleName"), config.productName);
assert.equal(value("CFBundleShortVersionString"), manifest.version);
assert.ok(value("NSMicrophoneUsageDescription"));
assert.ok(
  fs.existsSync(
    path.join(bundle, "Contents/Resources", value("CFBundleIconFile")),
  ),
);
const binary = path.join(bundle, "Contents/MacOS", value("CFBundleExecutable"));
assert.equal(
  execFileSync("/usr/bin/lipo", ["-archs", binary], {
    encoding: "utf8",
  }).trim(),
  "arm64",
);
execFileSync(
  "/usr/bin/codesign",
  ["--verify", "--deep", "--strict", "--verbose=2", bundle],
  { stdio: "inherit" },
);
// codesign writes its description to stderr, not stdout.
const { spawnSync } = await import("node:child_process");
const signature = spawnSync("/usr/bin/codesign", ["-dv", bundle], {
  encoding: "utf8",
});
assert.equal(signature.status, 0, signature.stderr);
assert.match(signature.stderr, /Signature=adhoc/);
console.log(
  `Verified ${bundle}: ${config.appId}, ${manifest.version}, arm64, ad-hoc signature.`,
);
