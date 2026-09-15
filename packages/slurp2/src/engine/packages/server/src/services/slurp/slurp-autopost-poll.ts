export type SlurpReservePollOutcome =
  "scheduled" | "prepared" | "covered" | "disabled" | "holding" | "exhausted" | "busy" | "ineligible" | "missed";

export async function runSlurpAutoPostPollOperations(operations: {
  reconcile: () => Promise<void>;
  publishDue: () => Promise<number>;
  prepare: () => Promise<SlurpReservePollOutcome>;
  generationMode: () => Promise<"pre_generate" | "on_demand">;
}): Promise<{ published: number; reserve: SlurpReservePollOutcome }> {
  await operations.reconcile();
  let published = await operations.publishDue();
  const reserve = await operations.prepare();
  if (reserve === "prepared") {
    published += await operations.publishDue();
    if ((await operations.generationMode()) === "on_demand") await operations.prepare();
  }
  return { published, reserve };
}
