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

export type SlurpMemoryStatus = "ok" | "missing" | "off" | "error" | null;

/**
 * The server keeps the outcome of the last recall, so an "off" can outlive the switch that caused it.
 * Only "off" is checked against Long-Term Memory's current setting; every other status is returned as is.
 */
export async function currentMemoryStatus(deps: {
  read: () => Promise<{ status: SlurpMemoryStatus }>;
  readLtm: () => Promise<{ longTermMemoryShareWithPackages?: boolean }>;
}): Promise<{ status: SlurpMemoryStatus }> {
  const result = await deps.read();
  if (result.status !== "off") return result;
  try {
    if ((await deps.readLtm()).longTermMemoryShareWithPackages !== false) return { status: null };
  } catch {
    // Unreadable: keep the recorded "off".
  }
  return result;
}
