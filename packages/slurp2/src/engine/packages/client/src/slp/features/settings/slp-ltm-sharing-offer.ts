/**
 * Turning on "What your other Agents know" does nothing for memories while Long-Term Memory's
 * "Other Agents can read memories" switch is off. This asks the player once, and only then writes
 * that one setting. Reads, asks and writes are injected so the decision runs without a DOM.
 */
export type LtmSharingOfferResult = "skipped" | "declined" | "enabled";

export async function offerLtmSharing(deps: {
  read: () => Promise<{ longTermMemoryShareWithPackages?: boolean }>;
  confirm: () => Promise<boolean>;
  save: () => Promise<unknown>;
}): Promise<LtmSharingOfferResult> {
  let settings: { longTermMemoryShareWithPackages?: boolean };
  try {
    settings = await deps.read();
  } catch {
    // Long-Term Memory missing or unreadable: the memory status line already says so.
    return "skipped";
  }
  if (settings.longTermMemoryShareWithPackages !== false) return "skipped";
  if (!(await deps.confirm())) return "declined";
  await deps.save();
  return "enabled";
}
