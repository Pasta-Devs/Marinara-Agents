import {
  templateEggFarewellScene,
  templateEggReturnScene,
  templateFarewellScene,
  templateReturnScene,
} from "../../../../shared/src/features/agents/saucelings/templates.js";
import {
  SAUCELING_POST_EGG_STAGES,
  type SaucelingCareProfile,
  type SaucelingMenagerieEntry,
  type SaucelingEvent,
  type SaucelingPet,
  type SaucelingPostEggStage,
} from "../../../../shared/src/features/agents/saucelings/types.js";

// ponytail: the Menagerie lives inside the world document so a swap stays one save; that holds for a few
// hundred entries. Past that, give each entry its own document, as portrait.ts does.
/** Menagerie entries keep the farewell and the life story first, then the latest care lines, so the save stays small. */
const MENAGERIE_JOURNAL_LIMIT = 24;
const STORY_KINDS = new Set<SaucelingEvent["kind"]>([
  "farewell",
  "egg-found",
  "hatch",
  "stage-up",
  "temperament-shift",
  "return-from-album",
  "evolve",
  "evolve-offer",
  "caretaker-change",
]);

function menagerieJournal(journal: SaucelingEvent[]): SaucelingEvent[] {
  const story = journal.filter((ev) => STORY_KINDS.has(ev.kind)).slice(0, MENAGERIE_JOURNAL_LIMIT);
  const others = journal.filter((ev) => !STORY_KINDS.has(ev.kind));
  const kept = new Set([...story, ...others].slice(0, MENAGERIE_JOURNAL_LIMIT));
  return journal.filter((ev) => kept.has(ev));
}

export function retirePetToMenagerie(
  pet: SaucelingPet,
  nowIso: string,
): { entry: SaucelingMenagerieEntry; farewellEvent: SaucelingEvent } {
  const farewellText =
    pet.stage === "egg"
      ? templateEggFarewellScene(pet.careProfile, Date.parse(nowIso))
      : templateFarewellScene(pet.careProfile, pet.name, Date.parse(nowIso));
  const farewellEvent: SaucelingEvent = {
    id: `farewell-${Date.parse(nowIso)}`,
    kind: "farewell",
    createdAt: nowIso,
    text: farewellText,
    generated: false,
    speaker: pet.careProfile.characterName,
  };
  return { entry: entryFromPet(pet, nowIso, farewellText, [farewellEvent, ...pet.journal]), farewellEvent };
}

/** The Menagerie entry for a pet arriving there now: one retired from the nook, or an egg found while chatting
 *  that goes straight there (`farewellScene` empty). */
export function entryFromPet(
  pet: SaucelingPet,
  nowIso: string,
  farewellScene: string,
  journal: SaucelingEvent[] = pet.journal,
): SaucelingMenagerieEntry {
  const reachedElder = pet.stage === "elder" || Boolean(pet.elderSinceAt);
  return {
    id: pet.id,
    name: pet.name,
    species: pet.species,
    stageAtRetirement: pet.stage,
    reachedElder,
    lockedStage: pet.lockedStage,
    temperament: pet.temperament,
    temperamentVector: { ...pet.temperamentVector },
    traits: [...pet.traits],
    quirk: pet.quirk,
    meters: { ...pet.meters },
    caretakerId: pet.caretakerId,
    careProfile: pet.careProfile,
    createdAt: pet.createdAt,
    growthMs: pet.growthMs,
    hatchedAt: pet.hatchedAt,
    retiredAt: nowIso,
    backgroundId: pet.backgroundId,
    design: pet.design,
    forms: { ...pet.forms },
    savedForms: { ...pet.savedForms },
    flipped: pet.flipped,
    paintTries: { ...pet.paintTries },
    foundBy: pet.foundBy,
    foundAt: pet.foundAt,
    finder: pet.finder,
    ownTemperament: pet.ownTemperament,
    evolution: pet.evolution,
    farewellScene,
    journal: menagerieJournal(journal),
  };
}

/** `caretaker` hands the pet to someone new; the return line is then theirs. */
export function restorePetFromMenagerie(
  entry: SaucelingMenagerieEntry,
  requestedStage: SaucelingPostEggStage | undefined,
  nowIso: string,
  caretaker: { id: string; profile: SaucelingCareProfile } = { id: entry.caretakerId, profile: entry.careProfile },
): { pet: SaucelingPet; returnEvent: SaucelingEvent } {
  const validStages = new Set<string>(SAUCELING_POST_EGG_STAGES);
  let lockedStage: SaucelingPostEggStage | null = null;
  let activeStage = entry.stageAtRetirement;

  if (entry.reachedElder) {
    // Elders brought back lock at the chosen post-egg stage (default elder)
    lockedStage = requestedStage && validStages.has(requestedStage) ? requestedStage : "elder";
    activeStage = lockedStage;
  } else {
    // Early retirees return at the stage they left (locked if they were already locked)
    lockedStage = entry.lockedStage;
    activeStage = entry.lockedStage ?? entry.stageAtRetirement;
  }

  const returnEvent: SaucelingEvent = {
    id: `return-${Date.parse(nowIso)}`,
    kind: "return-from-album",
    createdAt: nowIso,
    stage: activeStage,
    text:
      activeStage === "egg"
        ? templateEggReturnScene(caretaker.profile, Date.parse(nowIso))
        : templateReturnScene(caretaker.profile, entry.name, activeStage, Date.parse(nowIso)),
    generated: false,
    speaker: caretaker.profile.characterName,
  };

  const pet: SaucelingPet = {
    id: entry.id,
    name: entry.name,
    species: entry.species,
    stage: activeStage,
    lockedStage,
    temperament: entry.temperament,
    temperamentVector: { ...entry.temperamentVector },
    lastTemperamentShiftAt: nowIso,
    traits: [...entry.traits],
    quirk: entry.quirk,
    meters: {
      hunger: Math.max(60, entry.meters.hunger),
      mood: Math.max(65, entry.meters.mood),
      bond: entry.meters.bond,
    },
    caretakerId: caretaker.id,
    careProfile: caretaker.profile,
    nudges: [],
    actionCooldowns: {},
    careActionCount: 1,
    // An egg's hatching wait counts from createdAt, so move it past the Menagerie stay; a hatched one keeps its growth.
    createdAt:
      activeStage === "egg"
        ? new Date(
            Date.parse(entry.createdAt) + Math.max(0, Date.parse(nowIso) - Date.parse(entry.retiredAt)),
          ).toISOString()
        : entry.createdAt,
    growthMs: entry.growthMs,
    hatchedAt: entry.hatchedAt ?? (activeStage === "egg" ? null : nowIso),
    elderSinceAt: entry.reachedElder ? entry.retiredAt : null,
    retireReady: false,
    backgroundId: entry.backgroundId,
    design: entry.design,
    forms: { ...entry.forms },
    savedForms: { ...entry.savedForms },
    flipped: entry.flipped,
    paintTries: { ...entry.paintTries },
    foundBy: entry.foundBy,
    foundAt: entry.foundAt,
    finder: entry.finder,
    ownTemperament: entry.ownTemperament,
    // Its good days start over, as its meals do.
    evolution: { ...entry.evolution, goodHours: [], chatDays: [] },
    // Its time in the Menagerie does not count toward taking after anyone.
    caretakerSince: nowIso,
    eggSpot: null,
    mealRecord: [],
    lastTickAt: nowIso,
    rngState: Date.parse(nowIso) >>> 0 || 12345,
    journal: [returnEvent, ...entry.journal].slice(0, 80),
  };

  return { pet, returnEvent };
}
