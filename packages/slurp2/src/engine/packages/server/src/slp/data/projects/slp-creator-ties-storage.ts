/**
 * Collabs, rivalries, brand deals, couples and bonds (friends, roommates, coworkers, exes), world-wide, in one of Slurp's own app settings.
 *
 * One document because the world looks at all of them together on one clock, and the player's
 * Studio shows them together. Every change goes through `mutateSlurpCreatorTies`, one at a time.
 */
import type { DB } from "../../../db/connection.js";
import { createAppSettingsStorage } from "../../../services/storage/app-settings.storage.js";
import { readSlurpCreatorTies, type SlurpCreatorTies } from "../../modules/projects/slp-creator-ties.js";
import { readSlurpBrandDeals, type SlurpBrandDeal } from "../../modules/economy/slp-brand-deals.js";
import type { SlurpCouple } from "../../modules/projects/slp-creator-couples.js";
import { readSlurpCouples } from "../../modules/projects/slp-couple-read.js";
import { readSlurpBonds, type SlurpBond } from "../../modules/projects/slp-creator-bonds.js";

export const SLURP_CREATOR_TIES_KEY = "slurp2.creator-ties";

export type SlurpTiesDocument = {
  ties: SlurpCreatorTies;
  deals: SlurpBrandDeal[];
  couples: SlurpCouple[];
  bonds: SlurpBond[];
};

// ponytail: an in-process queue. Two Engine processes writing at once could lose one change; the
// world tick already holds a database lease, and player actions are one click at a time.
let queue: Promise<unknown> = Promise.resolve();

export async function readSlurpCreatorTiesDocument(db: DB): Promise<SlurpTiesDocument> {
  const raw = await createAppSettingsStorage(db).get(SLURP_CREATOR_TIES_KEY);
  let value: Record<string, unknown> | null = null;
  try {
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    value = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
  } catch {
    value = null;
  }
  return {
    ties: readSlurpCreatorTies(value),
    deals: readSlurpBrandDeals(value?.deals),
    couples: readSlurpCouples(value?.couples),
    bonds: readSlurpBonds(value?.bonds),
  };
}

/** Read, change, write, one at a time. `change` returning null writes nothing. */
export function mutateSlurpCreatorTies<T>(
  db: DB,
  change: (document: SlurpTiesDocument) => { document: SlurpTiesDocument; result: T } | null,
): Promise<T | null> {
  const run = queue.then(async () => {
    const current = await readSlurpCreatorTiesDocument(db);
    const next = change(current);
    if (!next) return null;
    await createAppSettingsStorage(db).set(
      SLURP_CREATOR_TIES_KEY,
      JSON.stringify({
        ...next.document.ties,
        deals: next.document.deals,
        couples: next.document.couples,
        bonds: next.document.bonds,
      }),
    );
    return next.result;
  });
  queue = run.catch(() => undefined);
  return run;
}

/** The couple a Creator is in with this page of the player's, or null. Rocky counts; a breakup does not. */
/** The active couple a page is in, with the one other member (the first, for a group), or null. */
export async function readSlurpCouplePartnerOf(db: DB, pageId: string) {
  const { couples } = await readSlurpCreatorTiesDocument(db);
  const couple = couples.find(
    (entry) => entry.stage !== "split" && [entry.aId, entry.bId, ...(entry.moreIds ?? [])].includes(pageId),
  );
  return couple ? { ...couple, partnerId: couple.aId === pageId ? couple.bId : couple.aId } : null;
}

export async function readSlurpPlayerCouple(db: DB, creatorAccountId: string, pageId: string) {
  const { couples } = await readSlurpCreatorTiesDocument(db);
  return (
    couples.find((couple) => {
      if (couple.stage === "split") return false;
      const members = [couple.aId, couple.bId, ...(couple.moreIds ?? [])];
      return members.includes(creatorAccountId) && members.includes(pageId);
    }) ?? null
  );
}
