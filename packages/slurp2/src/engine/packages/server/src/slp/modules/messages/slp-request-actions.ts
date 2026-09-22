/**
 * What a Creator can do with a fan's request, and what each choice creates.
 *
 * Pure. Every request can be handled from its thread, and every action leaves a record with the
 * right audience: the request and the answer stay in that fan's thread; only an aggregate count
 * ever reaches Creator-wide planning, and never with the fan or their wording attached.
 */

export const SLURP_REQUEST_ACTIONS = ["fulfill", "tease", "decline", "delay", "ignore", "aggregate"] as const;
export type SlurpRequestAction = (typeof SLURP_REQUEST_ACTIONS)[number];

/** How long a delayed request waits before the planner owes it a slot. */
export const SLURP_REQUEST_DELAY_DEFAULT_HOURS = 48;
export const SLURP_REQUEST_DELAY_MAX_HOURS = 14 * 24;

export type SlurpRequestActionEffect = {
  /** A promise the planner must honour: the intent it runs as, and when it becomes due. */
  promise: { intent: "request" | "teaser"; dueInHours: number } | null;
  /** A promise event in the thread, so the Creator's own messages can remember it. */
  promiseEvent: boolean;
  /** A thread-private boundary event: the Creator said no to this. */
  boundary: boolean;
  /** Whether the anonymous demand count for a topic goes up. */
  aggregate: boolean;
};

export function slurpRequestActionEffect(
  action: SlurpRequestAction,
  input: { dueInHours?: number } = {},
): SlurpRequestActionEffect {
  const delay = Math.min(
    SLURP_REQUEST_DELAY_MAX_HOURS,
    Math.max(1, Math.round(input.dueInHours ?? SLURP_REQUEST_DELAY_DEFAULT_HOURS)),
  );
  switch (action) {
    case "fulfill":
      return { promise: { intent: "request", dueInHours: 0 }, promiseEvent: true, boundary: false, aggregate: false };
    case "tease":
      return { promise: { intent: "teaser", dueInHours: 0 }, promiseEvent: true, boundary: false, aggregate: false };
    case "delay":
      return {
        promise: { intent: "request", dueInHours: delay },
        promiseEvent: true,
        boundary: false,
        aggregate: false,
      };
    case "decline":
      return { promise: null, promiseEvent: false, boundary: true, aggregate: false };
    case "aggregate":
      return { promise: null, promiseEvent: false, boundary: false, aggregate: true };
    default:
      return { promise: null, promiseEvent: false, boundary: false, aggregate: false };
  }
}
