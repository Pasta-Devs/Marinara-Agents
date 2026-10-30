// ──────────────────────────────────────────────
// Otome Forge: love interests' intimacy preferences (#1936)
// ──────────────────────────────────────────────
// An NSFW-only part of a love interest's bible: what they are into and what draws them. It sets no limits of its own:
// the player's content settings (Heat, Darkness, Lines & Veils and the consent toggles) decide what a scene may hold.
//   - only a story with NSFW Heat (Fade or Explicit, behind the 18+ confirmation: intimacyOpen) writes or reads it;
//     an SFW story never asks for it, and its prompts never carry it;
//   - a new bible is written with it (setup/prompts.ts bibleMessages); an older bible gains it only through the
//     Cast's explicit "Add intimacy preferences" (POST /runs/:run/lis/:li/intimacy), which writes this block alone and
//     keeps every other field, the story and its progress as they are;
//   - scenes, dates and banner stories see it beside the love interest's scene card, to bring in when a scene turns
//     intimate and it fits, not in every scene (the maintainer's #1936).
import { z, type ZodType } from "zod";
import type {
  BibleIntimacy,
  Player,
  Unit,
  World,
} from "../../../../client/src/features/otome-forge/shared/api-types.js";
import { intimacyOpen } from "../../../../client/src/features/otome-forge/shared/content.js";
import { otomeContentContract, otomeContractReminder } from "./content-contract.js";
import { generateJson, readOrGenerate, type GenerationDeps, type OtomeMessage } from "./generation.js";
import { OtomeForgeError } from "./http.js";
import { runDocTarget, unitId } from "./ids.js";
import { readRun } from "./schemas/state.js";
import { normalizeIntimacy, normalizeUnit } from "./schemas/unit.js";
import { INTIMACY_FIELD, INTIMACY_SHAPE, castEntry, castOf, protagonistEntry } from "./setup/prompts.js";
import type { OtomeStore } from "./store.js";

/**
 * His preferences beside his scene card ("" for an SFW story, or one he has none in). Told as context to use now and
 * then, so most scenes, and most intimacy, stay as they would be without it.
 */
export function intimacyLine(world: Pick<World, "content">, unit: Pick<Unit, "name" | "bible">): string {
  const intimacy = unit.bible?.intimacy;
  if (!intimacyOpen(world.content) || !intimacy) return "";
  const parts = [
    intimacy.preferences.length ? `into ${intimacy.preferences.join("; ")}` : "",
    intimacy.attractions.length ? `drawn to ${intimacy.attractions.join("; ")}` : "",
  ].filter(Boolean);
  if (!parts.length) return "";
  return `${unit.name}'s tastes in sex and intimacy: ${parts.join("; ")}. Bring them in when a scene turns intimate and they fit; not every intimate scene needs them, and ${unit.name} can want other things too.`;
}

const IntimacyReplySchema: ZodType<{ intimacy: BibleIntimacy }> = z.object({
  intimacy: z.object({ preferences: z.array(z.string()), attractions: z.array(z.string()) }),
});

/** The prompt that writes only the block, for a bible written without it. */
export function intimacyMessages({
  world,
  player,
  cast,
}: {
  world: World;
  player: Player;
  cast: Awaited<ReturnType<typeof castOf>>[number];
}): OtomeMessage[] {
  const { unit } = cast;
  const bible = unit.bible!;
  const system = [
    "You add one part to the hidden character bible of a love interest in an adult otome story: their own tastes in sex and intimacy. Every other part of the bible stays as it is.",
    "Reply with ONLY a JSON object of this shape:",
    `{${INTIMACY_SHAPE}}`,
    "FIELDS",
    INTIMACY_FIELD,
    "RULES",
    "- Derive it from who this character already is (the bible and the card below); never contradict them.",
    `- Write every label in ${world.language}.`,
    "",
    otomeContentContract({ world, lis: [{ name: unit.name }], kind: "planner" }),
  ].join("\n");
  const user = [
    "THIS LOVE INTEREST",
    castEntry(cast),
    `Age: ${bible.age}. Role: ${bible.role}. Public face: ${bible.publicFace}. True self: ${bible.trueSelf.is}`,
    `Voice: ${bible.voice.register}. Care: ${bible.voice.careLanguage}`,
    bible.likes.length ? `Likes: ${bible.likes.join("; ")}` : "",
    bible.redLines.length ? `Red lines: ${bible.redLines.join("; ")}` : "",
    bible.darkness.kinds.length ? `Darkness in them: ${bible.darkness.kinds.join("; ")}` : "",
    "",
    "PROTAGONIST",
    protagonistEntry(player),
    "",
    `Write ${unit.name}'s intimacy now.`,
    otomeContractReminder("planner"),
  ]
    .filter((line, index, lines) => line !== "" || lines[index - 1] !== "")
    .join("\n");
  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}

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
      temperature: 0.8,
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
