// Synthetic click shared by the two Auis replayers: the FlowStateDriver
// (`?ge=`) and the Review Mode reveal trail.
//
// A bare `el.click()` is not enough: Radix (dropdown, select, popover, context
// menu) opens on `pointerdown`, so a naked click is a silent no-op precisely on
// the suspended targets that matter most. Clicking a trigger that sits outside
// the viewport does nothing either — hence the scroll first.

/** Fires the full pointer sequence, the way Radix expects it. */
export function fireClick(el: HTMLElement) {
  el.scrollIntoView({ block: "center", behavior: "instant" as ScrollBehavior })
  const opts = { bubbles: true, cancelable: true, view: window }
  el.dispatchEvent(new PointerEvent("pointerdown", { ...opts, pointerId: 1 }))
  el.dispatchEvent(new MouseEvent("mousedown", opts))
  el.dispatchEvent(new PointerEvent("pointerup", { ...opts, pointerId: 1 }))
  el.dispatchEvent(new MouseEvent("mouseup", opts))
  el.click()
}
