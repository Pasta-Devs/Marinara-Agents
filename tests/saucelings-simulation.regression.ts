import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import {
  CARETAKER_SPEECH_KINDS,
  NEST_SCENE_PROMPT,
  SCENE_PROMPTS,
  SPECIES_CATALOG,
  isPasta,
  LIVE_VARIANTS,
  liveSheet,
  menagerieSections,
  neutralCareProfile,
  nookPlace,
  petKind,
  SHEET_ROWS,
  sceneAssetPath,
  spriteArtFor,
  spriteStrip,
  temperamentOf,
} from "../packages/saucelings/src/engine/packages/shared/src/features/agents/saucelings/vocabulary.ts";
import {
  PAINT_INSTRUCTIONS_CHARS,
  SAUCELING_PORTRAIT_LIMIT,
  SAUCELING_BACKGROUND_LIMIT,
  SAUCELING_CARETAKER_OUTCOMES,
  SAUCELING_EGG_START_WARMTH,
  SAUCELING_EVOLVE_AURAS,
  SAUCELING_EVOLVE_COLOURS,
  SAUCELING_EVOLVE_EXTRAS,
  SAUCELING_EVOLVE_MOVES,
  SAUCELING_EVOLVE_PATHS,
  ORDINARY_SPECIES,
  SAUCELING_ROUTINE_MOMENTS,
  SAUCELING_SPECIES,
  SAUCELING_STAGES,
  SEASONAL_SPECIES,
  SPECIAL_SPECIES,
  type SaucelingEventKind,
  type SaucelingMenagerieEntry,
  type SaucelingPet,
  type SaucelingSpecialSpeciesId,
  type SaucelingStage,
} from "../packages/saucelings/src/engine/packages/shared/src/features/agents/saucelings/types.ts";
import {
  beatFace,
  beatWeights,
  centreX,
  clampTarget,
  nextBeat,
  hurryMs,
  shownFace,
  stageScale,
  walkBounds,
  walkMs,
  walkWidth,
} from "../packages/saucelings/src/engine/packages/client/src/features/saucelings/stage-beats.ts";
import {
  FIGURE_POSES,
  caretakerCareAction,
  caretakerPose,
  figureFrame,
  pickStandingSprite,
  poseMoment,
  standingCaretaker,
} from "../packages/saucelings/src/engine/packages/client/src/features/saucelings/caretaker-look.ts";
import { SAUCELINGS_STYLES } from "../packages/saucelings/src/engine/packages/client/src/features/saucelings/styles.ts";
import {
  HATCH_MOMENTS,
  MOVE_PIECES,
} from "../packages/saucelings/src/engine/packages/client/src/features/saucelings/move-player.ts";
import {
  EGG_FORM_NEGATIVE,
  FIGURE_NEGATIVE,
  FORM_NEGATIVE,
  PORTRAIT_NEGATIVE,
  PORTRAIT_SUBJECTS,
  REFERENCE_NOTE,
  SCENE_NEGATIVE,
  SHEET_NEGATIVE,
  caretakerFigureRequest,
  caretakerRowRequest,
  figureAttempts,
  formNegative,
  formRequest,
  portraitAppearance,
  portraitNegative,
  sceneRequest,
  sheetRequest,
  sheetStages,
  startingScene,
} from "../packages/saucelings/src/engine/packages/client/src/features/saucelings/image-prompts.ts";
import {
  FORM_SIZES,
  blinkStrip,
  breathingFigure,
  contentBounds,
  creatureStrip,
  eggStrip,
  figureFromSheet,
  findEyes,
  fitToFrame,
  formFromPainting,
  formsFromSheet,
  keyOutBackground,
  quietRow,
  readSheet,
  reducePalette,
  sheetLayout,
  squashFrame,
  upscaleNearest,
  type Rgba,
} from "../packages/saucelings/src/engine/packages/client/src/features/saucelings/form-art.ts";
import {
  HOUSE_PHRASES,
  HOUSE_SIGNOFFS,
  spokenLine,
  templateAbsenceScene,
  templateCaretakerCareLine,
  templateCheckInLine,
  templateEggFarewellScene,
  templateEggFoundScene,
  templateEggFoundByOther,
  templateEggFoundWhileTalking,
  templateEggReturnScene,
  templateEvolveScene,
  templateFarewellScene,
  templateHatchScene,
  templateReturnScene,
  templateStageUpScene,
  templateTakesAfterScene,
  templateTemperamentShiftScene,
  templateUserActionLine,
} from "../packages/saucelings/src/engine/packages/shared/src/features/agents/saucelings/templates.ts";
import {
  cardPersona,
  extractReducedCard,
  normalizeCareProfile,
  normalizePhrasebook,
} from "../packages/saucelings/src/engine/packages/server/src/services/saucelings/care-profile.ts";
import {
  createEggFromCaretaker,
  rollSpeciesFromProfile,
} from "../packages/saucelings/src/engine/packages/server/src/services/saucelings/discovery.ts";
import {
  DAY_MS,
  METER_FLOOR,
  advance,
  applyCaretakerNudge,
  attentivenessMultiplier,
  checkIn,
  computeCareGaps,
  createSeededRng,
  evolveOfferDue,
  performUserAction,
} from "../packages/saucelings/src/engine/packages/server/src/services/saucelings/simulation.ts";
import {
  entryFromPet,
  restorePetFromMenagerie,
  retirePetToMenagerie,
} from "../packages/saucelings/src/engine/packages/server/src/services/saucelings/menagerie.ts";
import {
  evolutionLookOf,
  fallbackEvolutions,
  normalizeDesign,
  normalizeEvolutions,
  normalizeNature,
} from "../packages/saucelings/src/engine/packages/server/src/services/saucelings/design.ts";
import {
  eggFindChance,
  huntDecision,
  markChatDay,
} from "../packages/saucelings/src/engine/packages/server/src/services/saucelings/hunt.ts";
import {
  normalizeSaucelingSettings,
  normalizeSaucelingWorld,
} from "../packages/saucelings/src/engine/packages/server/src/services/saucelings/store.ts";
import {
  applyLines,
  reserveLines,
} from "../packages/saucelings/src/engine/packages/server/src/services/saucelings/words.ts";
import {
  availableSpecies,
  countCare,
  latchUnlocks,
  unlocksOf,
} from "../packages/saucelings/src/engine/packages/server/src/services/saucelings/unlocks.ts";
import {
  TAKE_AFTER_MS,
  applyCaretakerOutcomeToTemperament,
  evaluateTemperamentShift,
  ownTemperamentDue,
} from "../packages/saucelings/src/engine/packages/server/src/services/saucelings/temperament.ts";

const t0 = "2026-10-20T00:00:00.000Z";
const profile = neutralCareProfile("char-1", "Dottore", "digest-1");
profile.speciesLean = ["shellbini", "rigamuffin", "fluttino", "lentino"];
profile.temperamentLean = ["truffoddity", "seppy", "zesto", "carbonuzzle", "rabbratty", "alfredoze"];

/** What a writing connection might invent for a caretaker; normalizeDesign is checked on it below. */
const inkMothAnswer = () => ({
  kind: "ink moth",
  look: "A round moth with smudged grey wings and a feathery tail.",
  colours: ["indigo", "cream", "silver"],
  traits: ["quiet", "ink-stained", "curious"],
  quirk: "Leaves tiny blots on every page.",
  stages: {
    egg: "A speckled grey egg with an ink-blue swirl.",
    hatchling: "A tiny round moth with stubby wings.",
    juvenile: "A slim moth with growing smudged wings.",
    adult: "A moth with wide ink-blot wings and feathery antennae.",
    elder: "A frosty-winged moth with pale whiskers.",
  },
});
const inkMoth = normalizeDesign(inkMothAnswer(), "found")!;

// 1. Seeded RNG determinism
{
  const r1 = createSeededRng(42);
  const r2 = createSeededRng(42);
  assert.equal(r1.next(), r2.next());
  assert.equal(r1.next(), r2.next());
  assert.equal(r1.state(), r2.state());
}

// 2. Egg creation & hatching after wait + 1 care action; an egg takes egg care, a hatchling creature care
{
  const { pet: egg } = createEggFromCaretaker({ profile, nowIso: t0, seed: 7 });
  assert.equal(egg.stage, "egg");
  assert.equal(egg.temperament, "marinara");
  assert.equal(egg.name, SPECIES_CATALOG[egg.species].name);
  assert.equal(egg.meters.warmth, SAUCELING_EGG_START_WARMTH);
  assert.throws(() => performUserAction(egg, "feed", t0), /still an egg/u);

  // Action before 30m wait does not hatch yet
  const tEarly = "2026-10-20T00:10:00.000Z";
  const afterAction = performUserAction(egg, "warm", tEarly);
  assert.equal(afterAction.pet.stage, "egg");
  assert.equal(afterAction.pet.careActionCount, 1);
  assert.equal(afterAction.pet.meters.warmth, SAUCELING_EGG_START_WARMTH + 25);

  // Cooldown check: an immediate second warm fails; talking is its own button
  assert.throws(() => performUserAction(afterAction.pet, "warm", tEarly), /Wait \d+m/u);
  const talked = performUserAction(afterAction.pet, "talk", tEarly).pet;

  // Advance past 30m wait -> hatches into hatchling Marinara, as happy as its egg was warm
  const tHatch = "2026-10-20T01:00:00.000Z";
  const hatched = advance(talked, tHatch, { careWindowHours: 6 });
  assert.equal(hatched.pet.stage, "hatchling");
  assert.equal(hatched.pet.temperament, "marinara");
  assert.ok(hatched.events.some((e) => e.kind === "hatch"));
  assert.equal("warmth" in hatched.pet.meters, false);
  assert.equal(hatched.pet.meters.mood, 88);
  assert.throws(() => performUserAction(hatched.pet, "warm", tHatch), /already hatched/u);
}

// 3. Decay floors never kill the pet (floor at METER_FLOOR = 20)
{
  const neglectful = {
    ...profile,
    tendencies: {
      feedReliability: 0,
      overfeeding: 0,
      playfulness: 0,
      affection: 0,
      attentiveness: 0,
      consistency: 0,
    },
  };
  const { pet } = createEggFromCaretaker({ profile: neglectful, nowIso: t0, seed: 99 });
  // A neglected egg only cools: it stays an egg, its warmth floors, and nobody went hungry
  const tCold = "2026-10-25T00:00:00.000Z";
  const egg = advance(pet, tCold, { careWindowHours: 6 });
  assert.equal(egg.pet.stage, "egg");
  assert.equal(egg.pet.meters.warmth, METER_FLOOR);
  assert.ok((egg.events.find((e) => e.kind === "absence")?.tallies?.["let-cool"] ?? 0) >= 10);
  assert.deepEqual([computeCareGaps(egg.pet, tCold).warmth, computeCareGaps(egg.pet, tCold).hunger], [true, false]);

  // Warming it at last hatches a glum hatchling; then 5 more days (20 windows) -> collapses into an absence
  // event, meters floor at METER_FLOOR
  const hatchling = performUserAction(egg.pet, "warm", tCold).pet;
  assert.equal(hatchling.stage, "hatchling");
  assert.equal(hatchling.meters.mood, 63);
  const tLater = "2026-10-30T00:00:00.000Z";
  const res = advance(hatchling, tLater, { careWindowHours: 6 });
  assert.equal(res.pet.meters.hunger, METER_FLOOR);
  assert.equal(res.pet.meters.mood, METER_FLOOR);
  const absenceEv = res.events.find((e) => e.kind === "absence");
  assert.ok(absenceEv, "Elapsed > 24h collapses per-window rolls into one absence summary event");
  assert.equal(absenceEv.absenceBucket, "week");
  assert.ok((absenceEv.tallies?.forgot ?? 0) >= 10);

  const gaps = computeCareGaps(res.pet, tLater);
  assert.equal(gaps.hunger, true);
  assert.equal(gaps.mood, true);
  assert.equal(gaps.warmth, false);
}

// 3c. 0.14.0 care: the attentiveness multiplier, the 85 cap, the hunger gap, the meal count, and the per-hour pace
{
  const tendencies = (over: Partial<Record<string, number>>) => {
    const p = neutralCareProfile("char-care", "Steady");
    Object.assign(p.tendencies, {
      feedReliability: 0.5,
      overfeeding: 0,
      playfulness: 0,
      affection: 0,
      attentiveness: 0.5,
      consistency: 1,
      ...over,
    });
    return p;
  };
  const hatchling = (
    over: Partial<Record<string, number>>,
    meters: { hunger: number; mood: number; bond?: number },
  ) => {
    const egg = createEggFromCaretaker({ profile: tendencies(over), nowIso: t0, seed: 5 }).pet;
    return {
      ...egg,
      stage: "hatchling" as const,
      hatchedAt: t0,
      meters: { hunger: meters.hunger, mood: meters.mood, bond: meters.bond ?? 30 },
      mealRecord: [],
    };
  };
  const hoursLater = (h: number) => new Date(Date.parse(t0) + h * 3_600_000).toISOString();

  // Endpoints: distracted x0.7, average x1, attentive x1.8; 0.9 is x1.64
  assert.equal(attentivenessMultiplier(0), 0.7);
  assert.equal(attentivenessMultiplier(0.5), 1);
  assert.equal(attentivenessMultiplier(1), 1.8);
  assert.ok(Math.abs(attentivenessMultiplier(0.9) - 1.64) < 1e-9);

  // The caretaker's meals stop at 85, and a meter already above it is not pulled down by them
  {
    const fed = advance(hatchling({ feedReliability: 1 }, { hunger: 80, mood: 70 }), hoursLater(6), {
      careWindowHours: 6,
    }).pet;
    assert.ok(fed.meters.hunger <= 85, `caretaker meal stopped at 85, got ${fed.meters.hunger}`);
    assert.equal(fed.meters.hunger, 85, "80 - 12 + a meal reaches the cap and no more");
    const high = advance(hatchling({ feedReliability: 1 }, { hunger: 100, mood: 70 }), hoursLater(6), {
      careWindowHours: 6,
    }).pet;
    assert.equal(high.meters.hunger, 88, "100 - 12 decay; a meal does not lift or lower it");
    // The player's own Feed still goes past it
    assert.equal(performUserAction(fed, "feed", hoursLater(7)).pet.meters.hunger, 100);
  }

  // A Feed, or any meal the caretaker gives, ends the missed-meal count; later misses count again
  {
    const at = (h: number) => hoursLater(h);
    const forgot = (h: number) => ({
      id: `f-${h}`,
      kind: "caretaker-care" as const,
      createdAt: at(h),
      text: "",
      generated: false,
      outcome: "forgot" as const,
    });
    const fedEv = (h: number) => ({ ...forgot(h), id: `m-${h}`, outcome: "fed-fine" as const });
    const feedEv = {
      id: "u-5",
      kind: "user-care" as const,
      createdAt: at(5),
      action: "feed" as const,
      text: "",
      generated: false,
    };
    const base = hatchling({}, { hunger: 70, mood: 70 });
    const gapsOf = (journal: SaucelingPet["journal"]) =>
      computeCareGaps({ ...base, journal }, at(12)).missedMealsRecent;
    assert.equal(gapsOf([forgot(10), forgot(8), forgot(2), forgot(1)]), 4);
    assert.equal(gapsOf([forgot(10), forgot(8), feedEv, forgot(2), forgot(1)]), 2, "a Feed ends the count");
    assert.equal(gapsOf([forgot(10), fedEv(9), forgot(8), forgot(2)]), 1, "so does a caretaker meal");
    assert.equal(computeCareGaps({ ...base, journal: [feedEv, forgot(2), forgot(1)] }, at(12)).hunger, false);
  }

  // The meal count: every meal turn counts, a given meal counts once, and hatching starts it over
  {
    const day = advance(hatchling({ feedReliability: 1 }, { hunger: 60, mood: 60 }), hoursLater(18), {
      careWindowHours: 6,
    }).pet;
    assert.deepEqual(computeCareGaps(day, hoursLater(18)).meals, { given: 3, total: 3 });
    const none = advance(hatchling({ feedReliability: 0 }, { hunger: 60, mood: 60 }), hoursLater(18), {
      careWindowHours: 6,
    }).pet;
    assert.deepEqual(computeCareGaps(none, hoursLater(18)).meals, { given: 0, total: 3 });
    assert.deepEqual(computeCareGaps(day, hoursLater(18 + 24 * 8)).meals, { given: 0, total: 0 }, "a week old is gone");

    const cold = createEggFromCaretaker({ profile: tendencies({ feedReliability: 0 }), nowIso: t0, seed: 7 }).pet;
    const waiting = advance(cold, hoursLater(12), { careWindowHours: 6 }).pet;
    assert.equal(waiting.stage, "egg");
    assert.deepEqual(computeCareGaps(waiting, hoursLater(12)).meals, { given: 0, total: 2 });
    const hatched = performUserAction(waiting, "warm", hoursLater(13)).pet;
    assert.equal(hatched.stage, "hatchling");
    assert.deepEqual(hatched.mealRecord, []);
  }

  // A catch-up never runs past 14 days of turns
  {
    const gone = advance(hatchling({}, { hunger: 60, mood: 60 }), hoursLater(24 * 30), { careWindowHours: 6 });
    assert.equal(gone.events.find((e) => e.kind === "absence")?.windowsElapsed, 56);
    assert.equal(gone.pet.lastTickAt, hoursLater(24 * 30));
  }

  // A clock set back leaves lastTickAt ahead of now; it is clamped to now, so care still moves the meters later
  {
    const ahead = { ...hatchling({ feedReliability: 0 }, { hunger: 70, mood: 70 }), lastTickAt: hoursLater(1) };
    const clamped = advance(ahead, t0, { careWindowHours: 6 });
    assert.equal(clamped.pet.lastTickAt, t0);
    assert.deepEqual(clamped.events, []);
    assert.ok(advance(clamped.pet, hoursLater(7), { careWindowHours: 6 }).pet.meters.hunger < 70);
  }

  // The pace is per hour: one-hour turns give the same day as six-hour turns, on average (started well below the 85 cap, which clips lifts differently when they come one at a time)
  {
    const stats = (windowHours: number) => {
      let given = 0;
      let forgot = 0;
      let hunger = 0;
      let mood = 0;
      const seeds = 300;
      for (let seed = 1; seed <= seeds; seed++) {
        const res = advance(
          hatchling({ feedReliability: 0.6, playfulness: 0.6, affection: 0.5 }, { hunger: 50, mood: 50 }),
          hoursLater(18),
          { careWindowHours: windowHours },
          createSeededRng(seed),
        );
        const gaps = computeCareGaps(res.pet, hoursLater(18));
        given += gaps.meals.given;
        forgot += res.events.filter((e) => e.outcome === "forgot").length;
        hunger += res.pet.meters.hunger;
        mood += res.pet.meters.mood;
      }
      return { given: given / seeds, forgot: forgot / seeds, hunger: hunger / seeds, mood: mood / seeds };
    };
    const six = stats(6);
    const one = stats(1);
    assert.ok(Math.abs(six.given - one.given) < 0.35, `meals given ${six.given} vs ${one.given}`);
    assert.ok(Math.abs(six.forgot - one.forgot) < 0.35, `meals forgotten ${six.forgot} vs ${one.forgot}`);
    assert.ok(Math.abs(six.hunger - one.hunger) < 3, `hunger ${six.hunger} vs ${one.hunger}`);
    assert.ok(Math.abs(six.mood - one.mood) < 3, `mood ${six.mood} vs ${one.mood}`);
  }

  // An attentive caretaker cares more often than a distracted one with the same card
  {
    const given = (attentiveness: number) => {
      let total = 0;
      for (let seed = 1; seed <= 200; seed++) {
        const res = advance(
          hatchling({ feedReliability: 0.5, attentiveness }, { hunger: 60, mood: 60 }),
          hoursLater(18),
          { careWindowHours: 6 },
          createSeededRng(seed),
        );
        total += computeCareGaps(res.pet, hoursLater(18)).meals.given;
      }
      return total / 200;
    };
    const [distracted, average, attentive] = [given(0), given(0.5), given(1)];
    assert.ok(distracted < average - 0.3 && average < attentive - 0.5, `${distracted} < ${average} < ${attentive}`);
  }
}

// 3d. 0.15.0 growth: a pet grows only while it is fed enough, and the stage follows the time it spent growing
{
  const egg = createEggFromCaretaker({ profile, nowIso: t0, seed: 5 }).pet;
  const grower = (over: Partial<SaucelingPet>, hunger: number, reliability: number) => ({
    ...egg,
    stage: "hatchling" as const,
    hatchedAt: t0,
    meters: { hunger, mood: 70, bond: 50 },
    careProfile: {
      ...egg.careProfile,
      tendencies: { ...egg.careProfile.tendencies, feedReliability: reliability, overfeeding: 0 },
    },
    ...over,
  });
  const hoursLater = (h: number) => new Date(Date.parse(t0) + h * 3_600_000).toISOString();
  const HOURS = 3_600_000;

  // Fed all day, it grows all day
  const fed = advance(grower({}, 100, 1), hoursLater(24), { careWindowHours: 6 }).pet;
  assert.equal(fed.growthMs, 24 * HOURS);

  // A pet nobody feeds stops growing once its hunger falls below 35, and stays stopped
  const starved = advance(grower({}, 80, 0), hoursLater(48), { careWindowHours: 6 }).pet;
  assert.ok(starved.meters.hunger < 35);
  assert.ok(starved.growthMs > 12 * HOURS && starved.growthMs < 26 * HOURS, `grew ${starved.growthMs / HOURS} h`);
  assert.equal(advance(starved, hoursLater(96), { careWindowHours: 6 }).pet.growthMs, starved.growthMs);

  // The same is true by the hour as by the 6 hour
  const byHour = advance(grower({}, 80, 0), hoursLater(48), { careWindowHours: 1 }).pet;
  assert.ok(
    Math.abs(byHour.growthMs - starved.growthMs) < 3 * HOURS,
    `${byHour.growthMs / HOURS} vs ${starved.growthMs / HOURS}`,
  );

  // The stage follows growing time, not the time since the egg: old but small stays a hatchling, and 18 h grown is a juvenile
  const small = advance(
    grower({ createdAt: "2026-10-01T00:00:00.000Z", growthMs: 10 * HOURS }, 100, 1),
    hoursLater(6),
    {
      careWindowHours: 6,
    },
  ).pet;
  assert.equal(small.stage, "hatchling");
  assert.equal(small.growthMs, 16 * HOURS);
  const grown = advance(grower({ growthMs: 13 * HOURS }, 100, 1), hoursLater(6), { careWindowHours: 6 }).pet;
  assert.equal(grown.stage, "juvenile");

  // An egg does not grow, and hatching starts the count
  const eggLater = advance(egg, hoursLater(12), { careWindowHours: 6 }).pet;
  assert.equal(eggLater.growthMs, 0);

  // A pet saved before growth was kept counts its age so far, in the nook and in the Menagerie, so no one shrinks back
  const old = {
    ...grower({ createdAt: "2026-10-18T00:00:00.000Z", lastTickAt: "2026-10-20T00:00:00.000Z" }, 90, 1),
  } as Record<string, unknown>;
  delete old.growthMs;
  const kept = retirePetToMenagerie(
    { ...grower({ createdAt: "2026-10-18T00:00:00.000Z" }, 90, 1) },
    "2026-10-19T00:00:00.000Z",
  ).entry as unknown as Record<string, unknown>;
  delete kept.growthMs;
  const world = normalizeSaucelingWorld(
    JSON.parse(JSON.stringify({ schemaVersion: 1, activePet: old, menagerie: [kept] })),
  );
  assert.equal(world.activePet!.growthMs, 2 * 24 * HOURS);
  assert.equal(world.menagerie[0].growthMs, 24 * HOURS);

  // An early retiree comes back with the growth it had; its hatching clock is not touched
  const left = retirePetToMenagerie(grower({ growthMs: 30 * HOURS }, 90, 1), hoursLater(30)).entry;
  const back = restorePetFromMenagerie(left, undefined, hoursLater(300)).pet;
  assert.equal(back.growthMs, 30 * HOURS);
  assert.equal(back.createdAt, left.createdAt);
}

// 3b. Nothing written while it is an egg names what will hatch; Listen gives each species its own hint
{
  for (const [seed, hours] of [
    [1, 18],
    [2, 72],
  ] as const) {
    const { pet: egg, event: found } = createEggFromCaretaker({ profile, nowIso: t0, seed });
    const species = SPECIES_CATALOG[egg.species].name.toLowerCase();
    const ticked = advance(egg, new Date(Date.parse(t0) + hours * 3_600_000).toISOString(), { careWindowHours: 6 });
    // Events come newest first. A well-kept egg may hatch at the end of the advance, and the hatch scene
    // and what follows it may name it.
    const eggEvents = ticked.events.slice(ticked.events.findIndex((e) => e.kind === "hatch") + 1);
    const texts = [found.text, ...eggEvents.map((e) => e.text)];
    let cared = egg;
    for (const action of ["warm", "talk", "listen"] as const) {
      const step = performUserAction(cared, action, "2026-10-20T00:05:00.000Z");
      cared = step.pet;
      texts.push(...step.events.map((e) => e.text));
    }
    texts.push(checkIn(cared, "2026-10-20T00:06:00.000Z").event.text);
    assert.ok(texts.length >= 6, `seed ${seed} wrote ${texts.length} egg lines`);
    for (const text of texts) assert.equal(text.toLowerCase().includes(species), false, text);
  }
  const hints = new Set(SAUCELING_SPECIES.map((species) => templateUserActionLine({ name: "Egg", species }, "listen")));
  assert.equal(hints.size, SAUCELING_SPECIES.length);
}

// 3c. Check in puts the caretaker's line on top of the Journal
{
  const { pet } = createEggFromCaretaker({ profile, nowIso: t0, seed: 8 });
  const checked = checkIn(pet, "2026-10-20T00:20:00.000Z");
  assert.equal(checked.pet.journal[0], checked.event);
  assert.equal(checked.event.kind, "check-in");
  assert.equal(checked.pet.journal.length, pet.journal.length + 1);
}

// 3d. The caretaker's lines are their own words: no quotation marks, never their own name (that would be
// narration), and an egg's lines never name what will hatch
{
  const dottore = neutralCareProfile("dottore-1", "Il Dottore");
  const fed = { name: "Biscotti", meters: { hunger: 80, mood: 80, bond: 50 } };
  const eggLines = [
    templateEggFoundScene(dottore),
    templateEggFoundScene(dottore, true),
    templateEggFoundWhileTalking(dottore, { name: "Biscotti", stage: "egg" }),
    templateCaretakerCareLine(dottore, "Biscotti", "kept-warm"),
    templateCaretakerCareLine(dottore, "Biscotti", "let-cool"),
    templateCaretakerCareLine(dottore, "Biscotti", "chatted"),
    templateCheckInLine(dottore, { ...fed, stage: "egg" }),
    templateAbsenceScene(dottore, "Biscotti", "days", { "kept-warm": 3, "let-cool": 1, chatted: 2 }, true),
    templateEggFarewellScene(dottore),
    templateEggReturnScene(dottore),
  ];
  const lines = [
    ...eggLines,
    templateHatchScene(dottore, "Shellbini"),
    templateEvolveScene(dottore, "Biscotti", "Ember Lentino"),
    ...(["fed-fine", "fed-badly", "overfed", "forgot", "played", "cuddled", "milestone-noticed"] as const).map(
      (outcome) => templateCaretakerCareLine(dottore, "Biscotti", outcome),
    ),
    templateCheckInLine(dottore, { ...fed, stage: "adult" }),
    templateCheckInLine(dottore, { ...fed, stage: "adult", meters: { hunger: 30, mood: 80, bond: 50 } }),
    templateCheckInLine(dottore, { ...fed, stage: "adult", meters: { hunger: 80, mood: 30, bond: 50 } }),
    templateStageUpScene(dottore, "Biscotti", "juvenile"),
    templateTemperamentShiftScene(dottore, "Biscotti", "zesto"),
    templateAbsenceScene(dottore, "Biscotti", "week", { "fed-fine": 3, forgot: 1, played: 2, cuddled: 1 }, false),
    templateFarewellScene(dottore, "Biscotti"),
    templateReturnScene(dottore, "Biscotti", "elder"),
  ];
  for (const line of lines) {
    assert.equal(/["“”]/u.test(line), false, line);
    assert.equal(line.includes("Dottore"), false, line);
  }
  for (const line of eggLines) {
    for (const species of SAUCELING_SPECIES) assert.equal(line.toLowerCase().includes(species), false, line);
    assert.equal(line.includes("Biscotti"), false, line);
  }
  assert.equal(
    templateReturnScene(dottore, "Biscotti", "elder"),
    "Welcome back, little dumpling! Still a fine elder, I see.",
  );
  assert.equal(
    templateAbsenceScene(
      dottore,
      "Biscotti",
      "day",
      { "fed-fine": 2, overfed: 1, forgot: 1, played: 2, cuddled: 1 },
      false,
    ),
    "You're back! While you were away I fed Biscotti 3 times but forgot 1 meal, played with them twice and gave 1 cuddle.",
  );

  // One-off scenes turn through their lines, so the same moment does not read the same every time
  const varies = (line: (pick: number) => string) =>
    assert.ok(new Set(Array.from({ length: 12 }, (_, pick) => line(pick))).size >= 3, line(0));
  varies((pick) => templateEggFoundScene(dottore, false, pick));
  varies((pick) => templateEggFoundScene(dottore, true, pick));
  varies((pick) => templateEvolveScene(dottore, "Biscotti", "Ember Lentino", pick));
  varies((pick) => templateTemperamentShiftScene(dottore, "Biscotti", "zesto", pick));
  varies((pick) => templateTakesAfterScene(dottore, "Biscotti", "Quietly Curious", pick));
  varies((pick) => templateAbsenceScene(dottore, "Biscotti", "week", { played: 1 }, false, pick));
  varies((pick) => templateEggFarewellScene(dottore, pick));
  varies((pick) => templateEggReturnScene(dottore, pick));
  varies((pick) => templateReturnScene(dottore, "Biscotti", "elder", pick));

  // A model's line keeps only what is said
  assert.equal(spokenLine("“Il Dottore: Still warm, still quiet.”", "Il Dottore"), "Still warm, still quiet.");
  assert.equal(spokenLine('Dottore: *adjusts glasses* "Eat."', "Il Dottore"), "Eat.");
  assert.equal(spokenLine('"Eat," he said. "Now."', "Il Dottore"), '"Eat," he said. "Now."');

  // The caretaker's phrasebook speaks for the routine moments, in turn; an egg is "little egg"
  const voiced = {
    ...dottore,
    voice: {
      ...dottore.voice,
      phrases: { feed: ["Eat, {pet}. Data requires it.", "Supper, {pet}."], warmEgg: ["Stay warm, {pet}."] },
    },
  };
  assert.equal(templateCaretakerCareLine(voiced, "Biscotti", "fed-fine", 0), "Eat, Biscotti. Data requires it.");
  assert.equal(templateCaretakerCareLine(voiced, "Biscotti", "fed-fine", 1), "Supper, Biscotti.");
  assert.equal(
    templateCaretakerCareLine(voiced, "Shellbini", "kept-warm", 7),
    "Stay warm, little egg. Try not to make a mess of the nook.",
  );
  // A moment the phrasebook leaves out falls back to the house line
  assert.equal(
    templateCaretakerCareLine(voiced, "Biscotti", "played"),
    templateCaretakerCareLine(dottore, "Biscotti", "played"),
  );
  assert.equal(
    templateCaretakerCareLine(voiced, "Biscotti", "played"),
    HOUSE_PHRASES.play[0].replace("{pet}", "Biscotti"),
  );
  // ...and so do the one-off moments, with their own {...} filled in
  const sceneVoiced = {
    ...dottore,
    voice: {
      ...dottore.voice,
      phrases: {
        returnHome: ["Back on my table, {pet}. Still a {stage}."],
        eggFoundByOther: ["{finder} found an egg. {pet} will have to share."],
      },
    },
  };
  assert.equal(templateReturnScene(sceneVoiced, "Biscotti", "elder"), "Back on my table, Biscotti. Still an elder.");
  assert.equal(
    templateEggFoundByOther(sceneVoiced, { name: "Biscotti", stage: "adult" }, "Nahida", 1),
    "Nahida found an egg. Biscotti will have to share.",
  );
  assert.equal(templateFarewellScene(sceneVoiced, "Biscotti", 1), templateFarewellScene(dottore, "Biscotti", 1));

  // {kind}, {stage} and {nickname} are filled in
  assert.equal(
    templateHatchScene(dottore, "Shellbini", "Bo", 3),
    "It's hatched! A Shellbini, and a tidy hatch it was too. I'll call you Bo.",
  );
  // "a" before a filled-in word that starts with a vowel becomes "an"; "a little {kind}" stays
  assert.match(templateHatchScene(dottore, "Inkling", "Bo", 3), /^It's hatched! An Inkling, and a tidy hatch/u);
  assert.match(
    templateHatchScene(dottore, "Inkling", "Bo", 0),
    /^It's hatching! Come and look, it's a little Inkling!/u,
  );
  assert.equal(
    templateStageUpScene(
      { ...dottore, voice: { ...dottore.voice, petNickname: "specimen" } },
      "Biscotti",
      "juvenile",
      1,
    ),
    "Biscotti is on to the juvenile stage now. Well done, specimen.",
  );

  // A sign-off fits the moment's feeling, comes on about one line in four, and the same pick gives the same line
  const signedWith = (line: string, base: string, pool: readonly string[]) =>
    line === base || pool.some((tag) => line === `${base} ${tag}`);
  const hungry = { ...fed, stage: "adult" as const, meters: { hunger: 30, mood: 80, bond: 50 } };
  const hungryLines = Array.from({ length: 16 }, (_, pick) => templateCheckInLine(dottore, hungry, pick));
  assert.ok(hungryLines.some((line) => HOUSE_SIGNOFFS.worried.some((tag) => line.endsWith(` ${tag}`))));
  assert.ok(
    hungryLines.some((line) => HOUSE_PHRASES.checkInHungry.some((base) => line === base.replace("{pet}", "Biscotti"))),
  );
  for (const [pick, line] of hungryLines.entries()) {
    assert.ok(
      HOUSE_PHRASES.checkInHungry.some((base) =>
        signedWith(line, base.replace("{pet}", "Biscotti"), HOUSE_SIGNOFFS.worried),
      ),
      line,
    );
    assert.equal(templateCheckInLine(dottore, hungry, pick), line);
  }
  // Their own sign-offs replace the house ones
  const tagged = { ...voiced, voice: { ...voiced.voice, signoffs: { pleased: ["For science."] } } };
  const fedLines = Array.from({ length: 16 }, (_, pick) =>
    templateCaretakerCareLine(tagged, "Biscotti", "fed-fine", pick),
  );
  assert.ok(fedLines.some((line) => line.endsWith(" For science.")));
  assert.ok(fedLines.every((line) => !HOUSE_SIGNOFFS.pleased.some((tag) => line.endsWith(tag))));
  assert.ok(hungryLines.filter((line) => line.split(". ").length > 2).length <= 8);
  // A voice the model made before sign-offs gets none, so its catchphrases are not worn out as tags
  const older = { ...voiced, generatedByModel: true };
  assert.ok(
    Array.from({ length: 16 }, (_, pick) => templateCaretakerCareLine(older, "Shellbini", "kept-warm", pick)).every(
      (line) => line === "Stay warm, little egg.",
    ),
  );
  assert.ok(
    Array.from({ length: 16 }, (_, pick) => templateCaretakerCareLine(older, "Biscotti", "fed-fine", pick)).every(
      (line) => voiced.voice.phrases.feed!.some((base) => line === base.replace("{pet}", "Biscotti")),
    ),
  );
}

// 3e. Every line the caretaker says carries their name; the player's own care does not
{
  const dottore = neutralCareProfile("dottore-1", "Il Dottore");
  const { pet: egg, event: found } = createEggFromCaretaker({ profile: dottore, nowIso: t0, seed: 3 });
  const warmed = performUserAction(egg, "warm", "2026-10-20T00:05:00.000Z");
  assert.equal(warmed.events[0].speaker, undefined);
  const hatched = advance(warmed.pet, "2026-10-20T01:00:00.000Z", { careWindowHours: 6 });
  const later = advance({ ...hatched.pet, name: "Biscotti" }, "2026-10-20T19:00:00.000Z", { careWindowHours: 6 });
  const away = advance(later.pet, "2026-10-23T19:00:00.000Z", { careWindowHours: 6 });
  const said = [
    found,
    ...hatched.events,
    ...later.events,
    ...away.events,
    checkIn(away.pet, "2026-10-23T19:01:00.000Z").event,
  ];
  assert.ok(said.some((e) => e.kind === "hatch") && said.some((e) => e.kind === "absence"));
  assert.ok(said.some((e) => e.kind === "caretaker-care"));
  for (const e of said) assert.equal(e.speaker, "Il Dottore", `${e.kind}: ${e.text}`);
  const { entry, farewellEvent } = retirePetToMenagerie(away.pet, "2026-10-23T20:00:00.000Z");
  assert.equal(farewellEvent.speaker, "Il Dottore");
  assert.equal(restorePetFromMenagerie(entry, undefined, "2026-10-24T00:00:00.000Z").returnEvent.speaker, "Il Dottore");
  // Brought back to someone else, the pet is theirs and so is the line it comes back to
  const handed = restorePetFromMenagerie(entry, undefined, "2026-10-24T00:00:00.000Z", {
    id: "nahida-2",
    profile: { ...entry.careProfile, characterName: "Nahida" },
  });
  assert.equal(handed.pet.caretakerId, "nahida-2");
  assert.equal(handed.pet.careProfile.characterName, "Nahida");
  assert.equal(handed.returnEvent.speaker, "Nahida");
}

// 3f. The caretaker's whole card is read: backstory, instructions and example dialogue each under its own
// label, with {{char}} and {{user}} filled in; a personality edit changes the digest, so the profile rebuilds
{
  const card = (personality: string) => ({
    id: "dottore-1",
    comment: "",
    data: {
      spec: "chara_card_v2",
      data: {
        name: "Il Dottore",
        description: "Harbinger scholar.",
        personality,
        scenario: "A lab in Sumeru.",
        system_prompt: "Write {{char}} as dry and exacting.",
        post_history_instructions: "",
        mes_example: "<START>\n{{user}}: Is it hurt?\n{{char}}: Hold still. This will only sting a little.",
        first_mes: "",
        alternate_greetings: ["Ah, {{user}}. You're late."],
        creator_notes: "",
        tags: ["genshin"],
        extensions: { backstory: "Second of the Fatui Harbingers.", depth_prompt: { prompt: "Stay clinical." } },
      },
    },
  });
  const reduced = extractReducedCard(card("cold genius"));
  for (const expected of [
    "Personality: cold genius",
    "Backstory: Second of the Fatui Harbingers.",
    "System prompt: Write Il Dottore as dry and exacting.",
    "Depth prompt: Stay clinical.",
    "Example dialogue: the player: Is it hurt? Il Dottore: Hold still. This will only sting a little.",
    "First message: Ah, the player. You're late.",
  ]) {
    assert.ok(reduced.summaryText.includes(expected), `${expected}\n---\n${reduced.summaryText}`);
  }
  assert.equal(/\{\{(char|user)\}\}/u.test(reduced.summaryText), false);
  assert.notEqual(extractReducedCard(card("warm, motherly")).cardDigest, reduced.cardDigest);
  const persona = cardPersona(card("cold genius"));
  assert.match(persona.who, /^Personality: cold genius\n/u);
  assert.match(persona.who, /Backstory: Second of the Fatui/u);
  assert.match(persona.talk, /^Example dialogue: .*Hold still/u);

  // The profile keeps a speech style and short, spoken catchphrases, only its own: what the model leaves out stays
  // empty rather than taking the house's words; the phrasebook is its own call
  const normal = normalizeCareProfile(
    {
      voice: {
        speechStyle: "Clipped and clinical.",
        catchphrases: ['"Fascinating."', "*sighs*", "x".repeat(130)],
        phrases: { feed: ["Eat, {pet}."] },
      },
    },
    "dottore-1",
    "Il Dottore",
    reduced.cardDigest,
    true,
  );
  assert.equal(normal.voice.speechStyle, "Clipped and clinical.");
  assert.deepEqual(normal.voice.phrases, {});
  assert.deepEqual(normal.voice.catchphrases, ["Fascinating."]);
  assert.equal(normal.voice.petNickname, "");
  assert.equal(normal.voice.voiceSample, "");

  // The phrasebook keeps at most four short, spoken lines for each of its moments, using only the {...} that moment
  // fills in, and three short sign-offs per feeling with none; a moment with no line is left out
  const book = normalizePhrasebook(
    {
      phrases: {
        feed: ["*sets down a tray* Eat, {pet}.", "One, {nickname}.", "Two.", "Three.", "Four."],
        play: ["x".repeat(121), "Run, {kind}.", "Run, {pet}."],
        hatch: ["A {kind}, {pet}.", "A {stage}."],
        stageUp: ["Now a {stage}.", "{}"],
        cuddle: "not a list",
        checkInHungry: ["The model does not write this one."],
        bogus: ["ignored"],
      },
      signoffs: { pleased: ["Good.", "Fine.", "Adequate.", "Acceptable."], worried: ["Hm, {pet}.", "x".repeat(61)] },
    },
    "Il Dottore",
    SAUCELING_ROUTINE_MOMENTS,
  );
  assert.deepEqual(book.phrases, {
    feed: ["Eat, {pet}.", "One, {nickname}.", "Two.", "Three."],
    play: ["Run, {pet}."],
    hatch: ["A {kind}, {pet}."],
    stageUp: ["Now a {stage}."],
  });
  assert.deepEqual(book.signoffs, { pleased: ["Good.", "Fine.", "Adequate."], worried: [], neutral: [] });
}

// 4. Temperament scoring with margin and 1-day hysteresis
{
  const { pet: egg } = createEggFromCaretaker({ profile, nowIso: t0, seed: 12 });
  const hatched = performUserAction(egg, "warm", "2026-10-20T01:00:00.000Z").pet;
  assert.equal(hatched.stage, "hatchling");

  // Pump carbonuzzle heavily via cuddles
  let vec = hatched.temperamentVector;
  for (let i = 0; i < 6; i++) {
    vec = applyCaretakerOutcomeToTemperament(vec, "cuddled", 0.9);
  }
  const candidate = { ...hatched, temperamentVector: vec };

  // Within 24h of last shift: hysteresis blocks switch
  const tooSoonMs = Date.parse("2026-10-20T12:00:00.000Z");
  assert.equal(evaluateTemperamentShift(candidate, tooSoonMs), null);

  // After 24h: switches to carbonuzzle
  const afterDayMs = Date.parse("2026-10-21T02:00:00.000Z");
  assert.equal(evaluateTemperamentShift(candidate, afterDayMs), "carbonuzzle");
}

// 5. Nudges apply a 48h tendency boost
{
  const { pet } = createEggFromCaretaker({ profile, nowIso: t0, seed: 5 });
  const nudged = applyCaretakerNudge(pet, "feedReliability", t0);
  assert.equal(nudged.pet.nudges.length, 1);
  assert.equal(nudged.pet.nudges[0].tendency, "feedReliability");
}

// 6. Stage thresholds, elder retire-ready timing, and Menagerie bring-back stage lock
{
  const { pet: egg } = createEggFromCaretaker({ profile, nowIso: t0, seed: 21 });
  let pet = performUserAction(egg, "warm", "2026-10-20T01:00:00.000Z").pet;
  pet = { ...pet, meters: { hunger: 80, mood: 85, bond: 75 } };

  // Advance through juvenile -> adult -> elder
  pet = advance(pet, "2026-10-21T00:00:00.000Z", { careWindowHours: 6 }).pet;
  assert.equal(pet.stage, "juvenile");
  pet = advance(pet, "2026-10-23T00:00:00.000Z", { careWindowHours: 6 }).pet;
  assert.equal(pet.stage, "adult");
  pet = advance(pet, "2026-10-27T00:00:00.000Z", { careWindowHours: 6 }).pet;
  assert.equal(pet.stage, "elder");
  assert.equal(pet.retireReady, false);

  // 3 days after reaching elder -> retireReady = true
  pet = advance(pet, "2026-10-30T06:00:00.000Z", { careWindowHours: 6 }).pet;
  assert.equal(pet.retireReady, true);

  // Retire to the Menagerie and bring back locked at juvenile
  const { entry } = retirePetToMenagerie(pet, "2026-10-30T07:00:00.000Z");
  assert.equal(entry.reachedElder, true);

  const { pet: broughtBack } = restorePetFromMenagerie(entry, "juvenile", "2026-10-30T08:00:00.000Z");
  assert.equal(broughtBack.stage, "juvenile");
  assert.equal(broughtBack.lockedStage, "juvenile");

  // Further time advances keep the stage locked at juvenile
  const afterMoreDays = advance(broughtBack, "2026-11-10T00:00:00.000Z", { careWindowHours: 6 }).pet;
  assert.equal(afterMoreDays.stage, "juvenile");
  assert.equal(afterMoreDays.lockedStage, "juvenile");
}

// 6b. An early retiree returns at the stage it left; Menagerie time does not count as growing up
{
  const { pet: egg } = createEggFromCaretaker({ profile, nowIso: t0, seed: 3 });
  let pet = performUserAction(egg, "warm", "2026-10-20T01:00:00.000Z").pet;
  pet = advance(pet, "2026-10-21T06:00:00.000Z", { careWindowHours: 6 }).pet;
  pet = { ...pet, meters: { ...pet.meters, bond: 70 } };
  assert.equal(pet.stage, "juvenile");
  const { entry } = retirePetToMenagerie(pet, "2026-10-21T06:00:00.000Z");
  assert.equal(entry.reachedElder, false);
  const { pet: back } = restorePetFromMenagerie(entry, undefined, "2026-11-04T06:00:00.000Z");
  assert.equal(back.stage, "juvenile");
  assert.equal(advance(back, "2026-11-04T12:00:00.000Z", { careWindowHours: 6 }).pet.stage, "juvenile");
}

// 6b. The Menagerie's sections run eldest first and keep the list's order; an elder locked at adult is an elder
{
  const entry = (id: string, stageAtRetirement: SaucelingStage, reachedElder = false) => ({
    id,
    stageAtRetirement,
    reachedElder,
  });
  const sections = menagerieSections([
    entry("egg", "egg"),
    entry("locked", "adult", true),
    entry("h1", "hatchling"),
    entry("elder", "elder", true),
    entry("h2", "hatchling"),
  ]);
  assert.deepEqual(
    sections.map((section) => [section.stage, section.entries.map((each) => each.id)]),
    [
      ["elder", ["locked", "elder"]],
      ["hatchling", ["h1", "h2"]],
      ["egg", ["egg"]],
    ],
  );
  assert.deepEqual(menagerieSections([]), []);
}

// 6d. A Menagerie entry keeps its farewell and life story first, then the latest care lines, 24 in all
{
  const { pet: egg } = createEggFromCaretaker({ profile, nowIso: t0, seed: 4 });
  const careLines = Array.from({ length: 70 }, (_, i) => ({
    id: `care-${i}`,
    kind: "caretaker-care" as const,
    createdAt: t0,
    text: "fed",
    generated: false,
  }));
  const story = ["stage-up", "hatch", "egg-found"].map((kind) => ({
    id: kind,
    kind: kind as "stage-up" | "hatch" | "egg-found",
    createdAt: t0,
    text: kind,
    generated: false,
  }));
  const { entry } = retirePetToMenagerie({ ...egg, journal: [...careLines, ...story] }, "2026-10-30T07:00:00.000Z");
  assert.equal(entry.journal.length, 24);
  assert.equal(entry.journal[0].kind, "farewell");
  assert.deepEqual(
    entry.journal.slice(-3).map((ev) => ev.id),
    ["stage-up", "hatch", "egg-found"],
  );
  assert.equal(entry.journal[1].id, "care-0");
}

// 6e. A broken or repeated background library entry is dropped, and the list is newest first
{
  const { pet } = createEggFromCaretaker({ profile, nowIso: t0, seed: 9 });
  const { entry } = retirePetToMenagerie({ ...pet, id: "old-2", createdAt: "2026-10-18T00:00:00.000Z" }, t0);
  const world = normalizeSaucelingWorld(
    JSON.parse(
      JSON.stringify({
        schemaVersion: 1,
        activePet: { ...pet, backgroundId: "bg-pet" },
        menagerie: [{ ...entry, backgroundId: "bg-kept" }],
        backgrounds: [
          { id: "bg-kept", label: " sunny ", source: "generated", savedAt: "2026-10-21T00:00:00.000Z" },
          { id: "bg-kept", label: "again", source: "upload", savedAt: "2026-10-22T00:00:00.000Z" },
          { id: "", label: "no id", source: "upload", savedAt: "2026-10-22T00:00:00.000Z" },
          { id: "bg-undated", label: "no date", source: "upload" },
        ],
      }),
    ),
  );
  assert.deepEqual(
    world.backgrounds.map((b) => [b.id, b.label, b.source, b.savedAt]),
    [["bg-kept", "sunny", "generated", "2026-10-21T00:00:00.000Z"]],
  );
  assert.deepEqual(normalizeSaucelingWorld(JSON.parse(JSON.stringify(world))), world);
}

// 6c. A cold, attentive caretaker grows a pasta sauceling into a Truffoddity, and leaves one that is not pasta with
// the sauce it started with (its temperament is its own); a caretaker with no card lean rolls species evenly
{
  const cold = neutralCareProfile("char-2", "Cold Genius");
  Object.assign(cold.tendencies, {
    feedReliability: 0.4,
    overfeeding: 0.25,
    playfulness: 0.2,
    affection: 0.12,
    attentiveness: 0.9,
    consistency: 0.85,
  });
  const finals: string[] = [];
  for (let seed = 1; seed <= 80; seed++) {
    const egg = createEggFromCaretaker({ profile: cold, nowIso: t0, seed }).pet;
    let pet = performUserAction(egg, "warm", "2026-10-20T01:00:00.000Z").pet;
    for (let day = 1; day <= 10; day++) {
      pet = advance(pet, new Date(Date.parse(t0) + day * 86_400_000).toISOString(), { careWindowHours: 6 }).pet;
    }
    if (isPasta(pet)) finals.push(pet.temperament);
    else assert.equal(pet.temperament, egg.temperament, `${pet.species} kept its sauce`);
  }
  assert.ok(finals.length >= 10, `pasta among 80 eggs: ${finals.length}`);
  assert.ok(
    finals.filter((id) => id === "truffoddity").length >= finals.length * 0.6,
    `cold caretaker temperaments: ${finals}`,
  );

  const counts: Record<string, number> = {};
  const rng = createSeededRng(7);
  for (let i = 0; i < 2000; i++) {
    const species = rollSpeciesFromProfile(neutralCareProfile("char-3", "Plain"), rng);
    counts[species] = (counts[species] ?? 0) + 1;
  }
  // A neutral profile draws evenly from the ordinary species only (2000 / 9 is about 222 each).
  for (const count of Object.values(counts)) assert.ok(count > 170 && count < 280, JSON.stringify(counts));
  assert.deepEqual(Object.keys(counts).sort(), [...ORDINARY_SPECIES].sort());
}

// 6e. Every UI string key the client uses has English text, and en.json carries no unused keys
{
  const clientRoot = new URL(
    "../packages/saucelings/src/engine/packages/client/src/features/saucelings/",
    import.meta.url,
  );
  const english = JSON.parse(readFileSync(new URL("locales/en.json", clientRoot), "utf8"));
  const used = new Set<string>();
  for (const file of readdirSync(clientRoot).filter((name) => /\.tsx?$/u.test(name))) {
    for (const match of readFileSync(new URL(file, clientRoot), "utf8").matchAll(
      /["'](saucelings\.[A-Za-z0-9_.-]+)["']/gu,
    )) {
      used.add(match[1]);
    }
  }
  // Keys the views build from a value: t(`saucelings.stage.${stage}`) and the like.
  const eventKinds: Record<SaucelingEventKind, true> = {
    "egg-found": true,
    hatch: true,
    "caretaker-care": true,
    "user-care": true,
    nudge: true,
    absence: true,
    "stage-up": true,
    "temperament-shift": true,
    farewell: true,
    "return-from-album": true,
    "check-in": true,
    "caretaker-change": true,
    evolve: true,
    "evolve-offer": true,
  };
  // The caretaker speaks in every kind of line except the player's own care and nudges
  assert.deepEqual(
    [...CARETAKER_SPEECH_KINDS].sort(),
    Object.keys(eventKinds)
      .filter((kind) => kind !== "user-care" && kind !== "nudge")
      .sort(),
  );
  for (const stage of SAUCELING_STAGES) {
    used.add(`saucelings.stage.${stage}`);
    used.add(`saucelings.menagerie.section.${stage}`);
  }
  for (const kind of Object.keys(eventKinds)) used.add(`saucelings.event.${kind}`);
  for (const move of SAUCELING_EVOLVE_MOVES) used.add(`saucelings.evolve.moves.${move}`);
  for (const tab of ["nook", "journal", "album", "menagerie", "settings"]) used.add(`saucelings.tab.${tab}`);
  for (const rare of ["special", "halloween"]) used.add(`saucelings.pet.rare.${rare}`);
  for (const id of ["prismite", "thundrake", "clockrit"]) used.add(`saucelings.unlocks.${id}`);
  assert.deepEqual(
    [...used].filter((key) => !(key in english)),
    [],
  );
  assert.deepEqual(
    Object.keys(english).filter((key) => key !== "_meta" && !used.has(key)),
    [],
  );
}

// 6f. Each species is one sheet of 17 strips of three 104 px frames, and every effect strip matches its art size,
// so the client's background-size steps land on whole frames; the evolution extras and auras are one grey sheet each,
// a row per id in the order the client reads them; a living sheet is LIVE_VARIANTS copies of its species' sheet, for
// the species and copy times the client reads; sprites/ holds nothing the atlas does not list, every
// species has an egg, a strip per stage and mood, and a side view per stage on the row the client looks at, and the
// package declares no more assets than the Engine accepts (256).
{
  const spritesRoot = new URL("../packages/saucelings/sprites/", import.meta.url);
  const atlas = JSON.parse(readFileSync(new URL("atlas.json", spritesRoot), "utf8"));
  const webpSize = (path: string) => {
    const bytes = readFileSync(new URL(path.replace(/^sprites\//u, ""), spritesRoot));
    assert.equal(bytes.toString("latin1", 12, 16), "VP8L", `${path} is lossless WebP`);
    const bits = bytes.readUInt32LE(21);
    return [(bits & 0x3fff) + 1, ((bits >>> 14) & 0x3fff) + 1];
  };
  const size = atlas.artPixels * atlas.scale;
  assert.equal(atlas.rows.length, SHEET_ROWS);
  for (const path of Object.values<string>(atlas.sheets)) {
    assert.deepEqual(webpSize(path), [size * atlas.strip.frames, size * SHEET_ROWS], path);
  }
  for (const effect of Object.values<{ path: string; frames: number; artSize: [number, number] }>(atlas.effects)) {
    assert.deepEqual(
      webpSize(effect.path),
      [effect.artSize[0] * effect.frames * atlas.scale, effect.artSize[1] * atlas.scale],
      effect.path,
    );
  }
  assert.equal(atlas.version, 6);
  assert.equal(atlas.live.variants, LIVE_VARIANTS);
  for (const species of SAUCELING_SPECIES) {
    const sheet = atlas.live.sheets[species] as { path: string; ms: number } | undefined;
    assert.deepEqual(liveSheet(species), sheet ?? null, species);
    if (sheet) assert.deepEqual(webpSize(sheet.path), [size * atlas.strip.frames, size * SHEET_ROWS * LIVE_VARIANTS]);
  }
  assert.ok(Object.keys(atlas.live.sheets).every((species) => atlas.species.includes(species)));
  for (const [sheet, ids, frames] of [
    [atlas.extras, SAUCELING_EVOLVE_EXTRAS, 2],
    [atlas.auras, SAUCELING_EVOLVE_AURAS, 3],
  ] as const) {
    assert.deepEqual(sheet.rows, [...ids]);
    assert.equal(sheet.frames, frames);
    assert.deepEqual(
      webpSize(sheet.path),
      [sheet.artSize[0] * frames * atlas.scale, sheet.artSize[1] * ids.length * atlas.scale],
      sheet.path,
    );
  }
  // Each special and October species hatches with its own moment, built from moves and colours that exist
  assert.deepEqual(Object.keys(HATCH_MOMENTS).sort(), [...SPECIAL_SPECIES, ...SEASONAL_SPECIES].sort());
  for (const [species, moment] of Object.entries(HATCH_MOMENTS)) {
    assert.ok(SAUCELING_EVOLVE_COLOURS.includes(moment.colour), species);
    for (const move of moment.moves) assert.ok(SAUCELING_EVOLVE_MOVES.includes(move), `${species} ${move}`);
  }
  // The move pieces share one sheet: every piece the client draws, each frame inside it
  const [movesWidth, movesHeight] = webpSize(atlas.moves.path);
  for (const name of [...MOVE_PIECES, ...SAUCELING_EVOLVE_AURAS]) {
    const frames = atlas.moves.pieces[name];
    assert.ok(frames?.length, name);
    for (const [x, y, w, h] of frames) {
      assert.ok(x >= 0 && y >= 0 && (x + w) * atlas.scale <= movesWidth && (y + h) * atlas.scale <= movesHeight, name);
    }
  }
  assert.deepEqual(
    [atlas.extras.artSize, atlas.auras.artSize],
    [
      [12, 12],
      [7, 7],
    ],
  );
  // Scenes are whole Nook backgrounds on their own art grid, one per species and a nest every egg shares
  assert.deepEqual(Object.keys(atlas.scenes).sort(), ["nest", ...SAUCELING_SPECIES].sort());
  for (const path of Object.values<string>(atlas.scenes)) {
    assert.deepEqual(
      webpSize(path),
      atlas.sceneArtPixels.map((n: number) => n * atlas.scale),
      path,
    );
  }
  for (const species of atlas.species) {
    assert.equal(sceneAssetPath({ species, stage: "hatchling" }), atlas.scenes[species]);
  }
  assert.equal(sceneAssetPath({ species: "fluttino", stage: "egg" }), atlas.scenes.nest);
  assert.deepEqual(atlas.species, [...SAUCELING_SPECIES]);
  for (const species of SAUCELING_SPECIES) {
    const sheet = atlas.sheets[species];
    assert.deepEqual(spriteStrip(species, "egg", "content"), { path: sheet, row: atlas.rows.indexOf("egg") });
    assert.equal(spriteStrip(species, "egg", "side"), null);
    for (const stage of SAUCELING_STAGES.filter((s) => s !== "egg")) {
      for (const view of ["happy", "content", "grumpy", "side"] as const) {
        assert.deepEqual(spriteStrip(species, stage, view), {
          path: sheet,
          row: atlas.rows.indexOf(`${stage}:${view}`),
        });
      }
    }
  }
  const listed = new Set(
    [
      ...Object.values<string>(atlas.sheets),
      ...Object.values<string>(atlas.scenes),
      ...Object.values<{ path: string }>(atlas.effects).map((fx) => fx.path),
      atlas.extras.path,
      atlas.auras.path,
      atlas.moves.path,
      ...Object.values<{ path: string }>(atlas.live.sheets).map((sheet) => sheet.path),
    ].map((path) => path.replace(/^sprites\//u, "")),
  );
  assert.deepEqual(
    readdirSync(spritesRoot).filter((name) => name.endsWith(".webp") && !listed.has(name)),
    [],
  );
  const manifest = JSON.parse(readFileSync(new URL("../packages/saucelings/manifest.json", import.meta.url), "utf8"));
  assert.ok(manifest.contributions.assets.paths.length <= 256, `${manifest.contributions.assets.paths.length} assets`);
}

// 6g. The stage director's choices: what each mood may do, where a walk may go, and how long it takes
{
  const beatsFor = (mood: "happy" | "content" | "grumpy", species: "rigamuffin" | "shellbini", hour: number) =>
    Object.entries(beatWeights(mood, species, hour))
      .filter(([, weight]) => weight > 0)
      .map(([beat]) => beat);
  assert.deepEqual(beatsFor("grumpy", "rigamuffin", 12), ["wander", "idle", "look", "huff"]);
  assert.deepEqual(beatsFor("happy", "rigamuffin", 12), ["wander", "idle", "look", "hop", "hum"]);
  assert.deepEqual(beatsFor("content", "rigamuffin", 12), ["wander", "idle", "look", "hum", "nap"]);
  // An evolved sauceling does its signature move now and then, twice as often when happy, never when grumpy
  assert.deepEqual(
    (["happy", "content", "grumpy"] as const).map((mood) => beatWeights(mood, "rigamuffin", 12, true).signature),
    [1, 0.5, 0],
  );
  assert.equal(nextBeat("happy", "rigamuffin", 12, 0.999999, true), "signature");
  assert.equal(beatFace("signature", "happy", 0.9), "happy");
  // A nap is likelier at night, and the hummers hum more
  assert.ok(beatWeights("content", "rigamuffin", 23).nap > beatWeights("content", "rigamuffin", 12).nap);
  assert.ok(beatWeights("content", "shellbini", 12).hum > beatWeights("content", "rigamuffin", 12).hum);
  assert.equal(beatWeights("content", "rigamuffin", 6).nap, beatWeights("content", "rigamuffin", 22).nap);
  assert.notEqual(beatWeights("content", "rigamuffin", 7).nap, beatWeights("content", "rigamuffin", 6).nap);
  // Every roll lands on a beat that mood allows, and the ends of the range pick the first and last beat
  for (const mood of ["happy", "content", "grumpy"] as const) {
    const allowed = beatsFor(mood, "rigamuffin", 12);
    for (let roll = 0; roll < 1; roll += 0.01) assert.ok(allowed.includes(nextBeat(mood, "rigamuffin", 12, roll)));
    assert.equal(nextBeat(mood, "rigamuffin", 12, 0), allowed[0]);
    assert.equal(nextBeat(mood, "rigamuffin", 12, 0.999999), allowed.at(-1));
  }
  // A happy sauceling hops on at most one beat in eight, and its idle bounces without leaving the floor
  const happyWeights = beatWeights("happy", "rigamuffin", 12);
  assert.ok(happyWeights.hop * 8 <= Object.values(happyWeights).reduce((sum, weight) => sum + weight, 0));
  const happyIdle = SAUCELINGS_STYLES.slice(SAUCELINGS_STYLES.indexOf("@keyframes sl-idle-happy"));
  assert.doesNotMatch(happyIdle.slice(0, happyIdle.indexOf("\n}\n")), /translateY\(calc\(-[2-9]/u);
  // A happy sauceling rests on its content face and cheers in bursts: hops, hums, most idle moments and care; a
  // content one cheers now and then, a huff scowls, and care softens a grumpy one
  assert.equal(shownFace("happy", null, null), "content");
  assert.equal(shownFace("grumpy", null, null), "grumpy");
  assert.equal(shownFace("happy", null, beatFace("hop", "happy", 0.9)), "happy");
  assert.equal(shownFace("content", null, beatFace("hum", "content", 0.9)), "happy");
  assert.equal(shownFace("happy", null, beatFace("idle", "happy", 0.1)), "happy");
  assert.equal(shownFace("happy", null, beatFace("idle", "happy", 0.9)), "content");
  assert.equal(shownFace("content", null, beatFace("idle", "content", 0.1)), "happy");
  assert.equal(shownFace("content", null, beatFace("idle", "content", 0.5)), "content");
  assert.equal(shownFace("grumpy", null, beatFace("idle", "grumpy", 0.1)), "content");
  assert.equal(shownFace("grumpy", null, beatFace("huff", "grumpy", 0.9)), "grumpy");
  assert.equal(shownFace("happy", null, beatFace("look", "happy", 0.1)), "content");
  assert.equal(shownFace("content", "feed", null), "happy");
  assert.equal(shownFace("grumpy", "pet", null), "content");
  assert.equal(shownFace("happy", "rest", "happy"), "content");
  // A walk stays on the stage, in whole art pixels, and a stage narrower than a sprite still has a place to stand
  assert.deepEqual(walkBounds(183), { min: -6, max: 137 });
  assert.equal(clampTarget(-40, 183), -6);
  assert.equal(clampTarget(500, 183), 137);
  assert.equal(clampTarget(40.4, 183), 40);
  assert.equal(centreX(176), 62);
  assert.deepEqual(walkBounds(30), { min: -6, max: -6 });
  // A caretaker standing at the right keeps the pet to the left 70%: its frame's right edge, less the overhang,
  // stops where their share begins; with nobody standing there the pet has the whole stage
  assert.equal(walkWidth(183, false), 183);
  assert.equal(walkWidth(183, true), 128);
  assert.deepEqual(walkBounds(walkWidth(183, true)), { min: -6, max: 82 });
  // The sprite's pixels stay about as big as the background's: a Home widget's stage (about 330 to 480 px wide)
  // draws at 2x or 3x, the Nook's up to 4x, and an unmeasured stage at 2x
  assert.deepEqual(
    [0, 322, 370, 480, 528, 704, 1400].map((width) => stageScale(width)),
    [2, 2, 2, 3, 3, 4, 4],
  );
  // Beside a Home widget's meters the stage is 4:3, so its height counts too: the background still fills it
  assert.equal(stageScale(459, 345), 3);
  assert.equal(stageScale(534, 400), 4);
  // The pet hurries over to the caretaker before a care: a second at most, and never shorter than a blink
  assert.deepEqual([2, 24, -48, 96, 400].map(hurryMs), [200, 500, 1000, 1000, 1000]);
  // Grumpy trudges, happy trots; a move is never shorter than a blink
  assert.ok(walkMs(40, "grumpy") > walkMs(40, "content") && walkMs(40, "content") > walkMs(40, "happy"));
  assert.equal(walkMs(1, "happy"), 200);
}

// 6h. The caretaker standing in the scene looks as the moment is, and only the Engine's own sprites are used
{
  const open = { hunger: false, mood: false, warmth: false };
  const pose = (line: SaucelingEventKind | null, more: Partial<Parameters<typeof caretakerPose>[0]> = {}) =>
    caretakerPose({
      gaps: open,
      line: line ? { kind: line } : null,
      speaking: false,
      cheering: false,
      caring: null,
      ...more,
    });
  // A line holds no look once it is said: a check-in is talk while it is written and typed out, then calm (0.5.0
  // kept them smiling)
  assert.equal(pose("check-in", { speaking: true }), "talking");
  assert.equal(pose("check-in"), "calm");
  assert.equal(pose("stage-up"), "calm");
  assert.equal(pose("caretaker-care"), "calm");
  assert.equal(pose(null), "calm");
  // A hello waves while it comes in, as does a welcome back from the Album
  assert.equal(pose("caretaker-change", { speaking: true }), "waving");
  assert.equal(pose("return-from-album", { speaking: true }), "waving");
  assert.equal(pose("caretaker-change"), "calm");
  // Care plays toward the pet, theirs even as its line types out, and yours (0.7.1) before the cheer for a filled gap
  assert.equal(pose("caretaker-care", { caring: "feed", speaking: true }), "feeding");
  assert.equal(pose(null, { caring: "play" }), "playing");
  assert.equal(pose(null, { caring: "pet" }), "tending");
  assert.equal(pose(null, { caring: "rest" }), "tending");
  assert.equal(pose(null, { caring: "warm" }), "tending");
  assert.equal(pose(null, { caring: "talk" }), "talking");
  assert.equal(pose(null, { caring: "feed", cheering: true, gaps: { ...open, hunger: true } }), "feeding");
  // A gap open, or time away, worries them once they have said their piece; good news cheers them over talk
  assert.equal(pose("check-in", { gaps: { ...open, hunger: true } }), "worried");
  assert.equal(pose("check-in", { gaps: { ...open, hunger: true }, speaking: true }), "talking");
  assert.equal(pose("absence"), "worried");
  assert.equal(pose("hatch", { cheering: true, speaking: true }), "happy");
  // An Engine sprite keeps the three looks, and a figure painted before 0.6.0 shows the look of its three frames
  assert.deepEqual(FIGURE_POSES.map(poseMoment), [
    "neutral",
    "happy",
    "worried",
    "neutral",
    "happy",
    "happy",
    "happy",
    "happy",
  ]);
  assert.deepEqual(
    FIGURE_POSES.map((p) => figureFrame(p, 8)),
    [0, 1, 2, 3, 4, 5, 6, 7],
  );
  assert.deepEqual(
    FIGURE_POSES.map((p) => figureFrame(p, 3)),
    [0, 1, 2, 0, 1, 1, 1, 1],
  );
  const sprites = [
    { expression: "full_sheet", url: "/api/sprites/c/file/full_sheet.png" },
    { expression: "Neutral", url: "/api/sprites/c/file/Neutral.png" },
    { expression: "worried", url: "/api/sprites/c/file/worried.png" },
  ];
  // A few seconds after the player fills a gap they look happy, even while another gap is open
  assert.equal(pose(null, { gaps: { ...open, hunger: true }, cheering: true }), "happy");
  assert.equal(pose(null, { gaps: { ...open, hunger: true } }), "worried");
  // Standing in the scene: the moment's expression sprite, else neutral, else any; full-body sprites only when
  // the character has no others; nobody stands without sprites, and the box shows their avatar
  assert.equal(pickStandingSprite(sprites, "worried"), "/api/sprites/c/file/worried.png");
  assert.equal(pickStandingSprite(sprites, "happy"), "/api/sprites/c/file/Neutral.png");
  assert.equal(pickStandingSprite(sprites, "neutral"), "/api/sprites/c/file/Neutral.png");
  const odd = [
    { expression: "full_happy", url: "/api/sprites/c/file/full_happy.png" },
    { expression: "pout", url: "/api/sprites/c/file/pout.png" },
    { expression: "grin", url: "/api/sprites/c/file/grin.png" },
  ];
  assert.equal(pickStandingSprite(odd, "happy"), "/api/sprites/c/file/pout.png");
  assert.equal(pickStandingSprite(odd.slice(0, 1), "worried"), "/api/sprites/c/file/full_happy.png");
  assert.equal(pickStandingSprite(odd.slice(0, 1), "happy"), "/api/sprites/c/file/full_happy.png");
  assert.equal(pickStandingSprite([], "neutral"), null);
  // A painted figure stands at the pose's frame, breathing with its blink once they are made (and still before);
  // a caretaker without one stands as the Engine sprite for the pose's look; nobody stands while the figure loads,
  // or without sprites
  const motion = { body: "breathing.png", blink: "shut.png" };
  assert.deepEqual(standingCaretaker({ image: "fig.png", frames: 8 }, sprites, "feeding", motion), {
    figure: "breathing.png",
    rows: 2,
    frames: 8,
    frame: 5,
    blink: "shut.png",
  });
  assert.deepEqual(standingCaretaker({ image: "fig.png", frames: 3 }, sprites, "waving"), {
    figure: "fig.png",
    rows: 1,
    frames: 3,
    frame: 1,
    blink: null,
  });
  assert.deepEqual(standingCaretaker(null, sprites, "worried", motion), { src: "/api/sprites/c/file/worried.png" });
  assert.equal(standingCaretaker(undefined, sprites, "calm"), null);
  assert.equal(standingCaretaker(null, [], "calm"), null);
  // The caretaker's own care plays the effect of the player's matching button; a forgotten meal, a cooled egg
  // and a noticed milestone play nothing
  const effects = Object.fromEntries(
    SAUCELING_CARETAKER_OUTCOMES.map((outcome) => [outcome, caretakerCareAction(outcome)]),
  );
  assert.deepEqual(effects, {
    "fed-fine": "feed",
    "fed-badly": "feed",
    overfed: "feed",
    forgot: null,
    played: "play",
    cuddled: "pet",
    "milestone-noticed": null,
    "kept-warm": "warm",
    "let-cool": null,
    chatted: "talk",
  });
  assert.equal(caretakerCareAction(undefined), null);
}

// 6g. A painting asks for this pet's species and, when its sprite goes along, says the picture is the same creature
{
  const { pet } = createEggFromCaretaker({ profile, nowIso: t0, seed: 11 });
  const adult = { ...pet, stage: "adult" as const, name: "Biscotti", traits: ["sturdy", "curious"] };
  const plain = portraitAppearance(adult, false);
  assert.ok(plain.includes(PORTRAIT_SUBJECTS[adult.species]));
  // Traits are behaviour words a picture cannot show
  assert.equal(plain.includes("Traits:"), false);
  assert.equal(plain.includes(REFERENCE_NOTE), false);
  assert.ok(portraitAppearance(adult, true).includes(REFERENCE_NOTE));
  assert.ok(portraitAppearance({ ...adult, stage: "elder" }, false).includes("little round spectacles"));
  // Never "Saucelings" or a sauce's name, which pull a picture toward sauce: the temperament shows as how it looks
  assert.match(plain, /^Pixel art, 16-bit game sprite, .* A little virtual pet creature: /u);
  assert.equal(/Saucelings|Temperament:/u.test(plain), false, plain);
  assert.ok(plain.includes(`Its face and pose look ${temperamentOf(adult)!.readsAs}. Life stage: adult.`), plain);
}

// 6i. An invented sauceling is painted as its design says, never as pasta; its forms are painted stage by stage
{
  const { pet } = createEggFromCaretaker({ profile, nowIso: t0, seed: 11 });
  const invented = { ...pet, stage: "adult" as const, name: "Biscotti", design: inkMoth };
  const appearance = portraitAppearance(invented, false);
  assert.ok(
    appearance.includes(
      " A little virtual pet creature: an ink moth: A moth with wide ink-blot wings and feathery antennae; its colours are indigo, cream, silver.",
    ),
    appearance,
  );
  assert.equal(
    Object.values(PORTRAIT_SUBJECTS).some((subject) => appearance.includes(subject)),
    false,
  );
  const form = formRequest(inkMoth, "juvenile", "earlier");
  assert.match(form, /an ink moth, at its juvenile stage: A slim moth with growing smudged wings\. /u);
  assert.match(form, /at an earlier stage/u);
  assert.match(form, /Plain flat white background\.$/u);
  assert.match(form, /readable face/u);
  // An egg's form is one egg with no face
  const eggForm = formRequest(inkMoth, "egg", null);
  assert.equal(/earlier stage|before it evolved|readable face|full body/u.test(eggForm), false);
  assert.match(
    eggForm,
    /The egg of a small creature, an ink moth: A speckled grey egg .* One single egg with no face/u,
  );
  // A life sheet asks for every stage in one picture: two eggs, then four views of each stage
  assert.deepEqual(sheetStages(inkMoth), ["egg", "hatchling", "juvenile", "adult", "elder"]);
  assert.deepEqual(sheetLayout(sheetStages(inkMoth)), [2, 4, 4, 4, 4]);
  const sheet = sheetRequest(inkMoth, null);
  assert.match(
    sheet,
    /Lay out 18 drawings in 5 rows: exactly two drawings in row 1 and exactly four drawings in each of rows 2 to 5,/u,
  );
  assert.match(
    sheet,
    /Row 1, the egg, only two drawings\. Left: the whole egg, A speckled grey egg with an ink-blue swirl\. Next/u,
  );
  assert.match(sheet, /\nRow 5, elder, four drawings: A frosty-winged moth with pale whiskers\.\n/u);
  assert.match(sheet, /In rows 2 to 5, left to right: first the creature happy/u);
  assert.equal(/earlier stage|before it evolved/u.test(sheet), false);
  // Its habit is something it does, not something to draw, so it stays out of the picture
  assert.equal(sheet.includes(inkMoth.quirk), false);
  const evolvedSheet = sheetRequest(normalizeDesign(inkMothAnswer(), "evolved")!, "before");
  assert.match(evolvedSheet, /Lay out 8 drawings in 2 rows: exactly four drawings in each row,/u);
  assert.match(evolvedSheet, /\nRow 1, adult, four drawings: /u);
  assert.match(evolvedSheet, /In every row, left to right/u);
  assert.match(evolvedSheet, /before it evolved/u);
  assert.deepEqual(petKind(invented), { name: "ink moth", look: inkMoth.look });
  assert.deepEqual(petKind({ species: "shellbini", design: null }).name, "Shellbini");
  // A new background's prompt starts at the nest for any egg, the species' background for a built-in sauceling, and
  // a room in its own colours for an invented one, whose hidden species' background would not fit
  assert.equal(startingScene({ stage: "egg", species: "shellbini", design: inkMoth }), NEST_SCENE_PROMPT);
  assert.equal(startingScene({ stage: "adult", species: "shellbini", design: null }), SCENE_PROMPTS.shellbini);
  assert.match(startingScene({ stage: "adult", species: "shellbini", design: inkMoth }), /indigo, cream and silver/u);
  // A caretaker's lines are set in what the Nook shows: the built-in scene (the nest for an egg), a generated
  // background's prompt, and nothing for an uploaded picture; a background that is gone shows the built-in one
  const generatedBg = { id: "bg-1", label: "a lighthouse lamp room", source: "generated" as const, savedAt: t0 };
  const uploadedBg = { ...generatedBg, id: "bg-2", label: "IMG_2034", source: "upload" as const };
  const nookPet = { stage: "adult" as const, species: "shellbini" as const, backgroundId: null };
  assert.equal(nookPlace(nookPet, [generatedBg]), SCENE_PROMPTS.shellbini);
  assert.equal(nookPlace({ ...nookPet, stage: "egg" }, []), NEST_SCENE_PROMPT);
  assert.equal(nookPlace({ ...nookPet, backgroundId: "bg-1" }, [generatedBg, uploadedBg]), "a lighthouse lamp room");
  assert.equal(nookPlace({ ...nookPet, backgroundId: "bg-2" }, [generatedBg, uploadedBg]), null);
  assert.equal(nookPlace({ ...nookPet, backgroundId: "bg-9" }, [generatedBg]), SCENE_PROMPTS.shellbini);
}

// 6j. Egg hunting: any character replying may find, at most once a day, more slowly for each egg they found and
// keep unhatched; a chat reply never evolves it
{
  assert.deepEqual([0, 1, 2, 3, 4, 5].map(eggFindChance), [1 / 40, 1 / 80, 1 / 160, 1 / 320, 1 / 320, 1 / 320]);
  const { pet } = createEggFromCaretaker({ profile, nowIso: t0, seed: 11 });
  const adult = { ...pet, stage: "adult" as const };
  const world = (patch: Record<string, unknown> = {}) => normalizeSaucelingWorld({ activePet: adult, ...patch });
  const ids = ["char-1"];
  const hit = { find: 0, pick: 0 };
  assert.equal(huntDecision(world(), ids, hit, t0), "char-1");
  assert.equal(huntDecision(world(), ids, { find: 0.99, pick: 0 }, t0), null);
  assert.equal(huntDecision(world(), ["someone-else"], hit, t0), "someone-else");
  assert.equal(huntDecision(world(), [], hit, t0), null);
  assert.equal(huntDecision(world({ activePet: null }), ids, hit, t0), null);
  assert.equal(huntDecision(world({ settings: { eggHunting: false } }), ids, hit, t0), null);
  assert.equal(huntDecision(world({ lastEggFindDay: "2026-10-20" }), ids, hit, t0), null);
  assert.equal(huntDecision(world({ lastEggFindDay: "2026-10-19" }), ids, hit, t0), "char-1");
  const kept = entryFromPet(createEggFromCaretaker({ profile, nowIso: t0, seed: 12, foundBy: "char-1" }).pet, t0, "");
  const between = { find: 0.02, pick: 0 }; // under 1/40, over 1/80
  assert.equal(huntDecision(world(), ids, between, t0), "char-1");
  assert.equal(huntDecision(world({ menagerie: [kept] }), ids, between, t0), null);
  assert.equal(
    huntDecision(world({ menagerie: [{ ...kept, stageAtRetirement: "juvenile" }] }), ids, between, t0),
    "char-1",
  );
  assert.equal(huntDecision(world({ menagerie: [{ ...kept, foundBy: "char-2" }] }), ids, between, t0), "char-1");
  // With several targets, `pick` chooses the finder: the first at 0, the last at 0.99
  const two = ["char-1", "char-2"];
  assert.equal(huntDecision(world(), two, { find: 0, pick: 0 }, t0), "char-1");
  assert.equal(huntDecision(world(), two, { find: 0, pick: 0.49 }, t0), "char-1");
  assert.equal(huntDecision(world(), two, { find: 0, pick: 0.5 }, t0), "char-2");
  assert.equal(huntDecision(world(), two, { find: 0, pick: 0.99 }, t0), "char-2");
  assert.equal(huntDecision(world(), two, { find: 0, pick: 1 }, t0), "char-2");
  // The roll is checked against the chosen finder's own count of kept eggs: char-1 keeps 3 (1 in 320), char-2 none
  const keptByOne = [12, 13, 14].map((seed) =>
    entryFromPet(createEggFromCaretaker({ profile, nowIso: t0, seed, foundBy: "char-1" }).pet, t0, ""),
  );
  const crowded = world({ menagerie: keptByOne });
  const underFloor = { find: 1 / 400 };
  const underBase = { find: 1 / 100 }; // under 1/40, over 1/320
  assert.equal(huntDecision(crowded, two, { ...underFloor, pick: 0 }, t0), "char-1");
  assert.equal(huntDecision(crowded, two, { ...underBase, pick: 0 }, t0), null);
  assert.equal(huntDecision(crowded, two, { ...underBase, pick: 0.99 }, t0), "char-2");
  assert.equal(huntDecision(crowded, two, { find: 0.03, pick: 0.99 }, t0), null);
}

// 6j2. Evolution: good days add up, a finished day may bring its caretaker's offer (likelier on a day they chatted),
// once; the offered looks are checked, made up from a plain fallback, and travel with it to the Menagerie
{
  const { pet: egg } = createEggFromCaretaker({ profile, nowIso: t0, seed: 11 });
  const day0 = Math.floor(Date.parse(t0) / DAY_MS);
  const at = (hours: number) => new Date(Date.parse(t0) + hours * 3_600_000).toISOString();
  const adult = normalizeSaucelingWorld({
    activePet: {
      ...egg,
      stage: "adult",
      lockedStage: "adult",
      hatchedAt: t0,
      lastTickAt: at(21),
      meters: { hunger: 90, mood: 95, bond: 95 },
    },
  }).activePet!;
  assert.deepEqual(adult.evolution, { offer: null, choices: null, look: null, at: null, goodHours: [], chatDays: [] });
  const withState = (patch: Partial<typeof adult.evolution>) => ({
    ...adult,
    evolution: { ...adult.evolution, ...patch },
  });
  const steady = (value: number) => ({ next: () => value, state: () => 0 });
  const offered = (pet: typeof adult, value: number) => {
    const result = advance(pet, at(27), { careWindowHours: 6 }, steady(value));
    return [result.pet.evolution.offer, result.events.filter((event) => event.kind === "evolve-offer").length];
  };
  // Happy, close hours are counted for the day they end in
  const counted = advance(adult, at(24), { careWindowHours: 3 }, steady(0)).pet.evolution.goodHours;
  assert.deepEqual(counted, [{ day: day0, good: 3 }]);
  assert.deepEqual(
    advance({ ...adult, meters: { ...adult.meters, bond: 20 } }, at(24), { careWindowHours: 3 }, steady(0)).pet
      .evolution.goodHours,
    [],
  );
  // More than 36 good hours in three days: a third of finished days bring the offer, two thirds after a chat
  const good = { goodHours: [{ day: day0, good: 40 }] };
  assert.deepEqual(offered(withState(good), 0), ["offered", 1]);
  assert.deepEqual(offered(withState(good), 0.5), [null, 0]);
  assert.deepEqual(offered(withState({ ...good, chatDays: [day0] }), 0.5), ["offered", 1]);
  assert.deepEqual(offered(withState({ goodHours: [{ day: day0, good: 30 }] }), 0), [null, 0]);
  assert.deepEqual(offered(withState({ ...good, offer: "declined" }), 0), ["declined", 0]);
  assert.deepEqual(offered(withState({ ...good, at: t0 }), 0), [null, 0]);
  const offerLine = advance(withState(good), at(27), { careWindowHours: 6 }, steady(0)).events.find(
    (event) => event.kind === "evolve-offer",
  )!;
  assert.equal(offerLine.speaker, "Dottore");
  assert.match(offerLine.text, /been so happy lately\. I think they're ready to become something new\./u);
  // Only the three days up to the finished one count
  const spread = (days: number[]) => ({ ...adult.evolution, goodHours: days.map((day) => ({ day, good: 13 })) });
  assert.equal(evolveOfferDue(spread([day0 - 2, day0 - 1, day0]), day0), true);
  assert.equal(evolveOfferDue(spread([day0 - 3, day0 - 1, day0]), day0), false);
  assert.equal(evolveOfferDue(spread([day0 - 1, day0, day0 + 1]), day0), false);
  // A chat by its caretaker marks the day, once, and only for a hatched pet still waiting for its offer
  const chatWorld = (pet: typeof adult) => normalizeSaucelingWorld({ activePet: pet });
  const nowMs = Date.parse(at(27));
  const marked = markChatDay(chatWorld(adult), ["char-1"], nowMs);
  assert.deepEqual(marked.activePet!.evolution.chatDays, [day0 + 1]);
  assert.equal(markChatDay(marked, ["char-1"], nowMs), marked);
  assert.equal(markChatDay(chatWorld(adult), ["char-2"], nowMs).activePet!.evolution.chatDays.length, 0);
  assert.equal(markChatDay(chatWorld(egg), ["char-1"], nowMs).activePet!.evolution.chatDays.length, 0);
  assert.equal(
    markChatDay(chatWorld(withState({ offer: "offered" })), ["char-1"], nowMs).activePet!.evolution.chatDays.length,
    0,
  );
  const fourDays = markChatDay(chatWorld(withState({ chatDays: [day0 - 2, day0 - 1, day0] })), ["char-1"], nowMs);
  assert.deepEqual(fourDays.activePet!.evolution.chatDays, [day0 - 1, day0, day0 + 1]);

  // Every colour has a path: its own aura, and three extras of its own to pick from
  assert.deepEqual(Object.keys(SAUCELING_EVOLVE_PATHS).sort(), [...SAUCELING_EVOLVE_COLOURS].sort());
  assert.deepEqual(
    Object.values(SAUCELING_EVOLVE_PATHS)
      .map((path) => path.aura)
      .sort(),
    [...SAUCELING_EVOLVE_AURAS].sort(),
  );
  for (const path of Object.values(SAUCELING_EVOLVE_PATHS)) {
    assert.equal(new Set(path.extras).size, 3);
    for (const extra of path.extras) assert.ok(SAUCELING_EVOLVE_EXTRAS.includes(extra), extra);
  }
  // Every move belongs to exactly one path
  assert.deepEqual(
    Object.values(SAUCELING_EVOLVE_PATHS)
      .flatMap((path) => path.moves)
      .sort(),
    [...SAUCELING_EVOLVE_MOVES].sort(),
  );

  // The plain fallback: a colour of its own each, the kind's name, its aura and an extra from its path, and its
  // caretaker's care
  const kind = petKind(adult).name;
  const plain = fallbackEvolutions(adult, 2, ["ember"], () => 0);
  assert.deepEqual(
    plain.map((look) => [look.form, look.colour, look.extra, look.move]),
    [
      [`Frost ${kind}`, "frost", "snowflake", "icicles"],
      [`Moss ${kind}`, "moss", "leaf", "leafwhirl"],
    ],
  );
  assert.equal(
    plain[0]!.description,
    "Its colours have turned to icy blues, snowflakes drift around it, and a little snowflake floats above its head.",
  );
  assert.equal(plain[0]!.from, `Dottore's care and its ${temperamentOf(adult)!.name} ways.`);
  const moth = { ...adult, design: inkMoth };
  assert.equal(fallbackEvolutions(moth, 1, [], () => 0)[0]!.form, "Ember ink moth");
  assert.equal(fallbackEvolutions(moth, 1, [], () => 0)[0]!.from, "Dottore's care.");
  const allColours = fallbackEvolutions(adult, 9, [], Math.random).map((look) => look.colour);
  assert.equal(new Set(allColours).size, 9);
  for (let i = 0; i < 20; i++) {
    for (const look of fallbackEvolutions(adult, 9, [], Math.random)) {
      assert.ok(SAUCELING_EVOLVE_PATHS[look.colour].extras.includes(look.extra), `${look.colour} ${look.extra}`);
      assert.ok(SAUCELING_EVOLVE_PATHS[look.colour].moves.includes(look.move), `${look.colour} ${look.move}`);
    }
  }

  // The model's looks: every part, ids from the lists, a colour each, no borrowed names, food only for pasta
  const look = (patch: Record<string, unknown> = {}) => ({
    form: "Starlit Wisp",
    description: "Its fur has gone a soft violet.",
    from: "From: Dottore's long nights.",
    colour: "dusk",
    extra: "moon",
    ...patch,
  });
  const otherSpecies = Object.entries(SPECIES_CATALOG).find(([id]) => id !== adult.species)![1].name;
  // The aura follows the colour, and the move defaults to its path's first
  assert.deepEqual(normalizeEvolutions({ evolutions: [look()] }, moth), [
    { ...look(), from: "Dottore's long nights.", move: "starburst" },
  ]);
  // A move off its colour's path, or unknown, becomes the path's first
  assert.deepEqual(
    [look({ move: "roar" }), look({ move: "backflip" }), look({ move: "float" })].map(
      (item) => normalizeEvolutions({ evolutions: [item] }, moth)[0]?.move,
    ),
    ["starburst", "starburst", "float"],
  );
  // An extra off its colour's path, or unknown, becomes the path's first
  assert.deepEqual(
    [look({ extra: "flame" }), look({ extra: "trident" }), look({ extra: "orb" })].map(
      (item) => normalizeEvolutions({ evolutions: [item] }, moth)[0]?.extra,
    ),
    ["moon", "moon", "orb"],
  );
  // A saved look keeps its move and an extra off today's path when loaded; a saved "glow" is ignored
  const oldLook = look({ move: "twirl", extra: "flame" });
  assert.deepEqual(evolutionLookOf({ ...oldLook, glow: "sparkles" }), oldLook);
  // Its move: one from the list, else (missing or unknown) its colour's first
  assert.deepEqual(
    [look({ move: "roar" }), look({ move: "backflip" }), look()].map((item) => evolutionLookOf(item)?.move),
    ["roar", "starburst", "starburst"],
  );
  assert.deepEqual(
    normalizeEvolutions(
      {
        evolutions: [
          look({ colour: "fire" }),
          look({ form: "" }),
          look({ form: `${otherSpecies} Prime` }),
          look({ description: "It smells of tomato sauce." }),
          look(),
          look({ form: "Second Dusk" }),
          look({ form: "Gilded Wisp", colour: "gilded" }),
          look({ form: "Shaded Wisp", colour: "shade" }),
        ],
      },
      moth,
    ).map((item) => item.form),
    ["Starlit Wisp", "Gilded Wisp"],
  );
  assert.equal(normalizeEvolutions({ evolutions: [look({ description: "It smells of sauce." })] }, adult).length, 1);
  assert.deepEqual(normalizeEvolutions("nonsense", moth), []);

  // Saved state is checked on load; a sauceling that evolved the old way counts as evolved, from when it hatched
  const loaded = normalizeSaucelingWorld({
    activePet: {
      ...adult,
      evolution: {
        offer: "offered",
        choices: [look({ from: "x" }), look({ colour: "frost", from: "y" })],
        look: look({ colour: "teal" }),
        at: null,
        goodHours: [{ day: day0, good: 5 }, { day: -1, good: 2 }, "x"],
        chatDays: [day0, "y"],
      },
    },
  }).activePet!.evolution;
  assert.deepEqual(
    [loaded.offer, loaded.choices?.length, loaded.look, loaded.goodHours, loaded.chatDays],
    ["offered", 2, null, [{ day: day0, good: 5 }], [day0]],
  );
  const { evolution: _dropped, ...unsaved } = adult;
  const legacy = normalizeSaucelingWorld({
    activePet: { ...unsaved, design: normalizeDesign(inkMothAnswer(), "evolved") },
  }).activePet!.evolution;
  assert.deepEqual([legacy.offer, legacy.at, legacy.look], [null, t0, null]);
  assert.equal(normalizeSaucelingWorld({ activePet: { ...unsaved, design: inkMoth } }).activePet!.evolution.at, null);

  // The look, offer and choices go to the Menagerie and come back; the good days and chats start again
  const chosen = fallbackEvolutions(adult, 2, [], () => 0);
  const evolved = withState({
    offer: "offered",
    choices: [chosen[0]!, chosen[1]!],
    look: chosen[0]!,
    at: t0,
    goodHours: [{ day: day0, good: 9 }],
    chatDays: [day0],
  });
  const entry = entryFromPet(evolved, at(30), "");
  assert.deepEqual(entry.evolution, evolved.evolution);
  const back = restorePetFromMenagerie(entry, undefined, at(31)).pet.evolution;
  assert.deepEqual(back, { ...evolved.evolution, goodHours: [], chatDays: [] });
}

// 6k. A design is checked and trimmed; pasta, sauce, food and the built-in names are refused, and a found one
// needs a picture for every stage while an evolved one needs adult and elder
{
  assert.equal(inkMoth.origin, "found");
  assert.deepEqual(Object.keys(inkMoth.stages).sort(), ["adult", "egg", "elder", "hatchling", "juvenile"]);
  assert.deepEqual(normalizeDesign(JSON.stringify(inkMothAnswer()), "found"), inkMoth);
  const trimmed = normalizeDesign(
    {
      ...inkMothAnswer(),
      kind: "k".repeat(100),
      look: "l".repeat(500),
      colours: ["a".repeat(60), "grey", "indigo", "cream"],
      traits: ["quiet", "", 7, "curious", "shy", "loud"],
      stages: { ...inkMothAnswer().stages, wings: "ignored" },
    },
    "found",
  )!;
  assert.equal(trimmed.kind.length, 40);
  assert.equal(trimmed.look.length, 240);
  assert.deepEqual(trimmed.colours, ["a".repeat(24), "grey", "indigo"]);
  assert.deepEqual(trimmed.traits, ["quiet", "curious", "shy"]);
  assert.equal("wings" in trimmed.stages, false);
  const { juvenile: _juvenile, ...noJuvenile } = inkMothAnswer().stages;
  assert.equal(normalizeDesign({ ...inkMothAnswer(), stages: noJuvenile }, "found"), null);
  assert.equal(normalizeDesign({ ...inkMothAnswer(), colours: ["grey", "blue"] }, "found"), null);
  const evolved = normalizeDesign(
    { ...inkMothAnswer(), stages: { egg: "An extra egg.", adult: "A broad moth.", elder: "A frosty moth." } },
    "evolved",
  );
  assert.deepEqual(evolved?.stages, { adult: "A broad moth.", elder: "A frosty moth." });
  for (const bad of [
    { look: "Little noodles with legs." },
    { kind: "Sauce Sprite" },
    { stages: { ...inkMothAnswer().stages, egg: "a tomato-red egg" } },
    { quirk: "Thinks it is a Rigamuffin." },
    { traits: ["quiet", "marinara-loving", "shy"] },
  ]) {
    assert.equal(normalizeDesign({ ...inkMothAnswer(), ...bad }, "found"), null, JSON.stringify(bad));
  }
  assert.ok(normalizeDesign({ ...inkMothAnswer(), quirk: "Hoards food in its wings." }, "found"));
}

// 6l. A pet saved before designs is a built-in species with no forms; a design travels with its pet through the
// Menagerie and back, and its picture is its form, a silhouette while a found one has none, else its sprite
{
  const { pet } = createEggFromCaretaker({ profile, nowIso: t0, seed: 11 });
  const { design: _design, forms: _forms, foundBy: _foundBy, foundAt: _foundAt, ...legacy } = pet;
  const loaded = normalizeSaucelingWorld({
    activePet: legacy,
    menagerie: [
      { ...entryFromPet(pet, t0, "Bye."), forms: { adult: "form-1", wings: "x", elder: 7 }, foundBy: "char-1" },
    ],
  });
  const active = loaded.activePet!;
  assert.deepEqual([active.design, active.forms, active.foundBy, active.foundAt], [null, {}, null, null]);
  assert.deepEqual(loaded.menagerie[0].forms, { adult: "form-1" });
  assert.deepEqual([loaded.menagerie[0].foundBy, loaded.menagerie[0].foundAt], ["char-1", null]);
  assert.equal(loaded.lastEggFindDay, null);
  assert.equal(loaded.lastNewEggDay, null);
  assert.equal(loaded.settings.eggHunting, true);
  assert.equal(normalizeSaucelingWorld({ settings: { eggHunting: false } }).settings.eggHunting, false);
  assert.equal(
    normalizeSaucelingWorld({ activePet: { ...pet, design: { ...inkMoth, look: "a noodle" } } }).activePet!.design,
    null,
  );

  const found = createEggFromCaretaker({ profile, nowIso: t0, seed: 13, design: inkMoth, foundBy: "char-1" });
  assert.deepEqual(
    [found.pet.name, found.pet.traits, found.pet.quirk, found.pet.foundAt],
    ["ink moth", inkMoth.traits, inkMoth.quirk, t0],
  );
  assert.match(found.event.text, /while we were talking/u);
  const { entry } = retirePetToMenagerie({ ...found.pet, forms: { egg: "form-2" } }, t0);
  const { pet: back } = restorePetFromMenagerie(entry, undefined, t0);
  assert.deepEqual([back.design, back.forms, back.foundBy, back.foundAt], [inkMoth, { egg: "form-2" }, "char-1", t0]);

  const evolvedDesign = { ...inkMoth, origin: "evolved" as const };
  assert.deepEqual(spriteArtFor({ design: null, forms: {} }, "adult"), { kind: "species" });
  assert.deepEqual(spriteArtFor({ design: inkMoth, forms: {} }, "egg"), { kind: "silhouette" });
  assert.deepEqual(spriteArtFor({ design: inkMoth, forms: { egg: "f" } }, "egg"), { kind: "form", formId: "f" });
  assert.deepEqual(spriteArtFor({ design: evolvedDesign, forms: {} }, "adult"), { kind: "species" });
  assert.deepEqual(spriteArtFor({ design: evolvedDesign, forms: { adult: "g" } }, "elder"), { kind: "species" });
  assert.deepEqual(spriteArtFor({ design: evolvedDesign, forms: { adult: "g" } }, "adult"), {
    kind: "form",
    formId: "g",
  });
}

// 6m. A painting becomes a form: its flat background is keyed out from the edge (a hole of that colour inside
// the creature stays), the creature is fitted to its stage's size standing on the frame's floor, and doubled
{
  const BG = [200, 230, 250];
  const RED = [230, 40, 40];
  const make = (width: number, height: number, fill: number[]): Rgba => {
    const data = new Uint8ClampedArray(width * height * 4);
    for (let p = 0; p < width * height; p++) data.set([...fill, 255], p * 4);
    return { data, width, height };
  };
  const paint = (img: Rgba, x0: number, y0: number, w: number, h: number, c: number[]) => {
    for (let y = y0; y < y0 + h; y++)
      for (let x = x0; x < x0 + w; x++) img.data.set([...c, 255], (y * img.width + x) * 4);
  };
  const px = (img: Rgba, x: number, y: number) => [
    ...img.data.subarray((y * img.width + x) * 4, (y * img.width + x) * 4 + 4),
  ];
  const picture = make(64, 64, BG);
  paint(picture, 10, 20, 20, 30, RED);
  paint(picture, 18, 30, 4, 4, BG);
  const original = Uint8ClampedArray.from(picture.data);
  const keyed = keyOutBackground(picture);
  assert.deepEqual(picture.data, original);
  for (const [x, y] of [
    [0, 0],
    [63, 63],
    [32, 5],
  ])
    assert.equal(px(keyed, x, y)[3], 0, `${x},${y}`);
  assert.deepEqual(px(keyed, 12, 22), [...RED, 255]);
  assert.deepEqual(px(keyed, 19, 31), [...BG, 255]);
  assert.deepEqual(contentBounds(keyed), { x: 10, y: 20, width: 20, height: 30 });
  assert.equal(contentBounds({ data: new Uint8ClampedArray(8 * 8 * 4), width: 8, height: 8 }), null);
  const fitted = fitToFrame(keyed, 46);
  const box = contentBounds(fitted)!;
  assert.deepEqual([fitted.width, fitted.height, box.height, box.width], [52, 52, 46, Math.round((20 * 46) / 30)]);
  assert.equal(box.y + box.height, 52 - 2);
  assert.ok(fitted.data.every((value, index) => index % 4 !== 3 || value === 0 || value === 255));
  const up = upscaleNearest(
    { data: Uint8ClampedArray.from([10, 20, 30, 255, 40, 50, 60, 255]), width: 2, height: 1 },
    2,
  );
  assert.deepEqual([up.width, up.height, px(up, 1, 1), px(up, 2, 0)], [4, 2, [10, 20, 30, 255], [40, 50, 60, 255]]);
  // The one-picture fallback is a strip of three 52x52 frames at 2x, all standing on art row 49 (pixel rows 98-99).
  const formed = formFromPainting(picture, "adult")!;
  assert.deepEqual([formed.width, formed.height], [312, 104]);
  for (let f = 0; f < 3; f++) {
    let bottom = -1;
    for (let y = 0; y < 104; y++)
      for (let x = f * 104; x < f * 104 + 104; x++) if (formed.data[(y * 312 + x) * 4 + 3]) bottom = y;
    assert.equal(bottom, 99, `frame ${f}`);
  }
  assert.equal(formFromPainting(make(64, 64, BG), "adult"), null);
  // A background that is not one flat colour is refused, so the painting fails instead of saving a bad cut-out: a
  // gradient keys only near its top corners, and a busy pattern keys into scattered scraps.
  const gradient = make(64, 64, BG);
  for (let y = 0; y < 64; y++) paint(gradient, 0, y, 64, 1, [100 + y * 2, 180, 240 - y * 2]);
  paint(gradient, 22, 20, 20, 30, RED);
  assert.equal(formFromPainting(gradient, "adult"), null);
  const scraps = make(64, 64, BG);
  for (let y = 2; y < 62; y += 2) for (let x = 2; x < 62; x += 2) paint(scraps, x, y, 1, 1, [30, 90, 40]);
  paint(scraps, 22, 20, 20, 30, RED);
  assert.equal(formFromPainting(scraps, "adult"), null);
}

// 6n. Strip frames, the shared palette and the sheet reader, all on small synthetic pictures
{
  const blankFrame = (width = 52, height = 52): Rgba => ({
    data: new Uint8ClampedArray(width * height * 4),
    width,
    height,
  });
  const fill = (img: Rgba, x0: number, y0: number, w: number, h: number, c: number[]) => {
    for (let y = y0; y < y0 + h; y++)
      for (let x = x0; x < x0 + w; x++) img.data.set([...c, 255], (y * img.width + x) * 4);
  };
  const at = (img: Rgba, x: number, y: number) => [
    ...img.data.subarray((y * img.width + x) * 4, (y * img.width + x) * 4 + 4),
  ];
  /** The first and last solid row, and the first and last solid column of row y, inside columns [x0, x1). */
  const rowsOf = (img: Rgba, x0 = 0, x1 = img.width) => {
    const ys: number[] = [];
    for (let y = 0; y < img.height; y++)
      for (let x = x0; x < x1; x++)
        if (img.data[(y * img.width + x) * 4 + 3]) {
          ys.push(y);
          break;
        }
    return [ys[0]!, ys[ys.length - 1]!];
  };
  const spanOfRow = (img: Rgba, y: number) => {
    const xs = [...Array(img.width).keys()].filter((x) => img.data[(y * img.width + x) * 4 + 3]);
    return [xs[0]!, xs[xs.length - 1]!];
  };

  // A 20x30 creature on the floor (art rows 20-49): ink outline, beige body, an orange stripe on row 30.
  const INK = [30, 20, 10];
  const BODY = [200, 180, 150];
  const STRIPE = [250, 100, 50];
  const creature = blankFrame();
  fill(creature, 16, 20, 20, 30, INK);
  fill(creature, 17, 21, 18, 28, BODY);
  fill(creature, 17, 30, 18, 1, STRIPE);

  // (a) A creature's second frame sinks (the top moves down a row) and its third rises, bottom fixed on row 49.
  assert.equal(quietRow(creature), 47);
  const [rest, squash, stretch] = creatureStrip(creature);
  assert.equal(rest, creature);
  assert.deepEqual(
    [rowsOf(rest), rowsOf(squash), rowsOf(stretch)],
    [
      [20, 49],
      [21, 49],
      [19, 49],
    ],
  );
  assert.deepEqual(
    [at(squash, 25, 31), at(stretch, 25, 29)],
    [
      [...STRIPE, 255],
      [...STRIPE, 255],
    ],
  );
  assert.deepEqual(
    [at(squash, 25, 21), at(stretch, 25, 19), at(squash, 25, 49)],
    [
      [...INK, 255],
      [...INK, 255],
      [...INK, 255],
    ],
  );

  // (b) An egg's second frame rocks left: top third 2 px, middle third 1 px, bottom third not at all.
  const [still, left, right] = eggStrip(creature);
  assert.equal(still, creature);
  assert.deepEqual(
    [spanOfRow(left, 25), spanOfRow(left, 35), spanOfRow(left, 45)],
    [
      [14, 33],
      [15, 34],
      [16, 35],
    ],
  );
  assert.deepEqual(
    [spanOfRow(right, 25), spanOfRow(right, 35), spanOfRow(right, 49)],
    [
      [18, 37],
      [17, 36],
      [16, 35],
    ],
  );
  assert.deepEqual(rowsOf(left), [20, 49]);

  // (c) One palette of at most 16 colours, outline in its darkest, lone specks gone, a small bright part kept.
  const noisy = blankFrame();
  for (let y = 0; y < 20; y++)
    for (let x = 0; x < 20; x++) {
      const i = (x + y * 3) % 40;
      noisy.data.set([i * 6, 255 - i * 6, (i * 37) % 256, 255], ((10 + y) * 52 + 10 + x) * 4);
    }
  noisy.data.set([255, 255, 255, 255], (2 * 52 + 2) * 4);
  const [pal] = reducePalette([noisy]);
  const solid = (img: Rgba, x: number, y: number) => x >= 0 && y >= 0 && x < 52 && y < 52 && at(img, x, y)[3] === 255;
  const used = new Set<string>();
  for (let y = 0; y < 52; y++) for (let x = 0; x < 52; x++) if (solid(pal!, x, y)) used.add(at(pal!, x, y).join());
  assert.ok(used.size <= 16 && used.size > 1);
  const darkest = [...used]
    .map((c) => c.split(",").slice(0, 3).map(Number))
    .sort((a, b) => a[0]! + a[1]! + a[2]! - (b[0]! + b[1]! + b[2]!))[0]!;
  assert.equal(at(pal!, 2, 2)[3], 0);
  assert.equal(solid(pal!, 10, 10), true);
  for (let y = 0; y < 52; y++)
    for (let x = 0; x < 52; x++) {
      if (!solid(pal!, x, y)) continue;
      const edge = !solid(pal!, x - 1, y) || !solid(pal!, x + 1, y) || !solid(pal!, x, y - 1) || !solid(pal!, x, y + 1);
      if (edge) assert.deepEqual(at(pal!, x, y), [...darkest, 255], `edge ${x},${y}`);
    }
  const flamed = blankFrame();
  fill(flamed, 10, 10, 30, 30, [225, 205, 170]);
  fill(flamed, 20, 20, 3, 3, [250, 120, 20]);
  fill(flamed, 14, 14, 6, 6, [210, 190, 160]);
  const [kept] = reducePalette([flamed]);
  const [fr, fg, fb] = at(kept!, 21, 21);
  assert.ok(fr! > 200 && fg! < 170 && fb! < 100, `orange kept: ${at(kept!, 21, 21)}`);

  // (d) Reading a sheet: five rows (two eggs, then four views each) as filled rectangles on white.
  const TOPS = [20, 160, 320, 510, 720];
  const HEIGHTS = [100, 120, 150, 170, 190];
  const COLS = [2, 4, 4, 4, 4];
  const COLOUR = [60, 90, 200];
  type Rect = [number, number, number, number]; // x, y, width, height
  const baseRects = (): Rect[][] =>
    TOPS.map((top, r) =>
      Array.from({ length: COLS[r]! }, (_, c): Rect => {
        // The content view (column 1) is the tallest of a creature row; the others are 10 px shorter.
        const h = r === 0 || c === 1 ? HEIGHTS[r]! : HEIGHTS[r]! - 10;
        return [(r === 0 ? 300 : 40) + c * (r === 0 ? 300 : 240), top + HEIGHTS[r]! - h, 90, h];
      }),
    );
  const sheetOf = (rows: Rect[][], extra: Rect[] = []): Rgba => {
    const img = blankFrame(1024, 1024);
    img.data.fill(255);
    for (const [x, y, w, h] of [...rows.flat(), ...extra]) fill(img, x, y, w, h, COLOUR);
    return img;
  };
  const boxes = (rows: Rect[][]) => rows.map((row) => row.map(([x, y, width, height]) => ({ x, y, width, height })));
  const rects = baseRects();
  const read = readSheet(sheetOf(rects), COLS)!;
  assert.deepEqual(read.cells, boxes(rects));
  assert.deepEqual(read.notes, []);

  // The model repeated a row: eight drawings in a four-drawing row, the first four are read.
  const repeated = baseRects();
  repeated[1] = Array.from({ length: 8 }, (_, c): Rect => [20 + c * 120, TOPS[1]! + 120 - 100, 80, 100]);
  const again = readSheet(sheetOf(repeated), COLS)!;
  assert.deepEqual(again.cells[1], boxes(repeated)[1]!.slice(0, 4));
  assert.equal(again.notes.length, 1);

  // Two rows touching through a thin 2 px flame still read as five rows (the flame joins the lower drawing).
  const touching = baseRects();
  const flame: Rect = [600, TOPS[2]! + HEIGHTS[2]!, 2, 520 - (TOPS[2]! + HEIGHTS[2]!)];
  const flameRead = readSheet(sheetOf(touching, [flame]), COLS)!;
  assert.deepEqual(
    flameRead.cells.map((row) => row.length),
    COLS,
  );
  assert.deepEqual(flameRead.cells[3]![2], { x: 520, y: flame[1], width: 90, height: 520 + 160 - flame[1] });
  assert.deepEqual(flameRead.cells[2], boxes(touching)[2]);

  // With only two or three rows to find, touching rows still split: the tall band is measured against the other bands,
  // or, when it is alone, against its own ink at the cut. A lone row that does not thin is one row, so a row is missing.
  const trio = baseRects().slice(2);
  const trioRead = readSheet(sheetOf(trio, [flame]), [4, 4, 4])!;
  assert.deepEqual(trioRead.cells[0], boxes(trio)[0]);
  assert.deepEqual(trioRead.cells[2], boxes(trio)[2]);
  const pair = baseRects().slice(3);
  const pairFlame: Rect = [600, TOPS[3]! + HEIGHTS[3]!, 2, 730 - (TOPS[3]! + HEIGHTS[3]!)];
  const pairRead = readSheet(sheetOf(pair, [pairFlame]), [4, 4])!;
  assert.deepEqual(pairRead.cells[0], boxes(pair)[0]);
  assert.deepEqual(
    pairRead.cells.map((row) => row.length),
    [4, 4],
  );
  assert.equal(readSheet(sheetOf(baseRects().slice(4)), [4, 4]), null);

  // Only four rows, no row to find: null. So is a blank sheet.
  assert.equal(readSheet(sheetOf(baseRects().slice(0, 4)), COLS), null);
  assert.equal(readSheet(sheetOf([]), COLS), null);

  // A line of label text under a row, a speck before a row's first drawing and a ground shadow under a drawing are not drawings.
  const decorated = baseRects();
  const noise: Rect[] = [
    [300, 290, 200, 20],
    [5, TOPS[2]! + 50, 20, 20],
    [40, decorated[3]![0]![1] + decorated[3]![0]![3] + 3, 90, 6],
  ];
  const decoratedRead = readSheet(sheetOf(decorated, noise), COLS)!;
  assert.deepEqual(decoratedRead.cells, boxes(decorated));

  // (e) The sheet's rows become forms: every strip is 3 frames at 2x, and the tallest drawing stands at its stage's height.
  const stages = ["egg", "hatchling", "juvenile", "adult", "elder"] as const;
  const forms = formsFromSheet(sheetOf(rects), read, [...stages]);
  assert.deepEqual(Object.keys(forms), [...stages]);
  assert.deepEqual(Object.keys(forms.egg!), ["image"]);
  for (const stage of stages) {
    const form = forms[stage]!;
    if (stage !== "egg") assert.deepEqual(Object.keys(form).sort(), ["grumpy", "happy", "image", "side"]);
    for (const strip of Object.values(form)) assert.deepEqual([strip.width, strip.height], [312, 104]);
    const [top, bottom] = rowsOf(form.image, 0, 104);
    assert.equal((bottom - top + 1) / 2, FORM_SIZES[stage], stage);
    assert.equal(bottom, 99);
  }

  // (f) A caretaker's eight drawings, five facing the viewer over three facing left, become their figure: a 768 x 96
  // strip at 1x, all scaled together so the tallest stands 80 art pixels with its feet on the bottom row and no front
  // one is wider than 48. The front ones stand centred; a side view stands with its back where the front ones end,
  // reaching left, and never off the frame. Two rows of four are read in order, drawings that touch are cut apart,
  // and a sheet whose second row cannot be read keeps the top row's first three (calm, happy, worried).
  const figureSheet = (rows: number[], front = [120, 380], facing = [200, 380], gap = 40): Rgba => {
    const img = blankFrame(1024, 1024);
    img.data.fill(255);
    rows.forEach((count, r) => {
      const [w, h] = r === 0 ? front : facing;
      for (let c = 0; c < count; c++) {
        const tall = r === 0 && c === 1 ? h! + 40 : h!;
        fill(img, 20 + c * (w! + gap), 40 + r * 480 + (420 - tall), w!, tall, COLOUR);
      }
    });
    return img;
  };
  /** The first and last solid column of row y in frame f of a figure, counted from the frame's left. */
  const spanIn = (img: Rgba, f: number, y = 90) => {
    const xs = [...Array(96).keys()].filter((x) => img.data[(y * img.width + f * 96 + x) * 4 + 3]);
    return [xs[0]!, xs[xs.length - 1]!];
  };
  const figure = figureFromSheet(figureSheet([5, 3]))!;
  assert.deepEqual([figure.width, figure.height], [768, 96]);
  assert.deepEqual(rowsOf(figure, 96, 192), [16, 95]);
  assert.deepEqual(rowsOf(figure, 0, 96), [24, 95]);
  assert.deepEqual(rowsOf(figure, 5 * 96, 6 * 96), [24, 95]);
  assert.deepEqual(spanIn(figure, 0), [36, 58]);
  assert.deepEqual(spanIn(figure, 4), [36, 58]);
  for (const f of [5, 6, 7]) assert.deepEqual(spanIn(figure, f), [21, 58]);
  // Side views wide enough to reach off the frame shrink the whole figure until they fit
  const reaching = figureFromSheet(figureSheet([5, 3], [100, 200], [300, 200]))!;
  assert.deepEqual(spanIn(reaching, 0), [39, 56]);
  assert.deepEqual(spanIn(reaching, 5), [2, 56]);
  const wide = figureFromSheet(figureSheet([5, 3], [180, 200], [180, 200]))!;
  assert.equal(spanIn(wide, 0)[1]! - spanIn(wide, 0)[0]! + 1, 48);
  const sizeOf = (img: Rgba | null) => (img ? [img.width, img.height] : null);
  assert.deepEqual(sizeOf(figureFromSheet(figureSheet([4, 4]))), [768, 96]);
  // Touching drawings (gap 0) are cut near even steps; each frame holds one drawing, centred like the rest
  const cut = figureFromSheet(figureSheet([5, 3], undefined, undefined, 0))!;
  assert.deepEqual(sizeOf(cut), [768, 96]);
  const centreOf = (img: Rgba, f: number) => spanIn(img, f).reduce((a, b) => a + b) / 2;
  for (const f of [0, 2, 4]) assert.ok(Math.abs(centreOf(cut, f) - centreOf(figure, f)) <= 1);
  // A second row too short to be cut (two drawings for three) is not guessed at: the top row's first three are kept
  assert.deepEqual(sizeOf(figureFromSheet(figureSheet([5, 2]))), [288, 96]);
  assert.deepEqual(sizeOf(figureFromSheet(figureSheet([5]))), [288, 96]);
  assert.deepEqual(sizeOf(figureFromSheet(figureSheet([3]))), [288, 96]);
  assert.deepEqual(spanIn(figureFromSheet(figureSheet([5]))!, 0), spanIn(figure, 0));
  assert.equal(figureFromSheet(figureSheet([2])), null);
  assert.equal(figureFromSheet(figureSheet([])), null);

  // (h) A painted caretaker blinks where their eyes are found: cartoon eyes wholly inside the face, coloured eyes
  // whose lashes run into the outline, or eyes in a mask. Shut, an eye takes its lid's colour (the face under it)
  // with a lash line 60% down, or no line in a mask darker than the eye. Only the poses facing the viewer blink,
  // and only those whose eyes match the calm pose's; a face with no eyes to find (blush is not eyes), or a calm pose
  // whose eyes cannot be found, never blinks.
  const SKIN = [240, 200, 170];
  const BLUE = [60, 110, 200];
  const MASK = [40, 40, 50];
  /** A figure strip of `count` frames, each a head (rows 16 to 51, outlined) on a body down to row 95. */
  const faceStrip = (count: number, face: (img: Rgba, left: number, f: number) => void) => {
    const img = blankFrame(count * 96, 96);
    for (let f = 0; f < count; f++) {
      fill(img, f * 96 + 29, 16, 38, 36, INK);
      fill(img, f * 96 + 30, 17, 36, 34, SKIN);
      fill(img, f * 96 + 30, 17, 36, 9, [90, 60, 140]);
      fill(img, f * 96 + 34, 52, 28, 44, [150, 50, 60]);
      face(img, f * 96, f);
    }
    return img;
  };
  const cartoonEyes = (img: Rgba, left: number, shift = 0, y = 34) => {
    fill(img, left + 40 + shift, y, 3, 4, INK);
    fill(img, left + 53 + shift, y, 3, 4, INK);
    fill(img, left + 44 + shift, 44, 8, 1, INK);
  };
  const shutFrames = (overlay: Rgba) =>
    [...Array(overlay.width / 96).keys()].filter((f) => contentBounds({ ...overlay, ...frameAt(overlay, f) }));
  const frameAt = (strip: Rgba, f: number): Rgba => {
    const frame = blankFrame(96, 96);
    for (let y = 0; y < 96; y++)
      frame.data.set(
        strip.data.subarray((y * strip.width + f * 96) * 4, (y * strip.width + f * 96 + 96) * 4),
        y * 96 * 4,
      );
    return frame;
  };
  const cartoon = faceStrip(1, (img, left) => cartoonEyes(img, left));
  assert.deepEqual(
    findEyes(cartoon)!.map(({ x0, x1, y0, y1 }) => [x0, x1, y0, y1]),
    [
      [40, 42, 34, 37],
      [53, 55, 34, 37],
    ],
  );
  const cartoonShut = blinkStrip(cartoon)!;
  assert.deepEqual([cartoonShut.width, cartoonShut.height], [96, 96]);
  for (const x of [40, 41, 42, 53, 54, 55]) {
    assert.deepEqual(
      [35, 36, 37].map((y) => at(cartoonShut, x, y)),
      [
        [...SKIN, 255],
        [...INK, 255],
        [...SKIN, 255],
      ],
    );
  }
  assert.equal(at(cartoonShut, 47, 44)[3], 0);
  assert.deepEqual(contentBounds(cartoonShut), { x: 40, y: 34, width: 16, height: 4 });

  const lashed = faceStrip(1, (img, left) => {
    fill(img, left + 30, 33, 13, 1, INK);
    fill(img, left + 53, 33, 13, 1, INK);
    fill(img, left + 40, 34, 3, 4, BLUE);
    fill(img, left + 53, 34, 3, 4, BLUE);
    fill(img, left + 41, 35, 1, 2, [20, 30, 80]);
    fill(img, left + 54, 35, 1, 2, [20, 30, 80]);
  });
  const lashedShut = blinkStrip(lashed)!;
  assert.deepEqual(contentBounds(lashedShut), { x: 40, y: 34, width: 16, height: 4 });
  assert.deepEqual(
    [34, 35, 36, 37].map((y) => at(lashedShut, 41, y)),
    [
      [...SKIN, 255],
      [...SKIN, 255],
      [...INK, 255],
      [...SKIN, 255],
    ],
  );
  assert.equal(at(lashedShut, 41, 33)[3], 0);

  const masked = faceStrip(1, (img, left) => {
    fill(img, left + 34, 32, 28, 8, MASK);
    fill(img, left + 40, 35, 2, 2, [200, 40, 40]);
    fill(img, left + 54, 35, 2, 2, [200, 40, 40]);
  });
  const maskedShut = blinkStrip(masked)!;
  assert.deepEqual(contentBounds(maskedShut), { x: 40, y: 35, width: 16, height: 2 });
  for (const [x, y] of [
    [40, 35],
    [41, 36],
    [55, 36],
  ] as const)
    assert.deepEqual(at(maskedShut, x, y), [...MASK, 255]);

  const blushing = faceStrip(1, (img, left) => {
    fill(img, left + 36, 42, 3, 2, [250, 170, 170]);
    fill(img, left + 57, 42, 3, 2, [250, 170, 170]);
  });
  assert.equal(findEyes(blushing), null);
  assert.equal(blinkStrip(blushing), null);

  // Eight frames: the waving pose's head stands 3 columns further right and still blinks; a worried pose whose eyes
  // sit 6 rows higher is another face, and does not; the side views never do
  const posed = faceStrip(8, (img, left, f) => cartoonEyes(img, left, f === 4 ? 3 : 0, f === 2 ? 28 : 34));
  assert.deepEqual(shutFrames(blinkStrip(posed)!), [0, 1, 3, 4]);
  assert.deepEqual(contentBounds(frameAt(blinkStrip(posed)!, 4)), { x: 43, y: 34, width: 16, height: 4 });
  assert.deepEqual(shutFrames(blinkStrip(faceStrip(3, (img, left) => cartoonEyes(img, left)))!), [0, 1, 2]);
  assert.equal(blinkStrip(faceStrip(8, (img, left, f) => (f ? cartoonEyes(img, left) : undefined))), null);

  // A figure breathes as the pets do: below it, a row in which each frame drops its quietRow, so the top sinks one
  // pixel and the feet stay put; the blink is made the same way, so it stays on the eyes in either row
  const breathing = breathingFigure(posed);
  const rowOf = (img: Rgba, row: number): Rgba => ({
    width: img.width,
    height: 96,
    data: img.data.slice(row * img.width * 96 * 4, (row + 1) * img.width * 96 * 4),
  });
  assert.deepEqual([breathing.body.width, breathing.body.height], [8 * 96, 192]);
  assert.deepEqual(rowOf(breathing.body, 0).data, posed.data);
  assert.deepEqual(rowOf(breathing.blink!, 0).data, blinkStrip(posed)!.data);
  for (let f = 0; f < 8; f++) {
    const k = quietRow(frameAt(posed, f));
    assert.ok(k > 52, `frame ${f} drops a row of its body, not its head`);
    assert.deepEqual(frameAt(rowOf(breathing.body, 1), f).data, squashFrame(frameAt(posed, f), k).data);
    assert.deepEqual(frameAt(rowOf(breathing.blink!, 1), f).data, squashFrame(frameAt(blinkStrip(posed)!, f), k).data);
  }
  const standing = contentBounds(frameAt(posed, 0))!;
  const breathedOut = contentBounds(frameAt(rowOf(breathing.body, 1), 0))!;
  assert.deepEqual([breathedOut.y, breathedOut.y + breathedOut.height], [standing.y + 1, standing.y + standing.height]);
  assert.deepEqual(contentBounds(frameAt(rowOf(breathing.blink!, 1), 0)), { x: 40, y: 35, width: 16, height: 4 });
  assert.equal(breathingFigure(blushing).blink, null);
}

// 6n2. The caretaker's figure is asked for as eight poses in the rows and order the reader takes them (five facing
//      the viewer over three facing left, toward a pet not drawn), with their card's appearance (cut to 400
//      characters) and a word about the pictures sent with it
{
  const prompt = caretakerFigureRequest("Nahida", "Small, with long white hair.\n\nGreen eyes.  ", 2);
  assert.match(
    prompt,
    /^Pixel art, .* Eight drawings of the same character, Nahida, in two rows, all the same size and evenly spaced, with a wide gap of white around each one so no hair, tail, hand or held thing touches the next drawing/u,
  );
  assert.match(
    prompt,
    /top row has five, seen from the front: calm; happy and smiling; worried; talking, [^;]+; waving hello\./u,
  );
  assert.match(
    prompt,
    /bottom row has three, seen from the side, facing the left edge of the picture and looking down: holding out a small bowl; holding out a small toy; reaching down gently with both hands\./u,
  );
  // The pet is not mentioned: a weak model would draw it
  assert.equal(/\bpet\b/u.test(prompt), false);
  assert.equal(FIGURE_POSES.length, 8);
  assert.match(prompt, /What Nahida looks like: Small, with long white hair\. Green eyes\. /u);
  assert.match(prompt, /Keep Nahida's hair, face, outfit and colours from the reference images\./u);
  assert.match(prompt, /Plain flat white background\.$/u);
  assert.match(caretakerFigureRequest("Nahida", "", 1), /from the reference image\./u);
  const bare = caretakerFigureRequest("Il Dottore", "x".repeat(900), 0);
  assert.equal(bare.includes("reference image"), false);
  assert.ok(bare.includes(`looks like: ${"x".repeat(400)}.`));
  assert.equal(bare.includes("x".repeat(401)), false);
  assert.equal(caretakerFigureRequest("Mari", "", 1).includes("looks like"), false);

  // The three-drawing fallback is the first three poses in one row, with the same look and reference lines
  const row = caretakerRowRequest("Nahida", "Small, with long white hair.", 1);
  assert.match(row, /Three drawings of the same character, Nahida, in one row, seen from the front, /u);
  assert.match(row, /: calm; happy and smiling; worried\. Each one full body/u);
  assert.match(row, /What Nahida looks like: Small, with long white hair\./u);
  assert.match(row, /Keep Nahida's hair, face, outfit and colours from the reference image\./u);
  assert.equal(row.includes("Eight drawings"), false);
  assert.equal(caretakerRowRequest("Nahida", "x".repeat(900), 0).includes("x".repeat(401)), false);
}

// 6n3. Every prompt opens with the style tags, in the words weaker image models follow: no measures they cannot take
//      (pixels, colour counts, hex codes, ratios) and no negations, which belong in the negative prompt
{
  const { pet } = createEggFromCaretaker({ profile, nowIso: t0, seed: 11 });
  const prompts = [
    portraitAppearance({ ...pet, stage: "adult" as const }, true),
    portraitAppearance({ ...pet, stage: "adult" as const, design: inkMoth }, false),
    formRequest(inkMoth, "egg", null),
    formRequest(inkMoth, "juvenile", "earlier"),
    sheetRequest(inkMoth, null),
    sheetRequest(inkMoth, "before"),
    caretakerFigureRequest("Nahida", "Small, with long white hair.", 2),
    caretakerRowRequest("Nahida", "Small, with long white hair.", 0),
    sceneRequest("a sunny rock pool by the sea."),
    sceneRequest(SCENE_PROMPTS.shellbini),
  ];
  for (const prompt of prompts) {
    assert.ok(prompt.startsWith("Pixel art"), prompt);
    assert.equal(/\d+\s*pixels?/u.test(prompt), false, prompt);
    for (const banned of ["#FFFFFF", "16:9", "not a human", "Do not draw", "no shadow", "No text"]) {
      assert.equal(prompt.includes(banned), false, `${banned}: ${prompt}`);
    }
  }
  // The scene and the sheet say where things go, and the sheet still keeps its pose words off the picture
  assert.match(sceneRequest("a lamp room."), /A wide side-on scene of a lamp room, seen like a stage set: /u);
  assert.equal(SCENE_PROMPTS.shellbini.includes("starfish"), false);
  assert.ok(sheetRequest(inkMoth, null).includes("Do not write these words or any label on the picture."));

  // What each request leaves out goes in its negative prompt, which every kind carries; an egg's also drops the face
  const negatives = [
    PORTRAIT_NEGATIVE,
    FORM_NEGATIVE,
    EGG_FORM_NEGATIVE,
    SHEET_NEGATIVE,
    FIGURE_NEGATIVE,
    SCENE_NEGATIVE,
  ];
  for (const negative of negatives) assert.ok(negative.includes("text"), negative);
  assert.ok(FIGURE_NEGATIVE.includes("pet"));
  assert.ok(SCENE_NEGATIVE.includes("creatures"));
  assert.ok(EGG_FORM_NEGATIVE.includes("face"));
  assert.equal(FORM_NEGATIVE.includes("face"), false);
  assert.equal(formNegative("egg"), EGG_FORM_NEGATIVE);
  assert.equal(formNegative("adult"), FORM_NEGATIVE);
}

// 6n3b. The player's own instructions for an Album painting replace the plain background and nothing else, and let
//       the caretaker into the picture; empty ones change nothing
{
  const { pet } = createEggFromCaretaker({ profile, nowIso: t0, seed: 11 });
  const adult = { ...pet, stage: "adult" as const };
  const plain = portraitAppearance(adult, true);
  for (const empty of ["", "   ", " \n\t "]) {
    assert.equal(portraitAppearance(adult, true, empty), plain);
    assert.equal(portraitNegative(empty), PORTRAIT_NEGATIVE);
  }
  const asked = portraitAppearance(adult, true, "  sitting in a  teacup at a café,\nrain outside ");
  assert.ok(asked.startsWith("Pixel art"));
  assert.ok(asked.endsWith(" Full body. Sitting in a teacup at a café, rain outside."), asked);
  assert.equal(asked.includes("Plain flat white background"), false);
  assert.equal(asked.includes("One single creature"), false);
  // Everything before the scene is the plain prompt's, up to and including the face
  assert.ok(asked.startsWith(plain.slice(0, plain.indexOf(" One single creature"))));
  assert.ok(portraitAppearance(adult, false, "waving!").endsWith(" Full body. Waving!"));
  assert.ok(portraitAppearance(adult, false, "Is it raining?").endsWith(" Full body. Is it raining?"));
  const withText = portraitNegative("with my caretaker");
  assert.equal(withText.includes("human"), false);
  assert.equal(withText.includes("person"), false);
  assert.ok(withText.includes("cropped") && withText.includes("text"));
  // A stored caption that is not text is dropped, and one that is stays
  const kept = normalizeSaucelingWorld({
    portraits: [
      { id: "a", petId: "p", petName: "N", species: "rigamuffin", stage: "adult", savedAt: t0, instructions: 7 },
      { id: "b", petId: "p", petName: "N", species: "rigamuffin", stage: "adult", savedAt: t0, instructions: "tea" },
    ],
  }).portraits;
  assert.equal("instructions" in kept[0]!, false);
  assert.equal(kept[1]!.instructions, "tea");
  assert.ok(PAINT_INSTRUCTIONS_CHARS > 0);
}

// 6n4. A caretaker's figure is asked for until one reads: with the pictures, then without (a reference is the
//      starting picture on A1111 and Forge), then, if the player allows, as three drawings in one row
{
  const refs = ["data:image/jpeg;base64,a", "data:image/jpeg;base64,b"];
  const attempts = figureAttempts("Nahida", "Small.", refs, false);
  assert.equal(attempts.length, 2);
  assert.deepEqual(attempts[0]!.references, refs);
  assert.ok(attempts[0]!.prompt.includes("reference images"));
  assert.deepEqual(attempts[1]!.references, []);
  assert.equal(attempts[1]!.prompt.includes("reference image"), false);
  assert.ok(attempts[1]!.prompt.startsWith("Pixel art"));
  assert.equal(figureAttempts("Nahida", "Small.", [], false).length, 1);
  const withRow = figureAttempts("Nahida", "Small.", refs, true);
  assert.equal(withRow.length, 3);
  assert.equal(withRow[2]!.prompt, caretakerRowRequest("Nahida", "Small.", 0));
  assert.deepEqual(withRow[2]!.references, []);
  const noRefsWithRow = figureAttempts("Nahida", "Small.", [], true);
  assert.equal(noRefsWithRow.length, 2);
  assert.ok(noRefsWithRow[1]!.prompt.startsWith("Pixel art"));
  assert.ok(noRefsWithRow[1]!.prompt.includes("Three drawings"));
}

// 6o. Special eggs unlock by one milestone each and stay unlocked; Halloween eggs come in October (UTC) only;
//     a found egg and a caretaker's lean are always ordinary species
{
  const milestones = { careActions: 0, careDays: 0, lastCareDay: null };
  const elder = { reachedElder: true } as SaucelingMenagerieEntry;
  const world = { activePet: null, menagerie: [elder, elder], milestones, unlocked: [] as SaucelingSpecialSpeciesId[] };
  assert.deepEqual(latchUnlocks(world), []);
  const elderPet = { elderSinceAt: "2026-10-01T00:00:00.000Z" } as SaucelingPet;
  const unlocked = latchUnlocks({ ...world, activePet: elderPet });
  assert.deepEqual(unlocked, ["prismite"]);
  // Releasing an elder later leaves it unlocked; progress shows the elders there are now
  const released = { ...world, menagerie: [elder], unlocked };
  assert.deepEqual(latchUnlocks(released), ["prismite"]);
  assert.deepEqual(unlocksOf(released, "2026-09-30T23:59:00.000Z").prismite, { done: true, have: 1, need: 3 });
  // Evolving counts like raising an elder, once for one that did both; an undone evolution no longer counts
  const evolvedEntry = (at: string | null, reachedElder = false) =>
    ({ reachedElder, evolution: { at } }) as SaucelingMenagerieEntry;
  const evolvedPet = { elderSinceAt: null, evolution: { at: "2026-10-02T00:00:00.000Z" } } as SaucelingPet;
  const evolvedWorld = {
    ...world,
    activePet: evolvedPet,
    menagerie: [
      evolvedEntry("2026-10-01T00:00:00.000Z", true),
      evolvedEntry("2026-10-01T00:00:00.000Z"),
      evolvedEntry(null),
    ],
  };
  assert.equal(unlocksOf(evolvedWorld, "2026-09-30T23:59:00.000Z").prismite.have, 3);
  assert.deepEqual(latchUnlocks(evolvedWorld), ["prismite"]);

  let care = countCare(milestones, "2026-10-01");
  care = countCare(care, "2026-10-01");
  care = countCare(care, "2026-10-02");
  assert.deepEqual(care, { careActions: 3, careDays: 2, lastCareDay: "2026-10-02" });
  const devoted = { ...world, milestones: { careActions: 250, careDays: 30, lastCareDay: "2026-10-02" } };
  assert.deepEqual(latchUnlocks(devoted), ["thundrake", "clockrit"]);
  assert.deepEqual(unlocksOf(devoted, "2026-10-02T00:00:00.000Z").thundrake, { done: false, have: 100, need: 100 });

  assert.equal(unlocksOf(world, "2026-09-30T23:59:59.000Z").halloween, false);
  assert.equal(unlocksOf(world, "2026-10-01T00:00:00.000Z").halloween, true);
  assert.deepEqual(availableSpecies(world, "2026-09-15T12:00:00.000Z"), [...ORDINARY_SPECIES]);
  assert.deepEqual(availableSpecies(world, "2026-11-01T00:00:00.000Z"), [...ORDINARY_SPECIES]);
  const october = availableSpecies({ ...world, unlocked: ["clockrit"] }, "2026-10-31T23:00:00.000Z");
  assert.deepEqual(october, [...ORDINARY_SPECIES, ...SEASONAL_SPECIES, "clockrit"]);

  // An adopted egg draws only from what is available; a found egg (no list) is always ordinary
  const plain = neutralCareProfile("char-3", "Plain");
  const draws = (available?: typeof october) =>
    new Set(
      Array.from(
        { length: 400 },
        (_, i) => createEggFromCaretaker({ profile: plain, nowIso: t0, seed: i + 1, available }).pet.species,
      ),
    );
  assert.deepEqual([...draws(october)].sort(), [...october].sort());
  assert.deepEqual([...draws()].sort(), [...ORDINARY_SPECIES].sort());

  // A caretaker leans to ordinary species only, and the model is only offered those
  const leaning = normalizeCareProfile({ speciesLean: ["prismite", "wickwisp", "mossaboo"] }, "c", "C", "d", true);
  assert.equal(leaning.speciesLean[0], "mossaboo");
  assert.ok(leaning.speciesLean.every((id) => (ORDINARY_SPECIES as readonly string[]).includes(id)));
  const careSource = readFileSync(
    new URL(
      "../packages/saucelings/src/engine/packages/server/src/services/saucelings/care-profile.ts",
      import.meta.url,
    ),
    "utf8",
  );
  const offered = /"Species ids: ([^"]+)"/u
    .exec(careSource)![1]
    .match(/([a-z]+) \(/gu)!
    .map((m) => m.slice(0, -2));
  assert.deepEqual(offered, [...ORDINARY_SPECIES]);
  assert.ok(careSource.includes(`"speciesLean":${JSON.stringify(ORDINARY_SPECIES)}`));

  // A world saved before milestones starts from the nook pet's care actions; unknown unlock ids are dropped
  const { pet: carer } = createEggFromCaretaker({ profile: plain, nowIso: t0, seed: 5 });
  const saved = normalizeSaucelingWorld({
    activePet: { ...carer, careActionCount: 120 },
    unlocked: ["wickwisp", "clockrit"],
  });
  assert.deepEqual(saved.milestones, { careActions: 120, careDays: 0, lastCareDay: null });
  assert.deepEqual(saved.unlocked, ["thundrake", "clockrit"]);
}

// Lines from a click (Check in, a new caretaker's hello, a welcome back, a farewell) are always written and never
// counted against the daily limit; the rest come out of what is left of it, and only a charged line that was not
// written is given back
{
  const nowIso = "2026-10-22T12:00:00.000Z";
  const day = "2026-10-22";
  const { pet } = createEggFromCaretaker({ profile: neutralCareProfile("c", "Cara", "d"), nowIso, seed: 1 });
  const line = (kind: SaucelingEventKind, speaker?: string) => ({
    id: kind,
    kind,
    createdAt: nowIso,
    text: "-",
    generated: false,
    ...(speaker ? { speaker } : {}),
  });
  const reserve = (kinds: SaucelingEventKind[], used: number, limit: number, writeEveryLine = false) => {
    const reserved = reserveLines({
      pet,
      events: kinds.map((kind) => line(kind, kind === "user-care" ? undefined : "Cara")),
      budget: { day, used },
      settings: { ...normalizeSaucelingSettings({}), dailyGenerationBudget: limit, writeEveryLine },
      nowIso,
    });
    return { picked: reserved.request?.events.map((ev) => ev.kind) ?? [], used: reserved.budget.used };
  };
  assert.deepEqual(reserve(["check-in"], 6, 6), { picked: ["check-in"], used: 6 });
  assert.deepEqual(reserve(["farewell", "hatch"], 0, 0), { picked: ["farewell"], used: 0 });
  assert.deepEqual(reserve(["caretaker-change"], 3, 0), { picked: ["caretaker-change"], used: 3 });
  assert.deepEqual(reserve(["return-from-album"], 0, 0), { picked: ["return-from-album"], used: 0 });
  assert.deepEqual(reserve(["hatch"], 6, 6), { picked: [], used: 6 });
  assert.deepEqual(reserve(["hatch", "stage-up"], 5, 6), { picked: ["hatch"], used: 6 });
  // Still two lines a save at most
  assert.deepEqual(reserve(["check-in", "hatch", "stage-up"], 0, 6), { picked: ["check-in", "hatch"], used: 1 });

  const world = { ...normalizeSaucelingWorld({}), budget: { day, used: 4 } };
  const request = { pet, events: [line("check-in"), line("hatch")], day, charged: ["hatch"] };
  assert.equal(applyLines(world, request, new Map()).budget.used, 3);
  assert.equal(applyLines(world, request, new Map([["hatch", "Out it came."]])).budget.used, 4);

  // With every line from the model, each caretaker line is asked for, routine care too, up to six a save, and none
  // is charged or given back; the player's own actions keep their line
  assert.equal(normalizeSaucelingSettings({}).writeEveryLine, false);
  assert.equal(normalizeSaucelingSettings({ writeEveryLine: "yes" }).writeEveryLine, false);
  // The simpler caretaker figure is opt-in
  assert.equal(normalizeSaucelingSettings({}).threeDrawingFallback, false);
  assert.equal(normalizeSaucelingSettings({ threeDrawingFallback: "yes" }).threeDrawingFallback, false);
  assert.equal(normalizeSaucelingSettings({ threeDrawingFallback: true }).threeDrawingFallback, true);
  assert.deepEqual(reserve(["caretaker-care", "user-care", "hatch"], 6, 6, true), {
    picked: ["caretaker-care", "hatch"],
    used: 6,
  });
  assert.equal(reserve(Array(8).fill("caretaker-care"), 0, 6, true).picked.length, 6);
  assert.deepEqual(reserve(["user-care"], 0, 6, true), { picked: [], used: 0 });
  const free = { pet, events: [line("caretaker-care")], day, charged: [] };
  assert.equal(applyLines(world, free, new Map()).budget.used, 4);
}

// 6p. Whoever found an egg stays with it; a sauceling that is not pasta has a temperament of its own, taking after
// its finder and then, two weeks at a time, after a new caretaker; a hatchling's name is checked like a design
{
  const egg = createEggFromCaretaker({ profile, nowIso: t0, seed: 5 }).pet;
  assert.deepEqual(egg.finder, { id: "char-1", name: "Dottore" });
  assert.deepEqual([egg.ownTemperament, egg.caretakerSince, egg.eggSpot], [null, t0, null]);
  const pasta = { ...egg, species: "rigamuffin" as const, design: null, stage: "hatchling" as const };
  const moss = { ...pasta, species: "mossaboo" as const };
  assert.deepEqual([isPasta(pasta), isPasta(moss), isPasta({ ...pasta, design: inkMoth })], [true, false, false]);
  assert.ok(temperamentOf(pasta)?.sauce);
  assert.equal(temperamentOf(moss), null);

  const day = 86_400_000;
  const at = (days: number) => Date.parse(t0) + days * day;
  const own = { name: "Clinical", readsAs: "watches everything", takesAfter: egg.finder, steps: 3 as const, at: t0 };
  assert.deepEqual(temperamentOf({ ...moss, ownTemperament: own }), {
    name: "Clinical",
    readsAs: "watches everything",
    sauce: null,
  });
  assert.equal(TAKE_AFTER_MS, 14 * day);
  assert.equal(ownTemperamentDue({ ...moss, stage: "egg" }, at(30)), null);
  assert.equal(ownTemperamentDue(pasta, at(30)), null);
  assert.equal(ownTemperamentDue(moss, at(0)), "first");
  // With the caretaker it takes after, nothing more is due
  assert.equal(ownTemperamentDue({ ...moss, ownTemperament: own }, at(300)), null);
  // A new caretaker: a step two weeks after they took it on, and two weeks after each step, until it takes after
  // them fully; Menagerie days are not counted, since coming back starts the two weeks again
  const handed = {
    ...moss,
    ownTemperament: own,
    caretakerId: "char-2",
    caretakerSince: new Date(at(20)).toISOString(),
  };
  assert.equal(ownTemperamentDue(handed, at(33.9)), null);
  assert.equal(ownTemperamentDue(handed, at(34)), "step");
  const nahida = { id: "char-2", name: "Nahida" };
  const stepped = {
    ...handed,
    ownTemperament: { ...own, takesAfter: nahida, steps: 1 as const, at: new Date(at(34)).toISOString() },
  };
  assert.equal(ownTemperamentDue(stepped, at(47)), null);
  assert.equal(ownTemperamentDue(stepped, at(48)), "step");
  assert.equal(
    ownTemperamentDue({ ...stepped, ownTemperament: { ...stepped.ownTemperament, steps: 3 } }, at(300)),
    null,
  );

  assert.deepEqual(
    normalizeNature(
      { name: " Mossimo ", temperament: { name: "Clinical", readsAs: "watches everything, unbothered." } },
      "Mossaboo",
    ),
    { name: "Mossimo", temperament: { name: "Clinical", readsAs: "watches everything, unbothered" } },
  );
  // Its kind's name, a built-in name, numbers and food are refused, each part on its own
  for (const name of ["mossaboo", "Marinara", "Rigamuffin", "R2-D2", ""]) {
    assert.equal(normalizeNature({ name }, "Mossaboo").name, null, name);
  }
  assert.deepEqual(
    normalizeNature({ name: "Pebble", temperament: { name: "Hungry", readsAs: "dreams of tomatoes" } }, "Mossaboo"),
    { name: "Pebble", temperament: null },
  );
  assert.deepEqual(normalizeNature("not an answer", "Mossaboo"), { name: null, temperament: null });
  // A temperament is one plain word and a few words of how it acts; a glued or two-word name, or its finder's card
  // retold at length, is refused
  assert.deepEqual(
    normalizeNature({ temperament: { name: "cheeky", readsAs: "Mischievous, nippy, hard to impress." } }, "Mossaboo")
      .temperament,
    { name: "Cheeky", readsAs: "mischievous, nippy, hard to impress" },
  );
  const retold =
    "Brilliantly chaotic and sharply opinionated, quick to drop a dark joke or a sarcastic critique over poor formatting.";
  for (const temperament of [
    { name: "ChaoticSarcastic", readsAs: "chaotic, sarcastic" },
    { name: "Quietly Curious", readsAs: "watches everything" },
    { name: "Chaotic", readsAs: retold },
  ]) {
    assert.equal(normalizeNature({ temperament }, "Mossaboo").temperament, null, temperament.name);
  }
  // A saved one that fails those checks is dropped, so its first is written again
  const glued = normalizeSaucelingWorld({
    schemaVersion: 1,
    activePet: { ...moss, ownTemperament: { ...own, name: "ChaoticSarcastic", readsAs: retold } },
  }).activePet!;
  assert.equal(glued.ownTemperament, null);
  assert.equal(ownTemperamentDue(glued, at(0)), "first");
  assert.equal(
    templateTakesAfterScene(neutralCareProfile("x", "x"), "Mossimo", "Quietly Curious"),
    "Have you noticed? Mossimo has been a bit more quietly curious lately. I think it's picking up my ways.",
  );

  // A pet saved before finders were kept takes whoever said its egg's first line, with their id from their saved
  // voice; its caretaker's start is its newest hello; a spot is kept on its picture
  const legacy = JSON.parse(JSON.stringify({ ...egg, stage: "hatchling" })) as Record<string, any>;
  delete legacy.finder;
  delete legacy.ownTemperament;
  delete legacy.caretakerSince;
  legacy.eggSpot = { x: 1.4, y: 0.25, backgroundId: "bg-1" };
  legacy.journal = [
    {
      id: "hello-1",
      kind: "caretaker-change",
      createdAt: "2026-10-22T00:00:00.000Z",
      text: "Hi.",
      generated: false,
      speaker: "Nahida",
    },
    { id: "egg-1", kind: "egg-found", createdAt: t0, text: "An egg!", generated: false, speaker: "Old Finder" },
  ];
  const oldFinder = { ...neutralCareProfile("char-9", "Old Finder"), characterName: "Old Finder" };
  const restored = normalizeSaucelingWorld({
    schemaVersion: 1,
    activePet: legacy,
    profileCache: { "char-9": oldFinder },
  }).activePet!;
  assert.deepEqual(restored.finder, { id: "char-9", name: "Old Finder" });
  assert.equal(restored.caretakerSince, "2026-10-22T00:00:00.000Z");
  assert.deepEqual(restored.eggSpot, { x: 1, y: 0.25, backgroundId: "bg-1" });
  assert.equal(restored.ownTemperament, null);
  // With no first line it takes whoever found it while chatting, else its caretaker
  legacy.journal = [];
  legacy.foundBy = "char-7";
  assert.deepEqual(normalizeSaucelingWorld({ schemaVersion: 1, activePet: legacy }).activePet!.finder, {
    id: "char-7",
    name: "Dottore",
  });
  // A finder and temperament travel to the Menagerie and back, where a new stay with its caretaker begins
  const kept = { ...moss, ownTemperament: own };
  const entry = entryFromPet(kept, t0, "Bye.");
  assert.deepEqual([entry.finder, entry.ownTemperament], [egg.finder, own]);
  const { pet: back } = restorePetFromMenagerie(entry, undefined, "2026-11-01T00:00:00.000Z");
  assert.deepEqual(
    [back.finder, back.ownTemperament, back.caretakerSince, back.eggSpot],
    [egg.finder, own, "2026-11-01T00:00:00.000Z", null],
  );
}

// 7. Bundled server.mjs activate(), selfCheck(), and route lifecycle
async function testBundledServer() {
  const { pathToFileURL } = await import("node:url");
  const { resolve, dirname } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const serverMod = await import(pathToFileURL(resolve(repoRoot, "packages/saucelings/server.mjs")).href);

  let registeredPlugin: ((app: unknown, opts: unknown) => Promise<void>) | null = null;
  let registeredPrefix: string | null = null;
  const storedDocs = new Map<string, Record<string, any>>();
  // A model the test can switch on, slow down or break; null means no connection.
  let model: ((options: { signal?: unknown }, messages: Array<{ content: string }>) => Promise<string>) | null = null;
  let modelCalls = 0;
  // Set to make the next save collide with an outside writer once.
  let collideNextSave = false;
  // The egg-hunting contributor the package hands the Engine's prompt-context registry.
  let contributor: ((request: { targetCharacterIds?: string[] }) => unknown) | null = null;

  const fakeApi = {
    runtime: {
      isDebugAgentsEnabled: () => false,
      getAgentConfig: async () => null,
      json: { parseJsonish: (raw: string) => JSON.parse(raw) },
      languageModels: {
        resolveForRequest: async () => {
          if (!model) throw new Error("No connection configured");
          const reply = model;
          return {
            fitContext: (messages: unknown[], options?: { maxTokens?: number }) => ({
              messages,
              maxTokens: options?.maxTokens,
            }),
            chatComplete: async (messages: Array<{ content: string }>, options: { signal?: unknown }) => {
              modelCalls++;
              return { content: await reply(options, messages) };
            },
          };
        },
      },
      resources: {
        listCharacters: async (ids?: string[]) => {
          const nahida = { id: "nahida-2", comment: "", data: { name: "Nahida", personality: "gentle and curious" } };
          const dottore = {
            id: "dottore-1",
            comment: "",
            data: {
              name: "Il Dottore",
              personality: "cold genius scientist, analytic and calculating",
              description: "Harbinger scholar",
              mes_example: "{{char}}: Hold still. This will only sting a little.",
              extensions: { backstory: "Second of the Fatui Harbingers." },
            },
          };
          return !ids ? [dottore, nahida] : ids.includes("nahida-2") ? [nahida] : [dottore];
        },
      },
      persistence: {
        documents: {
          list: async (_pkg: string, kind: string) => [...storedDocs.values()].filter((doc) => doc.kind === kind),
          getById: async (_pkg: string, id: string) => storedDocs.get(id) ?? null,
          create: async (input: Record<string, unknown>) => {
            const doc = { ...input, revision: 1 };
            storedDocs.set(String(input.id), doc);
            return doc;
          },
          update: async (input: Record<string, unknown>) => {
            const existing = storedDocs.get(String(input.id));
            if (collideNextSave && existing) {
              collideNextSave = false;
              storedDocs.set(String(input.id), { ...existing, revision: Number(existing.revision) + 1 });
              return null;
            }
            if (!existing || existing.revision !== input.expectedRevision) return null;
            const doc = { ...existing, ...input, revision: Number(existing.revision) + 1 };
            storedDocs.set(String(input.id), doc);
            return doc;
          },
          remove: async (_pkg: string, id: string, revision: number) =>
            storedDocs.get(id)?.revision === revision && storedDocs.delete(id),
        },
      },
    },
    registerPrivilegedRoutes: async (
      plugin: (app: unknown, opts: unknown) => Promise<void>,
      opts: { prefix: string },
    ) => {
      registeredPlugin = plugin;
      registeredPrefix = opts.prefix;
      return () => {
        registeredPlugin = null;
      };
    },
    registerPromptContext: (registered: typeof contributor) => {
      contributor = registered;
      return () => {
        contributor = null;
      };
    },
  };

  const cleanup = await serverMod.activate({ api: fakeApi });
  assert.equal(registeredPrefix, "/api/saucelings");
  await serverMod.selfCheck();

  type Handler = (req: Record<string, unknown>, reply?: unknown) => Promise<Record<string, any>>;
  const routes = new Map<string, Handler>();
  const fakeReply = () => {
    const reply = {
      statusCode: 200,
      status: (code: number) => ((reply.statusCode = code), reply),
      send: (b: any) => b,
    };
    return reply;
  };
  const fakeApp = {
    get: (p: string, h: Handler) => routes.set(`GET ${p}`, h),
    post: (p: string, h: (req: Record<string, unknown>) => Promise<Record<string, any>>) => routes.set(`POST ${p}`, h),
    patch: (p: string, h: (req: Record<string, unknown>) => Promise<Record<string, any>>) =>
      routes.set(`PATCH ${p}`, h),
  };
  await registeredPlugin!(fakeApp, {});

  const s0 = await routes.get("GET /state")!({});
  assert.equal(s0.world.activePet, null);
  // The state poll leaves out the Menagerie, the Album and the profile cache; they have their own routes
  assert.equal("menagerie" in s0.world, false);
  assert.equal("portraits" in s0.world, false);
  assert.equal("backgrounds" in s0.world, false);
  assert.equal("profileCache" in s0.world, false);
  assert.deepEqual(s0.unlocks.thundrake, { done: false, have: 0, need: 100 });
  assert.equal(s0.menagerieCount, 0);
  assert.equal(s0.portraitCount, 0);
  const menagerieNow = async () => (await routes.get("GET /menagerie")!({})).menagerie as Array<Record<string, any>>;
  const portraitsNow = async () => (await routes.get("GET /portraits")!({})).portraits as Array<Record<string, any>>;
  assert.equal(s0.characters[0].name, "Il Dottore");
  assert.equal(s0.characters[0].hasVoice, false);
  assert.deepEqual(s0.writing, []);
  // Saves answer before the caretaker's words are written; this waits until the last of them has landed.
  const linesLanded = async () => {
    for (let tries = 0; tries < 400; tries++) {
      const state = await routes.get("GET /state")!({});
      if (state.writing.length === 0) return state;
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
    throw new Error("the caretaker's lines never landed");
  };

  // One new egg a UTC day; where the steps below bring in several, a day passes between them.
  const nextDay = () => {
    [...storedDocs.values()].find((doc) => doc.kind === "saucelings-world")!.data.lastNewEggDay = null;
  };

  const s1 = await routes.get("POST /adopt")!({ body: { characterId: "dottore-1", name: "Noodletto" } });
  assert.equal(s1.world.lastNewEggDay, new Date().toISOString().slice(0, 10));
  // An egg has no name of its own: it carries its species name until it hatches and the player names it
  assert.equal(s1.world.activePet.name, SPECIES_CATALOG[s1.world.activePet.species].name);
  assert.equal(s1.latestRemark.includes(s1.world.activePet.name), false);
  assert.equal(s1.world.activePet.careProfile.characterName, "Il Dottore");
  // The egg-found line is still being written when Adopt answers
  assert.deepEqual(s1.writing, [s1.world.activePet.journal[0].id]);
  assert.equal(s1.world.activePet.journal[0].speaker, "Il Dottore");
  // With no model it stays a template and the budget set aside for it is given back
  const l1 = await linesLanded();
  assert.equal(l1.world.activePet.journal[0].generated, false);
  assert.equal(l1.world.budget.used, 0);
  const badRequest = (route: string, body: Record<string, unknown>, message: RegExp) =>
    assert.rejects(
      routes.get(route)!({ body }),
      (error: any) => error.statusCode === 400 && message.test(error.message),
    );
  await badRequest("PATCH /pet", { name: "Noodletto" }, /once it hatches/u);
  await badRequest("POST /action", { action: "feed" }, /still an egg/u);
  // An egg can be moved about its background; the spot is kept with the background it was set on (here the
  // built-in nest), and a spot off the picture is refused
  const moved = await routes.get("PATCH /pet")!({ body: { eggSpot: { x: 0.25, y: 0.8 } } });
  assert.deepEqual(moved.world.activePet.eggSpot, { x: 0.25, y: 0.8, backgroundId: null });
  for (const eggSpot of [{ x: 1.2, y: 0.5 }, { x: 0.5 }, { x: "0.5", y: 0.5 }, "middle"]) {
    await badRequest("PATCH /pet", { eggSpot }, /somewhere on its background/u);
  }
  const unmoved = await routes.get("PATCH /pet")!({ body: { eggSpot: null } });
  assert.equal(unmoved.world.activePet.eggSpot, null);
  assert.equal(unmoved.world.activePet.caretakerSince, s1.world.activePet.createdAt);

  const s2 = await routes.get("POST /action")!({ body: { action: "warm" } });
  assert.equal(s2.world.activePet.careActionCount, 1);
  assert.equal(s2.world.activePet.stage, "egg");
  // The player's care counts towards the special eggs, once a day for the day count
  assert.deepEqual([s2.unlocks.thundrake.have, s2.unlocks.clockrit.have], [1, 1]);
  const s2b = await routes.get("POST /action")!({ body: { action: "talk" } });
  assert.deepEqual([s2b.unlocks.thundrake.have, s2b.unlocks.clockrit.have], [2, 1]);

  // Opening the tab 40 minutes later hatches the fed egg without waiting for a full care window
  const worldDoc = [...storedDocs.values()].find((doc) => doc.kind === "saucelings-world")!;
  worldDoc.data.activePet.createdAt = new Date(Date.now() - 40 * 60_000).toISOString();
  // A Mossaboo is not pasta, so it hatches with a temperament of its own.
  Object.assign(worldDoc.data.activePet, { species: "mossaboo", name: "Mossaboo" });
  // At hatch the writing connection names it and gives it a temperament taking after Il Dottore, who found its egg;
  // then the hatch line says the new name. The naming call is not counted against the day's lines.
  const prompts: string[] = [];
  model = async (_options, messages) => {
    const prompt = messages.map((message) => message.content).join("\n");
    prompts.push(prompt);
    return prompt.startsWith("You help with Saucelings")
      ? JSON.stringify({
          name: "Mossimo",
          temperament: { name: "Clinical", readsAs: "watches everything, unbothered." },
        })
      : JSON.stringify({ text: "Out it tumbled." });
  };
  const opened = await routes.get("GET /state")!({});
  assert.equal(opened.world.activePet.stage, "hatchling");
  const hatchedNow = await linesLanded();
  // Named once, before any line is written
  assert.equal(prompts.filter((prompt) => prompt.startsWith("You help with Saucelings")).length, 1);
  assert.match(prompts[0]!, /It takes after Il Dottore, who found its egg/u);
  assert.match(
    prompts[0]!,
    /Only what a small animal does: .* not ones from Il Dottore's card, and leave out its quirk/u,
  );
  assert.ok(prompts.some((prompt) => /Il Dottore has just named it Mossimo: say its new name\./u.test(prompt)));
  const hatchling = hatchedNow.world.activePet;
  assert.equal(hatchling.name, "Mossimo");
  assert.deepEqual(hatchling.finder, { id: "dottore-1", name: "Il Dottore" });
  assert.deepEqual(
    [hatchling.ownTemperament.name, hatchling.ownTemperament.readsAs, hatchling.ownTemperament.takesAfter],
    ["Clinical", "watches everything, unbothered", { id: "dottore-1", name: "Il Dottore" }],
  );
  assert.equal(hatchedNow.world.budget.used, opened.world.budget.used);
  const named = await routes.get("PATCH /pet")!({ body: { name: "Noodletto" } });
  assert.equal(named.world.activePet.name, "Noodletto");
  await badRequest("PATCH /pet", { eggSpot: { x: 0.5, y: 0.5 } }, /Only an egg can be moved/u);
  await badRequest("PATCH /pet", { caretakerId: "nobody" }, /Only one of your characters can be a caretaker/u);
  // Once renamed, the model is told the new name, and the temperament is how it behaves, not a name
  await routes.get("POST /check-in")!({ body: {} });
  assert.match(prompts.at(-1)!, /Pet's name: Noodletto\./u);
  assert.match(
    prompts.at(-1)!,
    /Its temperament: Clinical, watches everything, unbothered\. That is how it behaves, not its name/u,
  );
  // Two weeks with a caretaker it does not yet take after bring its temperament a step toward theirs, with a line
  // from them about it; the step itself is not counted against the day's lines (only their line is), waits half an
  // hour after the hatch call (the same wait as after a failed call), and nothing more is asked for until two more
  // weeks pass
  const fortnightAgo = new Date(Date.now() - 15 * 86_400_000).toISOString();
  const keptPet = [...storedDocs.values()].find((doc) => doc.kind === "saucelings-world")!.data.activePet;
  Object.assign(keptPet, {
    caretakerSince: fortnightAgo,
    ownTemperament: {
      ...keptPet.ownTemperament,
      takesAfter: { id: "old-keeper", name: "Old Keeper" },
      at: fortnightAgo,
    },
  });
  const promptsBeforeStep = prompts.length;
  const beforeStep = await routes.get("GET /state")!({});
  assert.equal(prompts.length, promptsBeforeStep);
  const realNow = Date.now;
  Date.now = () => realNow() + 31 * 60_000;
  let stepped: any = null;
  try {
    for (let tries = 0; tries < 400 && !stepped; tries++) {
      const state = await routes.get("GET /state")!({});
      if (state.world.activePet.journal[0].id.startsWith("takes-after-")) stepped = state;
      else await new Promise((resolve) => setTimeout(resolve, 5));
    }
    assert.ok(stepped, "the temperament never took a step");
    assert.equal(prompts.length, promptsBeforeStep + 2);
    const stepPrompt = prompts[promptsBeforeStep]!;
    assert.match(stepPrompt, /has been "Clinical: watches everything, unbothered"\. Il Dottore has looked after it/u);
    assert.match(stepPrompt, /keep most of the old one and add a little of theirs/u);
    assert.match(prompts.at(-1)!, /^You are Il Dottore, looking after a little pet/u);
    assert.match(
      prompts.at(-1)!,
      /\nIts traits: [^\n]+\. Its habit: [^\n]+\nIt is not pasta or food: no pasta or sauce jokes/u,
    );
    assert.ok(prompts.at(-1)!.includes(`the Nook's background: ${SCENE_PROMPTS.mossaboo}.`));
    assert.deepEqual(
      [stepped.world.activePet.ownTemperament.takesAfter, stepped.world.activePet.ownTemperament.steps],
      [{ id: "dottore-1", name: "Il Dottore" }, 1],
    );
    assert.deepEqual(stepped.world.activePet.journal[0], {
      ...stepped.world.activePet.journal[0],
      kind: "temperament-shift",
      speaker: "Il Dottore",
      text: "Out it tumbled.",
    });
    assert.equal(stepped.world.budget.used, beforeStep.world.budget.used + 1);
    Date.now = () => realNow() + 62 * 60_000;
    await routes.get("GET /state")!({});
    assert.equal(prompts.length, promptsBeforeStep + 2);
  } finally {
    Date.now = realNow;
  }
  model = null;

  const s3 = await routes.get("POST /nudge")!({ body: { tendency: "affection" } });
  assert.equal(s3.world.activePet.nudges.length, 1);

  // Paintings: stored only when enabled, only as a real image, each in its own document, listed in the Album
  const petId = s3.world.activePet.id as string;
  const pngOf = (...bytes: number[]) =>
    `data:image/png;base64,${Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...bytes]).toString("base64")}`;
  const png = pngOf(1, 2, 3);
  const rejects = (body: Record<string, unknown>) =>
    assert.rejects(
      routes.get("POST /portrait")!({ body: { petId, ...body } }),
      (error: any) => error.statusCode === 400,
    );
  await rejects({ image: png });
  await assert.rejects(
    routes.get("POST /portrait")!({ body: { image: png } }),
    (error: any) => error.statusCode === 400,
  );
  await routes.get("PATCH /settings")!({ body: { portraitEnabled: true, portraitConnectionId: "img-1" } });
  await rejects({ image: "https://image.example/cat.png" });
  await rejects({ image: png.replace("image/png", "image/jpeg") });
  await rejects({ image: `data:image/png;base64,${"A".repeat(6 * 1024 * 1024)}` });
  // A painting for a sauceling that has since been swapped out is refused, and leaves no file behind
  const docsBefore = storedDocs.size;
  await assert.rejects(
    routes.get("POST /portrait")!({ body: { petId: "someone-else", image: png } }),
    (error: any) => error.statusCode === 409,
  );
  assert.equal(storedDocs.size, docsBefore);
  const painted = await routes.get("POST /portrait")!({ body: { petId, image: png } });
  assert.equal(painted.portraitCount, 1);
  assert.equal(painted.world.settings.portraitConnectionId, "img-1");
  assert.equal(JSON.stringify(painted).includes(png), false);
  // A second painting is added, not swapped in
  await routes.get("POST /portrait")!({ body: { petId, image: pngOf(4, 5, 6) } });
  const [second, first] = await portraitsNow();
  assert.deepEqual(
    [first.petId, first.petName, first.stage, first.home, second.home],
    [petId, "Noodletto", "hatchling", "nook", "nook"],
  );
  const image = (id: string, reply = fakeReply()) => routes.get("GET /portrait/:id")!({ params: { id } }, reply);
  assert.deepEqual(await image(first.id), { image: png });
  assert.deepEqual(await image(second.id), { image: pngOf(4, 5, 6) });
  // Instructions are a caption: trimmed, spaces collapsed, capped, and left out when empty or not text
  const caption = async (instructions: unknown) => {
    const added = await routes.get("POST /portrait")!({ body: { petId, image: pngOf(7, 8, 9), instructions } });
    const [newest] = await portraitsNow();
    await routes.get("POST /portrait/:id/delete")!({ params: { id: newest!.id } });
    assert.equal(added.portraitCount, 3);
    return newest!.instructions as string | undefined;
  };
  assert.equal(await caption("  tea   at\ta café  "), "tea at a café");
  assert.equal(await caption("x ".repeat(300)), "x ".repeat(PAINT_INSTRUCTIONS_CHARS / 2).trim());
  assert.equal(await caption("   "), undefined);
  assert.equal(await caption(42), undefined);
  assert.equal((await portraitsNow()).length, 2);
  // A full Album refuses another painting before its image is saved
  const extra: string[] = [];
  while ((await portraitsNow()).length < SAUCELING_PORTRAIT_LIMIT) {
    await routes.get("POST /portrait")!({ body: { petId, image: pngOf(10, extra.length) } });
    extra.push((await portraitsNow())[0]!.id);
  }
  const fullDocs = storedDocs.size;
  await assert.rejects(
    routes.get("POST /portrait")!({ body: { petId, image: png } }),
    (error: any) => error.statusCode === 409,
  );
  assert.equal(storedDocs.size, fullDocs);
  for (const id of extra) await routes.get("POST /portrait/:id/delete")!({ params: { id } });
  // Only paintings the Album lists are served, never another of the package's documents
  const notListed = fakeReply();
  await image(String(worldDoc.id), notListed);
  assert.equal(notListed.statusCode, 404);
  // Delete takes one painting and its image, and the other stays
  const deleted = await routes.get("POST /portrait/:id/delete")!({ params: { id: second.id } });
  assert.equal(deleted.portraitCount, 1);
  assert.deepEqual(
    (await portraitsNow()).map((p) => p.id),
    [first.id],
  );
  assert.equal(storedDocs.has(second.id), false);
  await assert.rejects(
    routes.get("POST /portrait/:id/delete")!({ params: { id: second.id } }),
    (error: any) => error.statusCode === 404,
  );

  // Backgrounds: a real image only; every one saved joins a library shared by every sauceling, and a new one, a
  // cleared one or a released pet's one stays there until it is deleted
  assert.equal(s3.world.activePet.backgroundId, null);
  const webpOf = (...bytes: number[]) =>
    `data:image/webp;base64,${Buffer.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, ...bytes]).toString("base64")}`;
  const background = (id: string, reply = fakeReply()) => routes.get("GET /background/:id")!({ params: { id } }, reply);
  const backgroundGone = async (id: string) => {
    const reply = fakeReply();
    await background(id, reply);
    assert.equal(reply.statusCode, 404);
    assert.equal(storedDocs.has(id), false);
  };
  const libraryNow = async () =>
    ((await routes.get("GET /backgrounds")!({})).backgrounds as Array<Record<string, any>>).map((b) => [
      b.id,
      b.label,
      b.source,
    ]);
  const saveBackground = async (body: Record<string, unknown>) =>
    (await routes.get("POST /background")!({ body })).world.activePet.backgroundId as string;
  for (const bad of ["https://image.example/room.png", png.replace("image/png", "image/jpeg"), 42]) {
    await assert.rejects(
      routes.get("POST /background")!({ body: { image: bad } }),
      (error: any) => error.statusCode === 400 && /PNG, JPEG or WebP image of at most 4 MB/u.test(error.message),
    );
  }
  assert.deepEqual(await libraryNow(), []);
  const bgOne = await saveBackground({ image: webpOf(1), label: "  my room  ", source: "upload" });
  assert.deepEqual(await background(bgOne), { image: webpOf(1) });
  assert.equal(JSON.stringify(await routes.get("GET /state")!({})).includes(webpOf(1)), false);
  // Only backgrounds the library lists are served, never a painting or the world document
  const notBackground = fakeReply();
  await background(first.id, notBackground);
  assert.equal(notBackground.statusCode, 404);
  await new Promise((resolve) => setTimeout(resolve, 2));
  const bgTwo = await saveBackground({ image: webpOf(2), label: "a sunny meadow", source: "generated" });
  assert.notEqual(bgTwo, bgOne);
  assert.deepEqual(await background(bgOne), { image: webpOf(1) });
  assert.deepEqual(await background(bgTwo), { image: webpOf(2) });
  assert.deepEqual(await libraryNow(), [
    [bgTwo, "a sunny meadow", "generated"],
    [bgOne, "my room", "upload"],
  ]);

  // It travels with the pet through the Menagerie and back
  const s4 = await routes.get("POST /retire")!({ body: {} });
  assert.equal(s4.world.activePet, null);
  assert.equal(s4.menagerieCount, 1);
  assert.equal((await menagerieNow())[0].backgroundId, bgTwo);
  assert.deepEqual(await background(bgTwo), { image: webpOf(2) });
  assert.equal((await menagerieNow()).length, 1);
  assert.equal((await portraitsNow())[0].home, "menagerie");
  await assert.rejects(
    routes.get("POST /background/:id/select")!({ params: { id: bgOne } }),
    (error: any) => error.statusCode === 400,
  );

  const menagerieId = (await menagerieNow())[0].id as string;
  const s5 = await routes.get("POST /menagerie/:id/restore")!({ params: { id: menagerieId }, body: {} });
  assert.equal(s5.world.activePet.id, menagerieId);
  assert.equal(s5.menagerieCount, 0);
  assert.equal((await portraitsNow())[0].home, "nook");
  assert.equal(s5.world.activePet.backgroundId, bgTwo);
  const backToBuiltIn = await routes.get("POST /background/clear")!({ body: {} });
  assert.equal(backToBuiltIn.world.activePet.backgroundId, null);
  assert.deepEqual(await background(bgTwo), { image: webpOf(2) });

  // Any saved background can be picked again
  await assert.rejects(
    routes.get("POST /background/:id/select")!({ params: { id: first.id } }),
    (error: any) => error.statusCode === 404,
  );
  const picked = await routes.get("POST /background/:id/select")!({ params: { id: bgOne } });
  assert.equal(picked.world.activePet.backgroundId, bgOne);

  // Deleting a background takes it from every sauceling showing it, in the nook and in the Menagerie
  await routes.get("POST /retire")!({ body: {} });
  // An empty nook does not reset the day's egg
  await assert.rejects(
    routes.get("POST /adopt")!({ body: { characterId: "dottore-1" } }),
    (error: any) => error.statusCode === 409 && /One new egg a day/u.test(error.message),
  );
  assert.equal((await routes.get("GET /state")!({})).world.activePet, null);
  nextDay();
  const nextEgg = await routes.get("POST /adopt")!({ body: { characterId: "dottore-1" } });
  assert.equal(nextEgg.world.activePet.backgroundId, null);
  await routes.get("POST /background/:id/select")!({ params: { id: bgOne } });
  assert.equal((await menagerieNow())[0].backgroundId, bgOne);
  const afterDelete = await routes.get("POST /background/:id/delete")!({ params: { id: bgOne } });
  assert.equal(afterDelete.world.activePet.backgroundId, null);
  assert.equal((await menagerieNow())[0].backgroundId, null);
  await backgroundGone(bgOne);
  assert.deepEqual(await libraryNow(), [[bgTwo, "a sunny meadow", "generated"]]);
  await assert.rejects(
    routes.get("POST /background/:id/delete")!({ params: { id: bgOne } }),
    (error: any) => error.statusCode === 404,
  );

  // Releasing a sauceling keeps its paintings in the Album, under its name, and its background in the library
  await routes.get("POST /background/:id/select")!({ params: { id: bgTwo } });
  const eggId = nextEgg.world.activePet.id as string;
  await routes.get("POST /menagerie/:id/restore")!({ params: { id: petId }, body: { swap: true } });
  assert.equal((await menagerieNow())[0].backgroundId, bgTwo);
  await routes.get("POST /menagerie/:id/release")!({ params: { id: eggId } });
  await routes.get("POST /retire")!({ body: {} });
  await routes.get("POST /menagerie/:id/release")!({ params: { id: petId } });
  assert.deepEqual(await background(bgTwo), { image: webpOf(2) });
  const [kept] = await portraitsNow();
  assert.deepEqual([kept.id, kept.petName, kept.home], [first.id, "Noodletto", "released"]);
  assert.deepEqual(await image(kept.id), { image: png });

  // The library holds 24; a 25th is refused and leaves no stray image behind
  nextDay();
  await routes.get("POST /adopt")!({ body: { characterId: "dottore-1" } });
  for (let n = 0; n < SAUCELING_BACKGROUND_LIMIT - 1; n++) await saveBackground({ image: webpOf(10 + n) });
  assert.equal((await libraryNow()).length, SAUCELING_BACKGROUND_LIMIT);
  await assert.rejects(
    routes.get("POST /background")!({ body: { image: webpOf(99) } }),
    (error: any) => error.statusCode === 409 && /Delete one to save another/u.test(error.message),
  );
  const backgroundDocs = () => [...storedDocs.values()].filter((doc) => doc.kind === "saucelings-background");
  assert.equal(backgroundDocs().length, SAUCELING_BACKGROUND_LIMIT);
  const bgLast = (await libraryNow())[0][0] as string;
  await routes.get("POST /reset")!({ body: {} });
  assert.deepEqual(await portraitsNow(), []);
  await backgroundGone(bgLast);
  await backgroundGone(bgTwo);
  const missing = fakeReply();
  await image(first.id, missing);
  assert.equal(missing.statusCode, 404);
  assert.equal(
    [...storedDocs.values()].some((doc) => doc.kind === "saucelings-portrait" || doc.kind === "saucelings-background"),
    false,
  );

  // Model lines are written outside the save queue: a slow model holds up only its own request
  const biscottiId = (await routes.get("POST /adopt")!({ body: { characterId: "dottore-1" } })).world.activePet
    .id as string;
  const usedBeforeRetire = (await linesLanded()).world.budget.used as number;
  let releaseModel!: () => void;
  const modelGate = new Promise<void>((resolve) => (releaseModel = resolve));
  let sawSignal = false;
  model = async (options) => {
    sawSignal = options.signal instanceof AbortSignal;
    await modelGate;
    return JSON.stringify({ text: "Farewell, little noodle." });
  };
  modelCalls = 0;
  // Retire, like every swap, answers before the caretaker's words are written
  const retired = await Promise.race([
    routes.get("POST /retire")!({ body: {} }),
    new Promise<"blocked">((resolve) => setTimeout(() => resolve("blocked"), 500)),
  ]);
  if (retired === "blocked") assert.fail("a swap must not wait for the model");
  assert.equal(retired.writing.length, 1);
  // A farewell is a click line: it does not count against the daily limit
  assert.equal(retired.world.budget.used, usedBeforeRetire);
  const settingsMeanwhile = await Promise.race([
    routes.get("PATCH /settings")!({ body: { careWindowHours: 5 } }),
    new Promise((resolve) => setTimeout(() => resolve("blocked"), 500)),
  ]);
  assert.notEqual(settingsMeanwhile, "blocked", "a waiting model call must not hold up other saves");
  releaseModel();
  await linesLanded();
  assert.equal(modelCalls, 1);
  assert.ok(sawSignal, "model calls carry a timeout signal");
  const [farewellEntry] = await menagerieNow();
  assert.equal(farewellEntry.farewellScene, "Farewell, little noodle.");
  assert.equal(farewellEntry.journal[0].generated, true);
  assert.equal(farewellEntry.journal[0].speaker, "Il Dottore");

  // A save that collides and retries does not ask the model twice
  model = async () => JSON.stringify({ text: "Back in the nook!" });
  modelCalls = 0;
  collideNextSave = true;
  const back = await routes.get("POST /menagerie/:id/restore")!({ params: { id: farewellEntry.id }, body: {} });
  assert.equal(collideNextSave, false);
  assert.equal(back.world.budget.used, usedBeforeRetire);
  const landed = await linesLanded();
  assert.equal(modelCalls, 1);
  assert.equal(landed.world.activePet.journal[0].text, "Back in the nook!");

  // A failed model call keeps the template line
  model = async () => {
    throw new Error("provider down");
  };
  await routes.get("POST /retire")!({ body: {} });
  const failed = await linesLanded();
  assert.equal((await menagerieNow())[0].journal[0].generated, false);
  assert.equal(failed.world.budget.used, usedBeforeRetire);
  model = null;

  // Replacing the pet in the nook must be asked for; Release lets a Menagerie pet go for good
  assert.equal((await menagerieNow())[0].id, biscottiId);
  nextDay();
  const gnoccoId = (await routes.get("POST /adopt")!({ body: { characterId: "dottore-1" } })).world.activePet
    .id as string;
  const refusesSwap = (route: string, req: Record<string, unknown>) =>
    assert.rejects(routes.get(route)!(req), (error: any) => error.statusCode === 409);
  await refusesSwap("POST /adopt", { body: { characterId: "dottore-1" } });
  await refusesSwap("POST /menagerie/:id/restore", { params: { id: biscottiId }, body: {} });
  // Bringing one back from the Menagerie is not a new egg, so it is not limited
  const swappedIn = await routes.get("POST /menagerie/:id/restore")!({
    params: { id: biscottiId },
    body: { swap: true },
  });
  assert.equal(swappedIn.world.activePet.id, biscottiId);
  assert.deepEqual(
    (await menagerieNow()).map((e) => e.id),
    [gnoccoId],
  );
  // An egg swapped out comes back still an egg
  assert.equal((await menagerieNow())[0].stageAtRetirement, "egg");
  // A second new egg the same day is refused and leaves the nook as it was
  await assert.rejects(
    routes.get("POST /adopt")!({ body: { characterId: "dottore-1", swap: true } }),
    (error: any) => error.statusCode === 409 && /midnight UTC/u.test(error.message),
  );
  assert.equal((await routes.get("GET /state")!({})).world.activePet.id, biscottiId);
  nextDay();
  const newEgg = await routes.get("POST /adopt")!({ body: { characterId: "dottore-1", swap: true } });
  const farfallinaId = newEgg.world.activePet.id as string;
  assert.deepEqual(
    (await menagerieNow()).map((e) => e.id),
    [biscottiId, gnoccoId],
  );
  await badRequest("POST /portrait", { petId: farfallinaId, image: png }, /once it hatches/u);
  nextDay();
  const zitiId = (await routes.get("POST /adopt")!({ body: { characterId: "dottore-1", swap: true } })).world.activePet
    .id as string;
  const released = await routes.get("POST /menagerie/:id/release")!({ params: { id: farfallinaId } });
  assert.deepEqual(
    (await menagerieNow()).map((e) => e.id),
    [biscottiId, gnoccoId],
  );
  assert.equal(released.world.activePet.id, zitiId);
  await assert.rejects(
    routes.get("POST /menagerie/:id/release")!({ params: { id: farfallinaId } }),
    (error: any) => error.statusCode === 404,
  );

  // Read <name>'s card (POST /voice) has the writing connection make the caretaker's own voice: the profile model
  // sees the backstory and the example dialogue, then two calls side by side write the phrasebook in that speech
  // style, one for the routine moments and one for the one-off ones; the pet's profile gets all of it, and the state
  // says the character has a voice. No answer, or one with no speech style, is refused and changes nothing
  const dottoreOf = (state: any) => state.characters.find((ch: any) => ch.id === "dottore-1");
  const voiceRefused = () =>
    assert.rejects(
      routes.get("POST /voice")!({ body: { characterId: "dottore-1" } }),
      (error: any) => error.statusCode === 502,
    );
  model = async () => JSON.stringify({ voice: { petNickname: "specimen" } });
  await voiceRefused();
  model = async () => {
    throw new Error("provider down");
  };
  await voiceRefused();
  const voiceless = await routes.get("GET /state")!({});
  assert.equal(dottoreOf(voiceless).hasVoice, false);
  assert.equal(voiceless.world.activePet.careProfile.generatedByModel, false);
  let profilePrompt = "";
  let bookPrompt = "";
  let oneOffPrompt = "";
  model = async (_options, messages) => {
    const prompt = messages.map((message) => message.content).join("\n");
    if (/one-off moments/u.test(prompt)) {
      oneOffPrompt = prompt;
      return JSON.stringify({ phrases: { hello: ["*nods* Hold still, {pet}."], feed: ["Not a one-off."] } });
    }
    if (/You write a phrasebook/u.test(prompt)) {
      bookPrompt = prompt;
      return JSON.stringify({
        phrases: { feed: ["Eat, {pet}. Data requires it."], warmEgg: ["*adjusts the lamp* Stay warm, {pet}."] },
        signoffs: { neutral: ["Noted."] },
      });
    }
    profilePrompt = prompt;
    return JSON.stringify({ voice: { speechStyle: "Clipped, clinical, faintly amused." } });
  };
  const callsBeforeVoice = modelCalls;
  const refreshed = await routes.get("POST /voice")!({ body: { characterId: "dottore-1" } });
  assert.equal(modelCalls, callsBeforeVoice + 3);
  const refreshedVoice = refreshed.world.activePet.careProfile.voice;
  assert.deepEqual(refreshedVoice.phrases.feed, ["Eat, {pet}. Data requires it."]);
  assert.deepEqual(refreshedVoice.phrases.hello, ["Hold still, {pet}."]);
  assert.equal(refreshedVoice.speechStyle, "Clipped, clinical, faintly amused.");
  assert.deepEqual(refreshedVoice.phrases.warmEgg, ["Stay warm, {pet}."]);
  assert.deepEqual(refreshedVoice.signoffs, { pleased: [], worried: [], neutral: ["Noted."] });
  assert.equal(refreshed.world.activePet.careProfile.generatedByModel, true);
  assert.equal(dottoreOf(refreshed).hasVoice, true);
  assert.match(profilePrompt, /Backstory: Second of the Fatui Harbingers\./u);
  assert.match(profilePrompt, /The numbers in the example below are placeholders, not answers\./u);
  assert.match(profilePrompt, /voice\.worryLevel: how much they fret over the pet, from 0 \(never\) to 3/u);
  assert.match(profilePrompt, /Example dialogue: Il Dottore: Hold still\./u);
  assert.doesNotMatch(profilePrompt, /voice\.phrases|"phrases"/u);
  assert.match(bookPrompt, /How Il Dottore talks: Clipped, clinical, faintly amused\./u);
  assert.match(bookPrompt, /Backstory: Second of the Fatui Harbingers\./u);
  assert.match(bookPrompt, /- hatch: .*write \{kind\} for what hatched/u);
  assert.doesNotMatch(bookPrompt, /- hello:/u);
  assert.match(oneOffPrompt, /How Il Dottore talks: Clipped, clinical, faintly amused\./u);
  assert.match(oneOffPrompt, /write 3 different lines/u);
  assert.match(oneOffPrompt, /- eggFoundByOther: .*write \{finder\} for who found it/u);
  assert.doesNotMatch(oneOffPrompt, /- feed:|signoffs/u);

  // Switching caretaker never asks for a profile: a caretaker with no voice of their own starts with one guessed
  // from their card and says hello in a line of their own, which does not count against the daily limit; picking the
  // caretaker the pet already has says nothing. Their voice, once made, goes to the pet, and switching back to a
  // caretaker who has one uses it, even when their card has changed since
  let helloPrompt = "";
  model = async (_options, messages) => {
    const prompt = messages.map((message) => message.content).join("\n");
    if (/has just become this pet's caretaker/u.test(prompt)) {
      helloPrompt = prompt;
      return JSON.stringify({ text: "Hello there, little one." });
    }
    return JSON.stringify({ voice: { speechStyle: "Soft and wondering." } });
  };
  const callsBeforeSwitch = modelCalls;
  const usedBeforeSwitch = refreshed.world.budget.used as number;
  const switched = await routes.get("PATCH /pet")!({ body: { caretakerId: "nahida-2" } });
  assert.equal(switched.world.activePet.caretakerId, "nahida-2");
  assert.ok(Date.parse(switched.world.activePet.caretakerSince) > Date.parse(switched.world.activePet.createdAt));
  assert.equal(switched.world.activePet.careProfile.characterName, "Nahida");
  assert.equal(switched.world.activePet.careProfile.generatedByModel, false);
  const hello = switched.world.activePet.journal[0];
  assert.equal(hello.kind, "caretaker-change");
  assert.equal(hello.speaker, "Nahida");
  // The house hello is picked by the clock, so any of its four lines may come
  assert.match(
    hello.text,
    /^(Hello, little egg\. I'm looking after you now\.|Right, little egg\. You're with me from now on\.|Hello there, little egg\. Let's get you settled\.|I'll be taking care of you now, little egg\. We'll keep things tidy\.)/u,
  );
  assert.deepEqual(switched.writing, [hello.id]);
  const repicked = await routes.get("PATCH /pet")!({ body: { caretakerId: "nahida-2" } });
  assert.equal(repicked.world.activePet.journal[0].id, hello.id);
  assert.equal(repicked.world.activePet.journal.length, switched.world.activePet.journal.length);
  const greeted = await linesLanded();
  assert.equal(greeted.world.activePet.journal[0].text, "Hello there, little one.");
  assert.match(helloPrompt, /Nahida has just become this pet's caretaker/u);
  // A caretaker with no voice of their own is not given the house's nickname, sayings or lines to copy
  assert.match(helloPrompt, /"moment":"taking over as the pet's caretaker from someone else, said to the pet"/u);
  assert.doesNotMatch(helloPrompt, /little dumpling|There we are, all sorted|tidy bowl|Steady now|fallbackTemplate/u);
  assert.equal(greeted.world.budget.used, usedBeforeSwitch);
  assert.equal(modelCalls, callsBeforeSwitch + 1);
  const nahidaVoice = await routes.get("POST /voice")!({ body: { characterId: "nahida-2" } });
  assert.equal(nahidaVoice.world.activePet.careProfile.voice.speechStyle, "Soft and wondering.");
  // The profile and the two parts of the phrasebook
  assert.equal(modelCalls, callsBeforeSwitch + 4);
  [...storedDocs.values()].find((doc) => doc.kind === "saucelings-world")!.data.profileCache["dottore-1"].cardDigest =
    "an older card";
  const switchedBack = await routes.get("PATCH /pet")!({ body: { caretakerId: "dottore-1" } });
  assert.equal(switchedBack.world.activePet.careProfile.voice.speechStyle, "Clipped, clinical, faintly amused.");
  assert.equal(switchedBack.world.activePet.journal[0].speaker, "Il Dottore");
  await linesLanded();
  // Only the hello was written
  assert.equal(modelCalls, callsBeforeSwitch + 5);

  // Bring back hands a Menagerie pet to the caretaker picked for it, with their voice and no profile call, and the
  // return line theirs; leaving the caretaker out keeps the one it had
  model = async () => JSON.stringify({ text: "Back again." });
  await routes.get("PATCH /settings")!({ body: { dailyGenerationBudget: 40 } });
  const callsBeforeHandover = modelCalls;
  const handedOver = await routes.get("POST /menagerie/:id/restore")!({
    params: { id: biscottiId },
    body: { swap: true, caretakerId: "nahida-2" },
  });
  assert.equal(handedOver.world.activePet.id, biscottiId);
  assert.equal(handedOver.world.activePet.caretakerId, "nahida-2");
  assert.equal(handedOver.world.activePet.careProfile.voice.speechStyle, "Soft and wondering.");
  assert.equal(handedOver.world.activePet.journal[0].kind, "return-from-album");
  assert.equal(handedOver.world.activePet.journal[0].speaker, "Nahida");
  const zitiBack = await routes.get("POST /menagerie/:id/restore")!({ params: { id: zitiId }, body: { swap: true } });
  assert.equal(zitiBack.world.activePet.caretakerId, "dottore-1");
  assert.equal(zitiBack.world.activePet.journal[0].speaker, "Il Dottore");
  for (let tries = 0; tries < 50 && (await routes.get("GET /state")!({})).writing.length > 0; tries++) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  // Two return lines, and no profile
  assert.equal(modelCalls, callsBeforeHandover + 2);
  // A pet that comes back to its caretaker takes the voice they have been given since it left
  const gnoccoBack = await routes.get("POST /menagerie/:id/restore")!({
    params: { id: gnoccoId },
    body: { swap: true },
  });
  assert.equal(gnoccoBack.world.activePet.caretakerId, "dottore-1");
  assert.equal(gnoccoBack.world.activePet.careProfile.voice.speechStyle, "Clipped, clinical, faintly amused.");
  await linesLanded();

  // Check in: the caretaker writes a fresh line on top of the Journal, in their own spoken words and the voice of
  // their card, and keeps the egg's kind out of the prompt; it does not count against the daily limit, so it is
  // written even when no lines are left today
  let checkInPrompt = "";
  model = async (_options, messages) => {
    checkInPrompt = messages.map((message) => message.content).join("\n");
    return JSON.stringify({ text: "“Il Dottore: Still warm, still quiet.”" });
  };
  const usedBefore = (await routes.get("GET /state")!({})).world.budget.used as number;
  const checked = await routes.get("POST /check-in")!({ body: {} });
  assert.equal(checked.world.activePet.journal[0].kind, "check-in");
  assert.equal(checked.world.activePet.journal[0].speaker, "Il Dottore");
  assert.equal(checked.latestRemark, "Still warm, still quiet.");
  assert.equal(checked.world.budget.used, usedBefore);
  assert.match(checkInPrompt, /unhatched egg/u);
  assert.equal(checkInPrompt.includes(checked.world.activePet.name), false, checkInPrompt);
  assert.match(checkInPrompt, /Spoken words only/u);
  assert.match(checkInPrompt, /Personality: cold genius scientist/u);
  assert.match(checkInPrompt, /How Il Dottore talks in their card .*\nExample dialogue: Il Dottore: Hold still\./u);
  assert.match(checkInPrompt, /How Il Dottore talks: Clipped, clinical, faintly amused\./u);
  assert.match(checkInPrompt, /say it in words, never the numbers\. The recent journal/u);
  assert.ok(
    checkInPrompt.includes(`Il Dottore and the pet are right now, the Nook's background: ${NEST_SCENE_PROMPT}.`),
  );
  // The model is told what the moment is, never shown the house's line for it, and the journal's house lines come as
  // what they were about
  assert.match(checkInPrompt, /"moment":"the player asks how the egg is, and it is doing fine"/u);
  assert.doesNotMatch(checkInPrompt, /fallbackTemplate/u);
  for (const ev of checked.world.activePet.journal.slice(1, 4)) {
    if (!ev.generated && ev.speaker) assert.equal(checkInPrompt.includes(ev.text), false, ev.text);
  }
  await routes.get("PATCH /settings")!({ body: { dailyGenerationBudget: usedBefore } });
  const callsAtLimit = modelCalls;
  const atLimit = await routes.get("POST /check-in")!({ body: {} });
  assert.equal(atLimit.world.activePet.journal[0].generated, true);
  assert.equal(atLimit.world.budget.used, usedBefore);
  assert.equal(modelCalls, callsAtLimit + 1);
  await routes.get("PATCH /settings")!({ body: { dailyGenerationBudget: usedBefore + 1 } });
  model = null;

  // Egg hunting: on a chat reply by any character the contributor rolls, adds nothing to the prompt and returns at
  // once; a hit finds an egg that waits in the Menagerie, and the caretaker says so beside the pet in the nook
  assert.equal(typeof contributor, "function");
  const reply = (targetCharacterIds: string[]) => contributor!({ targetCharacterIds });
  const worldNow = () => [...storedDocs.values()].find((doc) => doc.kind === "saucelings-world")!.data;
  const tick = () => new Promise((resolve) => setTimeout(resolve, 30));
  const settle = async (check: () => Promise<boolean>) => {
    for (let n = 0; n < 100 && !(await check()); n++) await tick();
    assert.ok(await check());
    await tick();
  };
  const ihdr = (width: number, height: number) =>
    pngOf(0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0, 0, width >> 8, width & 255, 0, 0, height >> 8, height & 255, 8, 6);
  const formPng = ihdr(104, 104);
  const postForm = (body: Record<string, unknown>) => routes.get("POST /form")!({ body });
  const formRefused = (body: Record<string, unknown>) =>
    assert.rejects(postForm(body), (error: any) => error.statusCode === 400);
  let designPrompt = "";
  let naturePrompt = "";
  let mothEggId = "";
  let evolvedId = "";
  const realRandom = Math.random;
  Math.random = () => 0;
  try {
    assert.equal(reply([]), null);
    await tick();
    // Any character replying may find the egg: Nahida is not the caretaker, so the egg is hers and the caretaker's
    // line in the nook pet's journal names her
    const beforeOther = (await menagerieNow()).length;
    assert.equal(reply(["nahida-2"]), null);
    await settle(async () => (await menagerieNow()).length === beforeOther + 1);
    assert.deepEqual(
      [(await menagerieNow())[0].stageAtRetirement, (await menagerieNow())[0].foundBy],
      ["egg", "nahida-2"],
    );
    const toldOther = worldNow().activePet.journal[0];
    assert.deepEqual([toldOther.kind, toldOther.speaker], ["egg-found", "Il Dottore"]);
    assert.match(toldOther.text, /Nahida.* an egg .*Menagerie/u);
    assert.equal(toldOther.finder, "Nahida");
    worldNow().lastEggFindDay = null;
    const kept = (await menagerieNow()).length;
    // With no writing connection the find is an ordinary egg
    assert.equal(reply(["dottore-1"]), null);
    await settle(async () => (await menagerieNow()).length === kept + 1);
    const plainEgg = (await menagerieNow())[0];
    assert.deepEqual(
      [plainEgg.stageAtRetirement, plainEgg.foundBy, plainEgg.design, plainEgg.farewellScene],
      ["egg", "dottore-1", null, ""],
    );
    assert.equal(plainEgg.name, SPECIES_CATALOG[plainEgg.species as keyof typeof SPECIES_CATALOG].name);
    const told = worldNow().activePet.journal[0];
    assert.deepEqual([told.kind, told.speaker], ["egg-found", "Il Dottore"]);
    assert.match(told.text, /egg\b.*Menagerie/u);
    assert.equal(told.text.includes("Nahida"), false);
    assert.equal(told.finder, undefined);
    assert.equal(worldNow().lastEggFindDay, new Date().toISOString().slice(0, 10));
    // One find a day
    reply(["dottore-1"]);
    await tick();
    assert.equal((await menagerieNow()).length, kept + 1);
    // The writing connection invents the creature from the card, never pasta
    let foundLinePrompt = "";
    model = async (_options, messages) => {
      const prompt = messages.map((message) => message.content).join("\n");
      if (prompt.includes("Here is one of its small creatures.")) naturePrompt = prompt;
      else if (!prompt.includes('"eventKind":')) designPrompt = prompt;
      else if (prompt.includes('"eventKind":"egg-found"')) foundLinePrompt = prompt;
      return JSON.stringify(inkMothAnswer());
    };
    worldNow().lastEggFindDay = null;
    worldNow().budget = { day: new Date().toISOString().slice(0, 10), used: 0 };
    reply(["dottore-1"]);
    await settle(async () => (await menagerieNow()).length === kept + 2);
    const mothEgg = (await menagerieNow())[0];
    mothEggId = mothEgg.id;
    assert.deepEqual([mothEgg.name, mothEgg.design, mothEgg.foundBy], ["ink moth", inkMoth, "dottore-1"]);
    assert.match(designPrompt, /never pasta, sauce or food/u);
    assert.match(designPrompt, /cold genius scientist/u);
    assert.match(designPrompt, /turned into an animal's body and habits: a tidy character's pet/u);
    assert.match(designPrompt, /it cannot read, write, talk, work or hold opinions/u);
    assert.match(designPrompt, /No art-style words such as low-poly, 3D, realistic or cartoon\./u);
    assert.match(designPrompt, /quirk: one short sentence on a habit that shows the character's ways/u);
    // The caretaker's line says the egg is a new one, not the pet beside them
    assert.match(foundLinePrompt, /It is not this pet: it waits in the Menagerie\./u);
    assert.match(foundLinePrompt, /found by Il Dottore while talking with the player/u);
    assert.match(foundLinePrompt, /"moment":"telling the player you found another egg while chatting with them;/u);
    // Egg hunting can be turned off
    await routes.get("PATCH /settings")!({ body: { eggHunting: false } });
    worldNow().lastEggFindDay = null;
    reply(["dottore-1"]);
    await tick();
    assert.equal((await menagerieNow()).length, kept + 2);
    await routes.get("PATCH /settings")!({ body: { eggHunting: true, portraitEnabled: true } });
    // Forms are only for an invented sauceling
    await formRefused({ stage: "egg", image: formPng });

    // A chat reply no longer evolves an adult; its caretaker offers it, and Evolve… asks for two looks, once
    const stored = worldNow();
    const today = new Date().toISOString().slice(0, 10);
    stored.lastEggFindDay = today;
    // Pasta, so no temperament is asked for before the old-way evolution below
    stored.activePet = {
      ...stored.activePet,
      species: "rigamuffin",
      stage: "adult",
      lockedStage: "adult",
      name: "Biscotti",
    };
    const callsBefore = modelCalls;
    reply(["dottore-1"]);
    await tick();
    assert.deepEqual(
      [worldNow().activePet.design ?? null, worldNow().activePet.evolution.at, modelCalls],
      [null, null, callsBefore],
    );
    const evolveRoute = (name: string, body: Record<string, unknown> = {}) =>
      routes.get(`POST /evolve/${name}`)!({ body });
    const evolveRefused = (name: string, status: number, body: Record<string, unknown> = {}) =>
      assert.rejects(evolveRoute(name, body), (error: any) => error.statusCode === status);
    await evolveRefused("options", 409);
    worldNow().activePet.evolution = { ...worldNow().activePet.evolution, offer: "offered" };
    const choices = (await evolveRoute("options")).world.activePet.evolution.choices;
    assert.equal(choices.length, 2);
    assert.notEqual(choices[0].colour, choices[1].colour);
    assert.match(choices[0].form, /^Ember /u);
    const asked = modelCalls;
    assert.deepEqual((await evolveRoute("options")).world.activePet.evolution.choices, choices);
    assert.equal(modelCalls, asked);
    await evolveRefused("choose", 400, { index: 2 });
    // Choosing one says so in the journal; it can be undone, back to the same offer and choices, then turned down
    const chosen = (await evolveRoute("choose", { index: 0 })).world.activePet;
    assert.deepEqual(chosen.evolution.look, choices[0]);
    assert.equal(typeof chosen.evolution.at, "string");
    assert.deepEqual([chosen.journal[0].kind, chosen.journal[0].speaker], ["evolve", "Il Dottore"]);
    assert.ok(chosen.journal[0].text.includes("Biscotti"));
    assert.ok(chosen.journal[0].text.includes(choices[0].form));
    await evolveRefused("choose", 409, { index: 1 });
    await evolveRefused("decline", 409);
    const undone = (await evolveRoute("undo")).world.activePet.evolution;
    assert.deepEqual([undone.look, undone.at, undone.offer, undone.choices], [null, null, "offered", choices]);
    await evolveRefused("undo", 409);
    assert.equal((await evolveRoute("decline")).world.activePet.evolution.offer, "declined");
    await evolveRefused("options", 409);
    await evolveRefused("choose", 409, { index: 0 });

    // A sauceling that evolved the old way keeps its design and counts as evolved; it keeps its name and sprite
    // until a form is painted
    const legacyStored = worldNow();
    legacyStored.activePet = { ...legacyStored.activePet, design: normalizeDesign(inkMothAnswer(), "evolved") };
    delete legacyStored.activePet.evolution;
    naturePrompt = "";
    const evolvedPet = (await routes.get("GET /state")!({})).world.activePet;
    evolvedId = evolvedPet.id;
    assert.equal(evolvedPet.design.origin, "evolved");
    assert.deepEqual(Object.keys(evolvedPet.design.stages).sort(), ["adult", "elder"]);
    assert.deepEqual([evolvedPet.name, evolvedPet.forms], ["Biscotti", {}]);
    assert.deepEqual(
      [evolvedPet.evolution.offer, evolvedPet.evolution.at],
      [null, evolvedPet.hatchedAt ?? evolvedPet.createdAt],
    );
    // What it evolved into is not pasta, so it is asked for a temperament of its own, taking after its finder
    await settle(async () => naturePrompt !== "");
    assert.match(naturePrompt, /It takes after Il Dottore, who found its egg/u);
    assert.match(naturePrompt, /It is an ink moth: /u);
  } finally {
    Math.random = realRandom;
  }
  model = null;

  // A form is PNG strips 104 high, of one frame (104 wide) or three (312), for a stage its design describes
  const stripPng = ihdr(312, 104);
  /** A strip padded out to about `kb` KB, still with a valid header. */
  const bigStrip = (kb: number) =>
    `data:image/png;base64,${Buffer.concat([Buffer.from(stripPng.split(",")[1]!, "base64"), Buffer.alloc(kb * 1024)]).toString("base64")}`;
  await formRefused({ stage: "hatchling", image: formPng });
  await formRefused({ stage: "wings", image: formPng });
  await formRefused({ stage: "adult", image: ihdr(52, 52) });
  await formRefused({ stage: "adult", image: ihdr(208, 104) });
  await formRefused({ stage: "adult", image: ihdr(312, 52) });
  await formRefused({ stage: "adult", image: webpOf(1) });
  await formRefused({ stage: "adult", image: png });
  await formRefused({ stage: "adult", image: stripPng, side: formPng });
  await formRefused({ stage: "adult", image: stripPng, side: png });
  await formRefused({ stage: "adult", image: bigStrip(49) });
  await formRefused({
    stage: "adult",
    image: bigStrip(40),
    side: bigStrip(40),
    happy: bigStrip(40),
    grumpy: bigStrip(40),
  });
  const formOf = async (id: string, reply = fakeReply(), query = {}) =>
    routes.get("GET /form/:id")!({ params: { id }, query }, reply);
  const strips = { image: stripPng, side: ihdr(312, 104), happy: ihdr(312, 104), grumpy: ihdr(312, 104) };
  const stripped = (await postForm({ stage: "elder", ...strips, extra: formPng })).world.activePet.forms.elder;
  assert.deepEqual(await formOf(stripped), { ...strips, frames: 3 });
  assert.deepEqual(await formOf(stripped, fakeReply(), { strips: "front" }), { image: stripPng, frames: 3 });
  assert.deepEqual(Object.keys(storedDocs.get(stripped)!.data).sort(), ["grumpy", "happy", "image", "petId", "side"]);
  // A page claims a painting before it asks for it: another page is refused while the claim holds, and painting by
  // itself stops after two tries until a form is saved; the claims never reach the client
  const start = (body: Record<string, unknown>) => routes.get("POST /form/start")!({ body });
  const startRefused = (body: Record<string, unknown>, statusCode: number) =>
    assert.rejects(start(body), (error: any) => error.statusCode === statusCode);
  await startRefused({ key: "wings", token: "page-a" }, 400);
  await startRefused({ key: "hatchling", token: "page-a" }, 400);
  await startRefused({ key: "adult" }, 400);
  assert.deepEqual(await start({ key: "adult", auto: true, token: "page-a" }), { ok: true });
  await startRefused({ key: "adult", auto: true, token: "page-b" }, 409);
  await startRefused({ key: "adult", token: "page-b" }, 409);
  await start({ key: "sheet", auto: true, token: "page-b" });
  await start({ key: "adult", auto: true, token: "page-a" });
  await startRefused({ key: "adult", auto: true, token: "page-a" }, 400);
  await start({ key: "adult", token: "page-a" });
  assert.deepEqual(worldNow().activePet.paintTries, { adult: 3, sheet: 1 });
  assert.equal("painting" in (await routes.get("GET /state")!({})).world, false);
  // A claim older than any painting takes no longer holds
  await startRefused({ key: "sheet", token: "page-a" }, 409);
  worldNow().painting[`${evolvedId}:sheet`].at = new Date(Date.now() - 4 * 60_000).toISOString();
  await start({ key: "sheet", token: "page-a" });
  // A saved form ends the sauceling's claims and starts its tries again
  await postForm({ stage: "adult", image: formPng });
  assert.deepEqual([worldNow().activePet.paintTries, worldNow().painting], [{}, {}]);
  await start({ key: "adult", auto: true, token: "page-b" });
  const formSaved = await postForm({ stage: "adult", image: formPng });
  const firstForm = formSaved.world.activePet.forms.adult as string;
  assert.equal(storedDocs.get(firstForm)?.kind, "saucelings-form");
  assert.deepEqual(await formOf(firstForm), { image: formPng, frames: 1 });
  const repainted = await postForm({ stage: "adult", image: ihdr(104, 104) });
  const secondForm = repainted.world.activePet.forms.adult as string;
  assert.notEqual(secondForm, firstForm);
  // A repaint keeps the picture it replaced as the one set back (and the set kept before it goes)
  assert.equal(storedDocs.has(firstForm), true);
  assert.deepEqual(repainted.world.activePet.savedForms, { adult: firstForm });
  assert.deepEqual(await formOf(firstForm), { image: formPng, frames: 1 });
  // Undo repaint swaps the two, so a second press brings the repaint back
  const undoForm = () => routes.get("POST /form/undo")!({ body: {} });
  const undone = (await undoForm()).world.activePet;
  assert.deepEqual([undone.forms.adult, undone.savedForms], [firstForm, { adult: secondForm }]);
  const redone = (await undoForm()).world.activePet;
  assert.deepEqual([redone.forms.adult, redone.savedForms], [secondForm, { adult: firstForm }]);
  // Flip is a saved switch on the whole sauceling, with no new picture, and it goes to the Menagerie with it
  assert.equal(redone.flipped, false);
  const petFlipped = (await routes.get("PATCH /pet")!({ body: { flipped: true } })).world.activePet;
  assert.deepEqual(
    [petFlipped.flipped, petFlipped.forms.adult, petFlipped.savedForms],
    [true, secondForm, { adult: firstForm }],
  );
  assert.equal((await routes.get("GET /state")!({})).world.activePet.flipped, true);
  const unlisted = fakeReply();
  await formOf(String([...storedDocs.values()].find((doc) => doc.kind === "saucelings-world")!.id), unlisted);
  assert.equal(unlisted.statusCode, 404);
  // A form travels with its pet to the Menagerie, and goes when it is released
  const retiredMoth = (await routes.get("POST /retire")!({ body: {} })).world;
  assert.equal(retiredMoth.activePet, null);
  assert.equal((await menagerieNow()).find((entry) => entry.id === evolvedId)!.flipped, true);
  assert.deepEqual(await formOf(secondForm), { image: formPng, frames: 1 });
  await routes.get("POST /menagerie/:id/release")!({ params: { id: evolvedId } });
  assert.equal(storedDocs.has(secondForm), false);
  assert.equal(storedDocs.has(firstForm), false);
  // A found egg can still be given its form where it waits, a form that names it
  await formRefused({ stage: "egg", image: formPng, petId: "nobody" });
  const plainEggId = (await menagerieNow()).find((entry) => entry.stageAtRetirement === "egg" && !entry.design)!.id;
  await formRefused({ stage: "egg", image: formPng, petId: plainEggId });
  await postForm({ stage: "egg", image: formPng, petId: mothEggId });
  const waitingForm = (await menagerieNow()).find((entry) => entry.id === mothEggId)!.forms.egg as string;
  assert.deepEqual(await formOf(waitingForm), { image: formPng, frames: 1 });
  // Brought to the nook it keeps its design and form, and the form can be painted again; reset takes every form
  const restoredMoth = await routes.get("POST /menagerie/:id/restore")!({ params: { id: mothEggId }, body: {} });
  assert.deepEqual(
    [restoredMoth.world.activePet.design, restoredMoth.world.activePet.forms],
    [inkMoth, { egg: waitingForm }],
  );
  await assert.rejects(undoForm(), (error: any) => error.statusCode === 400);
  const eggRepainted = (await postForm({ stage: "egg", image: formPng })).world.activePet;
  const eggForm = eggRepainted.forms.egg as string;
  assert.equal(storedDocs.get(eggForm)?.kind, "saucelings-form");
  assert.deepEqual(eggRepainted.savedForms, { egg: waitingForm });
  assert.equal(storedDocs.has(waitingForm), true);
  // A life sheet saves every stage's form at once, or none: a stage the design lacks or one bad strip refuses it all
  const formCount = () => [...storedDocs.values()].filter((doc) => doc.kind === "saucelings-form").length;
  const postSheet = (body: Record<string, unknown>) => routes.get("POST /form/sheet")!({ body });
  const sheetRefused = (body: Record<string, unknown>) =>
    assert.rejects(postSheet(body), (error: any) => error.statusCode === 400);
  const before = formCount();
  await sheetRefused({ forms: {} });
  await sheetRefused({ forms: { egg: { image: stripPng }, wings: { image: stripPng } } });
  await sheetRefused({ forms: { egg: { image: stripPng }, hatchling: { image: stripPng, side: formPng } } });
  await sheetRefused({ forms: { egg: { image: stripPng }, hatchling: "nope" } });
  assert.equal(formCount(), before);
  const sheet = await postSheet({ forms: { egg: { image: stripPng }, hatchling: strips, adult: strips } });
  const sheetForms = sheet.world.activePet.forms;
  assert.deepEqual(Object.keys(sheetForms).sort(), ["adult", "egg", "hatchling"]);
  // The sheet's repaint saves the whole set it replaced, and the set kept before it goes
  assert.deepEqual(sheet.world.activePet.savedForms, { egg: eggForm });
  assert.equal(storedDocs.has(eggForm), true);
  assert.equal(storedDocs.has(waitingForm), false);
  assert.equal(formCount(), before + 2);
  assert.deepEqual(await formOf(sheetForms.hatchling), { ...strips, frames: 3 });
  assert.deepEqual(await formOf(sheetForms.egg), { image: stripPng, frames: 3 });
  const sheetUndone = (await undoForm()).world.activePet;
  assert.deepEqual(sheetUndone.forms, { ...sheetForms, egg: eggForm });
  assert.deepEqual(sheetUndone.savedForms, { egg: sheetForms.egg });
  assert.deepEqual(await formOf(eggForm), { image: formPng, frames: 1 });
  // The writing connection suggests a background place for the nook's sauceling; an egg's kind stays a surprise
  const suggest = () => routes.get("POST /background/suggest")!({ body: {} });
  assert.deepEqual(await suggest(), { scene: null });
  let scenePrompt = "";
  let sceneAnswer = "a quiet scholar's desk lit by a lamp: ink pots, quills, stacked notebooks and a moonlit window.";
  model = async (_options, messages) => {
    scenePrompt = messages.map((message) => message.content).join("\n");
    return JSON.stringify({ scene: sceneAnswer });
  };
  assert.deepEqual(await suggest(), {
    scene: "a quiet scholar's desk lit by a lamp: ink pots, quills, stacked notebooks and a moonlit window",
  });
  assert.match(scenePrompt, /An egg: A speckled grey egg/u);
  assert.match(scenePrompt, /Its caretaker is Il Dottore\.\nWho they are:\nPersonality: cold genius scientist/u);
  assert.equal(scenePrompt.includes("ink moth"), false);
  sceneAnswer = "a dusty attic where an ink moth would flutter between old books";
  assert.deepEqual(await suggest(), { scene: null });
  worldNow().activePet = { ...worldNow().activePet, stage: "juvenile", name: "Smudge" };
  assert.deepEqual(await suggest(), { scene: sceneAnswer });
  assert.match(scenePrompt, /Smudge, an ink moth at its juvenile stage\. Look: /u);
  assert.match(scenePrompt, /Colours: indigo, cream, silver\./u);
  model = null;

  // A caretaker's painted figure: only for one of the player's characters and only as a 768 x 96 strip (or a 288 x 96
  // one painted before 0.6.0) of at most 128 KB, kept in its own document that GET serves with its frame count while
  // it is listed; painting them again replaces it and deletes the old one
  const figureRefused = (body: Record<string, unknown>) =>
    assert.rejects(routes.get("POST /figure")!({ body }), (error: any) => error.statusCode === 400);
  const prefix = "data:image/png;base64,";
  const padded = (png: string, bytes: number) =>
    `${prefix}${Buffer.concat([Buffer.from(png.slice(prefix.length), "base64"), Buffer.alloc(bytes, 1)]).toString("base64")}`;
  const figurePng = ihdr(768, 96);
  await figureRefused({ characterId: "someone-else", image: figurePng });
  await figureRefused({ characterId: "dottore-1", image: ihdr(104, 104) });
  await figureRefused({ characterId: "dottore-1", image: ihdr(768, 104) });
  await figureRefused({ characterId: "dottore-1", image: ihdr(672, 96) });
  await figureRefused({ characterId: "dottore-1", image: padded(figurePng, 128 * 1024) });
  await figureRefused({ characterId: "dottore-1", image: "https://image.example/dottore.png" });
  const figured = await routes.get("POST /figure")!({ body: { characterId: "dottore-1", image: figurePng } });
  const firstFigure = figured.world.caretakerFigures["dottore-1"] as string;
  const figureOf = (id: string, reply = fakeReply()) => routes.get("GET /figure/:id")!({ params: { id } }, reply);
  assert.deepEqual(await figureOf(firstFigure), { image: figurePng, frames: 8 });
  const otherFigure = padded(figurePng, 100 * 1024);
  const figureAgain = await routes.get("POST /figure")!({ body: { characterId: "dottore-1", image: otherFigure } });
  const secondFigure = figureAgain.world.caretakerFigures["dottore-1"] as string;
  assert.notEqual(secondFigure, firstFigure);
  // The figure a repaint replaced is kept, and Undo repaint swaps the two (again to bring the repaint back)
  assert.deepEqual(figureAgain.world.savedFigures, { "dottore-1": firstFigure });
  assert.deepEqual(await figureOf(firstFigure), { image: figurePng, frames: 8 });
  const undoFigure = (characterId: string) => routes.get("POST /figure/undo")!({ body: { characterId } });
  const figureUndone = (await undoFigure("dottore-1")).world;
  assert.deepEqual(
    [figureUndone.caretakerFigures["dottore-1"], figureUndone.savedFigures["dottore-1"]],
    [firstFigure, secondFigure],
  );
  const figureRedone = (await undoFigure("dottore-1")).world;
  assert.deepEqual(
    [figureRedone.caretakerFigures["dottore-1"], figureRedone.savedFigures["dottore-1"]],
    [secondFigure, firstFigure],
  );
  await assert.rejects(undoFigure("someone-else"), (error: any) => error.statusCode === 400);
  // Flipping a caretaker is a saved switch, painted or not, for one of the user's characters only
  const flipCaretaker = (body: unknown) => routes.get("PATCH /caretaker/flip")!({ body });
  assert.deepEqual((await flipCaretaker({ characterId: "dottore-1", flipped: true })).world.flippedCaretakers, [
    "dottore-1",
  ]);
  assert.deepEqual((await flipCaretaker({ characterId: "dottore-1", flipped: true })).world.flippedCaretakers, [
    "dottore-1",
  ]);
  await assert.rejects(
    flipCaretaker({ characterId: "someone-else", flipped: true }),
    (error: any) => error.statusCode === 400,
  );
  await assert.rejects(flipCaretaker({ characterId: "dottore-1" }), (error: any) => error.statusCode === 400);
  assert.equal((await undoFigure("dottore-1")).world.flippedCaretakers.length, 1);
  assert.equal((await undoFigure("dottore-1")).world.savedFigures["dottore-1"], firstFigure);
  assert.deepEqual((await flipCaretaker({ characterId: "dottore-1", flipped: false })).world.flippedCaretakers, []);
  const oldFigure = ihdr(288, 96);
  const threeFrames = await routes.get("POST /figure")!({ body: { characterId: "dottore-1", image: oldFigure } });
  assert.deepEqual(await figureOf(threeFrames.world.caretakerFigures["dottore-1"] as string), {
    image: oldFigure,
    frames: 3,
  });
  // The set kept before goes when a repaint keeps another
  assert.equal(storedDocs.has(firstFigure), false);
  const figureGone = fakeReply();
  await figureOf(firstFigure, figureGone);
  assert.equal(figureGone.statusCode, 404);
  await routes.get("PATCH /settings")!({ body: { portraitEnabled: false } });
  await figureRefused({ characterId: "dottore-1", image: figurePng });
  await routes.get("PATCH /settings")!({ body: { portraitEnabled: true } });

  await routes.get("POST /reset")!({ body: {} });
  assert.equal(
    [...storedDocs.values()].some((doc) => doc.kind === "saucelings-form" || doc.kind === "saucelings-figure"),
    false,
  );
  assert.deepEqual((await routes.get("GET /state")!({})).world.caretakerFigures, {});
  assert.deepEqual((await routes.get("GET /state")!({})).world.flippedCaretakers, []);

  // The writing connection can be picked in Settings, and cleared back to the Engine default
  const withConnection = await routes.get("PATCH /settings")!({ body: { connectionId: "text-1" } });
  assert.equal(withConnection.world.settings.connectionId, "text-1");
  const cleared = await routes.get("PATCH /settings")!({ body: { connectionId: null } });
  assert.equal(cleared.world.settings.connectionId, null);

  await cleanup();
  assert.equal(contributor, null);
  console.log("saucelings simulation regression: OK");
}

// On a wide panel the stage card and the care column share one grid row; an open Nook panel makes the column taller,
// so the stage card keeps its own height instead of stretching to match
const widePanelStyles = SAUCELINGS_STYLES.slice(SAUCELINGS_STYLES.indexOf("@container sl-shell (min-width: 48rem)"));
assert.match(widePanelStyles.slice(0, widePanelStyles.indexOf("\n}\n")), /\.sl-stage-card \{ align-self: start; \}/u);

void testBundledServer();
