import {
  templateAbsenceScene,
  templateCaretakerCareLine,
  templateCheckInLine,
  templateEvolveOfferScene,
  templateHatchScene,
  templateStageUpScene,
  templateTemperamentShiftScene,
  templateUserActionLine,
} from "../../../../shared/src/features/agents/saucelings/templates.js";
import {
  SAUCELING_EGG_ACTIONS,
  SAUCELING_EGG_START_WARMTH,
  SAUCELING_GROWTH_MIN_HUNGER,
  SAUCELING_HATCH_WAIT_MS,
  type SaucelingAbsenceBucket,
  type SaucelingCaretakerOutcome,
  type SaucelingEvent,
  type SaucelingEvolveState,
  type SaucelingMealDay,
  type SaucelingMeters,
  type SaucelingPet,
  type SaucelingSettings,
  type SaucelingStage,
  type SaucelingTendencyKey,
  type SaucelingUserAction,
} from "../../../../shared/src/features/agents/saucelings/types.js";
import { petKind } from "../../../../shared/src/features/agents/saucelings/vocabulary.js";
import {
  applyCaretakerOutcomeToTemperament,
  applyUserActionToTemperament,
  evaluateTemperamentShift,
} from "./temperament.js";

export const METER_FLOOR = 20;
export const METER_CEILING = 100;
export const MAX_JOURNAL_ENTRIES = 80;
const ELDER_RETIRE_READY_MS = 3 * 24 * 60 * 60 * 1000; // 3 days as elder
const HOUR_MS = 3600 * 1000;
export const DAY_MS = 24 * HOUR_MS;
/** What it loses an hour with nobody looking after it: 12 hunger, 9 mood and 12 warmth over 6 hours. */
const HUNGER_DECAY_PER_HOUR = 2;
const MOOD_DECAY_PER_HOUR = 1.5;
const WARMTH_DECAY_PER_HOUR = 2;
/** A caretaker's chances are for 6 hours: a shorter turn rolls its share of them, a longer one rolls them again. */
const ROLL_HOURS = 6;
/** The caretaker's care alone never lifts a meter past this; only the player's own care goes higher. */
const CARETAKER_CEILING = 85;
/** A long absence is caught up on for at most this much time. */
const MAX_CATCH_UP_MS = 14 * DAY_MS;
/** How many days the caretaker's meal count looks back. */
const MEAL_RECORD_DAYS = 7;
/** An hour counts toward an evolution offer when it ends this close and this happy. */
export const EVOLVE_GOOD_BOND = 70;
export const EVOLVE_GOOD_MOOD = 50;
/** Good hours over the last three UTC days it needs before each day's offer roll; there are 72 in all. */
export const EVOLVE_GOOD_HOURS = 36;
/** The chance of the offer at the end of each such day, and on a day its caretaker replied in a chat. */
export const EVOLVE_OFFER_CHANCE = 1 / 3;
export const EVOLVE_CHAT_OFFER_CHANCE = 2 / 3;

export const ACTION_COOLDOWN_MS: Record<SaucelingUserAction, number> = {
  feed: 30 * 60 * 1000,
  play: 30 * 60 * 1000,
  rest: 45 * 60 * 1000,
  pet: 15 * 60 * 1000,
  // The egg stage lasts about half an hour, so its care comes round more often.
  warm: 10 * 60 * 1000,
  talk: 10 * 60 * 1000,
  listen: 10 * 60 * 1000,
};

export interface SeededRng {
  next(): number;
  state(): number;
}

export function createSeededRng(initialState: number): SeededRng {
  let s = initialState >>> 0 || 0x6d2b79f5;
  return {
    next(): number {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    state(): number {
      return s >>> 0;
    },
  };
}

function clampMeter(val: number, floor = METER_FLOOR): number {
  return Math.max(floor, Math.min(METER_CEILING, Math.round(val)));
}

function clampBond(val: number): number {
  return Math.max(0, Math.min(METER_CEILING, Math.round(val)));
}

function eggWarmth(pet: Pick<SaucelingPet, "meters">): number {
  return pet.meters.warmth ?? SAUCELING_EGG_START_WARMTH;
}

/** A hatchling starts fed, and as happy as its egg was warm; warmth is an egg-only meter. */
function hatchlingMeters(meters: SaucelingMeters): SaucelingMeters {
  const { warmth = SAUCELING_EGG_START_WARMTH, ...rest } = meters;
  return { ...rest, hunger: 75, mood: clampMeter(40 + warmth / 2) };
}

/** Meter loss between two moments, in whole points that add up the same however the time is cut into turns. */
function decayBetween(perHour: number, fromMs: number, toMs: number): number {
  return Math.round((perHour * toMs) / HOUR_MS) - Math.round((perHour * fromMs) / HOUR_MS);
}

/** What the caretaker's attentiveness does to every chance they have to care: 0 gives ×0.7, 0.5 ×1, 1 ×1.8. */
export function attentivenessMultiplier(attentiveness: number): number {
  return attentiveness <= 0.5 ? 0.7 + attentiveness * 0.6 : 1 + (attentiveness - 0.5) * 1.6;
}

/** The hours of a stretch it was fed enough to grow, as hunger falls in a line from `before` to `after`. */
function growingHours(before: number, after: number, hours: number): number {
  const floor = SAUCELING_GROWTH_MIN_HUNGER;
  if (before >= floor && after >= floor) return hours;
  if (before < floor || before <= after) return 0;
  return (hours * (before - floor)) / (before - after);
}

/** The hours of each stretch a turn is run in: whole 6 hours, then what is left. */
function stretchesOf(turnHours: number): number[] {
  const stretches = Array<number>(Math.floor(turnHours / ROLL_HOURS)).fill(ROLL_HOURS);
  if (turnHours % ROLL_HOURS > 0) stretches.push(turnHours % ROLL_HOURS);
  return stretches;
}

/** Adds one meal turn (for an egg, one warming turn) to the day it falls on, given or not. */
function withMealOn(record: SaucelingMealDay[], atMs: number, given: boolean): SaucelingMealDay[] {
  const day = Math.floor(atMs / DAY_MS);
  const same = record.find((entry) => entry.day === day) ?? { day, given: 0, total: 0 };
  return [
    ...record.filter((entry) => entry.day !== day && entry.day > day - MEAL_RECORD_DAYS),
    { day, given: same.given + (given ? 1 : 0), total: same.total + 1 },
  ].sort((a, b) => a.day - b.day);
}

/** Adds a stretch's hours to the day it ends on when it ended happy and close; keeps three days. */
function withGoodHours(evolution: SaucelingEvolveState, pet: SaucelingPet, tickMs: number, hours: number) {
  const { bond, mood } = pet.meters;
  if (bond < EVOLVE_GOOD_BOND || mood < EVOLVE_GOOD_MOOD) return evolution;
  // A stretch that ends on the stroke of midnight belongs to the day it ends.
  const day = Math.floor((tickMs - 1) / DAY_MS);
  const same = evolution.goodHours.find((entry) => entry.day === day)?.good ?? 0;
  const goodHours = [
    ...evolution.goodHours.filter((entry) => entry.day !== day && entry.day > day - 3),
    { day, good: same + hours },
  ].sort((a, b) => a.day - b.day);
  return { ...evolution, goodHours };
}

/** Whether a sauceling may be offered its evolution at the end of `day`: never evolved, never offered, and happy and
 *  close for more than EVOLVE_GOOD_HOURS of the three days up to it. */
export function evolveOfferDue(evolution: SaucelingEvolveState, day: number): boolean {
  if (evolution.offer || evolution.at) return false;
  const good = evolution.goodHours
    .filter((entry) => entry.day > day - 3 && entry.day <= day)
    .reduce((sum, entry) => sum + entry.good, 0);
  return good > EVOLVE_GOOD_HOURS;
}

/** A meter lifted by the caretaker: it rises no higher than the ceiling, and one already above it stays put. */
function liftedByCaretaker(meter: number, delta: number): number {
  return clampMeter(delta > 0 ? Math.max(meter, Math.min(meter + delta, CARETAKER_CEILING)) : meter + delta);
}

function effectiveTendency(pet: SaucelingPet, key: SaucelingTendencyKey, nowMs: number): number {
  const base = pet.careProfile.tendencies[key] ?? 0.5;
  const boost = pet.nudges
    .filter((n) => n.tendency === key && Date.parse(n.expiresAt) > nowMs)
    .reduce((sum, n) => sum + n.delta, 0);
  return Math.max(0, Math.min(1, base + boost));
}

function absenceBucketForHours(hours: number): SaucelingAbsenceBucket {
  if (hours < 48) return "day";
  if (hours < 120) return "days";
  if (hours < 240) return "week";
  return "long";
}

function targetStageForPet(pet: SaucelingPet, nowMs: number): SaucelingStage {
  if (pet.lockedStage) return pet.lockedStage;
  if (pet.stage === "egg") {
    const waitedEnough = nowMs - Date.parse(pet.createdAt) >= SAUCELING_HATCH_WAIT_MS;
    if (waitedEnough && pet.careActionCount >= 1) return "hatchling";
    return "egg";
  }
  // Growing up counts the time it spent fed, not the time since the egg.
  const growthHours = pet.growthMs / HOUR_MS;
  const stageOrder: SaucelingStage[] = ["egg", "hatchling", "juvenile", "adult", "elder"];
  const currentIdx = stageOrder.indexOf(pet.stage);
  let computed: SaucelingStage = "hatchling";
  if (growthHours >= 144 && pet.meters.bond >= 60) computed = "elder";
  else if (growthHours >= 60 && pet.meters.bond >= 35) computed = "adult";
  else if (growthHours >= 18 && pet.meters.bond >= 15) computed = "juvenile";
  return stageOrder.indexOf(computed) > currentIdx ? computed : pet.stage;
}

let eventCounter = 0;
function makeEventId(nowMs: number, rng: SeededRng): string {
  const suffix = Math.floor(rng.next() * 1e6)
    .toString(36)
    .padStart(4, "0");
  eventCounter = (eventCounter + 1) % 10000;
  return `evt-${nowMs}-${eventCounter}-${suffix}`;
}

export function advance(
  pet: SaucelingPet,
  nowIso: string,
  settings: Pick<SaucelingSettings, "careWindowHours">,
  rng: SeededRng = createSeededRng(pet.rngState),
): { pet: SaucelingPet; events: SaucelingEvent[] } {
  const nowMs = Date.parse(nowIso);
  const lastMs = Date.parse(pet.lastTickAt);
  if (!Number.isFinite(nowMs) || !Number.isFinite(lastMs)) return { pet, events: [] };
  // A clock set back leaves the last tick in the future; bring it to now so care counts from here.
  if (nowMs < lastMs) return { pet: { ...pet, lastTickAt: nowIso }, events: [] };
  if (nowMs === lastMs) return { pet, events: [] };

  const windowHours = Math.max(1, settings.careWindowHours || 6);
  const windowMs = windowHours * 3600 * 1000;
  const elapsedMs = nowMs - lastMs;
  const windows = Math.floor(elapsedMs / windowMs);

  const nextPet: SaucelingPet = {
    ...pet,
    meters: { ...pet.meters },
    temperamentVector: { ...pet.temperamentVector },
    nudges: pet.nudges.filter((n) => Date.parse(n.expiresAt) > nowMs),
    journal: [...pet.journal],
  };
  const events: SaucelingEvent[] = [];

  if (windows > 0) {
    const collapseIntoAbsence = elapsedMs > 24 * 3600 * 1000 && windows >= 2;
    const tallies: Partial<Record<SaucelingCaretakerOutcome, number>> = {};
    const cappedWindows = Math.min(windows, Math.floor(MAX_CATCH_UP_MS / windowMs));
    const stretches = stretchesOf(windowHours);

    // The stage only changes after the windows, so an egg stays an egg through all of them.
    const isEgg = nextPet.stage === "egg";
    // A turn is run as stretches of at most 6 hours, so a long turn rolls its chances again and a short one a share.
    const turns: { startMs: number; endMs: number; hours: number }[] = [];
    let cursorMs = lastMs;
    for (let i = 0; i < cappedWindows; i++) {
      for (const hours of stretches) {
        turns.push({ startMs: cursorMs, endMs: cursorMs + hours * HOUR_MS, hours });
        cursorMs += hours * HOUR_MS;
      }
    }
    for (const { startMs, endMs: tickMs, hours } of turns) {
      const tickIso = new Date(tickMs).toISOString();
      const share = hours / ROLL_HOURS;

      // Natural decay (floors at METER_FLOOR = 20); an egg only cools
      if (isEgg) {
        nextPet.meters.warmth = clampMeter(eggWarmth(nextPet) - decayBetween(WARMTH_DECAY_PER_HOUR, startMs, tickMs));
      } else {
        const fedBefore = nextPet.meters.hunger;
        nextPet.meters.hunger = clampMeter(
          nextPet.meters.hunger - decayBetween(HUNGER_DECAY_PER_HOUR, startMs, tickMs),
        );
        nextPet.growthMs += Math.round(growingHours(fedBefore, nextPet.meters.hunger, hours) * HOUR_MS);
        nextPet.meters.mood = clampMeter(nextPet.meters.mood - decayBetween(MOOD_DECAY_PER_HOUR, startMs, tickMs));
      }

      const reliability = effectiveTendency(nextPet, "feedReliability", tickMs);
      const overfeed = effectiveTendency(nextPet, "overfeeding", tickMs);
      const playful = effectiveTendency(nextPet, "playfulness", tickMs);
      const affection = effectiveTendency(nextPet, "affection", tickMs);
      const consistency = effectiveTendency(nextPet, "consistency", tickMs);
      const attentive = effectiveTendency(nextPet, "attentiveness", tickMs);
      // An attentive caretaker has more chances to care, a distracted one fewer; a short stretch rolls its share.
      const boost = attentivenessMultiplier(attentive);
      const chanceOf = (chance: number) => Math.min(1, Math.max(0, chance * boost));
      const rolls = (chance: number) => rng.next() < chanceOf(chance) * share;
      // Meals come every 6 hours of the clock whatever the length of a turn, so a day holds the same number of them.
      const mealTurn = Math.floor(tickMs / (ROLL_HOURS * HOUR_MS)) > Math.floor(startMs / (ROLL_HOURS * HOUR_MS));

      const recordOutcome = (
        outcome: SaucelingCaretakerOutcome,
        hungerDelta: number,
        moodDelta: number,
        bondDelta: number,
        warmthDelta = 0,
      ) => {
        nextPet.meters.hunger = liftedByCaretaker(nextPet.meters.hunger, hungerDelta);
        nextPet.meters.mood = liftedByCaretaker(nextPet.meters.mood, moodDelta);
        nextPet.meters.bond = clampBond(nextPet.meters.bond + bondDelta);
        if (isEgg) nextPet.meters.warmth = liftedByCaretaker(eggWarmth(nextPet), warmthDelta);
        nextPet.careActionCount += outcome !== "forgot" && outcome !== "let-cool" ? 1 : 0;
        // Temperament starts counting at hatching.
        if (!isEgg) {
          nextPet.temperamentVector = applyCaretakerOutcomeToTemperament(nextPet.temperamentVector, outcome, affection);
        }
        tallies[outcome] = (tallies[outcome] ?? 0) + 1;
        if (!collapseIntoAbsence) {
          const ev: SaucelingEvent = {
            id: makeEventId(tickMs, rng),
            kind: "caretaker-care",
            createdAt: tickIso,
            text: templateCaretakerCareLine(
              nextPet.careProfile,
              nextPet.name,
              outcome,
              Math.floor(tickMs / (hours * HOUR_MS)),
            ),
            generated: false,
            speaker: nextPet.careProfile.characterName,
            outcome,
          };
          events.push(ev);
        }
      };

      // An egg only needs keeping warm and a little company
      if (isEgg) {
        if (mealTurn) {
          const kept = rng.next() < chanceOf(reliability);
          nextPet.mealRecord = withMealOn(nextPet.mealRecord, tickMs, kept);
          if (kept) recordOutcome("kept-warm", 0, 0, 2, 20);
          else recordOutcome("let-cool", 0, 0, 0, -6);
        }
        if (rolls(affection * 0.75)) recordOutcome("chatted", 0, 0, 3);
        continue;
      }

      // Meal roll
      if (mealTurn) {
        const fed = rng.next() < chanceOf(reliability);
        nextPet.mealRecord = withMealOn(nextPet.mealRecord, tickMs, fed);
        if (fed) {
          if (rng.next() < overfeed) {
            recordOutcome("overfed", 26, 4, 2);
          } else if (rng.next() > consistency * 0.85 + 0.1) {
            recordOutcome("fed-badly", 10, -3, 1);
          } else {
            recordOutcome("fed-fine", 18, 5, 2);
          }
        } else {
          recordOutcome("forgot", -4, -6, 0);
        }
      }

      // Play roll
      if (rolls(playful * 0.75)) {
        recordOutcome("played", -3, 14, 3);
      }

      // Cuddle roll; a caretaker who skips the cuddle may still notice how the pet is coming along
      if (rolls(affection * 0.75)) {
        recordOutcome("cuddled", 0, 12, 4);
      } else if (rng.next() < attentive * 0.75 * share) {
        recordOutcome("milestone-noticed", 0, 2, 1);
      }

      // Mood governs evolution: good days add up, and each finished day may bring the caretaker's offer, once.
      nextPet.evolution = withGoodHours(nextPet.evolution, nextPet, tickMs, hours);
      const finishedDay = Math.floor(tickMs / DAY_MS) - 1;
      if (finishedDay >= Math.floor(startMs / DAY_MS) && evolveOfferDue(nextPet.evolution, finishedDay)) {
        const chance = nextPet.evolution.chatDays.includes(finishedDay)
          ? EVOLVE_CHAT_OFFER_CHANCE
          : EVOLVE_OFFER_CHANCE;
        if (rng.next() < chance) {
          nextPet.evolution = { ...nextPet.evolution, offer: "offered" };
          events.push({
            id: makeEventId(tickMs, rng),
            kind: "evolve-offer",
            createdAt: tickIso,
            text: templateEvolveOfferScene(nextPet.careProfile, nextPet.name, tickMs),
            generated: false,
            speaker: nextPet.careProfile.characterName,
          });
        }
      }
    }

    if (collapseIntoAbsence) {
      const bucket = absenceBucketForHours(elapsedMs / (3600 * 1000));
      const absenceEv: SaucelingEvent = {
        id: makeEventId(nowMs, rng),
        kind: "absence",
        createdAt: nowIso,
        text: templateAbsenceScene(nextPet.careProfile, nextPet.name, bucket, tallies, isEgg, nowMs),
        generated: false,
        speaker: nextPet.careProfile.characterName,
        absenceBucket: bucket,
        windowsElapsed: cappedWindows,
        tallies,
      };
      events.push(absenceEv);
    }

    nextPet.lastTickAt = new Date(lastMs + windows * windowMs).toISOString();
  }

  // Stage transition check
  const nextStage = targetStageForPet(nextPet, nowMs);
  if (nextStage !== nextPet.stage) {
    const wasEgg = nextPet.stage === "egg";
    nextPet.stage = nextStage;
    if (wasEgg) {
      nextPet.hatchedAt = nowIso;
      nextPet.meters = hatchlingMeters(nextPet.meters);
      nextPet.mealRecord = [];
      nextPet.temperament = "marinara";
      nextPet.lastTemperamentShiftAt = nowIso;
      events.push({
        id: makeEventId(nowMs, rng),
        kind: "hatch",
        createdAt: nowIso,
        stage: nextStage,
        text: templateHatchScene(nextPet.careProfile, petKind(nextPet).name, undefined, nowMs),
        generated: false,
        speaker: nextPet.careProfile.characterName,
      });
    } else {
      if (nextStage === "elder" && !nextPet.elderSinceAt) {
        nextPet.elderSinceAt = nowIso;
      }
      events.push({
        id: makeEventId(nowMs, rng),
        kind: "stage-up",
        createdAt: nowIso,
        stage: nextStage,
        text: templateStageUpScene(nextPet.careProfile, nextPet.name, nextStage, nowMs),
        generated: false,
        speaker: nextPet.careProfile.characterName,
      });
    }

    // Attentiveness roll for milestone-noticed
    const attentive = effectiveTendency(nextPet, "attentiveness", nowMs);
    if (rng.next() <= attentive) {
      nextPet.temperamentVector = applyCaretakerOutcomeToTemperament(
        nextPet.temperamentVector,
        "milestone-noticed",
        effectiveTendency(nextPet, "affection", nowMs),
      );
      events.push({
        id: makeEventId(nowMs, rng),
        kind: "caretaker-care",
        createdAt: nowIso,
        outcome: "milestone-noticed",
        text: templateCaretakerCareLine(nextPet.careProfile, nextPet.name, "milestone-noticed", nowMs),
        generated: false,
        speaker: nextPet.careProfile.characterName,
      });
    }
  }

  // Temperament shift check
  const shiftedTemperament = evaluateTemperamentShift(nextPet, nowMs);
  if (shiftedTemperament) {
    nextPet.temperament = shiftedTemperament;
    nextPet.lastTemperamentShiftAt = nowIso;
    events.push({
      id: makeEventId(nowMs, rng),
      kind: "temperament-shift",
      createdAt: nowIso,
      temperament: shiftedTemperament,
      text: templateTemperamentShiftScene(nextPet.careProfile, nextPet.name, shiftedTemperament, nowMs),
      generated: false,
      speaker: nextPet.careProfile.characterName,
    });
  }

  // Elder retire-ready check
  if (nextPet.stage === "elder" && !nextPet.lockedStage && nextPet.elderSinceAt) {
    if (nowMs - Date.parse(nextPet.elderSinceAt) >= ELDER_RETIRE_READY_MS) {
      nextPet.retireReady = true;
    }
  }

  nextPet.rngState = rng.state();
  if (events.length > 0) {
    nextPet.journal = [...events.reverse(), ...nextPet.journal].slice(0, MAX_JOURNAL_ENTRIES);
  }
  return { pet: nextPet, events };
}

export function performUserAction(
  pet: SaucelingPet,
  action: SaucelingUserAction,
  nowIso: string,
  rng: SeededRng = createSeededRng(pet.rngState),
): { pet: SaucelingPet; events: SaucelingEvent[] } {
  const nowMs = Date.parse(nowIso);
  const isEgg = pet.stage === "egg";
  if (isEgg !== (SAUCELING_EGG_ACTIONS as readonly SaucelingUserAction[]).includes(action)) {
    throw Object.assign(
      new Error(isEgg ? "It is still an egg: warm it, talk to it or listen to it." : "It has already hatched."),
      { statusCode: 400 },
    );
  }
  const cooldownUntil = pet.actionCooldowns[action] ? Date.parse(pet.actionCooldowns[action]!) : 0;
  if (cooldownUntil > nowMs) {
    const minutesLeft = Math.max(1, Math.ceil((cooldownUntil - nowMs) / 60000));
    throw Object.assign(new Error(`Wait ${minutesLeft}m before doing that again.`), { statusCode: 400 });
  }

  const wasHungryGap = pet.meters.hunger < 50;
  const nextPet: SaucelingPet = {
    ...pet,
    meters: { ...pet.meters },
    // Temperament starts counting at hatching.
    temperamentVector: isEgg
      ? pet.temperamentVector
      : applyUserActionToTemperament(pet.temperamentVector, action, wasHungryGap),
    actionCooldowns: {
      ...pet.actionCooldowns,
      [action]: new Date(nowMs + ACTION_COOLDOWN_MS[action]).toISOString(),
    },
    careActionCount: pet.careActionCount + 1,
    journal: [...pet.journal],
  };

  switch (action) {
    case "feed":
      nextPet.meters.hunger = clampMeter(nextPet.meters.hunger + 24);
      nextPet.meters.mood = clampMeter(nextPet.meters.mood + 6);
      nextPet.meters.bond = clampBond(nextPet.meters.bond + 5);
      break;
    case "play":
      nextPet.meters.hunger = clampMeter(nextPet.meters.hunger - 4);
      nextPet.meters.mood = clampMeter(nextPet.meters.mood + 22);
      nextPet.meters.bond = clampBond(nextPet.meters.bond + 6);
      break;
    case "rest":
      nextPet.meters.mood = clampMeter(nextPet.meters.mood + 16);
      nextPet.meters.bond = clampBond(nextPet.meters.bond + 4);
      break;
    case "pet":
      nextPet.meters.mood = clampMeter(nextPet.meters.mood + 12);
      nextPet.meters.bond = clampBond(nextPet.meters.bond + 7);
      break;
    case "warm":
      nextPet.meters.warmth = clampMeter(eggWarmth(nextPet) + 25);
      nextPet.meters.bond = clampBond(nextPet.meters.bond + 2);
      break;
    case "talk":
      nextPet.meters.bond = clampBond(nextPet.meters.bond + 6);
      break;
    case "listen":
      nextPet.meters.bond = clampBond(nextPet.meters.bond + 3);
      break;
  }

  const events: SaucelingEvent[] = [
    {
      id: makeEventId(nowMs, rng),
      kind: "user-care",
      createdAt: nowIso,
      action,
      text: templateUserActionLine(nextPet, action),
      generated: false,
    },
  ];

  // Check if this care action triggered hatching or stage-up
  const nextStage = targetStageForPet(nextPet, nowMs);
  if (nextStage !== nextPet.stage) {
    const wasEgg = nextPet.stage === "egg";
    nextPet.stage = nextStage;
    if (wasEgg) {
      nextPet.hatchedAt = nowIso;
      nextPet.meters = hatchlingMeters(nextPet.meters);
      nextPet.mealRecord = [];
      nextPet.temperament = "marinara";
      nextPet.lastTemperamentShiftAt = nowIso;
      events.push({
        id: makeEventId(nowMs, rng),
        kind: "hatch",
        createdAt: nowIso,
        stage: nextStage,
        text: templateHatchScene(nextPet.careProfile, petKind(nextPet).name, undefined, nowMs),
        generated: false,
        speaker: nextPet.careProfile.characterName,
      });
    } else {
      if (nextStage === "elder" && !nextPet.elderSinceAt) nextPet.elderSinceAt = nowIso;
      events.push({
        id: makeEventId(nowMs, rng),
        kind: "stage-up",
        createdAt: nowIso,
        stage: nextStage,
        text: templateStageUpScene(nextPet.careProfile, nextPet.name, nextStage, nowMs),
        generated: false,
        speaker: nextPet.careProfile.characterName,
      });
    }
  }

  const shiftedTemperament = evaluateTemperamentShift(nextPet, nowMs);
  if (shiftedTemperament) {
    nextPet.temperament = shiftedTemperament;
    nextPet.lastTemperamentShiftAt = nowIso;
    events.push({
      id: makeEventId(nowMs, rng),
      kind: "temperament-shift",
      createdAt: nowIso,
      temperament: shiftedTemperament,
      text: templateTemperamentShiftScene(nextPet.careProfile, nextPet.name, shiftedTemperament, nowMs),
      generated: false,
      speaker: nextPet.careProfile.characterName,
    });
  }

  nextPet.rngState = rng.state();
  nextPet.journal = [...events.reverse(), ...nextPet.journal].slice(0, MAX_JOURNAL_ENTRIES);
  return { pet: nextPet, events };
}

export function applyCaretakerNudge(
  pet: SaucelingPet,
  tendency: SaucelingTendencyKey,
  nowIso: string,
): { pet: SaucelingPet; event: SaucelingEvent } {
  const nowMs = Date.parse(nowIso);
  const expiresAt = new Date(nowMs + 48 * 3600 * 1000).toISOString();
  const labels: Record<SaucelingTendencyKey, string> = {
    feedReliability: `Asked ${pet.careProfile.characterName} to remember meals`,
    overfeeding: `Asked ${pet.careProfile.characterName} to go easy on portions`,
    playfulness: `Asked ${pet.careProfile.characterName} to play more often`,
    affection: `Asked ${pet.careProfile.characterName} for extra cuddles`,
    attentiveness: `Asked ${pet.careProfile.characterName} to watch for milestones`,
    consistency: `Asked ${pet.careProfile.characterName} to keep a steadier routine`,
  };
  // An egg's warmth roll uses meal reliability and its chat roll uses affection.
  if (pet.stage === "egg") {
    labels.feedReliability = `Asked ${pet.careProfile.characterName} to keep the egg warm`;
    labels.affection = `Asked ${pet.careProfile.characterName} to talk to the egg more`;
  }
  const delta = tendency === "overfeeding" ? -0.25 : 0.25;
  const label = labels[tendency];
  const event: SaucelingEvent = {
    id: `nudge-${nowMs}`,
    kind: "nudge",
    createdAt: nowIso,
    text: `${label} (lasts 48 h).`,
    generated: false,
  };
  const filtered = pet.nudges.filter((n) => n.tendency !== tendency && Date.parse(n.expiresAt) > nowMs);
  return {
    pet: {
      ...pet,
      nudges: [...filtered, { tendency, delta, expiresAt, label }],
      journal: [event, ...pet.journal].slice(0, MAX_JOURNAL_ENTRIES),
    },
    event,
  };
}

/** A fresh line from the caretaker, asked for by the player; the route has the model write it. */
export function checkIn(
  pet: SaucelingPet,
  nowIso: string,
  rng: SeededRng = createSeededRng(pet.rngState),
): { pet: SaucelingPet; event: SaucelingEvent } {
  const event: SaucelingEvent = {
    id: makeEventId(Date.parse(nowIso), rng),
    kind: "check-in",
    createdAt: nowIso,
    text: templateCheckInLine(pet.careProfile, pet, Date.parse(nowIso)),
    generated: false,
    speaker: pet.careProfile.characterName,
  };
  return {
    pet: { ...pet, rngState: rng.state(), journal: [event, ...pet.journal].slice(0, MAX_JOURNAL_ENTRIES) },
    event,
  };
}

/** Outcomes where a meal was given, by anyone. */
const MEAL_OUTCOMES: readonly SaucelingCaretakerOutcome[] = ["fed-fine", "fed-badly", "overfed"];

export function computeCareGaps(pet: SaucelingPet | null, nowIso: string) {
  if (!pet) {
    return { hunger: false, mood: false, warmth: false, missedMealsRecent: 0, meals: { given: 0, total: 0 } };
  }
  const nowMs = Date.parse(nowIso);
  const sevenDaysAgo = nowMs - 7 * DAY_MS;
  let missedMealsRecent = 0;

  // Missed meals only count since the last meal anyone gave, so a fed pet stops showing hungry.
  for (const ev of pet.journal) {
    if (Date.parse(ev.createdAt) < sevenDaysAgo) break;
    if (ev.kind === "user-care" && ev.action === "feed") break;
    if (ev.kind === "caretaker-care" && ev.outcome) {
      if (MEAL_OUTCOMES.includes(ev.outcome)) break;
      if (ev.outcome === "forgot") missedMealsRecent++;
    } else if (ev.kind === "absence" && ev.tallies) {
      if (MEAL_OUTCOMES.some((outcome) => (ev.tallies?.[outcome] ?? 0) > 0)) break;
      missedMealsRecent += ev.tallies.forgot ?? 0;
    }
  }

  const nowDay = Math.floor(nowMs / DAY_MS);
  let given = 0;
  let total = 0;
  for (const day of pet.mealRecord ?? []) {
    if (day.day <= nowDay - MEAL_RECORD_DAYS) continue;
    given += day.given;
    total += day.total;
  }

  const isEgg = pet.stage === "egg";
  return {
    hunger: !isEgg && (pet.meters.hunger < 52 || missedMealsRecent >= 2),
    mood: !isEgg && pet.meters.mood < 52,
    warmth: isEgg && eggWarmth(pet) < 52,
    missedMealsRecent,
    meals: { given, total },
  };
}
