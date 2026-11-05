import {
  SAUCELING_SCORED_TEMPERAMENTS,
  type SaucelingCaretakerOutcome,
  type SaucelingPet,
  type SaucelingScoredTemperamentId,
  type SaucelingTemperamentId,
  type SaucelingTemperamentVector,
  type SaucelingUserAction,
} from "../../../../shared/src/features/agents/saucelings/types.js";
import { isPasta } from "../../../../shared/src/features/agents/saucelings/vocabulary.js";

const SHIFT_MARGIN = 6;
const HYSTERESIS_MS = 24 * 60 * 60 * 1000;
const VECTOR_DECAY = 0.94;

export function createInitialTemperamentVector(
  lean: readonly SaucelingScoredTemperamentId[],
): SaucelingTemperamentVector {
  const vec: SaucelingTemperamentVector = {
    zesto: 10,
    carbonuzzle: 10,
    rabbratty: 10,
    seppy: 10,
    alfredoze: 10,
    truffoddity: 10,
  };
  if (lean[0]) vec[lean[0]] += 5;
  if (lean[1]) vec[lean[1]] += 2.5;
  return vec;
}

function decayVector(vec: SaucelingTemperamentVector): SaucelingTemperamentVector {
  const next = { ...vec };
  for (const key of SAUCELING_SCORED_TEMPERAMENTS) {
    next[key] = Number((next[key] * VECTOR_DECAY).toFixed(3));
  }
  return next;
}

export function applyCaretakerOutcomeToTemperament(
  vec: SaucelingTemperamentVector,
  outcome: SaucelingCaretakerOutcome,
  affectionLevel: number,
): SaucelingTemperamentVector {
  const next = decayVector(vec);
  switch (outcome) {
    case "fed-fine":
      next.zesto += 4.5;
      break;
    case "fed-badly":
      next.rabbratty += 4;
      next.seppy += 2;
      break;
    case "overfed":
      next.alfredoze += 6;
      next.rabbratty += 2;
      break;
    case "forgot":
      next.seppy += 5.5;
      next.rabbratty += 3.5;
      break;
    case "played":
      next.zesto += 5;
      break;
    case "cuddled":
      next.carbonuzzle += 6;
      break;
    case "milestone-noticed":
      next.truffoddity += affectionLevel < 0.4 ? 6.5 : 3.5;
      break;
  }
  return next;
}

export function applyUserActionToTemperament(
  vec: SaucelingTemperamentVector,
  action: SaucelingUserAction,
  wasHungryGap: boolean,
): SaucelingTemperamentVector {
  const next = decayVector(vec);
  switch (action) {
    case "feed":
      next.zesto += 4;
      if (wasHungryGap) next.rabbratty += 2.5;
      break;
    case "play":
      next.zesto += 5;
      break;
    case "rest":
      next.alfredoze += 4.5;
      break;
    case "pet":
      next.carbonuzzle += 5.5;
      break;
  }
  return next;
}

/** A sauce shift, for pasta only: a sauceling that is not pasta has its own temperament (see `ownTemperamentDue`). */
export function evaluateTemperamentShift(
  pet: Pick<
    SaucelingPet,
    "species" | "design" | "stage" | "temperament" | "temperamentVector" | "lastTemperamentShiftAt"
  >,
  nowMs: number,
): SaucelingTemperamentId | null {
  if (pet.stage === "egg" || !isPasta(pet)) return null;
  const lastShiftMs = Date.parse(pet.lastTemperamentShiftAt);
  if (Number.isFinite(lastShiftMs) && nowMs - lastShiftMs < HYSTERESIS_MS) {
    return null;
  }
  const entries = SAUCELING_SCORED_TEMPERAMENTS.map((id) => ({
    id,
    score: pet.temperamentVector[id] ?? 0,
  })).sort((a, b) => b.score - a.score);

  const top = entries[0]!;
  const runnerUp = entries[1]!;
  if (top.id === pet.temperament) return null;

  const currentScore = pet.temperament === "marinara" ? runnerUp.score : (pet.temperamentVector[pet.temperament] ?? 0);
  if (top.score - currentScore >= SHIFT_MARGIN && top.score >= 16) {
    return top.id;
  }
  return null;
}

/** Two weeks in a row with one caretaker moves an own temperament a step toward theirs. */
export const TAKE_AFTER_MS = 14 * 24 * 60 * 60 * 1000;

/** What a hatched sauceling that is not pasta needs written: its first temperament (taking after its finder), or a
 *  step toward the caretaker who has had it two weeks in a row (since they took it on and since it last changed), until
 *  it takes after them fully; null when nothing is due. */
export function ownTemperamentDue(
  pet: Pick<SaucelingPet, "species" | "design" | "stage" | "ownTemperament" | "caretakerId" | "caretakerSince">,
  nowMs: number,
): "first" | "step" | null {
  if (pet.stage === "egg" || isPasta(pet)) return null;
  const own = pet.ownTemperament;
  if (!own) return "first";
  if (own.takesAfter.id === pet.caretakerId && own.steps === 3) return null;
  const since = Math.max(Date.parse(pet.caretakerSince) || 0, Date.parse(own.at) || 0);
  return nowMs - since >= TAKE_AFTER_MS ? "step" : null;
}
