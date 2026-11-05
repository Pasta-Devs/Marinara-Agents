import { randomUUID } from "node:crypto";
import { templateEggFoundScene } from "../../../../shared/src/features/agents/saucelings/templates.js";
import {
  ORDINARY_SPECIES,
  SAUCELING_EGG_START_WARMTH,
  type SaucelingCareProfile,
  type SaucelingDesign,
  type SaucelingEvent,
  type SaucelingPet,
  type SaucelingSpeciesId,
} from "../../../../shared/src/features/agents/saucelings/types.js";
import { SPECIES_CATALOG, selectTraitsForPet } from "../../../../shared/src/features/agents/saucelings/vocabulary.js";
import { createSeededRng, type SeededRng } from "./simulation.js";
import { createInitialTemperamentVector } from "./temperament.js";

const DEFAULT_QUIRKS: Record<SaucelingSpeciesId, string> = {
  rigamuffin: "Tucks stray breadcrumbs into its ridges for later.",
  fluttino: "Hovers an inch above its pillow whenever it naps.",
  lentino: "Ties itself into a polite bow when dinner is on time.",
  shellbini: "Hums softly inside its shell until someone knocks.",
  tortellump: "Rolls into the warmest corner of the nook and will not unroll until dinner.",
  mossaboo: "A new sprout appears on its back whenever it is happy.",
  puddlepip: "It ripples all over when it giggles.",
  snufflump: "It puffs up to twice its size when surprised.",
  burrowl: "It digs a little hole whenever it is thinking.",
  prismite: "It throws rainbow flecks on everything around it in sunlight.",
  thundrake: "It rumbles and its sparks jump when it is excited.",
  clockrit: "Its pendulum tail swings faster when it is excited.",
  wickwisp: "Its flame shrinks to a spark when it is frightened.",
  cauldrop: "It boils over when it laughs.",
  webbit: "Its belly brightens at dusk and dims at dawn.",
};

/** The caretaker's leaning picks most eggs; the rest are any of `available`, which the leaning is kept to as well. */
export function rollSpeciesFromProfile(
  profile: SaucelingCareProfile,
  rng: SeededRng,
  available: readonly SaucelingSpeciesId[] = ORDINARY_SPECIES,
): SaucelingSpeciesId {
  const lean = profile.speciesLean.filter((id) => available.includes(id));
  const roll = rng.next();
  if (roll < 0.6 && lean[0]) return lean[0];
  if (roll < 0.85 && lean[1]) return lean[1];
  const idx = Math.floor(rng.next() * available.length);
  return available[idx] ?? "rigamuffin";
}

/** An egg is nameless to the player: it takes its kind's name, shown only once it hatches, when it is given a name
 *  (see words.ts) that the player can change. `profile` is whoever found it, its first caretaker. A `design` from its caretaker gives its kind, traits and quirk; it still
 *  rolls a species, whose scene, anchors and behaviours it keeps. `foundBy` marks one found while chatting. */
export function createEggFromCaretaker(options: {
  profile: SaucelingCareProfile;
  nowIso: string;
  seed?: number;
  design?: SaucelingDesign | null;
  foundBy?: string | null;
  /** What the egg may be (see `availableSpecies`); a found egg is always an ordinary one. */
  available?: readonly SaucelingSpeciesId[];
}): {
  pet: SaucelingPet;
  event: SaucelingEvent;
} {
  const seed = options.seed ?? (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
  const rng = createSeededRng(seed);
  const species = rollSpeciesFromProfile(options.profile, rng, options.available);
  const design = options.design ?? null;
  const foundBy = options.foundBy ?? null;
  const name = design ? design.kind : SPECIES_CATALOG[species].name;
  const traits = design ? [...design.traits] : selectTraitsForPet(species, options.profile, seed);
  const event: SaucelingEvent = {
    id: `egg-${Date.parse(options.nowIso)}`,
    kind: "egg-found",
    createdAt: options.nowIso,
    stage: "egg",
    text: templateEggFoundScene(options.profile, foundBy !== null, Date.parse(options.nowIso)),
    generated: false,
    speaker: options.profile.characterName,
  };

  const pet: SaucelingPet = {
    id: randomUUID(),
    name,
    species,
    stage: "egg",
    lockedStage: null,
    temperament: "marinara",
    temperamentVector: createInitialTemperamentVector(options.profile.temperamentLean),
    lastTemperamentShiftAt: options.nowIso,
    traits,
    quirk: design ? design.quirk : DEFAULT_QUIRKS[species],
    meters: {
      hunger: 75,
      mood: 78,
      bond: 10,
      warmth: SAUCELING_EGG_START_WARMTH,
    },
    caretakerId: options.profile.characterId,
    careProfile: options.profile,
    nudges: [],
    actionCooldowns: {},
    careActionCount: 0,
    createdAt: options.nowIso,
    growthMs: 0,
    hatchedAt: null,
    elderSinceAt: null,
    retireReady: false,
    backgroundId: null,
    design,
    forms: {},
    savedForms: {},
    flipped: false,
    paintTries: {},
    foundBy,
    foundAt: foundBy ? options.nowIso : null,
    finder: { id: options.profile.characterId, name: options.profile.characterName },
    ownTemperament: null,
    caretakerSince: options.nowIso,
    eggSpot: null,
    mealRecord: [],
    evolution: { offer: null, choices: null, look: null, at: null, goodHours: [], chatDays: [] },
    lastTickAt: options.nowIso,
    rngState: rng.state(),
    journal: [event],
  };

  return { pet, event };
}
