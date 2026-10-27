import {
  templateEggFoundByOther,
  templateEggFoundWhileTalking,
} from "../../../../shared/src/features/agents/saucelings/templates.js";
import type {
  SaucelingCareProfile,
  SaucelingEvent,
  SaucelingPet,
  SaucelingWorldDocument,
} from "../../../../shared/src/features/agents/saucelings/types.js";
import { careProfileNow } from "./care-profile.js";
import { generateDesign } from "./design.js";
import { createEggFromCaretaker } from "./discovery.js";
import { entryFromPet } from "./menagerie.js";
import { DAY_MS, MAX_JOURNAL_ENTRIES } from "./simulation.js";
import { readSaucelingWorld, updateSaucelingWorld } from "./store.js";
import { currentDayKey, FOUND_LINE_PREFIX, saveWithLines } from "./words.js";

/** The chance a character's chat reply finds an egg, before it is halved for each egg they keep unhatched. */
const FIND_CHANCE = 1 / 40;
const FIND_FLOOR = 1 / 320;

/** The find chance once `keptUnhatched` eggs this finder found are still waiting, so finds slow down
 *  while eggs pile up. */
export function eggFindChance(keptUnhatched: number): number {
  return Math.max(FIND_FLOOR, FIND_CHANCE / 2 ** keptUnhatched);
}

/** Eggs this finder found while chatting that are still eggs, in the nook or the Menagerie. */
function keptUnhatched(world: SaucelingWorldDocument, finderId: string): number {
  const nook = world.activePet?.stage === "egg" && world.activePet.foundBy === finderId ? 1 : 0;
  return nook + world.menagerie.filter((e) => e.stageAtRetirement === "egg" && e.foundBy === finderId).length;
}

/** What a chat reply by `targetIds` does, given rolls in [0, 1): any character replying may find an egg while a
 *  nook sauceling exists, and at most one find a day. `rolls.pick` chooses the finder among the targets; `rolls.find`
 *  is checked against that finder's own chance. Returns the finder's id, or null for no find. */
export function huntDecision(
  world: SaucelingWorldDocument,
  targetIds: readonly string[],
  rolls: { find: number; pick: number },
  nowIso: string,
): string | null {
  if (!world.settings.eggHunting || !world.activePet || targetIds.length === 0) return null;
  const finder = targetIds[Math.min(targetIds.length - 1, Math.floor(rolls.pick * targetIds.length))]!;
  return rolls.find < eggFindChance(keptUnhatched(world, finder)) && world.lastEggFindDay !== currentDayKey(nowIso)
    ? finder
    : null;
}

/** Runs a find the roll may allow: claims today's find in the save queue, asks the writing connection for a
 *  design outside it, then saves the egg. With no design it is an ordinary egg. */
export async function runHunt(
  targetIds: readonly string[],
  rolls: { find: number; pick: number },
  nowIso = new Date().toISOString(),
): Promise<void> {
  const before = await readSaucelingWorld();
  const finder = huntDecision(before, targetIds, rolls, nowIso);
  if (!finder) return;
  // The day is taken before the slow design call, so two replies close together never find two eggs.
  let claimed = false as boolean;
  await updateSaucelingWorld((current) => {
    claimed = huntDecision(current, targetIds, rolls, nowIso) === finder;
    return claimed ? { ...current, lastEggFindDay: currentDayKey(nowIso) } : current;
  });
  if (!claimed) return;
  try {
    const design = await generateDesign({ characterId: finder, connectionId: before.settings.connectionId });
    const profile = await careProfileNow(finder, before.profileCache[finder]);
    await saveFind(finder, profile, design, nowIso);
  } catch (error) {
    // No egg was saved, so today's find is given back; a later reply may still find one.
    await updateSaucelingWorld((current) =>
      current.lastEggFindDay === currentDayKey(nowIso)
        ? { ...current, lastEggFindDay: before.lastEggFindDay }
        : current,
    ).catch(() => undefined);
    throw error;
  }
}

/** Notes that the hatched pet's caretaker replied in a chat today, which makes an evolution offer likelier (see
 *  `simulation.ts`); egg hunting does not need to be on. Keeps the last three days, and writes at most once a day. */
export function markChatDay(world: SaucelingWorldDocument, targetIds: readonly string[], nowMs: number) {
  const pet = world.activePet;
  const day = Math.floor(nowMs / DAY_MS);
  if (!pet || pet.stage === "egg" || !targetIds.includes(pet.caretakerId)) return world;
  const evolution = pet.evolution;
  if (evolution.offer || evolution.at || evolution.chatDays.includes(day)) return world;
  const chatDays = [...evolution.chatDays, day].slice(-3);
  return { ...world, activePet: { ...pet, evolution: { ...evolution, chatDays } } };
}

/** The egg is the finder's (their `profile`); the line in the nook pet's journal is said by its caretaker, who names
 *  the finder when it was someone else. */
async function saveFind(
  finderId: string,
  profile: SaucelingCareProfile,
  design: SaucelingPet["design"],
  nowIso: string,
): Promise<void> {
  const egg = createEggFromCaretaker({ profile, nowIso, design, foundBy: finderId });
  await saveWithLines(nowIso, (current) => {
    const nook = current.activePet;
    const menagerie = [entryFromPet(egg.pet, nowIso, ""), ...current.menagerie];
    // The egg waits in the Menagerie; if the nook pet was released meanwhile there is no one to tell.
    if (!nook) return { world: { ...current, menagerie }, pet: null, events: [] };
    const teller = nook.careProfile;
    const line: SaucelingEvent = {
      id: `${FOUND_LINE_PREFIX}${Date.parse(nowIso)}`,
      kind: "egg-found",
      createdAt: nowIso,
      text:
        nook.caretakerId === finderId
          ? templateEggFoundWhileTalking(teller, nook, Date.parse(nowIso))
          : templateEggFoundByOther(teller, nook, profile.characterName, Date.parse(nowIso)),
      generated: false,
      speaker: teller.characterName,
      ...(nook.caretakerId === finderId ? {} : { finder: profile.characterName }),
    };
    const told = { ...nook, journal: [line, ...nook.journal].slice(0, MAX_JOURNAL_ENTRIES) };
    return { world: { ...current, activePet: told, menagerie }, pet: told, events: [line] };
  });
}

let hunting = false;
/** The day and targets last checked for `markChatDay`, so the rest of a day's replies by them never read storage.
 *  Cleared again when that check could not settle the day: it failed, or the nook pet was still an egg or had another
 *  caretaker, which can change before the day ends (those replies read, but do not write). */
let chatMarked = "";

/**
 * The prompt-context contributor: the Engine calls it once per generation, before the reply is written. It adds
 * nothing to the prompt and reads no chat text; it notes the day for the caretaker and rolls, and on a hit starts a
 * hunt in the background, so it returns at once (the Engine gives contributors 2 s and runs them one after another).
 *
 * Any character replying may find the egg, not only the nook pet's caretaker; one roll picks which of the targets.
 * The Engine also calls it for Peek Prompt, a regenerate and a swipe, and before a generation that then fails, so
 * those roll too. In a group chat with no reply target, every character in it counts as a target. Multiplayer
 * rooms never call it.
 */
export function noteChatReply(request: { targetCharacterIds?: string[] }): null {
  const targetIds = [...(request.targetCharacterIds ?? [])];
  if (targetIds.length === 0) return null;
  const nowMs = Date.now();
  const marked = `${Math.floor(nowMs / DAY_MS)}:${[...targetIds].sort().join(",")}`;
  if (marked !== chatMarked) {
    chatMarked = marked;
    const unsettled = () => {
      if (chatMarked === marked) chatMarked = "";
    };
    // A read first, so a day with nothing to note never writes; the write checks again in the save queue.
    void readSaucelingWorld()
      .then((world) => {
        const pet = world.activePet;
        if (pet && (pet.stage === "egg" || !targetIds.includes(pet.caretakerId))) return unsettled();
        if (markChatDay(world, targetIds, nowMs) === world) return;
        return updateSaucelingWorld((current) => markChatDay(current, targetIds, nowMs)).then(() => undefined);
      })
      .catch(unsettled);
  }
  const rolls = { find: Math.random(), pick: Math.random() };
  // Most replies miss the roll whatever the world holds, so they never read storage for it.
  if (hunting || rolls.find >= FIND_CHANCE) return null;
  hunting = true;
  void runHunt(targetIds, rolls)
    .catch(() => undefined)
    .finally(() => {
      hunting = false;
    });
  return null;
}
