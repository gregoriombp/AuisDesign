import assert from "node:assert/strict";
import test from "node:test";

import { isValidRevealPath, REVEAL_PATH_MAX_STEPS } from "../reveal";

const step = { selector: "main > button:nth-of-type(2)", label: "More actions" };

test("accepts the shape the replay produces", () => {
  assert.equal(isValidRevealPath([]), true);
  assert.equal(isValidRevealPath([step, { selector: "#menu", fingerprint: { tag: "button" } }]), true);
});

test("rejects more steps than the replay runs", () => {
  const many = Array.from({ length: REVEAL_PATH_MAX_STEPS + 1 }, () => step);
  assert.equal(isValidRevealPath(many), false);
});

test("rejects a malformed or oversized step", () => {
  assert.equal(isValidRevealPath("t:Delete"), false);
  assert.equal(isValidRevealPath([{ label: "no selector" }]), false);
  assert.equal(isValidRevealPath([{ selector: "" }]), false);
  assert.equal(isValidRevealPath([{ selector: "x".repeat(1025) }]), false);
  assert.equal(isValidRevealPath([{ selector: "#a", label: "x".repeat(121) }]), false);
  assert.equal(isValidRevealPath([{ selector: "#a", fingerprint: "text" }]), false);
  assert.equal(isValidRevealPath([null]), false);
});
