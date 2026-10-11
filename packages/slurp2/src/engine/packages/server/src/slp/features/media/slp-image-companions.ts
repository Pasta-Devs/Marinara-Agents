import type { SlpAccount } from "../../../../../shared/src/slp/slp-social.types.js";
import type { DB } from "../../../db/connection.js";
import { createSlurpStorage } from "../../data/slp-storage.js";

/** Another Creator the post is about (a partner, a collab), with the card behind their page. */
export type SlurpImageCompanion = { account: SlpAccount; source: SlpAccount | null };

/** The Creators a post's beat names, as picture companions. The author and unknown ids drop out. */
export async function resolveSlurpImageCompanions(
  db: DB,
  ids: unknown,
  authorId: string,
): Promise<SlurpImageCompanion[]> {
  const noodle = createSlurpStorage(db);
  const companions: SlurpImageCompanion[] = [];
  for (const id of new Set(Array.isArray(ids) ? ids : [])) {
    if (typeof id !== "string" || id === authorId) continue;
    const account = await noodle.getNoodlerAccountById(id);
    if (account) companions.push({ account, source: await noodle.resolveAccountSource(account) });
  }
  return companions;
}
