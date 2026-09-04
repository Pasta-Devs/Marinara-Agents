/**
 * The mark a Creator home measures its "since your last visit" numbers from.
 *
 * A delta needs two readings, and Slurp only ever stored the current one. This holds the previous
 * one per persona: followers and lifetime earnings for each Creator that persona operates, plus
 * when it was taken.
 *
 * Written on every studio read, so the mark is always "your last visit". That means opening the
 * studio twice in a row reports no change the second time, which is correct.
 */
import type { DB } from "../../db/connection.js";
import { createAppSettingsStorage } from "../storage/app-settings.storage.js";

const key = (personaId: string) => `slurp.persona.${personaId}.studio`;

export type SlurpStudioSnapshot = {
  at: string;
  creators: Record<string, { followers: number; lifetimeEarnings: number }>;
};

export async function readSlurpStudioSnapshot(db: DB, personaId: string): Promise<SlurpStudioSnapshot | null> {
  const raw = await createAppSettingsStorage(db).get(key(personaId));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<SlurpStudioSnapshot>;
    if (typeof parsed?.at !== "string" || !parsed.creators || typeof parsed.creators !== "object") return null;
    const creators: SlurpStudioSnapshot["creators"] = {};
    for (const [id, value] of Object.entries(parsed.creators)) {
      // A hand-edited or partly written blob must not produce a delta from a non-number, which
      // would render as NaN in the one place the player looks to understand what changed.
      if (typeof value?.followers !== "number" || typeof value?.lifetimeEarnings !== "number") continue;
      if (!Number.isFinite(value.followers) || !Number.isFinite(value.lifetimeEarnings)) continue;
      creators[id] = { followers: value.followers, lifetimeEarnings: value.lifetimeEarnings };
    }
    return { at: parsed.at, creators };
  } catch {
    return null;
  }
}

export async function writeSlurpStudioSnapshot(
  db: DB,
  personaId: string,
  snapshot: SlurpStudioSnapshot,
): Promise<void> {
  await createAppSettingsStorage(db).set(key(personaId), JSON.stringify(snapshot));
}
