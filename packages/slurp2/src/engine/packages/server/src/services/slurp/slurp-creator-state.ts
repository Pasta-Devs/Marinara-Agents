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

/**
 * Something that is true of a Creator for a while, and then is not.
 *
 * The dials below are accumulators: they answer "how much" and they move slowly. A great many
 * things worth knowing about a person are not accumulators — she posted ten minutes ago, a set
 * sold well this morning, she has had a drink. Each of those wanted a dial of its own, and a dial
 * per feeling is how a state model grows to forty columns that the prompt then averages away.
 *
 * So they are one list with a clock instead. A modifier carries a prompt line and expires by
 * timestamp, which means no scheduler ticks it and no migration is needed to add another: adding
 * a feeling is adding a row to SLURP_MODIFIERS, never a column to storage.
 */
export const SLURP_MODIFIER_KINDS = [
  "just_posted",
  "post_landed",
  "post_flopped",
  "afterglow",
  "overexposed",
  "paid_well",
  "goal_hit",
  "lapse_sting",
  "tipsy",
  "tired",
  "rattled",
] as const;

export type SlurpModifierKind = (typeof SLURP_MODIFIER_KINDS)[number];

export type SlurpCreatorModifier = {
  kind: SlurpModifierKind;
  /** When it stops applying. Expiry is read off the clock, so nothing has to tick it. */
  until: string;
  /** What put it there, in a few words, for the panel. Never reaches the model. */
  source: string;
};

/**
 * Every modifier, with what it does and how long it lasts.
 *
 * The numeric part is applied once, when the modifier arrives. The line is what persists while it
 * is active. That split is deliberate: a lasting consequence belongs on a dial where it can be
 * seen and decayed, and a modifier that also nudged numbers every read would compound silently
 * for as long as it ran.
 */
export const SLURP_MODIFIERS: Record<
  SlurpModifierKind,
  { line: string; hours: number; delta: Omit<SlurpStateDelta, "adultLevel" | "posture"> }
> = {
  just_posted: {
    line: "You posted a few minutes ago and you keep checking how it is doing.",
    hours: 1,
    delta: { arousal: 4 },
  },
  post_landed: {
    line: "Something you posted is doing well and you are pleased with yourself.",
    hours: 6,
    delta: { emotion: "proud", emotionIntensity: 12, arousal: 6 },
  },
  post_flopped: {
    line: "Something you posted has gone nowhere, and you have noticed.",
    hours: 8,
    delta: { emotion: "lonely", emotionIntensity: 10, energy: -4 },
  },
  afterglow: {
    line: "You are coming down from something and you feel unguarded.",
    hours: 2,
    delta: { arousal: -20, emotion: "content", emotionIntensity: 8 },
  },
  overexposed: {
    line: "You went further than you usually do and you are not sure how you feel about it yet.",
    hours: 10,
    delta: { arousal: -12, emotion: "embarrassed", emotionIntensity: 14 },
  },
  paid_well: {
    line: "Money came in today and it has taken the edge off.",
    hours: 12,
    delta: { emotion: "content", emotionIntensity: 10, energy: 5 },
  },
  goal_hit: {
    line: "You hit the goal you asked them for. Say something about it.",
    hours: 24,
    delta: { emotion: "excited", emotionIntensity: 20, energy: 8 },
  },
  lapse_sting: {
    line: "Somebody who had been around a long time has gone quiet, and it is sitting with you.",
    hours: 12,
    delta: { emotion: "hurt", emotionIntensity: 14 },
  },
  tipsy: {
    line: "You have had a drink or two.",
    hours: 3,
    delta: { arousal: 10, energy: -8 },
  },
  tired: {
    line: "You are running on nothing and it shows.",
    hours: 4,
    delta: { energy: -15 },
  },
  rattled: {
    line: "Somebody was unpleasant earlier and you have not shaken it off.",
    hours: 4,
    delta: { emotion: "anxious", emotionIntensity: 12 },
  },
};

/**
 * Coins arriving in one go below which nothing is felt. A one-coin tip is not a good day.
 *
 * The threshold matters more than the number: without one, every unlock on the platform would
 * refresh `paid_well` and a Creator would be permanently pleased about money.
 */
export const SLURP_PAID_WELL_COINS = 5;

/**
 * What publishing costs in privacy, before the access level is taken into account.
 *
 * Exposure is the only dial the world writes rather than a fan, and this is the only thing that
 * writes it. A locked post is further out than a public one — it is the one she made for people
 * who paid to see it — so it carries the larger share.
 */
export const SLURP_EXPOSURE_PER_POST = { public: 8, locked: 16 } as const;

/**
 * Reactions inside one world pulse that mean a post has landed.
 *
 * A follow is the rare one that actually moves the funnel, per `slurp-world-pulse.ts`, so it
 * counts for more than a like. This is deliberately about one tick rather than a rolling average:
 * the feeling being modelled is noticing your notifications, not auditing your analytics.
 */
export const SLURP_POST_LANDED_REACTIONS = 5;

/** Most that are kept at once. Older ones fall off first: a person is not ten things at a time. */
export const SLURP_MODIFIER_LIMIT = 4;

export type SlurpCreatorState = {
  emotion: SlurpCreatorEmotion;
  emotionIntensity: number;
  energy: number;
  arousal: number;
  /**
   * How far out on a limb this Creator currently is in public.
   *
   * Every other dial here is moved by what one fan did in one conversation. This one is moved by
   * what she published to everybody, which is the only channel the world had into her mood at
   * all. It is what produces the morning after: post something bold at midnight, wake up exposed,
   * and write differently all day because of something no fan said to you.
   */
  exposure: number;
  intent: SlurpAdultIntent;
  modifiers: SlurpCreatorModifier[];
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
  exposure?: number;
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
  exposure: 0,
  intent: "none",
  modifiers: [],
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

/** The modifiers still running at `at`. Expiry is a clock read, so nothing has to sweep them. */
export function activeSlurpModifiers(state: SlurpCreatorState, at = new Date()): SlurpCreatorModifier[] {
  return state.modifiers.filter((modifier) => {
    const until = Date.parse(modifier.until);
    return Number.isFinite(until) && until > at.getTime();
  });
}

/** What the active modifiers tell the model, in the order they arrived. */
export function slurpModifierLines(state: SlurpCreatorState, at = new Date()): string[] {
  return activeSlurpModifiers(state, at).map((modifier) => SLURP_MODIFIERS[modifier.kind].line);
}

/**
 * Add one modifier and apply its one-off change.
 *
 * Re-adding a kind that is already running refreshes it rather than stacking a second copy, so a
 * Creator who posts four times in an hour is "just posted" once and is not charged for it four
 * times over. Expired entries are dropped on the way through, which is the only sweep there is.
 */
export function addSlurpModifier(
  state: SlurpCreatorState,
  kind: SlurpModifierKind,
  source: string,
  at = new Date(),
): SlurpCreatorState {
  const definition = SLURP_MODIFIERS[kind];
  const until = new Date(at.getTime() + definition.hours * 3_600_000).toISOString();
  const running = activeSlurpModifiers(state, at);
  const already = running.some((modifier) => modifier.kind === kind);
  const kept = running.filter((modifier) => modifier.kind !== kind);
  const modifiers = [...kept, { kind, until, source }].slice(-SLURP_MODIFIER_LIMIT);
  // The numbers move only when the feeling is new. A refresh extends the line, nothing more.
  const next = already ? { ...state } : applySlurpCreatorStateDelta(state, definition.delta, at.toISOString());
  return { ...next, modifiers, updatedAt: at.toISOString() };
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
  const now = Date.now();
  const modifiers = Array.isArray(record.modifiers)
    ? record.modifiers
        .filter((entry): entry is SlurpCreatorModifier => {
          if (!entry || typeof entry !== "object" || Array.isArray(entry)) return false;
          const candidate = entry as Record<string, unknown>;
          if (!SLURP_MODIFIER_KINDS.includes(candidate.kind as SlurpModifierKind)) return false;
          if (typeof candidate.until !== "string") return false;
          const until = Date.parse(candidate.until);
          // An expired entry is dropped on read, so the list cannot grow without a sweep.
          return Number.isFinite(until) && until > now;
        })
        .map((entry) => ({ kind: entry.kind, until: entry.until, source: String(entry.source ?? "") }))
        .slice(-SLURP_MODIFIER_LIMIT)
    : SLURP_CREATOR_STATE_DEFAULT.modifiers;
  return {
    emotion,
    modifiers,
    emotionIntensity: number("emotionIntensity", SLURP_CREATOR_STATE_DEFAULT.emotionIntensity),
    energy: number("energy", SLURP_CREATOR_STATE_DEFAULT.energy),
    arousal: number("arousal", SLURP_CREATOR_STATE_DEFAULT.arousal),
    exposure: number("exposure", SLURP_CREATOR_STATE_DEFAULT.exposure),
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
    if (key === "modifiers") continue;
    const numericKey = key as "emotionIntensity" | "energy" | "arousal" | "exposure";
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

/**
 * What doing something costs a Creator.
 *
 * Energy was the only dial in this module with a mechanical effect — it sets the reply burst
 * limit and gates media — and nothing anywhere ever spent it. It drifted toward 60 on a clock, so
 * a Creator who published six posts and four pictures in an afternoon ended it more rested than
 * she started, and "available effort" described nothing that had happened.
 *
 * The numbers are in the same units as the recovery below: at a typical gap the drift returns
 * roughly two and a half points an hour, so a post is about two hours of rest and a commission is
 * most of a working day. Both are deliberately cheap enough that ordinary use never floors her.
 *
 * ponytail: recovery is clock-based, so it accrues while she is awake and posting rather than
 * only while she is asleep. Reading the Conversation Schedule here would fix that; it needs the
 * schedule in this pure module, so it waits for the caller that already has it.
 */
export const SLURP_ENERGY_COST = {
  post: 6,
  image: 4,
  commission: 12,
} as const;

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
    // Being far out on a limb is a feeling about last night, so it is mostly gone by morning.
    exposure: toward(state.exposure, 0, 12),
    modifiers: activeSlurpModifiers(state, new Date(now)),
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
