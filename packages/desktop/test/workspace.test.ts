import { test } from "node:test";
import assert from "node:assert/strict";
import {
  bridgeNotice,
  isAllowedNavigation,
  workspaceRoute,
  type Workspace,
} from "../src/shared/workspace.ts";
const local: Workspace = {
  kind: "local",
  path: "/project",
  origin: "http://127.0.0.1:3001",
};
test("navigation stays on this workspace, including IPC routes", () => {
  assert.equal(
    workspaceRoute(local, "/auis?state=empty#heading"),
    "http://127.0.0.1:3001/auis?state=empty#heading",
  );
  for (const url of [
    "http://127.0.0.1:3000",
    "https://example.org",
    "file:///tmp/a",
    "javascript:alert(1)",
    "http://user@127.0.0.1:3001",
    "invalid",
  ])
    assert.equal(isAllowedNavigation(local, url), false, url);
  for (const route of [
    "//example.org",
    "/\\example.org",
    "https://example.org",
    "/\n/example.org",
  ])
    assert.equal(workspaceRoute(local, route), null, route);
});
test("remote origins are explicit, not suffix or prefix matches", () => {
  const remote: Workspace = {
    kind: "remote",
    url: "https://app.example.org/home",
    allowedOrigins: ["https://login.example.org"],
  };
  assert.ok(isAllowedNavigation(remote, "https://login.example.org/authorize"));
  assert.ok(isAllowedNavigation(remote, "https://app.example.org/"));
  assert.equal(
    isAllowedNavigation(remote, "https://app.example.org.attacker.test/"),
    false,
  );
  assert.equal(isAllowedNavigation(remote, "http://app.example.org"), false);
});
test("a nondefault port carries its own bridge command, attach included", () => {
  assert.equal(
    bridgeNotice({ status: "running", url: local.origin, port: 3001 }),
    "export BRIDGE_BASE=http://127.0.0.1:3001",
  );
  assert.equal(
    bridgeNotice({
      status: "running",
      url: "http://localhost:3000",
      port: 3000,
    }),
    null,
  );
  assert.equal(bridgeNotice({ status: "error" }), null);
});
