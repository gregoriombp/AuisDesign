import assert from "node:assert/strict";
import test from "node:test";

import { bridgeErrorResponse } from "../errors";
import { UnsupportedImageTypeError, classifyImageValue, contentTypeFor } from "../imageTypes";

test("an accepted raster comes out with the table's type and extension", () => {
  const cases: [string, string, string][] = [
    ["image/png", "image/png", "png"],
    ["image/jpeg", "image/jpeg", "jpg"],
    ["image/jpg", "image/jpeg", "jpg"],
    ["IMAGE/PNG", "image/png", "png"],
    ["image/gif", "image/gif", "gif"],
    ["image/webp", "image/webp", "webp"],
    ["image/avif", "image/avif", "avif"],
  ];
  for (const [declared, mime, ext] of cases) {
    assert.deepEqual(classifyImageValue(`data:${declared};base64,AAAA`), {
      kind: "raster",
      mime,
      ext,
      base64: "AAAA",
    });
  }
});

test("SVG and any type outside the list are rejected", () => {
  for (const declared of [
    "image/svg+xml",
    "text/html",
    "application/octet-stream",
    "image/bmp",
    "image/x-icon",
    "",
  ]) {
    assert.equal(classifyImageValue(`data:${declared};base64,PHN2Zz4=`).kind, "rejected", declared);
  }
});

test("a data URI without base64 is rejected, even with a raster type", () => {
  assert.equal(classifyImageValue("data:image/svg+xml,<svg onload=alert(1)>").kind, "rejected");
  assert.equal(classifyImageValue("data:image/png,AAAA").kind, "rejected");
  assert.equal(classifyImageValue("data:image/png;charset=utf-8,AAAA").kind, "rejected");
  assert.equal(classifyImageValue("data:image/png").kind, "rejected");
});

test("a parameter before base64 does not change the decided type", () => {
  assert.deepEqual(classifyImageValue("data:image/png;name=a.png;base64,AAAA"), {
    kind: "raster",
    mime: "image/png",
    ext: "png",
    base64: "AAAA",
  });
});

test("an uppercase or space-led prefix is still a data URI", () => {
  assert.equal(classifyImageValue("DATA:image/svg+xml;base64,AAAA").kind, "rejected");
  assert.equal(classifyImageValue("  data:image/svg+xml;base64,AAAA").kind, "rejected");
});

test("an externalized ref and a URL pass through untouched", () => {
  for (const value of [`/api/review-bridge/images/${"a".repeat(64)}.png`, "https://example.com/a.svg", ""]) {
    assert.deepEqual(classifyImageValue(value), { kind: "passthrough" });
  }
});

test("the served type covers legacy files", () => {
  assert.equal(contentTypeFor(`${"a".repeat(64)}.png`), "image/png");
  assert.equal(contentTypeFor(`${"a".repeat(64)}.jpg`), "image/jpeg");
  assert.equal(contentTypeFor(`${"a".repeat(64)}.svg`), "image/svg+xml");
  assert.equal(contentTypeFor(`${"a".repeat(64)}.bin`), "application/octet-stream");
});

test("the route answers a rejected type with 415 and the accepted formats", async () => {
  const err = new UnsupportedImageTypeError("image/svg+xml");
  assert.equal(err.declared, "image/svg+xml");
  const res = bridgeErrorResponse(err);
  assert.ok(res);
  assert.equal(res.status, 415);
  const body = (await res.json()) as { error?: string };
  assert.match(body.error ?? "", /PNG, JPEG, GIF, WebP or AVIF/);
});
