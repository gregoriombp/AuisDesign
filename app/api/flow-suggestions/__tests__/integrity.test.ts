import assert from "node:assert/strict"
import test from "node:test"

import {
  canonicalFlowRevision,
  canonicalizeFlowSnapshot,
  flowActorForSession,
  hasCanonicalBase,
  hashFlowSnapshot,
  parseFlowMaterializationReceipt,
} from "../_integrity"

test("flow hash is stable across object keys and collection ordering", () => {
  const nodes = [
    { id: "screen:b", data: { title: "B", step: "2" } },
    { id: "screen:a", data: { step: "1", title: "A" } },
  ]
  const edges = [
    { id: "edge:b", target: "screen:b", source: "screen:a" },
    { id: "edge:a", source: "start", target: "screen:a" },
  ]
  const reorderedNodes = [
    { data: { title: "A", step: "1" }, id: "screen:a" },
    { data: { step: "2", title: "B" }, id: "screen:b" },
  ]
  const reorderedEdges = edges.toReversed().map((edge) => ({
    target: edge.target,
    source: edge.source,
    id: edge.id,
  }))

  assert.equal(
    hashFlowSnapshot(nodes, edges),
    hashFlowSnapshot(reorderedNodes, reorderedEdges),
  )
  assert.notEqual(
    hashFlowSnapshot(nodes, edges),
    hashFlowSnapshot(
      [{ id: "screen:a", data: { step: "1", title: "Changed" } }],
      edges,
    ),
  )
})

test("canonical base detects a tampered snapshot without rejecting legacy absence", () => {
  const flow = "example"
  const baseSnapshot = canonicalizeFlowSnapshot(
    [{ id: "screen:start", data: { title: "Start" } }],
    [],
  )
  const baseHash = hashFlowSnapshot(baseSnapshot.nodes, baseSnapshot.edges)
  const baseRevision = canonicalFlowRevision(flow, baseHash)

  assert.equal(
    hasCanonicalBase({ flow, baseHash, baseRevision, baseSnapshot }),
    true,
  )
  assert.equal(
    hasCanonicalBase({
      flow,
      baseHash,
      baseRevision,
      baseSnapshot: {
        nodes: [{ id: "screen:start", data: { title: "Tampered" } }],
        edges: [],
      },
    }),
    false,
  )
  assert.equal(hasCanonicalBase({ flow, baseHash, baseRevision }), false)
})

test("materialization receipt is normalized and rejects incomplete evidence", () => {
  assert.deepEqual(
    parseFlowMaterializationReceipt({
      baseRevision: " flow:example@abc ",
      baseHash: " abc ",
      files: [" app/auis/ux-flow/example/page.tsx "],
      validations: [" npm run typecheck "],
      summary: " Materialized. ",
      actor: { kind: "agent", id: "germano", name: "spoof" },
    }),
    {
      baseRevision: "flow:example@abc",
      baseHash: "abc",
      files: ["app/auis/ux-flow/example/page.tsx"],
      validations: ["npm run typecheck"],
      summary: "Materialized.",
    },
  )
  assert.equal(
    parseFlowMaterializationReceipt({
      baseRevision: "flow:x@abc",
      baseHash: "abc",
      files: [],
      validations: ["typecheck"],
      summary: "ok",
    }),
    null,
  )
})

test("flow actor is derived from the session", () => {
  assert.deepEqual(
    flowActorForSession({ role: "agent", email: null, authEnabled: true }),
    { kind: "agent", id: "claude", name: "Claude" },
  )
  assert.deepEqual(
    flowActorForSession({
      role: "admin",
      email: "Jane@Example.com",
      authEnabled: true,
    }),
    {
      kind: "user",
      id: "user:jane@example.com",
      name: "Jane@Example.com",
    },
  )
  assert.deepEqual(
    flowActorForSession({ role: "admin", email: null, authEnabled: false }),
    { kind: "user", id: "local-admin", name: "Local admin" },
  )
})
