/**
 * Reading one creator's day out of storage.
 *
 * Split from `slurp-day-vibe.ts` so the scoring rules stay importable without an Engine checkout,
 * the way `slurp-rapport.ts` and `slurp-messaging.ts` are.
 */
import type { DB } from "../../db/connection.js";
import { createAppSettingsStorage } from "../storage/app-settings.storage.js";
import { createSlurpStorage } from "../storage/slurp.storage.js";
import {
  slurpDayVibe,
  slurpDayVibeDescription,
  slurpDayVibeFacts,
  SLURP_DAY_VIBES,
  type SlurpDayVibe,
} from "./slurp-day-vibe.js";

/** Where the cached vibe lives. One entry per creator per day, like `slurp-studio-snapshot.ts`. */
const key = (creatorAccountId: string) => `slurp.creator.${creatorAccountId}.dayvibe`;

const dayKey = (at: Date) => at.toISOString().slice(0, 10);

/**
 * The day vibe for one creator, cached for the rest of the day.
 *
 * Computed on the first read of each day and then reused, so every message in a conversation is
 * answered from the same morning. Recomputing per reply would let the creator's mood flicker
 * mid-sentence when a tip landed.
 */
export async function describeSlurpDayVibe(db: DB, creatorAccountId: string, at = new Date()): Promise<string | null> {
  try {
    const settingsStore = createAppSettingsStorage(db);
    const cached = await settingsStore.get(key(creatorAccountId));
    const today = dayKey(at);
    if (cached) {
      const parsed = JSON.parse(cached) as { on?: string; vibe?: SlurpDayVibe };
      if (parsed?.on === today && parsed.vibe && SLURP_DAY_VIBES.includes(parsed.vibe)) {
        return slurpDayVibeDescription(parsed.vibe);
      }
    }
    const slurp = createSlurpStorage(db);
    const earnings = await slurp.getEarnings(creatorAccountId);
    const lastPostAt = await slurp
      .listNoodlerPostsByAccounts([creatorAccountId], 1)
      .then((byAccount) => byAccount.get(creatorAccountId)?.[0]?.createdAt ?? null)
      .catch(() => null);
    const vibe = slurpDayVibe(slurpDayVibeFacts(earnings, lastPostAt, at));
    await settingsStore.set(key(creatorAccountId), JSON.stringify({ on: today, vibe }));
    return slurpDayVibeDescription(vibe);
  } catch {
    // A creator with no day is a creator having an ordinary one. This must never cost a reply.
    return null;
  }
}
