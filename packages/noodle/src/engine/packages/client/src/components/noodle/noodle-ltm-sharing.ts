/**
 * Noodle's "Use memories from Long-Term Memory" switch depends on Long-Term Memory's own
 * "Other Agents can read memories" switch. Reads are injected so the decisions run without a DOM,
 * and this file has no imports so the regression can load it directly.
 */
export type NoodleMemoryStatus = "ok" | "missing" | "off" | "error" | null;

/**
 * The server keeps the outcome of the last recall, so an "off" can outlive the switch that caused it.
 * Only "off" is checked against Long-Term Memory's current setting; every other status is returned as is.
 */
export async function currentMemoryStatus(deps: {
  read: () => Promise<{ status: NoodleMemoryStatus }>;
  readLtm: () => Promise<{ longTermMemoryShareWithPackages?: boolean }>;
}): Promise<{ status: NoodleMemoryStatus }> {
  const result = await deps.read();
  if (result.status !== "off") return result;
  try {
    if ((await deps.readLtm()).longTermMemoryShareWithPackages !== false) return { status: null };
  } catch {
    // Unreadable: keep the recorded "off".
  }
  return result;
}

export type LtmSharingOfferResult = "skipped" | "declined" | "enabled";

/**
 * Turning on "Use memories from Long-Term Memory" does nothing for memories while Long-Term Memory's
 * "Other Agents can read memories" switch is off. This asks the player once, and only then writes
 * that one setting.
 */
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
