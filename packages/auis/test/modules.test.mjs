// The module menu `auis init` shows. Pinned here: only installable modules can
// be picked, the others stay listed with their reason, --only refuses what
// cannot install, and the picker's keys do what the hint line says.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  MODULES,
  MODULE_IDS,
  initialPicker,
  moduleChoices,
  pickedIds,
  pickerReducer,
  resolveOnly,
} from "../src/modules.mjs";

describe("moduleChoices", () => {
  it("lists every module; only installable ones are selectable and pre-checked", () => {
    const rows = moduleChoices({ planOk: true });
    assert.deepEqual(rows.map((r) => r.id), MODULE_IDS);
    for (const row of rows) {
      const installable = MODULES.find((m) => m.id === row.id).status === "installable";
      assert.equal(row.selectable, installable, row.id);
      assert.equal(row.checked, installable, row.id);
      if (!installable) assert.ok(row.note, `${row.id} needs a reason`);
    }
    assert.ok(rows.find((r) => r.id === "review").selectable);
  });

  it("an installable module the repo cannot take carries the plan's reason", () => {
    const review = moduleChoices({ planOk: false, planReason: "No root layout." }).find((r) => r.id === "review");
    assert.equal(review.selectable, false);
    assert.equal(review.note, "No root layout.");
  });
});

describe("resolveOnly", () => {
  const rows = moduleChoices({ planOk: true });

  it("accepts installable ids, in catalog order, case-insensitively", () => {
    assert.deepEqual(resolveOnly(" Review ", rows), { ok: true, ids: ["review"] });
  });

  it("names the modules for an unknown id", () => {
    const r = resolveOnly("review,chat", rows);
    assert.equal(r.ok, false);
    assert.match(r.message, /chat: unknown module/);
    assert.match(r.message, /review, states, edit, styleguide, flows/);
  });

  it("says why a known module cannot install", () => {
    const r = resolveOnly("review,styleguide", rows);
    assert.equal(r.ok, false);
    assert.match(r.message, /^Styleguide cannot be installed here: .*your components/);
  });

  it("refuses an empty list", () => {
    assert.equal(resolveOnly(" , ", rows).ok, false);
  });

  it("ends a plan's reason with one period, not two", () => {
    const blocked = moduleChoices({ planOk: false, planReason: "No root layout." });
    assert.equal(resolveOnly("review", blocked).message, "Review cannot be installed here: No root layout.");
  });
});

describe("pickerReducer", () => {
  const press = (state, ...keys) => keys.reduce(pickerReducer, state);
  const start = () => initialPicker(moduleChoices({ planOk: true }));

  it("starts on the first selectable row with the defaults checked", () => {
    const s = start();
    assert.equal(s.rows[s.cursor].id, "review");
    assert.deepEqual(s.checked, ["review"]);
  });

  it("toggles a selectable row and refuses to confirm an empty selection", () => {
    const s = press(start(), "space", "enter");
    assert.deepEqual(s.checked, []);
    assert.equal(s.done, false);
    assert.match(s.hint, /at least one/);
    const ok = press(s, "space", "enter");
    assert.equal(ok.done, true);
    assert.deepEqual(pickedIds(ok), ["review"]);
  });

  it("a row that cannot be picked explains itself instead of toggling", () => {
    const s = press(start(), "down", "space");
    assert.deepEqual(s.checked, ["review"]);
    assert.match(s.hint, /^State Mode: /);
  });

  it("wraps around, toggles all, and cancels", () => {
    const up = press(start(), "up");
    assert.equal(up.cursor, MODULE_IDS.length - 1);
    assert.deepEqual(press(start(), "all").checked, []);
    assert.deepEqual(press(start(), "all", "all").checked, ["review"]);
    const gone = press(start(), "cancel", "space");
    assert.equal(gone.cancelled, true);
    assert.deepEqual(gone.checked, ["review"]);
  });
});
