export type SlurpMemoryOfferOutcome = "skipped" | "declined" | "enabled";
/** Slurp's switches that match Long-Term Memory's: read memories (`flavourFromAgents`) and add them (`shareWithMemory`). */
export type SlurpMemorySetting = "flavourFromAgents" | "shareWithMemory";

/**
 * After a Long-Term Memory sharing switch turns on, offers to turn on Slurp's matching `setting`, which Slurp also
 * needs before memories flow that way. A missing Slurp or a failed read asks nothing; a failed `save` throws to the
 * caller.
 */
export async function offerSlurpMemories(deps: {
  setting: SlurpMemorySetting;
  read: () => Promise<Partial<Record<SlurpMemorySetting, boolean>>>;
  confirm: () => boolean | Promise<boolean>;
  save: () => Promise<unknown>;
}): Promise<SlurpMemoryOfferOutcome> {
  let settings: Partial<Record<SlurpMemorySetting, boolean>>;
  try {
    settings = await deps.read();
  } catch {
    return "skipped";
  }
  // Only a Slurp that answers with this switch off is asked about: not installed, or too old to have it, skips.
  if (settings?.[deps.setting] !== false) return "skipped";
  if (!(await deps.confirm())) return "declined";
  await deps.save();
  return "enabled";
}
