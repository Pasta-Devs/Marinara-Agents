export { roll, pick } from "./rng.js";
export * from "./types.js";
export {
  WEEKS,
  DAYS,
  HOURS,
  TERM_WEEKS,
  DAY_NAMES,
  SLOTS,
  newClock,
  term,
  dayName,
  slot,
  isFriday,
  dayIndex,
  spendHours,
  nextDay,
} from "./clock.js";
export { K, STANCES, TIERS, FOLLOW, effect, trustChange, offer } from "./stances.js";
export type { Stance } from "./stances.js";
export { applyDelta, clamp, pure } from "./run.js";
export { HAFENKAI, migrate, migrate3, migrate4, m4Defaults, newRun } from "./kit.js";
export type { Kit } from "./kit.js";
export { meterTension, pureSeedDay as seedDay, pureAnswerCard as answerCard } from "./cards.js";
export {
  pureOpenPromise as openPromise,
  pureKeepPromise as keepPromise,
  pureReadLetter as readLetter,
  lettersUnlocked,
} from "./threads.js";
export { pureSettleWeek as settleWeek, pureEndDay as endDay } from "./settle.js";
export {
  pureAddWitness as addWitness,
  pureAddEvidence as addEvidence,
  pureTalkToMember as talkToMember,
  pureHoldHearing as holdHearing,
} from "./hearing.js";

// In-place versions for bulk simulation (no copy per call). Use only on a run you own.
import { answerCard as answerCardIn, seedDay as seedDayIn } from "./cards.js";
import { endDay as endDayIn } from "./settle.js";
export const draft = { seedDay: seedDayIn, answerCard: answerCardIn, endDay: endDayIn };
export * from "./people.js";
export * from "./layers.js";
export * from "./culture.js";
export { PRESETS, tension } from "./storyteller.js";
export {
  MEETINGS,
  MEETING_KINDS,
  passes,
  pureStartMeeting as startMeeting,
  pureMeetingText as meetingText,
  pureMeetingChoice as meetingChoice,
} from "./meetings.js";
export { blocks, setSystem, startSystems } from "./blocks.js";
export { decreeCost, enforcerIn, plotChance, pureSetRule as setRule, ruleOption, stancePower } from "./authority.js";
export { electionReady, isElection, lawArrives, pureBackCandidate as backCandidate } from "./politics.js";
export * from "./adult.js";
export * from "./wish.js";
export * from "./things.js";
export { horrorSeeds, horrorClosed } from "./horror.js"; // M4 T7
export { strangeSeeds, strangeClosed, isAiCrew, AI_CREW } from "./strange.js";
export * from "./eyes.js";
export * from "./delegation.js"; // T11
export * from "./favours.js"; // M4 T12
export { crimeSeeds } from "./crime.js"; // M4 T4
export { mysterySeeds, isCleared, pureInvestigate as investigate } from "./mystery.js";
export { GOALS, goalById, checkGoal, currentGoals, offerGoals, pickGoals } from "./goals.js"; // M4 T8
export { PERKS, choosePerk, offerPerks, perkWeight } from "./perks.js";
export * from "./ledger.js"; // M4 T15
export { legacyRun, legacyTerm, pureNameHeir as nameHeir } from "./legacy.js"; // M4 T6
export { ENDINGS, endingIdOf, endView, judgeRun, leaveRun, wonYear } from "./endings.js"; // M4 T9
export { ACHIEVEMENTS } from "./achievements.js";
export * from "./building.js"; // M4 T16
export {
  MINIGAMES,
  minigameOffer,
  pureMinigamePlay as playMinigame,
  pureMinigameText as minigameText,
} from "./minigames.js"; // M4 T17
