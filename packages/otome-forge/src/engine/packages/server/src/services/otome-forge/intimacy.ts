// ──────────────────────────────────────────────
// Otome Forge: love interests' intimacy preferences (#1936)
// ──────────────────────────────────────────────
// An NSFW-only part of a love interest's bible: what they are into and what draws them. It sets no limits of its own:
// the player's content settings (Heat, Darkness, Lines & Veils and the consent toggles) decide what a scene may hold.
//   - only a story with NSFW Heat (Fade or Explicit, behind the 18+ confirmation: intimacyOpen) writes or reads it;
//     an SFW story never asks for it, and its prompts never carry it;
//   - a new bible is written with it (S/prompts.ts bibleMessages); an older bible gains it only through the
//     Cast's explicit "Add intimacy preferences" (POST /runs/:run/lis/:li/intimacy), which writes this block alone and
//     keeps every other field, the story and its progress as they are;
//   - scenes, dates and banner stories see it beside the love interest's scene card, to bring in when a scene turns
//     intimate and it fits, not in every scene (the maintainer's #1936).
import { z, type ZodType } from "zod";
import type { BibleIntimacy } from "../../../../client/src/features/otome-forge/shared/api-types.js";
import { intimacyOpen } from "../../../../client/src/features/otome-forge/shared/content.js";
import { generateJson, readOrGenerate, type GenerationDeps } from "./generation.js";
import { OtomeForgeError } from "./http.js";
import { runDocTarget, unitId } from "./ids.js";
import { readRun } from "./schemas/state.js";
import { normalizeIntimacy, normalizeUnit } from "./schemas/unit.js";
import { castOf } from "./setup/cast.js";
import type { OtomeStore } from "./store.js";
import { intimacyMessages } from "./prompts.js";

const IntimacyReplySchema: ZodType<{ intimacy: BibleIntimacy }> = z.object({
  intimacy: z.object({ preferences: z.array(z.string()), attractions: z.array(z.string()) }),
});

export interface IntimacyDeps extends GenerationDeps {
  runtime: GenerationDeps["runtime"] & Parameters<typeof castOf>[0];
  store: OtomeStore;
}

/**
 * Writes a love interest's missing intimacy block (1 call on the Planning connection) and keeps the rest of the bible.
 * A block already there is returned as it is, with no call. 409 `conflict` for an SFW story or a bible not written yet.
 */
export async function fillIntimacy(
  deps: IntimacyDeps,
  runId: string,
  li: string,
  { debugMode, signal }: { debugMode: boolean; signal?: AbortSignal },
): Promise<BibleIntimacy> {
  const read = async () => (await deps.store.readDoc(unitId(runId, li), normalizeUnit))?.bible?.intimacy ?? null;
  return readOrGenerate(runId, read, async () => {
    signal?.throwIfAborted();
    const run = await readRun(deps.store, runId);
    if (!run) throw new OtomeForgeError(404, "No such Otome Forge run.", "not-found");
    if (!intimacyOpen(run.world.content)) {
      throw new OtomeForgeError(409, "Intimacy preferences are for adult NSFW stories only.", "conflict");
    }
    const unit = run.units.find((candidate) => candidate.id === li);
    if (!unit) throw new OtomeForgeError(404, "No such love interest.", "not-found");
    if (!unit.bible) throw new OtomeForgeError(409, `${unit.name}'s bible is not written yet.`, "conflict");
    const [cast] = await castOf(deps.runtime, [unit]);
    const { value } = await generateJson(deps, {
      runId,
      job: "structured",
      label: `bible-intimacy/${li}`,
      messages: intimacyMessages({ world: run.world, player: run.player, cast: cast! }),
      schema: IntimacyReplySchema,
      normalize: (reply) => {
        const intimacy = normalizeIntimacy(reply.intimacy);
        return typeof intimacy === "string" ? intimacy : { intimacy };
      },
      maxTokens: 1500,
      debugMode,
      lane: "foreground",
      signal,
    });
    signal?.throwIfAborted();
    const intimacy = normalizeIntimacy(value.intimacy) as BibleIntimacy;
    // Only the missing block is written: an edit or another fill that landed meanwhile wins, and nothing else changes.
    const saved = await deps.store.updateDoc(runDocTarget("unit", unitId(runId, li)), normalizeUnit, (current) =>
      current.bible && !current.bible.intimacy ? { ...current, bible: { ...current.bible, intimacy } } : current,
    );
    if (!saved) throw new OtomeForgeError(404, "No such love interest.", "not-found");
    return saved.bible?.intimacy ?? intimacy;
  });
}
