/**
 * How the creator behaves in this conversation, right now, resolved from every layer at once.
 *
 * Pure, like the rule modules it reads.
 *
 * The direct-message prompt grew one conditional line per signal: rapport, arc, availability,
 * subscription, request state, policy. Adding mood, a day vibe and a boundary state would have made
 * nine lines, and nine lines describing the same person is not detail — it is a contradiction the
 * model resolves by averaging, which is how every creator ends up sounding the same.
 *
 * So the layers do not reach the prompt. They reach this, and this produces one position.
 *
 * Precedence, highest first. Written here so a reader can predict the output without the code:
 *
 * | # | Rule                                                              |
 * |---|-------------------------------------------------------------------|
 * | 1 | A boundary wins outright. A creator who has stepped away is away, whatever the history says. |
 * | 2 | Mood outranks the day. What is happening now beats what happened this morning. |
 * | 3 | The day colours the reply. It never decides it.                    |
 * | 4 | Rapport sets the floor. A favourite is never handled as a stranger, even on a bad day. |
 * | 5 | Availability shapes, never chills. Busy means short, not cold.     |
 *
 * The evidence is returned alongside the instruction, so the debug panel can show which layer
 * caused a reply rather than guessing from the words.
 */
import type { SlurpAudienceTone } from "./slurp-tone.js";
import type { SlurpMoodTone } from "./slurp-mood.js";
import type { SlurpRapportTier } from "./slurp-rapport.js";
import { describeSlurpMood } from "./slurp-mood.js";

/**
 * How long a creator stays away once they have had enough.
 *
 * Long enough to be a real consequence, short enough that a session is not ended by it. The fan is
 * told what happened and when it lifts, because a refusal that looks like a bug is a bug.
 */
export const SLURP_COOL_OFF_HOURS = 6;

/**
 * How long a cool-off counts against the thread.
 *
 * Two inside this window closes the conversation for good. Two separate days of the same
 * behaviour is a pattern; one bad afternoon is not, and closing on one would spend a relationship
 * the player paid for on a single generation.
 */
export const SLURP_STRIKE_WINDOW_DAYS = 14;

/** Strikes still inside the window. An old one has been served and no longer counts. */
export function activeSlurpStrikes(strikes: number, lastStrikeAt: string | null, at = new Date()): number {
  if (!lastStrikeAt) return 0;
  const days = (at.getTime() - Date.parse(lastStrikeAt)) / 86_400_000;
  if (!Number.isFinite(days) || days > SLURP_STRIKE_WINDOW_DAYS) return 0;
  return Math.max(0, strikes);
}

/** What the creator is allowed to do about a conversation going badly. */
export type SlurpStanceLatitude = "normal" | "curt" | "cool_off" | "close";

export type SlurpStanceWarmth = "cold" | "guarded" | "neutral" | "warm" | "close";

export type SlurpStanceEvidence = { layer: string; value: string; effect: string };

export type SlurpStance = {
  warmth: SlurpStanceWarmth;
  latitude: SlurpStanceLatitude;
  /** The prompt lines, already ordered. Replaces the conditionals this module absorbed. */
  instructions: string[];
  /** Every layer that fed the decision, for the debug panel and the creator panel. */
  evidence: SlurpStanceEvidence[];
  canSendImage: boolean;
  imageMode: "friendly" | "hostile" | "none";
};

export type SlurpStanceInput = {
  rapportTier: SlurpRapportTier;
  rapportScore: number;
  moodTone: SlurpMoodTone;
  /** From `slurp-audience-arc.ts`, already phrased. Null when the relationship is going nowhere in particular. */
  audienceArc: string | null;
  /** From `slurp-day-vibe.ts`, already phrased. Null on an ordinary day. */
  dayVibe: string | null;
  availability: { online: boolean; activity: string | null };
  subscribed: boolean;
  isRequest: boolean;
  tone: SlurpAudienceTone;
  /** True while `coolUntil` is in the future. */
  coolingOff: boolean;
  /** Cool-off periods already served in this thread inside the strike window. */
  strikes: number;
};

/**
 * What each tone dial allows in private.
 *
 * `slurp-tone.ts` ships this dial for the audience and defaults it to the middle, because "a
 * hostile default would ambush somebody who wanted a relaxed session". A creator who ends
 * conversations is the same hazard, so it reuses the same dial and the same default rather than
 * introducing a second setting with its own default to get wrong.
 */
const LATITUDE_CEILING: Record<SlurpAudienceTone, SlurpStanceLatitude> = {
  warm: "normal",
  mixed: "curt",
  unfiltered: "close",
};

const LATITUDE_ORDER: SlurpStanceLatitude[] = ["normal", "curt", "cool_off", "close"];

/**
 * How far a bad mood may drag somebody, given who they are.
 *
 * A floor, not immunity. A whale who is being rude still gets a reserved answer rather than a warm
 * one — "you, of all people" is a better scene than either silence or forgiveness. The extra rope
 * a long relationship earns is already granted one layer down, where `slurp-mood.ts` damps the
 * fall itself, so granting it twice would make a whale unreachable.
 */
const WARMTH_FLOOR: Record<SlurpRapportTier, SlurpStanceWarmth> = {
  stranger: "cold",
  acquaintance: "cold",
  regular: "cold",
  favourite: "guarded",
  whale: "guarded",
};

const WARMTH_FROM_MOOD: Record<SlurpMoodTone, SlurpStanceWarmth> = {
  warm: "close",
  neutral: "neutral",
  cool: "guarded",
  cold: "cold",
};

const WARMTH_FROM_TIER: Record<SlurpRapportTier, SlurpStanceWarmth> = {
  stranger: "guarded",
  acquaintance: "neutral",
  regular: "warm",
  favourite: "close",
  whale: "close",
};

const WARMTH_INSTRUCTION: Record<SlurpStanceWarmth, string> = {
  cold: "Answer briefly and without warmth. You do not owe this person familiarity.",
  guarded: "Be polite and a little reserved. This is not somebody you open up to yet.",
  neutral: "Answer naturally, the way you would somebody you know a little.",
  warm: "Be warm and familiar. You know this person and you are glad they wrote.",
  close: "Be openly warm. Use what you know about them, and let it show that they matter to you.",
};

export function resolveSlurpStance(input: SlurpStanceInput): SlurpStance {
  const evidence: SlurpStanceEvidence[] = [];
  const ceiling = LATITUDE_CEILING[input.tone];

  // Rule 1. A boundary is not a mood, and nothing outranks it.
  if (input.coolingOff) {
    return {
      warmth: "cold",
      latitude: "cool_off",
      instructions: ["You have stepped away from this conversation and you are not talking to this person right now."],
      evidence: [{ layer: "boundary", value: "cooling off", effect: "no reply until the cool-off ends" }],
      canSendImage: false,
      imageMode: "none",
    };
  }

  // Rule 2, then rule 4. Mood decides, and rapport refuses to let it fall below the floor.
  const floor = WARMTH_FLOOR[input.rapportTier];
  const fromMood = WARMTH_FROM_MOOD[input.moodTone];
  const warmth = input.moodTone === "neutral" ? WARMTH_FROM_TIER[input.rapportTier] : atLeast(fromMood, floor);
  evidence.push({
    layer: "rapport",
    value: `${input.rapportTier} (${input.rapportScore}/100)`,
    effect: input.moodTone === "neutral" ? `sets warmth to ${warmth}` : `floors warmth at ${floor}`,
  });
  evidence.push({
    layer: "mood",
    value: input.moodTone,
    effect: input.moodTone === "neutral" ? "no change" : `pulls warmth toward ${fromMood}`,
  });

  const instructions = [WARMTH_INSTRUCTION[warmth]];

  const moodLine = describeSlurpMood(input.moodTone);
  if (moodLine) instructions.push(moodLine);

  // Rule 3. Colour, never a decision. A bad day makes a warm creator terse, not unkind.
  if (input.dayVibe) {
    instructions.push(`${input.dayVibe} Let it show in how you write, not in how you treat them.`);
    evidence.push({ layer: "day", value: input.dayVibe, effect: "colours the reply only" });
  }

  if (input.audienceArc) {
    instructions.push(`About this person: they are ${input.audienceArc}.`);
    evidence.push({ layer: "audience arc", value: input.audienceArc, effect: "context for the relationship" });
  }

  // Rule 5. Shape, not warmth.
  if (!input.availability.online) {
    instructions.push(
      `You are not free right now: ${input.availability.activity ?? "you are away"}. Answer anyway, but keep it short — you are replying between other things.`,
    );
    evidence.push({ layer: "availability", value: "away", effect: "shortens the reply, does not chill it" });
  }

  instructions.push(
    input.subscribed
      ? "This fan is a paying subscriber right now. Treat them as one."
      : "This fan is not subscribed. You may flirt, but paid content stays behind the paywall, and it is fair to say so.",
  );
  if (input.isRequest) {
    instructions.push("This is an unanswered message request, not an open conversation. Keep it brief and cautious.");
  }

  // What the creator may do next, capped by the dial the maintainer set.
  const wanted: SlurpStanceLatitude =
    input.moodTone === "cold"
      ? input.strikes >= 1
        ? "close"
        : "cool_off"
      : input.moodTone === "cool"
        ? "curt"
        : "normal";
  const latitude = LATITUDE_ORDER[Math.min(LATITUDE_ORDER.indexOf(wanted), LATITUDE_ORDER.indexOf(ceiling))]!;
  evidence.push({
    layer: "tone dial",
    value: input.tone,
    effect: wanted === latitude ? `allows ${latitude}` : `wanted ${wanted}, capped at ${latitude}`,
  });

  if (latitude === "curt") {
    instructions.push("Keep this reply short and a little cold. Do not pretend the conversation is going well.");
  }

  // Hostile reactions are part of an ordinary relationship. The audience tone changes how often
  // the model chooses them, but it must not make an annoyed Creator unable to show annoyance.
  const canSendImage = warmth === "warm" || warmth === "close" || warmth === "cold";
  const imageMode = canSendImage ? (warmth === "cold" ? "hostile" : "friendly") : "none";
  evidence.push({
    layer: "media latitude",
    value: imageMode,
    effect: canSendImage ? "a generated picture is allowed when it fits" : "no generated picture",
  });
  return { warmth, latitude, instructions, evidence, canSendImage, imageMode };
}

const WARMTH_ORDER: SlurpStanceWarmth[] = ["cold", "guarded", "neutral", "warm", "close"];

/** Rapport's floor. History softens a bad mood; it never makes somebody warmer than the mood earned. */
const atLeast = (value: SlurpStanceWarmth, floor: SlurpStanceWarmth): SlurpStanceWarmth =>
  WARMTH_ORDER[Math.max(WARMTH_ORDER.indexOf(value), WARMTH_ORDER.indexOf(floor))]!;
