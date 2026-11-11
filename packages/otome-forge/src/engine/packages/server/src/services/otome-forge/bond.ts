// ──────────────────────────────────────────────
// Otome Forge: the bond ranks' reveals (0.23.0)
// ──────────────────────────────────────────────
// After a love interest's finale (stage 6), the relationship keeps growing through ten bond ranks (C/shared/bond.ts).
// This writes their bible entries: one truth per rank, all ten in one call, the first time they are needed, so they
// never contradict one another. Until it runs, a bible has none and reads as none; once written, the scene card sends
// the ones up to the rank he stands at INSTEAD of his stage secrets (prompts.ts render), because those were revealed on
// his route and are not new. The planners' full bible JSON keeps the secrets, so the story never contradicts itself.
// The shape is fillIntimacy's (S/intimacy.ts): readOrGenerate, one generateJson, and a merge that only fills what is
// missing, so an edit or a second fill that landed meanwhile wins.
import { z, type ZodType } from "zod";
import type { BibleBond } from "../../../../client/src/features/otome-forge/shared/api-types.js";
import { BOND_RANKS } from "../../../../client/src/features/otome-forge/shared/bond.js";
import { generateJson, readOrGenerate, type GenerationDeps } from "./generation.js";
import { OtomeForgeError } from "./http.js";
import { runDocTarget, unitId } from "./ids.js";
import { bondRevealMessages } from "./prompts.js";
import { readRun } from "./schemas/state.js";
import { normalizeBondReveals, normalizeUnit } from "./schemas/unit.js";
import { castOf } from "./setup/cast.js";
import type { OtomeStore } from "./store.js";

const BondReplySchema: ZodType<{ bond: BibleBond[] }> = z.object({
  bond: z.array(z.object({ level: z.number(), truth: z.string() })),
});

export interface BondDeps extends GenerationDeps {
  runtime: GenerationDeps["runtime"] & Parameters<typeof castOf>[0];
  store: OtomeStore;
}

/**
 * Writes his missing bond reveals (1 call on the Planning connection) and keeps the rest of the bible, returning them,
 * or the ones already there with no call. 409 `conflict` before his finale (the ranks do not exist yet) or for a bible
 * not written yet, as fillIntimacy does.
 */
export async function fillBondReveals(
  deps: BondDeps,
  runId: string,
  li: string,
  { debugMode, signal }: { debugMode: boolean; signal?: AbortSignal },
): Promise<BibleBond[]> {
  const read = async () => (await deps.store.readDoc(unitId(runId, li), normalizeUnit))?.bible?.bond ?? null;
  return readOrGenerate(runId, read, async () => {
    signal?.throwIfAborted();
    const run = await readRun(deps.store, runId);
    if (!run) throw new OtomeForgeError(404, "No such Otome Forge run.", "not-found");
    const unit = run.units.find((candidate) => candidate.id === li);
    if (!unit) throw new OtomeForgeError(404, "No such love interest.", "not-found");
    if (!unit.bible) throw new OtomeForgeError(409, `${unit.name}'s bible is not written yet.`, "conflict");
    const [cast] = await castOf(deps.runtime, [unit]);
    const { value } = await generateJson(deps, {
      runId,
      job: "structured",
      label: `bible-bond/${li}`,
      messages: bondRevealMessages({ world: run.world, player: run.player, cast: cast! }),
      schema: BondReplySchema,
      normalize: (reply) => {
        const bond = normalizeBondReveals(reply.bond);
        return bond && bond.length === BOND_RANKS.length
          ? { bond }
          : "bond must hold one reveal for each rank 11 to 20";
      },
      maxTokens: 2000,
      debugMode,
      lane: "foreground",
      signal,
    });
    signal?.throwIfAborted();
    const bond = normalizeBondReveals(value.bond);
    if (!bond)
      throw new OtomeForgeError(502, "The bond reveals came back in a shape nothing could read.", "bad-format");
    // Only the missing block is written: an edit or another fill that landed meanwhile wins, and nothing else changes.
    const saved = await deps.store.updateDoc(runDocTarget("unit", unitId(runId, li)), normalizeUnit, (current) =>
      current.bible && !current.bible.bond ? { ...current, bible: { ...current.bible, bond } } : current,
    );
    if (!saved) throw new OtomeForgeError(404, "No such love interest.", "not-found");
    return saved.bible?.bond ?? bond;
  });
}
