export type SlurpMemoryAskOutcome = "skipped" | "declined" | "accepted";
/** Slurp's switches that match Long-Term Memory's: read memories (`flavourFromAgents`) and add them (`shareWithMemory`). */
export type SlurpMemorySetting = "flavourFromAgents" | "shareWithMemory";

/**
 * When a Long-Term Memory sharing switch turns on, asks whether to turn on Slurp's matching `setting`, which Slurp
 * also needs before memories flow that way. It changes nothing: the caller applies a yes once the settings Save
 * succeeds. A missing Slurp or a failed read asks nothing.
 */
export async function askSlurpMemories(deps: {
  setting: SlurpMemorySetting;
  read: () => Promise<Partial<Record<SlurpMemorySetting, boolean>>>;
  confirm: () => boolean | Promise<boolean>;
}): Promise<SlurpMemoryAskOutcome> {
  let settings: Partial<Record<SlurpMemorySetting, boolean>>;
  try {
    settings = await deps.read();
  } catch {
    return "skipped";
  }
  // Only a Slurp that answers with this switch off is asked about: not installed, or too old to have it, skips.
  if (settings?.[deps.setting] !== false) return "skipped";
  return (await deps.confirm()) ? "accepted" : "declined";
}
