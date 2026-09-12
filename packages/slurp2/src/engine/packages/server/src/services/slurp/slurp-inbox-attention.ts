import type { SlurpCommission } from "../storage/slurp-messages.storage.js";

export type SlurpAttentionCommission = SlurpCommission & { side: "viewer" | "creator" };

/** Keep the tray tied to present obligations and the active persona's two owned seats. */
export function selectSlurpAttentionCommissions(input: {
  viewerThreadIds: ReadonlySet<string>;
  operatedCreatorIds: ReadonlySet<string>;
  viewerCommissions: readonly SlurpCommission[];
  creatorCommissions: readonly SlurpCommission[];
}): SlurpAttentionCommission[] {
  return [
    ...input.viewerCommissions
      .filter((commission) => input.viewerThreadIds.has(commission.threadId) && commission.state === "quoted")
      .map((commission) => ({ ...commission, side: "viewer" as const })),
    ...input.creatorCommissions
      .filter(
        (commission) =>
          input.operatedCreatorIds.has(commission.creatorAccountId) &&
          (commission.state === "brief" || commission.state === "accepted"),
      )
      .map((commission) => ({ ...commission, side: "creator" as const })),
  ].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}
