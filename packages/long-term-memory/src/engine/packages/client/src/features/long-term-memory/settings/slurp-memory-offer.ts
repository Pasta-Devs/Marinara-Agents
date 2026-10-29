export type SlurpMemoryOfferOutcome = "skipped" | "declined" | "enabled";

/**
 * After Long-Term Memory sharing turns on, offers to turn on Slurp's "What your other Agents know"
 * switch, which Slurp's Creators also need before they use memories. A missing Slurp or a failed
 * read asks nothing; a failed `save` throws to the caller.
 */
export async function offerSlurpMemories(deps: {
  read: () => Promise<{ flavourFromAgents?: boolean }>;
  confirm: () => boolean | Promise<boolean>;
  save: () => Promise<unknown>;
}): Promise<SlurpMemoryOfferOutcome> {
  let settings: { flavourFromAgents?: boolean };
  try {
    settings = await deps.read();
  } catch {
    return "skipped";
  }
  if (settings?.flavourFromAgents !== false) return "skipped";
  if (!(await deps.confirm())) return "declined";
  await deps.save();
  return "enabled";
}
