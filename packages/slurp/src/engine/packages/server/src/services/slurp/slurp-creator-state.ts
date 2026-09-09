/**
 * The state that makes one Slurp Creator more than a single mood number.
 *
 * The values stay separate on purpose. Energy describes available effort. Arousal describes
 * sexual attention. Stance describes treatment of one fan. None of them grants permission or
 * bypasses a boundary.
 */

export const SLURP_CREATOR_EMOTIONS = [
  "content",
  "warm",
  "playful",
  "excited",
  "curious",
  "proud",
  "lonely",
  "anxious",
  "embarrassed",
  "irritated",
  "jealous",
  "hurt",
  "angry",
  "withdrawn",
] as const;

export type SlurpCreatorEmotion = (typeof SLURP_CREATOR_EMOTIONS)[number];

export const SLURP_CREATOR_NEEDS = [
  "attention",
  "reassurance",
  "space",
  "validation",
  "money",
  "creative_outlet",
  "privacy",
  "connection",
  "control",
  "rest",
] as const;

export type SlurpCreatorNeed = (typeof SLURP_CREATOR_NEEDS)[number];

export const SLURP_ADULT_INTENTS = [
  "none",
  "invite_attention",
  "be_desired",
  "tease",
  "build_tension",
  "share",
  "sell_access",
  "promote_content",
  "request_custom",
  "reward_loyalty",
  "withdraw",
] as const;

export type SlurpAdultIntent = (typeof SLURP_ADULT_INTENTS)[number];

export const SLURP_PLATFORM_STRATEGIES = [
  "express_self",
  "seek_reactions",
  "build_tension",
  "convert_attention",
  "reward_subscribers",
  "sell_custom_work",
  "start_drama",
  "recover_attention",
  "protect_privacy",
  "rest",
] as const;

export type SlurpPlatformStrategy = (typeof SLURP_PLATFORM_STRATEGIES)[number];

export const SLURP_THREAD_STANCES = [
  "open",
  "friendly",
  "playful",
  "teasing",
  "professional",
  "guarded",
  "distant",
  "defensive",
  "rejecting",
] as const;

export type SlurpThreadStance = (typeof SLURP_THREAD_STANCES)[number];

export const SLURP_ADULT_LEVELS = ["ordinary", "suggestive", "provocative", "intimate", "explicit"] as const;
export type SlurpAdultLevel = (typeof SLURP_ADULT_LEVELS)[number];

export type SlurpCreatorState = {
  emotion: SlurpCreatorEmotion;
  emotionIntensity: number;
  energy: number;
  arousal: number;
  needs: SlurpCreatorNeed[];
  intent: SlurpAdultIntent;
  strategy: SlurpPlatformStrategy;
  updatedAt: string;
};

export type SlurpThreadState = {
  stance: SlurpThreadStance;
  familiarity: number;
  interest: number;
  sexualComfort: number;
  commercialTrust: number;
  emotionalTrust: number;
  respect: number;
  resentment: number;
  threadDesire: number;
  adultLevel: SlurpAdultLevel;
  updatedAt: string;
};

export type SlurpCreatorStateSignal =
  | "fan_shared_personal_fact"
  | "fan_remembered_creator_detail"
  | "fan_gave_respectful_compliment"
  | "fan_gave_welcome_adult_attention"
  | "fan_ignored_creator_question"
  | "fan_pushed_after_refusal"
  | "fan_requested_free_content"
  | "fan_paid_for_content"
  | "fan_completed_commission"
  | "fan_returned_after_silence"
  | "fan_mentioned_another_creator"
  | "fan_apologized"
  | "fan_broke_a_promise";

export type SlurpStateDelta = {
  emotion?: SlurpCreatorEmotion;
  intent?: SlurpAdultIntent;
  strategy?: SlurpPlatformStrategy;
  energy?: number;
  arousal?: number;
  emotionIntensity?: number;
  familiarity?: number;
  interest?: number;
  sexualComfort?: number;
  commercialTrust?: number;
  emotionalTrust?: number;
  respect?: number;
  resentment?: number;
  threadDesire?: number;
  adultLevel?: SlurpAdultLevel;
  stance?: SlurpThreadStance;
};

export type SlurpThreadStateDelta = Pick<
  SlurpStateDelta,
  | "familiarity"
  | "interest"
  | "sexualComfort"
  | "commercialTrust"
  | "emotionalTrust"
  | "respect"
  | "resentment"
  | "threadDesire"
  | "adultLevel"
> & { stance?: SlurpThreadStance };

export const SLURP_CREATOR_STATE_DEFAULT: Omit<SlurpCreatorState, "updatedAt"> = {
  emotion: "content",
  emotionIntensity: 35,
  energy: 60,
  arousal: 25,
  needs: [],
  intent: "none",
  strategy: "express_self",
};

export const SLURP_THREAD_STATE_DEFAULT: Omit<SlurpThreadState, "updatedAt"> = {
  stance: "friendly",
  familiarity: 0,
  interest: 0,
  sexualComfort: 0,
  commercialTrust: 0,
  emotionalTrust: 0,
  respect: 50,
  resentment: 0,
  threadDesire: 0,
  adultLevel: "ordinary",
};

const MIN = 0;
const MAX = 100;
const clamp = (value: number): number => Math.max(MIN, Math.min(MAX, Math.round(value)));

const delta = (changes: Record<string, number>, key: string, amount: number): void => {
  changes[key] = (changes[key] ?? 0) + amount;
};

/** Translate a model signal into small server-owned changes. */
export function stateDeltaForSignal(signal: SlurpCreatorStateSignal): SlurpStateDelta {
  const delta: SlurpStateDelta = {};
  switch (signal) {
    case "fan_shared_personal_fact":
      delta.familiarity = 2;
      delta.emotionalTrust = 2;
      break;
    case "fan_remembered_creator_detail":
      delta.familiarity = 3;
      delta.emotionalTrust = 3;
      delta.interest = 2;
      break;
    case "fan_gave_respectful_compliment":
      delta.interest = 2;
      delta.emotionalTrust = 1;
      break;
    case "fan_gave_welcome_adult_attention":
      delta.interest = 3;
      delta.sexualComfort = 4;
      delta.threadDesire = 3;
      delta.adultLevel = "suggestive";
      break;
    case "fan_ignored_creator_question":
      delta.interest = -2;
      delta.emotionalTrust = -2;
      break;
    case "fan_pushed_after_refusal":
      delta.sexualComfort = -12;
      delta.emotionalTrust = -8;
      delta.respect = -10;
      delta.resentment = 18;
      delta.adultLevel = "ordinary";
      delta.stance = "defensive";
      break;
    case "fan_requested_free_content":
      delta.commercialTrust = -5;
      break;
    case "fan_paid_for_content":
      delta.commercialTrust = 4;
      delta.interest = 1;
      break;
    case "fan_completed_commission":
      delta.commercialTrust = 6;
      delta.emotionalTrust = 2;
      break;
    case "fan_returned_after_silence":
      delta.interest = 3;
      delta.familiarity = 1;
      break;
    case "fan_mentioned_another_creator":
      delta.interest = -1;
      delta.resentment = 4;
      break;
    case "fan_apologized":
      delta.emotionalTrust = 5;
      delta.respect = 3;
      delta.resentment = -8;
      break;
    case "fan_broke_a_promise":
      delta.emotionalTrust = -8;
      delta.respect = -6;
      delta.resentment = 12;
      break;
  }
  return delta;
}

/** Apply one bounded delta. The server, not the model, owns the limits. */
export function applySlurpCreatorStateDelta(
  state: SlurpCreatorState,
  changes: SlurpStateDelta,
  now: string,
): SlurpCreatorState {
  const next = { ...state };
  for (const [key, value] of Object.entries(changes)) {
    if (key === "emotion" || key === "intent" || key === "strategy") {
      next[key] = value as never;
      continue;
    }
    if (typeof value !== "number") continue;
    next[key as "emotionIntensity" | "energy" | "arousal"] = clamp(
      value + next[key as "emotionIntensity" | "energy" | "arousal"],
    );
  }
  next.updatedAt = now;
  return next;
}

export function applySlurpThreadStateDelta(
  state: SlurpThreadState,
  changes: SlurpThreadStateDelta,
  now: string,
): SlurpThreadState {
  const next = { ...state } as SlurpThreadState & Record<string, unknown>;
  for (const [key, value] of Object.entries(changes)) {
    if (key === "adultLevel" || key === "stance") {
      next[key] = value;
      continue;
    }
    if (typeof value !== "number") continue;
    const current = typeof next[key] === "number" ? next[key] : 0;
    next[key] = clamp(current + value);
  }
  next.updatedAt = now;
  return next;
}

/** Apply a set of independent signals in order. */
export function applySlurpThreadStateSignals(
  state: SlurpThreadState,
  signals: SlurpCreatorStateSignal[],
  now: string,
): SlurpThreadState {
  return signals.reduce(
    (current, signal) => applySlurpThreadStateDelta(current, stateDeltaForSignal(signal), now),
    state,
  );
}

/** Silence lowers short-lived drives but leaves trust, respect, and long-term rapport alone. */
export function decaySlurpCreatorState(state: SlurpCreatorState, hours: number, now: string): SlurpCreatorState {
  const elapsed = Math.max(0, hours);
  const toward = (value: number, target: number, rate: number): number => {
    const distance = target - value;
    return clamp(value + distance * Math.min(1, (elapsed * rate) / 100));
  };
  return {
    ...state,
    emotionIntensity: toward(state.emotionIntensity, 35, 16),
    energy: toward(state.energy, 60, 8),
    arousal: toward(state.arousal, 25, 20),
    updatedAt: now,
  };
}

export function decaySlurpThreadState(state: SlurpThreadState, hours: number, now: string): SlurpThreadState {
  const elapsed = Math.max(0, hours);
  const toward = (value: number, target: number, rate: number): number => {
    const distance = target - value;
    return clamp(value + distance * Math.min(1, (elapsed * rate) / 100));
  };
  return {
    ...state,
    interest: toward(state.interest, 0, 3),
    threadDesire: toward(state.threadDesire, 0, 5),
    resentment: toward(state.resentment, 0, 1),
    updatedAt: now,
  };
}

/** Convert private numeric state into compact words for a model prompt. */
export function slurpIntensityBand(value: number): "low" | "medium" | "high" | "urgent" {
  if (value <= 25) return "low";
  if (value <= 60) return "medium";
  if (value <= 80) return "high";
  return "urgent";
}

export function slurpAdultLevelIndex(level: SlurpAdultLevel): number {
  return SLURP_ADULT_LEVELS.indexOf(level);
}

// Keep this tiny utility in the pure module so future action rules can combine deltas without
// mutating state or inventing a second arithmetic convention.
export function addSlurpDeltas(...deltas: SlurpStateDelta[]): SlurpStateDelta {
  const numeric: Record<string, number> = {};
  const categorical: SlurpStateDelta = {};
  for (const current of deltas) {
    for (const [key, value] of Object.entries(current)) {
      if (typeof value === "number") delta(numeric, key, value);
      else categorical[key as keyof SlurpStateDelta] = value as never;
    }
  }
  return { ...numeric, ...categorical };
}
