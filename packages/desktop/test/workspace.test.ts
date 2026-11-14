import assert from "node:assert/strict";
import { test } from "node:test";
import { isAllowedNavigation, isWebLink, resolveRoute } from "../src/shared/workspace.ts";

const ORIGIN = "http://127.0.0.1:3000";

test("the view stays on the workspace's origin", () => {
  assert.equal(isAllowedNavigation("http://127.0.0.1:3000/auis/styleguide?tab=1#top", [ORIGIN]), true);
  assert.equal(isAllowedNavigation("http://127.0.0.1:3000", [ORIGIN]), true);
});

test("a look-alike host is another site", () => {
  for (const url of [
    "http://127.0.0.1.evil.com:3000/",
    "http://127.0.0.1:3000@evil.com/",
    "http://evil.com/?http://127.0.0.1:3000/",
    "http://127.0.0.1:3001/",
    "https://127.0.0.1:3000/",
  ]) {
    assert.equal(isAllowedNavigation(url, [ORIGIN]), false, url);
  }
});

test("localhost and 127.0.0.1 are not treated as one origin", () => {
  // Two dev servers can each hold one of them on the same port.
  assert.equal(isAllowedNavigation("http://localhost:3000/", [ORIGIN]), false);
});

test("only web pages are navigations", () => {
  for (const url of ["file:///etc/passwd", "javascript:alert(1)", "data:text/html,hi", "about:blank", "not a url", ""]) {
    assert.equal(isAllowedNavigation(url, [ORIGIN]), false, url);
  }
});

test("a workspace can allow more than one origin", () => {
  const origins = ["https://app.example.com", "https://login.example.com"];
  assert.equal(isAllowedNavigation("https://login.example.com/sign-in", origins), true);
  assert.equal(isAllowedNavigation("https://example.com/", origins), false);
});

test("only web links are handed to the browser", () => {
  assert.equal(isWebLink("https://example.com/docs"), true);
  assert.equal(isWebLink("http://example.com"), true);
  for (const url of ["file:///Applications", "vscode://open", "mailto:a@b.c", "javascript:void 0", "nope"]) {
    assert.equal(isWebLink(url), false, url);
  }
});

test("a route resolves to a page on the project's origin", () => {
  assert.equal(resolveRoute(ORIGIN, "/auis/styleguide"), "http://127.0.0.1:3000/auis/styleguide");
  assert.equal(resolveRoute(ORIGIN, "/?state=empty"), "http://127.0.0.1:3000/?state=empty");
});

test("a route cannot leave the project's origin", () => {
  for (const route of ["//evil.com/x", "/\\evil.com/x", "https://evil.com/", "evil.com", "", "javascript:alert(1)"]) {
    assert.equal(resolveRoute(ORIGIN, route), null, JSON.stringify(route));
  }
});
