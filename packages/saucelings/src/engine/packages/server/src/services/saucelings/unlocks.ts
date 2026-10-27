import {
  ORDINARY_SPECIES,
  SEASONAL_SPECIES,
  SPECIAL_SPECIES,
  type SaucelingMilestones,
  type SaucelingSpecialSpeciesId,
  type SaucelingSpeciesId,
  type SaucelingUnlocks,
  type SaucelingWorldDocument,
} from "../../../../shared/src/features/agents/saucelings/types.js";

/** What each special egg needs: elders raised or saucelings evolved, care actions given, and days with a care action. */
export const UNLOCK_NEEDS: Record<SaucelingSpecialSpeciesId, number> = { prismite: 3, thundrake: 100, clockrit: 30 };

type UnlockWorld = Pick<SaucelingWorldDocument, "activePet" | "menagerie" | "milestones" | "unlocked">;

/** How far the player is towards each special egg. Elders and evolved saucelings (one that is both counts once) are
 *  the Menagerie's and the nook's, so one that is released or undoes its evolution no longer counts (an unlock it
 *  helped to stays). */
function progressOf(world: UnlockWorld): Record<SaucelingSpecialSpeciesId, number> {
  const pet = world.activePet;
  const elders =
    world.menagerie.filter((entry) => entry.reachedElder || entry.evolution.at).length +
    (pet && (pet.elderSinceAt || pet.evolution.at) ? 1 : 0);
  return { prismite: elders, thundrake: world.milestones.careActions, clockrit: world.milestones.careDays };
}

/** The unlocked specials: every one unlocked before, and any whose milestone is met now. */
export function latchUnlocks(world: UnlockWorld): SaucelingSpecialSpeciesId[] {
  const have = progressOf(world);
  return SPECIAL_SPECIES.filter((id) => world.unlocked.includes(id) || have[id] >= UNLOCK_NEEDS[id]);
}

/** October by UTC, like the package's day key. */
export const isHalloween = (nowIso: string) => new Date(nowIso).getUTCMonth() === 9;

export function unlocksOf(world: UnlockWorld, nowIso: string): SaucelingUnlocks {
  const have = progressOf(world);
  const progress = (id: SaucelingSpecialSpeciesId) => ({
    done: world.unlocked.includes(id),
    have: Math.min(have[id], UNLOCK_NEEDS[id]),
    need: UNLOCK_NEEDS[id],
  });
  return {
    prismite: progress("prismite"),
    thundrake: progress("thundrake"),
    clockrit: progress("clockrit"),
    halloween: isHalloween(nowIso),
  };
}

/** What an adopted egg may be now: the ordinary species, the Halloween ones in October, and unlocked specials. */
export function availableSpecies(world: UnlockWorld, nowIso: string): SaucelingSpeciesId[] {
  return [...ORDINARY_SPECIES, ...(isHalloween(nowIso) ? SEASONAL_SPECIES : []), ...world.unlocked];
}

/** One more care action given on `day` (the UTC day key). */
export function countCare(milestones: SaucelingMilestones, day: string): SaucelingMilestones {
  return {
    careActions: milestones.careActions + 1,
    careDays: milestones.careDays + (milestones.lastCareDay === day ? 0 : 1),
    lastCareDay: day,
  };
}
