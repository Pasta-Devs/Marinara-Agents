/**
 * The mark a Creator home measures its "since your last visit" numbers from.
 *
 * A delta needs two readings, and Slurp only ever stored the current one. This holds the previous
 * one per persona: followers, subscribers and lifetime earnings for each Creator that persona operates, plus
 * when it was taken.
 *
 * Written on the Studio's first read of a visit, so the mark is always "your last visit". The mark it
 * replaced is kept as `baseline`: the other reads of the same visit (after Collect, a goal edit, from
 * the Wallet) compare against it and show the same trends instead of zero (R1-065).
 */
import type { DB } from "../../../db/connection.js";
import { createAppSettingsStorage } from "../../../services/storage/app-settings.storage.js";

const key = (personaId: string) => `slurp2.persona.${personaId}.studio`;

import { SLURP_EARNINGS_LEGACY_SCALE } from "../../modules/economy/slp-earnings.js";
export type SlurpStudioSnapshot = {
  at: string;
  platformScale?: number;
  creators: Record<string, { followers: number; lifetimeEarnings: number; subscribers?: number }>;
  /** Earnings in platform dollars and shown subscribers (0.3.7). An older mark counted coins and real fans. */
  platform?: true;
  /** The mark this visit measures from (the one this snapshot replaced). */
  baseline?: SlurpStudioSnapshot | null;
};

export async function readSlurpStudioSnapshot(db: DB, personaId: string): Promise<SlurpStudioSnapshot | null> {
  const raw = await createAppSettingsStorage(db).get(key(personaId));
  if (!raw) return null;
  try {
    return parseSlurpStudioSnapshot(JSON.parse(raw), true);
  } catch {
    return null;
  }
}

/** Validates a stored mark; `withBaseline` reads one nested level (the baseline has none). */
export function parseSlurpStudioSnapshot(value: unknown, withBaseline = false): SlurpStudioSnapshot | null {
  const parsed = value as Partial<SlurpStudioSnapshot> | null;
  if (typeof parsed?.at !== "string" || !parsed.creators || typeof parsed.creators !== "object") return null;
  const creators: SlurpStudioSnapshot["creators"] = {};
  // A mark from before 0.3.7: earnings scale like the stored earnings did; its subscriber trend starts next visit.
  const legacy = parsed.platform !== true;
  for (const [id, value] of Object.entries(parsed.creators)) {
    // A hand-edited or partly written blob must not produce a delta from a non-number, which
    // would render as NaN in the one place the player looks to understand what changed.
    if (typeof value?.followers !== "number" || typeof value?.lifetimeEarnings !== "number") continue;
    if (!Number.isFinite(value.followers) || !Number.isFinite(value.lifetimeEarnings)) continue;
    creators[id] = {
      followers: value.followers,
      lifetimeEarnings: legacy ? value.lifetimeEarnings * SLURP_EARNINGS_LEGACY_SCALE : value.lifetimeEarnings,
      // Older marks have no subscriber count; that Creator's subscriber trend starts next visit.
      ...(!legacy && typeof value.subscribers === "number" && Number.isFinite(value.subscribers)
        ? { subscribers: value.subscribers }
        : {}),
    };
  }
  const baseline = withBaseline ? parseSlurpStudioSnapshot(parsed.baseline) : null;
  return {
    at: parsed.at,
    platformScale: parsed.platformScale,
    creators,
    platform: true,
    ...(baseline ? { baseline } : {}),
  };
}

export async function writeSlurpStudioSnapshot(
  db: DB,
  personaId: string,
  snapshot: SlurpStudioSnapshot,
): Promise<void> {
  await createAppSettingsStorage(db).set(key(personaId), JSON.stringify(snapshot));
}
