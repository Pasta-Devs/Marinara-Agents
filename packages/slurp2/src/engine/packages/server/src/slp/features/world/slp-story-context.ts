import type { DB } from "../../../db/connection.js";
import { createSlurpStorage } from "../../data/slp-storage.js";
import { slurpPlatformEventInstruction } from "../../../../../shared/src/slp/slp-platform-events.js";
import { readSlurpCreatorTiesDocument } from "../../data/projects/slp-creator-ties-storage.js";
import {
  SLURP_EMPTY_STORY_STATE,
  slurpStoryState,
  slurpTieTags,
  type SlurpStoryState,
} from "../../modules/world/events/slp-story-state.js";

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

/**
 * The image instructions plus a standing condition's look ("Right now: …"), so every picture of a
 * pregnant Creator shows it. Best effort: a failed read returns the instructions unchanged.
 */
export async function withSlurpConditionLook(db: DB, creatorId: string, instructions: string): Promise<string> {
  const { state } = await loadSlurpStoryState(db, creatorId, new Date());
  return state.look ? [instructions, `Right now: ${state.look}.`].filter(Boolean).join("\n") : instructions;
}

/**
 * A Creator's standing conditions for one post, reply or picture (docs/STORYLINES.md, "State"), and
 * the partner's name for condition moments that include them. Best effort, like the instruction
 * above: a failed read costs the prompt its conditions, never the post or reply.
 */
export async function loadSlurpStoryState(
  db: DB,
  creatorId: string,
  at: Date,
): Promise<{ state: SlurpStoryState; partner: string | null }> {
  try {
    const storage = createSlurpStorage(db);
    const [facts, ties] = await Promise.all([storage.listStoryFacts(), readSlurpCreatorTiesDocument(db)]);
    const state = slurpStoryState({ facts, creatorId, tieTags: slurpTieTags(ties, creatorId), at });
    const couple = state.deck.some((beat) => beat.withPartner)
      ? ties.couples.find(
          (entry) => entry.stage !== "split" && [entry.aId, entry.bId, ...(entry.moreIds ?? [])].includes(creatorId),
        )
      : undefined;
    const partnerId = couple ? (couple.aId === creatorId ? couple.bId : couple.aId) : null;
    const partner = partnerId ? ((await storage.getNoodlerAccountById(partnerId))?.displayName ?? null) : null;
    return { state, partner };
  } catch {
    return { state: SLURP_EMPTY_STORY_STATE, partner: null };
  }
}
