/**
 * What `auis init` can install into an existing app, one module per thing a
 * person would pick. Only `installable` modules can be chosen; the others are
 * listed with the reason they cannot be yet, so the menu tells the truth about
 * what Auis does today instead of hiding the rest.
 *
 * Whether an installable module can go into THIS repository is a second
 * question, answered by the install plan (`planInstall`, the same one `doctor`
 * prints): `moduleChoices` folds that answer in.
 */

export const MODULES = [
  {
    id: "review",
    label: "Review",
    summary: "pins, comments, the drawer and agent mentions",
    status: "installable",
  },
  {
    id: "states",
    label: "State Mode",
    summary: "switch a screen's states in place, and ?ge= deep links that replay clicks",
    status: "planned",
    reason: "it is not packaged for an existing app yet, and it needs a registry of your screens",
  },
  {
    id: "edit",
    label: "Edit Mode",
    summary: "visual edits an agent turns into code",
    status: "planned",
    reason: "it is not packaged yet, and it needs a map of your components and tokens",
  },
  {
    id: "styleguide",
    label: "Styleguide",
    summary: "a living page of your own components and tokens",
    status: "planned",
    reason: "it has to document your components, not Auis's, and that scanner does not exist yet",
  },
  {
    id: "flows",
    label: "UX Flows",
    summary: "navigable flow diagrams that are pages in your app",
    status: "planned",
    reason: "it is not packaged for an existing app yet",
  },
];

export const MODULE_IDS = MODULES.map((m) => m.id);

/**
 * The menu rows for this repository. A module is selectable when it is
 * installable AND the install plan works here; otherwise the row says why.
 * The default selection is every selectable module.
 */
export function moduleChoices({ planOk = true, planReason = null } = {}) {
  return MODULES.map((m) => {
    if (m.status !== "installable") {
      return { id: m.id, label: m.label, summary: m.summary, selectable: false, checked: false, note: m.reason };
    }
    if (!planOk) {
      return { id: m.id, label: m.label, summary: m.summary, selectable: false, checked: false, note: planReason };
    }
    return { id: m.id, label: m.label, summary: m.summary, selectable: true, checked: true, note: null };
  });
}

/**
 * `--only review` or `--only review,states`: the ids, in catalog order, or the
 * reason the list cannot be installed. An unknown id names the valid ones; a
 * known one that cannot be installed says why.
 */
export function resolveOnly(value, choices) {
  const asked = String(value ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (asked.length === 0) return { ok: false, message: `--only needs a module: ${MODULE_IDS.join(", ")}` };
  const unknown = asked.filter((id) => !MODULE_IDS.includes(id));
  if (unknown.length > 0) {
    return { ok: false, message: `--only ${unknown.join(", ")}: unknown module. Modules: ${MODULE_IDS.join(", ")}` };
  }
  for (const id of asked) {
    const row = choices.find((c) => c.id === id);
    if (!row.selectable) {
      return { ok: false, message: `${row.label} cannot be installed here: ${String(row.note).replace(/\.$/, "")}.` };
    }
  }
  return { ok: true, ids: MODULE_IDS.filter((id) => asked.includes(id)) };
}

/**
 * The picker's state machine, with no terminal in it so it can be tested.
 * Keys: "up", "down", "space" (toggle), "all" (a: toggle every selectable),
 * "enter" (confirm; refused with nothing selected), "cancel" (Esc, Ctrl-C).
 */
export function initialPicker(rows) {
  const first = rows.findIndex((r) => r.selectable);
  return {
    rows,
    cursor: first === -1 ? 0 : first,
    checked: rows.filter((r) => r.checked).map((r) => r.id),
    done: false,
    cancelled: false,
    hint: null,
  };
}

export function pickerReducer(state, key) {
  if (state.done || state.cancelled) return state;
  const { rows } = state;
  const selectable = rows.filter((r) => r.selectable).map((r) => r.id);
  switch (key) {
    case "up":
      return { ...state, cursor: (state.cursor - 1 + rows.length) % rows.length, hint: null };
    case "down":
      return { ...state, cursor: (state.cursor + 1) % rows.length, hint: null };
    case "space": {
      const row = rows[state.cursor];
      if (!row.selectable) return { ...state, hint: `${row.label}: ${row.note}` };
      const on = state.checked.includes(row.id);
      return {
        ...state,
        checked: on ? state.checked.filter((id) => id !== row.id) : [...state.checked, row.id],
        hint: null,
      };
    }
    case "all": {
      const allOn = selectable.every((id) => state.checked.includes(id));
      return { ...state, checked: allOn ? [] : selectable, hint: null };
    }
    case "enter":
      if (state.checked.length === 0) return { ...state, hint: "Pick at least one module, or press Esc to leave." };
      return { ...state, done: true, hint: null };
    case "cancel":
      return { ...state, cancelled: true };
    default:
      return state;
  }
}

/** The ids a finished picker chose, in catalog order. */
export function pickedIds(state) {
  return MODULE_IDS.filter((id) => state.checked.includes(id));
}
