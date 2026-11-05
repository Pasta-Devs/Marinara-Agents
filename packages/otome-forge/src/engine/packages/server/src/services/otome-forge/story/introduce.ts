// ──────────────────────────────────────────────
// Otome Forge: a love interest who arrives mid-story (#1983 M3).
// ──────────────────────────────────────────────
// The end-of-arc "meet someone new" choice writes one love interest: their unit, their bible and their ties into the
// world's web, then adds them to the cast LAST (cast order is Object.keys(state.lis), and a newcomer appended last is
// safe everywhere). Nothing here touches world.forge.steps: the forge phase turns "forging" the moment a text step is
// pending, and the whole app would drop the player onto a progress screen mid-arc. A love interest only exists once
// their bible does (the cast is state.lis filtered by unit.bible), so a failed arrival degrades to "not yet": the unit
// sits without a bible, out of the cast, and the next attempt writes the bible. A newcomer whose arc plan fails or is
// cancelled leaves the cast and the web but keeps their unit and bible (removeLoveInterest), so the same arrival again
// takes that unit back and pays for no second bible.
// Their bible is checked with every existing love interest as `others`, or its web silently empties; their ties go into
// world.web as rows against each of them, which the planner and the narrator already read.
import type { Player, Pronouns, Unit, World } from "../../../../../client/src/features/otome-forge/shared/api-types.js";
import { ARCHETYPE_IDS, type ArchetypeId } from "../../../../../client/src/features/otome-forge/shared/archetypes.js";
import { intimacyOpen } from "../../../../../client/src/features/otome-forge/shared/content.js";
import { LIS_MAX } from "../../../../../client/src/features/otome-forge/shared/cast.js";
import type { CapabilityRuntimeHost } from "@marinara-engine/shared";
import { generateJson, type GenerationDeps } from "../generation.js";
import { OtomeForgeError } from "../http.js";
import { newLiId, runDocTarget, stateId, unitId, worldId } from "../ids.js";
import { checkBible } from "../setup/bible.js";
import { bibleMessages } from "../prompts.js";
import { castOf, readCard } from "../setup/cast.js";
import { BibleSchema, normalizeUnit } from "../schemas/unit.js";
import { defaultLiState, normalizeState, readRun } from "../schemas/state.js";
import { normalizeWorld } from "../schemas/world.js";

/** What the player picked at the end of an arc: one of their cards, or someone invented. */
export type Arrival =
  | { source: "card"; cardId: string; pronouns: Pronouns }
  | { source: "archetype"; archetype: string; name: string; pronouns: Pronouns; notes?: string };

const VOICE_GENDER = { man: "male", woman: "female", person: "" } as const;

const samePronouns = (a: Pronouns, b: Pronouns) =>
  a.subject === b.subject && a.object === b.object && a.possessive === b.possessive;

/** The control characters a name may never carry (the setup route's rule). */
const CONTROL = /[\u0000-\u001f\u007f]/u;

/**
 * Writes the newcomer and returns who they are, for the arc that introduces them. 400 when the cast is full, when the
 * card cannot be read, or when the name is unusable; 409 when the run is still being forged.
 */
export async function introduceLoveInterest(
  deps: GenerationDeps & {
    runtime: GenerationDeps["runtime"] & Pick<CapabilityRuntimeHost, "resources">;
    store: import("../store.js").OtomeStore;
  },
  runId: string,
  arrival: Arrival,
  { debugMode, signal }: { debugMode?: boolean; signal?: AbortSignal } = {},
): Promise<{ id: string; name: string }> {
  const run = await readRun(deps.store, runId);
  if (!run) throw new OtomeForgeError(404, "No such Otome Forge run.", "not-found");
  if (run.world.forge.phase !== "ready") throw new OtomeForgeError(409, "The world is still being forged.", "conflict");
  const taken = Object.keys(run.state.lis);
  if (taken.length >= LIS_MAX) {
    throw new OtomeForgeError(400, "The cast is full: five love interests is the most a story holds.", "bad-request");
  }

  let name = "";
  if (arrival.source === "card") {
    const card = await readCard(deps.runtime, arrival.cardId);
    name = card?.name.trim() ?? "";
    if (!name) throw new OtomeForgeError(400, "That card could not be read.", "bad-request");
  } else {
    name = arrival.name.trim();
    if (!name) throw new OtomeForgeError(400, "Say who arrives.", "bad-request");
    if (!ARCHETYPE_IDS.includes(arrival.archetype as ArchetypeId)) {
      throw new OtomeForgeError(400, "Unknown archetype.", "bad-request");
    }
  }
  if (CONTROL.test(name) || name.includes(".."))
    throw new OtomeForgeError(400, "That name cannot be used.", "bad-request");

  // A unit out of the cast for the same arrival (the same card, or archetype, name and notes, with the same pronouns) is
  // taken back with its bible, when it has one, instead of writing another.
  const stored = (await deps.store.listRun("unit", runId)).map((record) => normalizeUnit(record.data));
  const notes = arrival.source === "archetype" ? (arrival.notes?.trim() ?? "") : "";
  const kept = stored.find(
    (candidate) =>
      !Object.hasOwn(run.state.lis, candidate.id) &&
      candidate.source === arrival.source &&
      candidate.name === name &&
      samePronouns(candidate.pronouns, arrival.pronouns) &&
      (arrival.source === "card"
        ? candidate.cardId === arrival.cardId
        : candidate.archetype === arrival.archetype && (candidate.notes ?? "") === notes),
  );
  const li =
    kept?.id ??
    newLiId(
      name,
      stored.map((unit) => unit.id),
    );
  const at = new Date().toISOString();
  const unit: Unit =
    kept ??
    ({
      ...normalizeUnit({}),
      id: li,
      kind: "character",
      name,
      // The player's pick for a card, exactly as setup asks (a card carries no pronouns of its own).
      pronouns: arrival.pronouns,
      source: arrival.source,
      ...(arrival.source === "card" ? { cardId: arrival.cardId } : {}),
      ...(arrival.source === "archetype"
        ? { archetype: arrival.archetype, ...(arrival.notes?.trim() ? { notes: arrival.notes.trim() } : {}) }
        : {}),
      createdAt: at,
    } as Unit);
  if (!kept) await deps.store.mutateDoc(runDocTarget("unit", unitId(runId, li)), normalizeUnit, () => unit);

  const others = run.units.filter((candidate) => candidate.id !== li);
  const [member] = await castOf(deps.runtime, [unit]);
  const worldHost = run.world;
  const player: Player = run.player;
  if (!unit.bible) {
    const { value: bible } = await generateJson(deps, {
      runId,
      job: "structured",
      label: `bible/${li}`,
      messages: bibleMessages({
        world: worldHost as World,
        player,
        member: member!,
        others: others.map((other) => ({ unit: other })),
      }),
      schema: BibleSchema,
      normalize: (reply) =>
        checkBible(reply, {
          pronouns: unit.pronouns,
          others: others.map(({ id, name: otherName }) => ({ id, name: otherName })),
          intimacy: intimacyOpen(worldHost.content),
        }),
      maxTokens: 5000,
      debugMode: !!debugMode,
      lane: "foreground",
      ...(signal ? { signal } : {}),
    });
    await deps.store.updateDoc(runDocTarget("unit", unitId(runId, li)), normalizeUnit, (current) => ({
      ...current,
      bible,
      bibleEdited: false,
      identityLine: bible.look.identityLine,
      outfitLine: bible.look.outfitLine,
      voiceGender: current.voiceGender || VOICE_GENDER[bible.look.presentation],
    }));
  }
  // Their ties to the cast, in the world's own web: what the planner and the narrator read, and what a bible's own web
  // cannot carry (it keeps only rows for ids it was written with).
  await deps.store.updateDoc(runDocTarget("world", worldId(runId)), normalizeWorld, (world) => ({
    ...world,
    web: [
      ...world.web.filter((row) => row.a !== li),
      ...others.map((other) => ({
        a: li,
        b: other.id,
        history: `${name} has only just come into ${player.name || "the protagonist"}'s life; ${other.name} has not taken to them yet.`,
        stance: "uneasy" as const,
        debt: "",
      })),
    ],
  }));
  // Last: added to the cast order, after everyone already there.
  await deps.store.updateDoc(runDocTarget("state", stateId(runId)), normalizeState, (state) => ({
    ...state,
    lis: { ...state.lis, [li]: defaultLiState() },
  }));
  return { id: li, name };
}

/**
 * Takes back a newcomer whose arc never got planned (#1985 review): their ties in the world's web and their cast entry
 * go, so a failed or cancelled plan leaves no one in the cast that the story never introduces. Their unit stays, with
 * the bible paid for on it, out of the cast (whoever means the love interests reads readCastUnits, never every stored
 * unit), and the same arrival again takes it back (introduceLoveInterest). Best effort: a rollback never throws over the original failure.
 */
export async function removeLoveInterest(
  deps: { store: import("../store.js").OtomeStore },
  runId: string,
  li: string,
): Promise<void> {
  await deps.store
    .updateDoc(runDocTarget("world", worldId(runId)), normalizeWorld, (world) => ({
      ...world,
      web: world.web.filter((row) => row.a !== li && row.b !== li),
    }))
    .catch(() => null);
  await deps.store
    .updateDoc(runDocTarget("state", stateId(runId)), normalizeState, (state) => {
      const { [li]: _gone, ...lis } = state.lis;
      return { ...state, lis };
    })
    .catch(() => null);
}
