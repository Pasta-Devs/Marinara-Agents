/**
 * What a Creator's week looks like to the Support desk, so a ticket's topic comes from a real lever
 * (docs/SUPPORT-DESK.md): a week the algorithm buries them (a Discover feature), a collab that fell
 * through (a suggested collab), and income that dried up (coins). Pure; the desk tick reads the data.
 */
import { slurpReachWeek } from "../../../../../shared/src/slp/slp-reach.js";
import type { SlpDeskSituation } from "../../../../../shared/src/slp/slp-support-desk.js";

const DAY_MS = 86_400_000;

export type SlpDeskSituationInput = {
  creatorId: string;
  at: Date;
  /** The earnings ledger: signed amounts, so payouts and reversals are skipped here. */
  ledger: readonly { kind: string; amount: number; at: string }[];
  collabs: readonly {
    hostId: string;
    partnerId: string;
    status: string;
    answeredAt: string | null;
    decline: string | null;
  }[];
};

export function slurpDeskSituation(input: SlpDeskSituationInput): SlpDeskSituation {
  const { creatorId, at } = input;
  const now = at.getTime();
  const age = (stamp: string) => now - Date.parse(stamp);

  // The same weekly roll that buries their posts' reach: Support can answer it with a Discover feature.
  const viewsDown = slurpReachWeek(creatorId, at) === "buried";

  // Income of the last week against the week before it.
  const income = (from: number, to: number) =>
    input.ledger
      .filter((entry) => entry.amount > 0 && entry.kind !== "payout" && entry.kind !== "reversal")
      .filter((entry) => age(entry.at) >= from * DAY_MS && age(entry.at) < to * DAY_MS)
      .reduce((sum, entry) => sum + entry.amount, 0);
  // ponytail: the ledger keeps its newest 60 entries, so a very busy Creator's earlier week may be cut (a missed signal, never a false one).
  const before = income(7, 14);
  const moneyDown = before > 0 && income(0, 7) < before / 2;

  // A collab they asked for fell through lately (their own partner said no, not the other way round), and none is open.
  const mine = input.collabs.filter((collab) => collab.hostId === creatorId || collab.partnerId === creatorId);
  const hasCollabWish =
    !mine.some((collab) => ["asked", "agreed", "planned"].includes(collab.status)) &&
    mine.some(
      (collab) =>
        collab.hostId === creatorId &&
        collab.status === "declined" &&
        (collab.decline === "busy" || collab.decline === "noAnswer") &&
        collab.answeredAt !== null &&
        age(collab.answeredAt) < 14 * DAY_MS,
    );
  return { viewsDown, hasCollabWish, moneyDown };
}
