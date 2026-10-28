/** `skipped` is a Creator choosing a quiet slot, not a run that went wrong. See `slp-planner.ts`. */
export type SlurpReservePollOutcome =
  | "scheduled"
  | "prepared"
  | "covered"
  | "disabled"
  | "holding"
  | "exhausted"
  | "busy"
  | "ineligible"
  | "missed"
  | "skipped";

export async function runSlurpAutoPostPollOperations(operations: {
  reconcile: () => Promise<void>;
  publishDue: () => Promise<number>;
  prepare: () => Promise<SlurpReservePollOutcome>;
  generationMode: () => Promise<"pre_generate" | "on_demand">;
}): Promise<{ published: number; reserve: SlurpReservePollOutcome }> {
  await operations.reconcile();
  let published = await operations.publishDue();
  let reserve = await operations.prepare();
  // A quiet slot is spent, so the poll moves on to the next one rather than stopping for the day.
  // One retry, so a run of quiet slots cannot turn one poll into a loop.
  if (reserve === "skipped") reserve = await operations.prepare();
  if (reserve === "prepared") {
    published += await operations.publishDue();
    if ((await operations.generationMode()) === "on_demand") await operations.prepare();
  }
  return { published, reserve };
}
