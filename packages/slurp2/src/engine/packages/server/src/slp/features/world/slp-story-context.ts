import type { DB } from "../../../db/connection.js";
import { createSlurpStorage } from "../../data/slp-storage.js";
import { slurpPlatformEventInstruction } from "../../../../../shared/src/slp/slp-platform-events.js";

/**
 * Occasions, occurrences, and story facts for one Creator's prompt. The story engine wrote
 * occurrences and facts that no prompt read; this is the one place generation reads them.
 * Best effort: a failed read costs the prompt its world context, never the post or reply.
 */
export async function resolveSlurpEventInstruction(db: DB, creatorId: string, at: Date): Promise<string | null> {
  const storage = createSlurpStorage(db);
  const [settings, occurrences, facts, creator] = await Promise.all([
    storage.getSettings(),
    storage.listStoryOccurrences().catch(() => []),
    storage.listStoryFacts().catch(() => []),
    storage.getNoodlerAccountById(creatorId).catch(() => null),
  ]);
  const tags = creator?.settings.profile.tags ?? [];
  return slurpPlatformEventInstruction(settings.platformEvents, at, { id: creatorId, tags }, { occurrences, facts });
}
