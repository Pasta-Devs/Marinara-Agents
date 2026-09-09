/**
 * The state that makes one Slurp Creator more than a single mood number.
 *
 * The values stay separate on purpose. Energy describes available effort. Arousal describes
 * sexual attention. Posture describes treatment of one fan. None of them grants permission or
 * bypasses a boundary.
 *
 * Every value here must be moved by something and read by something. `needs` and `strategy` were
 * neither: no code path ever wrote them, so every Creator reported an empty need list and the
 * strategy `express_self` forever. `interest` and `commercialTrust` were written but duplicated
 * work already done better elsewhere — mood already tracks how a conversation is going, and
 * `slurp-rapport.ts` already scores tips, unlocks and commissions from the real ledger rather
 * than from the model's claim about it. A dial the prompt cannot distinguish from its neighbour
 * is not detail, it is the averaging problem `slurp-stance.ts` was written to avoid.
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

export const SLURP_THREAD_POSTURES = [
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

export type SlurpThreadPosture = (typeof SLURP_THREAD_POSTURES)[number];

export const SLURP_ADULT_LEVELS = ["ordinary", "suggestive", "provocative", "intimate", "explicit"] as const;
export type SlurpAdultLevel = (typeof SLURP_ADULT_LEVELS)[number];

export type SlurpCreatorState = {
  emotion: SlurpCreatorEmotion;
  emotionIntensity: number;
  energy: number;
  arousal: number;
  intent: SlurpAdultIntent;
  updatedAt: string;
};

export type SlurpThreadState = {
  /** Named `posture`, not `stance`: `slurp-stance.ts` owns the word for the resolved position. */
  posture: SlurpThreadPosture;
  familiarity: number;
  sexualComfort: number;
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

export const SLURP_CREATOR_STATE_SIGNALS = [
  "fan_shared_personal_fact",
  "fan_remembered_creator_detail",
  "fan_gave_respectful_compliment",
  "fan_gave_welcome_adult_attention",
  "fan_ignored_creator_question",
  "fan_pushed_after_refusal",
  "fan_requested_free_content",
  "fan_paid_for_content",
  "fan_completed_commission",
  "fan_returned_after_silence",
  "fan_mentioned_another_creator",
  "fan_apologized",
  "fan_broke_a_promise",
] as const satisfies readonly SlurpCreatorStateSignal[];

export type SlurpStateDelta = {
  emotion?: SlurpCreatorEmotion;
  intent?: SlurpAdultIntent;
  energy?: number;
  arousal?: number;
  emotionIntensity?: number;
  familiarity?: number;
  sexualComfort?: number;
  emotionalTrust?: number;
  respect?: number;
  resentment?: number;
  threadDesire?: number;
  adultLevel?: SlurpAdultLevel;
  posture?: SlurpThreadPosture;
};

export type SlurpThreadStateDelta = Pick<
  SlurpStateDelta,
  "familiarity" | "sexualComfort" | "emotionalTrust" | "respect" | "resentment" | "threadDesire" | "adultLevel"
> & { posture?: SlurpThreadPosture };

export const SLURP_CREATOR_STATE_DEFAULT: Omit<SlurpCreatorState, "updatedAt"> = {
  emotion: "content",
  emotionIntensity: 35,
  energy: 60,
  arousal: 25,
  intent: "none",
};

export const SLURP_THREAD_STATE_DEFAULT: Omit<SlurpThreadState, "updatedAt"> = {
  posture: "friendly",
  familiarity: 0,
  sexualComfort: 0,
  emotionalTrust: 0,
  respect: 50,
  resentment: 0,
  threadDesire: 0,
  adultLevel: "ordinary",
};

/** The intensity every feeling returns to. Also the default, so a settled Creator reads as one. */
const SLURP_EMOTION_BASE = 35;

/** `toward` approaches the base without reaching it, so settling needs a little room above it. */
const SLURP_EMOTION_SETTLED = 38;

const MIN = 0;
const MAX = 100;
const clamp = (value: number): number => Math.max(MIN, Math.min(MAX, Math.round(value)));

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
      break;
    case "fan_gave_respectful_compliment":
      delta.emotionalTrust = 2;
      break;
    case "fan_gave_welcome_adult_attention":
      delta.sexualComfort = 6;
      delta.threadDesire = 5;
      break;
    case "fan_ignored_creator_question":
      delta.emotionalTrust = -2;
      break;
    case "fan_pushed_after_refusal":
      delta.sexualComfort = -12;
      delta.emotionalTrust = -8;
      delta.respect = -10;
      delta.resentment = 18;
      delta.adultLevel = "ordinary";
      delta.posture = "defensive";
      break;
    case "fan_requested_free_content":
      delta.respect = -3;
      break;
    // Paying is not a thread dial. `slurp-rapport.ts` scores tips, unlocks and commissions from
    // the wallet, so scoring the model's claim about them here only ever disagreed with the money.
    case "fan_paid_for_content":
      break;
    case "fan_completed_commission":
      delta.emotionalTrust = 2;
      break;
    case "fan_returned_after_silence":
      delta.familiarity = 1;
      break;
    case "fan_mentioned_another_creator":
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

/** Changes to the Creator's shared state. Relationship changes stay on the thread. */
export function creatorStateDeltaForSignal(signal: SlurpCreatorStateSignal): SlurpStateDelta {
  switch (signal) {
    case "fan_gave_welcome_adult_attention":
      return { arousal: 3, emotion: "playful", emotionIntensity: 2, intent: "tease" };
    case "fan_paid_for_content":
      return { energy: -1, emotion: "proud", emotionIntensity: 1 };
    case "fan_completed_commission":
      return { energy: -5, emotion: "content", emotionIntensity: 2 };
    case "fan_mentioned_another_creator":
      return { emotion: "jealous", emotionIntensity: 4 };
    case "fan_pushed_after_refusal":
      return { emotion: "irritated", emotionIntensity: 5, arousal: -6 };
    case "fan_returned_after_silence":
      return { emotion: "warm", emotionIntensity: 2, arousal: 1 };
    default:
      return {};
  }
}

export function readSlurpCreatorState(raw: unknown, fallbackUpdatedAt: string): SlurpCreatorState {
  const value = typeof raw === "string" ? parseSlurpStateJson(raw) : raw;
  const record = value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  const number = (key: keyof SlurpCreatorState, fallback: number): number =>
    typeof record[key] === "number" && Number.isFinite(record[key]) ? clamp(Number(record[key])) : fallback;
  const emotion = SLURP_CREATOR_EMOTIONS.includes(record.emotion as SlurpCreatorEmotion)
    ? (record.emotion as SlurpCreatorEmotion)
    : SLURP_CREATOR_STATE_DEFAULT.emotion;
  const intent = SLURP_ADULT_INTENTS.includes(record.intent as SlurpAdultIntent)
    ? (record.intent as SlurpAdultIntent)
    : SLURP_CREATOR_STATE_DEFAULT.intent;
  return {
    emotion,
    emotionIntensity: number("emotionIntensity", SLURP_CREATOR_STATE_DEFAULT.emotionIntensity),
    energy: number("energy", SLURP_CREATOR_STATE_DEFAULT.energy),
    arousal: number("arousal", SLURP_CREATOR_STATE_DEFAULT.arousal),
    intent,
    updatedAt:
      typeof record.updatedAt === "string" && Number.isFinite(Date.parse(record.updatedAt))
        ? record.updatedAt
        : fallbackUpdatedAt,
  };
}

function parseSlurpStateJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function slurpCreatorStateCanUseMedia(creator: SlurpCreatorState, thread: SlurpThreadState): boolean {
  if (creator.energy < 25 || thread.posture === "rejecting") return false;
  const adultStateActive = creator.arousal >= 36 || thread.adultLevel !== "ordinary";
  if (!adultStateActive) return true;
  return thread.sexualComfort >= 36 && thread.respect >= 36 && thread.posture !== "defensive";
}

/** Apply one bounded delta. The server, not the model, owns the limits. */
export function applySlurpCreatorStateDelta(
  state: SlurpCreatorState,
  changes: SlurpStateDelta,
  now: string,
): SlurpCreatorState {
  const next = { ...state };
  for (const [key, value] of Object.entries(changes)) {
    if (key === "emotion" || key === "intent") {
      next[key] = value as never;
      continue;
    }
    if (typeof value !== "number") continue;
    const numericKey = key as "emotionIntensity" | "energy" | "arousal";
    next[numericKey] = clamp(value + next[numericKey]);
  }
  next.updatedAt = now;
  return next;
}

/**
 * What one thread must hold to keep each level.
 *
 * Comfort is the slow axis: it never decays, so it carries the floor of every step and a ceiling
 * once earned is not lost to a quiet week. Desire is the fast one and does decay, so holding the
 * top of the range needs somebody who is still interested now, not somebody who was in March.
 */
const ADULT_LEVEL_REQUIREMENT: Record<SlurpAdultLevel, { sexualComfort: number; threadDesire: number }> = {
  ordinary: { sexualComfort: 0, threadDesire: 0 },
  suggestive: { sexualComfort: 20, threadDesire: 0 },
  provocative: { sexualComfort: 40, threadDesire: 30 },
  intimate: { sexualComfort: 60, threadDesire: 45 },
  explicit: { sexualComfort: 80, threadDesire: 60 },
};

/** Below this the ceiling cannot rise. Being wanted is not the same as being thought well of. */
const ADULT_RESPECT_FLOOR = 40;

/** Above this the ceiling cannot rise. A grudge outranks an appetite. */
const ADULT_RESENTMENT_CEILING = 40;

/** The more restrictive of two levels. A refusal must never be outranked by an earlier signal. */
export function lowerSlurpAdultLevel(a: SlurpAdultLevel, b: SlurpAdultLevel): SlurpAdultLevel {
  return slurpAdultLevelIndex(a) <= slurpAdultLevelIndex(b) ? a : b;
}

/**
 * The ceiling this thread has earned, one step from where it is now.
 *
 * Nothing here is set by the model. Until this existed the only two writers were one signal that
 * set `suggestive` and one that set `ordinary`, so `provocative`, `intimate` and `explicit` were
 * unreachable and every conversation in Slurp was capped two steps below its own top — while the
 * prompt said, hard, "keep adult behavior at or below its adultLevel".
 *
 * A rise is earned, never granted: one step at a time, never skipping, and only while the fan is
 * somebody she both wants and thinks well of. Respect, resentment and a defensive posture veto a
 * rise outright. That veto is the whole difference between escalation and pressure paying off,
 * and it is why the fall is checked first: a level the thread no longer holds goes immediately,
 * whatever earned it.
 */
export function nextSlurpAdultLevel(state: SlurpThreadState): SlurpAdultLevel {
  const index = slurpAdultLevelIndex(state.adultLevel);
  const holds = (level: SlurpAdultLevel): boolean => {
    const need = ADULT_LEVEL_REQUIREMENT[level];
    return state.sexualComfort >= need.sexualComfort && state.threadDesire >= need.threadDesire;
  };
  if (index > 0 && !holds(state.adultLevel)) return SLURP_ADULT_LEVELS[index - 1];
  if (state.respect < ADULT_RESPECT_FLOOR) return state.adultLevel;
  if (state.resentment > ADULT_RESENTMENT_CEILING) return state.adultLevel;
  if (state.posture === "defensive" || state.posture === "rejecting") return state.adultLevel;
  const next = SLURP_ADULT_LEVELS[index + 1];
  return next && holds(next) ? next : state.adultLevel;
}

export function applySlurpThreadStateDelta(
  state: SlurpThreadState,
  changes: SlurpThreadStateDelta,
  now: string,
): SlurpThreadState {
  const next = { ...state } as SlurpThreadState & Record<string, unknown>;
  for (const [key, value] of Object.entries(changes)) {
    if (key === "posture") {
      next[key] = value;
      continue;
    }
    // Most restrictive wins. The model chooses the order it reports signals in, so last-write-wins
    // let a refusal and a welcome land in either order and produce a different ceiling each time.
    if (key === "adultLevel") {
      next.adultLevel = lowerSlurpAdultLevel(next.adultLevel as SlurpAdultLevel, value as SlurpAdultLevel);
      continue;
    }
    if (typeof value !== "number") continue;
    const current = typeof next[key] === "number" ? next[key] : 0;
    next[key] = clamp(current + value);
  }
  // After the numbers, never before: a rise is read off the state the signals just produced.
  next.adultLevel = nextSlurpAdultLevel(next as SlurpThreadState);
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
  const emotionIntensity = toward(state.emotionIntensity, SLURP_EMOTION_BASE, 16);
  // The intensity decayed but the emotion it belonged to never did, so one jealous afternoon left
  // a Creator quietly jealous for the rest of the save. The two are one feeling: when the
  // intensity settles she settles, and the intent that arrived with it goes with it.
  const settled = emotionIntensity <= SLURP_EMOTION_SETTLED;
  return {
    ...state,
    emotion: settled ? SLURP_CREATOR_STATE_DEFAULT.emotion : state.emotion,
    intent: settled ? SLURP_CREATOR_STATE_DEFAULT.intent : state.intent,
    emotionIntensity,
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
  const decayed: SlurpThreadState = {
    ...state,
    threadDesire: toward(state.threadDesire, 0, 5),
    resentment: toward(state.resentment, 0, 1),
    updatedAt: now,
  };
  return { ...decayed, adultLevel: nextSlurpAdultLevel(decayed) };
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
