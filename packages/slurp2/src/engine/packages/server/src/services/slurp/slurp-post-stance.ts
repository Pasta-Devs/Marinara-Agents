/**
 * How this Creator is today, resolved into one position, for the things she publishes.
 *
 * Pure, like the rule modules it reads.
 *
 * ## Why this exists
 *
 * `slurp-stance.ts` collapses rapport, mood, the day, availability and the audience tone into a
 * single instruction for a direct message, and its header says why: nine prompt lines describing
 * one person is not detail, it is a contradiction the model resolves by averaging, which is how
 * every Creator ends up sounding the same.
 *
 * Posts had the opposite problem. `buildNoodlerPostMessages` received the account, the stage
 * voice, the source card, the schedule, the history and a variation axis — and nothing at all
 * about the person writing. Her mood, her energy, what she earned, what she published last night
 * reached her direct messages and stopped there. A Creator who was propositioned cruelly all
 * night posted the same sunny caption at nine the next morning, because the feed could not see
 * any of it.
 *
 * So this is the post-side sibling, deliberately the same shape: layers in, one ordered set of
 * instructions out, with the evidence kept beside it so a panel can say which layer caused a post
 * rather than guessing from the words.
 *
 * ## Precedence, highest first
 *
 * | # | Rule                                                                                     |
 * |---|------------------------------------------------------------------------------------------|
 * | 1 | Energy shapes effort, never silence. A tired Creator posts something small, not nothing.  |
 * | 2 | Exposure outranks the mood. The morning after is about last night, not about today.       |
 * | 3 | A feeling colours the post. It never picks the subject.                                   |
 * | 4 | A modifier is what is true right now, and says so in its own words.                       |
 * | 5 | A goal that is behind asks. A goal that is met says thank you.                             |
 *
 * ## What this deliberately does not do
 *
 * It never sets how adult a post is. `buildNoodlerPostMessages` takes that from the editable
 * generation guidance, on purpose and with a comment saying so, and a second opinion arriving
 * here would quietly overrule a setting the player owns.
 *
 * It also never stops a post. Blocking on low energy would read as a broken scheduler, and
 * `slurp-stance.ts` already settled the same question the same way for availability: shape the
 * output, do not withhold it.
 */
import {
  activeSlurpModifiers,
  slurpIntensityBand,
  SLURP_MODIFIERS,
  type SlurpCreatorState,
} from "./slurp-creator-state.js";
import type { SlurpGoalProgress } from "./slurp-goal.js";
import type { SlurpStanceEvidence } from "./slurp-stance.js";

export type SlurpPostStance = {
  /** The prompt lines, already ordered. Empty when there is nothing worth saying. */
  instructions: string[];
  /** Every layer that fed the decision, for the debug and creator panels. */
  evidence: SlurpStanceEvidence[];
};

export type SlurpPostStanceInput = {
  state: SlurpCreatorState;
  /** From `slurp-day-vibe.ts`, already phrased. Null on an ordinary day. */
  dayVibe: string | null;
  /** From `slurp-goal.ts`. Null when no goal is open. */
  goal: SlurpGoalProgress | null;
  at?: Date;
};

/** Below this she is working on fumes and it should show in what she puts out. */
const TIRED_ENERGY = 30;

/** Above this she has plenty and can afford something ambitious. */
const RESTED_ENERGY = 75;

/** Above this last night is still with her. */
const EXPOSED = 45;

/** A goal this far along is worth mentioning rather than pushing. */
const GOAL_NEARLY_MET = 0.75;

export function resolveSlurpPostStance(input: SlurpPostStanceInput): SlurpPostStance {
  const { state } = input;
  const instructions: string[] = [];
  const evidence: SlurpStanceEvidence[] = [];

  // Rule 1. Effort, never silence.
  if (state.energy <= TIRED_ENERGY) {
    instructions.push(
      "You are running low today. Keep this short and low-effort — something you could put up without getting off the sofa. Do not perform enthusiasm you do not have.",
    );
    evidence.push({ layer: "energy", value: slurpIntensityBand(state.energy), effect: "shortens the post" });
  } else if (state.energy >= RESTED_ENERGY) {
    instructions.push("You have the energy for something more involved than usual today. Make it worth their time.");
    evidence.push({ layer: "energy", value: slurpIntensityBand(state.energy), effect: "allows a bigger post" });
  }

  // Rule 2. Last night outranks this morning.
  if (state.exposure >= EXPOSED) {
    instructions.push(
      "You put something out recently that went further than you usually go, and you are still sitting with it. Pull back a little today: quieter, more yourself, less on display.",
    );
    evidence.push({ layer: "exposure", value: slurpIntensityBand(state.exposure), effect: "pulls the post back" });
  }

  // Rule 3. Colour, never subject.
  if (state.emotionIntensity >= 50) {
    instructions.push(
      `You are feeling ${state.emotion} today, and fairly strongly. Let it show in how you write rather than making it the subject of the post.`,
    );
    evidence.push({ layer: "emotion", value: state.emotion, effect: "colours the writing" });
  }
  if (input.dayVibe) {
    instructions.push(`${input.dayVibe} Let it show in how you write, not in what you announce.`);
    evidence.push({ layer: "day", value: input.dayVibe, effect: "colours the post only" });
  }

  // Rule 4. What is true right now, in its own words.
  for (const modifier of activeSlurpModifiers(state, input.at ?? new Date())) {
    instructions.push(SLURP_MODIFIERS[modifier.kind].line);
    evidence.push({ layer: "right now", value: modifier.kind, effect: modifier.source || "in effect" });
  }

  // Rule 5. This is the platform strategy the old stored field never once expressed. Derived from
  // the goal and the ledger, it is always true of the moment rather than fixed at setup forever.
  if (input.goal) {
    if (input.goal.met) {
      instructions.push(
        `You reached the goal you asked them for: ${input.goal.label}. Thank them for it somewhere in this post.`,
      );
      evidence.push({ layer: "goal", value: "met", effect: "asks for a thank-you" });
    } else if (input.goal.progress >= GOAL_NEARLY_MET) {
      instructions.push(
        `You are nearly at the goal you asked them for: ${input.goal.label}, ${input.goal.remaining} to go. Mention how close it is.`,
      );
      evidence.push({ layer: "goal", value: "nearly met", effect: "mentions the goal" });
    } else {
      instructions.push(
        `You have a goal open that is not moving fast: ${input.goal.label}, ${input.goal.remaining} to go. Give them a reason to help with it, without begging.`,
      );
      evidence.push({ layer: "goal", value: "behind", effect: "leans on the goal" });
    }
  }

  return { instructions, evidence };
}

/** The block the post prompt receives. Null when today is unremarkable and adds nothing. */
export function slurpPostStanceInstruction(stance: SlurpPostStance): string | null {
  if (stance.instructions.length === 0) return null;
  return ["# How you are today", ...stance.instructions].join("\n");
}
