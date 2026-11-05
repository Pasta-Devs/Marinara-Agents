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
export { HAFENKAI, migrate, migrate3, newRun } from "./kit.js";
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
export * from "./adult.js";
