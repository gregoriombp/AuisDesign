// Scenario unions of the State Mode demo screen. The registry types its axes
// against these unions (`axisFromRecord<ExampleScreenState>`), so adding a
// member here without a label there fails the compile.

export type ExampleScreenState =
  | "default"
  | "empty"
  | "loading"
  | "error"
  | "permission"

export type ExampleScreenPlan = "free" | "pro"

const STATES: readonly ExampleScreenState[] = [
  "default",
  "empty",
  "loading",
  "error",
  "permission",
]
const PLANS: readonly ExampleScreenPlan[] = ["free", "pro"]

/** Absent or unknown → default, exactly like the switcher assumes. */
export function parseExampleState(raw: string | undefined): ExampleScreenState {
  return (STATES as readonly string[]).includes(raw ?? "")
    ? (raw as ExampleScreenState)
    : "default"
}

export function parseExamplePlan(raw: string | undefined): ExampleScreenPlan {
  return (PLANS as readonly string[]).includes(raw ?? "")
    ? (raw as ExampleScreenPlan)
    : "free"
}
