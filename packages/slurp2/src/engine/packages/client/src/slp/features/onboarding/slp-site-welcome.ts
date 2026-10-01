/**
 * Opening day (docs/OPENING-DAY.md): the owner's first run as one script on a rail. Support (the
 * owner's staff) greets them, takes the platform license (18+), shows their empty Slurp, moves Mari
 * in, asks how the place should run, and opens the doors. The player answers with taps.
 *
 * Scripted, not generated: the player has not picked an AI connection yet, and opening costs
 * nothing. Nothing is written before "Open the doors": `slpRailStamp` returns the one patch.
 * Pure, so the order, the branching and the mapping run in tests.
 */
import {
  SLURP_ACTIVITY_PRESETS,
  SLURP_DEFAULT_ACTIVITY_PRESET,
  slurpActivityPresetForSettings,
  slurpActivityPresetPatch,
  type SlurpActivityPreset,
} from "../../modules/creator/slp-activity-presets";
import { SLP_SPICE_LEVELS, type SlpSpiceLevel } from "../../../../../shared/src/slp/slp-spice.js";
import { SLURP_AUDIENCE_TONES } from "../../../../../shared/src/slp/slp-tone.js";
import { SLURP_PLATFORM_SCALE } from "../../../../../shared/src/slp/slp-scale.js";
import type { SlurpSettings, SlurpSettingsUpdate } from "../settings/slp-settings-contract";

export const SLP_RAIL_CHAPTERS = ["hello", "id", "what", "locked", "setup", "fun", "review", "done"] as const;
export type SlpRailChapter = (typeof SLP_RAIL_CHAPTERS)[number];

/** The header shows these stops (one per scene), not every chapter or line. */
export const SLP_RAIL_STOPS = ["opening", "license", "slurp", "setup", "doors"] as const;
export type SlpRailStop = (typeof SLP_RAIL_STOPS)[number];
const STOP: Record<SlpRailChapter, SlpRailStop> = {
  hello: "opening",
  id: "license",
  what: "slurp",
  locked: "slurp",
  setup: "setup",
  fun: "setup",
  review: "doors",
  done: "doors",
};

/** `opened` is "Open the doors" (or "Save changes" on a rerun): the one write. */
export type SlpRailEvent = "start" | "ageConfirmed" | "revealed" | "opened";
/** Stage beats: the license card, the owner's phone, Mari moving in, the doors closing. */
export type SlpRailCard = "pastapay" | "phone" | "moveIn" | "doors";

/** Questions with fixed options. `connection` and `imageConnection` offer the player's own. */
export const SLP_RAIL_OPTIONS = {
  coins: ["gotIt", "what"],
  who: ["watch", "run", "both"],
  pace: SLURP_ACTIVITY_PRESETS,
  pictures: ["yes", "no"],
  spice: SLP_SPICE_LEVELS,
  names: ["hinted", "open"],
  nights: ["yes", "no"],
  fun: ["sure", "skip"],
  fans: SLURP_AUDIENCE_TONES,
  size: SLURP_PLATFORM_SCALE,
  drama: ["none", "sometimes", "bringIt"],
  ads: ["none", "few", "lots"],
  adTone: ["normal", "unhinged"],
  pullStrings: ["fair", "platform"],
} as const;
type Fixed = typeof SLP_RAIL_OPTIONS;
export type SlpRailQuestion = keyof Fixed | "connection" | "imageConnection";

/** Saved answers from localStorage, minus any value this version does not offer (a renamed option,
 *  a hand-edited key): a dropped answer is simply asked again. */
export function slpRailCleanAnswers(answers: unknown): SlpRailAnswers {
  if (!answers || typeof answers !== "object") return {};
  const clean: Record<string, string> = {};
  for (const [question, value] of Object.entries(answers)) {
    if (typeof value !== "string") continue;
    const options = (SLP_RAIL_OPTIONS as Record<string, readonly string[]>)[question];
    if (options ? options.includes(value) : question === "connection" || question === "imageConnection")
      clean[question] = value;
  }
  return clean as SlpRailAnswers;
}

export type SlpRailAnswers = Partial<
  { [K in keyof Fixed]: Fixed[K][number] } & {
    connection: string;
    imageConnection: string;
    /** "Use your recommended setup": every setup and fun question takes its default. */
    lane: "recommended";
  }
>;

export type SlpRailConnection = { id: string; name: string; isDefault?: boolean };

export type SlpRailSettings = Pick<
  SlurpSettings,
  | "generationConnectionId"
  | "autoPostingScheduleEnabled"
  | "postsPerDay"
  | "postsPerDayCustom"
  | "autoPostingImagesEnabled"
  | "nightQuiet"
  | "audienceTone"
  | "platformScale"
  | "drama"
  | "storyAutomation"
  | "arcAutoMode"
  | "arcCrossovers"
  | "inlineAdsEnabled"
  | "inlineAdsFrequency"
  | "inlineAdsTone"
  | "supportDesk"
>;

export type SlpRailContext = {
  /** "again" is Backstage's "Run setup again": it opens at the questions, after the age check. */
  opening: "first" | "again";
  textConnections: readonly SlpRailConnection[];
  imageConnections: readonly SlpRailConnection[];
  runsCreators: boolean;
  /** Today's values: the defaults every question starts from. */
  settings: SlpRailSettings;
  spice: SlpSpiceLevel;
};

export type SlpRailState = {
  answers: SlpRailAnswers;
  events: readonly SlpRailEvent[];
  /** `say` and `card` steps already played, by id. */
  seen: readonly string[];
  /** "Skip to the questions": the explainer chapters count as done. Ignored before the age check. */
  skipIntro?: boolean;
};

type When = (answers: SlpRailAnswers, context: SlpRailContext) => boolean;
/**
 * `tap`: the card (i18n key) the player taps before the rail goes on. `skipIf` / `onlyIf`: a line
 * that depends on an event that can come early (Mari's Unlock works before Support asks for it).
 */
export type SlpRailStep =
  | {
      kind: "say";
      id: string;
      chapter: SlpRailChapter;
      key: string;
      tap?: string;
      when?: When;
      small?: boolean;
      skipIf?: SlpRailEvent;
      onlyIf?: { event: SlpRailEvent; unseen: string };
    }
  | { kind: "card"; id: SlpRailCard; chapter: SlpRailChapter; tap?: string }
  | { kind: "wait"; id: SlpRailEvent; chapter: SlpRailChapter; tap?: string }
  | {
      kind: "ask";
      id: SlpRailQuestion;
      chapter: SlpRailChapter;
      options: readonly string[];
      /** The settings (or sign-up fields) an answer changes. Empty: it only steers the rail. */
      writes: readonly string[];
      when?: When;
      shortcut?: "recommended";
    };

type SayExtra = Partial<Pick<Extract<SlpRailStep, { kind: "say" }>, "when" | "small" | "skipIf" | "onlyIf">> & {
  tap?: string;
};
const say = (chapter: SlpRailChapter, id: string, extra: SayExtra = {}): SlpRailStep => {
  const { tap, ...rest } = extra;
  return {
    kind: "say",
    id,
    chapter,
    key: `ui.slurp.opening.say.${id}`,
    ...(tap ? { tap: `ui.slurp.opening.tap.${tap}` } : {}),
    ...rest,
  };
};
const ask = (
  chapter: SlpRailChapter,
  id: SlpRailQuestion,
  options: readonly string[],
  writes: readonly string[],
  when?: When,
): Extract<SlpRailStep, { kind: "ask" }> => ({ kind: "ask", id, chapter, options, writes, ...(when ? { when } : {}) });

const hasText: When = (_answers, context) => context.textConnections.length > 0;
const fun: When = (answers) => answers.fun === "sure";
const runs = (who: SlpRailAnswers["who"]) => who === "run" || who === "both";

/** The whole script, in order. Connection questions offer the context's connections. */
export function slpRailSteps(context: SlpRailContext): SlpRailStep[] {
  return [
    say("hello", "hello1"),
    say("hello", "hello2", { small: true }),
    { kind: "wait", id: "start", chapter: "hello", tap: "ui.slurp.opening.tap.start" },
    say("id", "id1"),
    { kind: "card", id: "pastapay", chapter: "id" },
    { kind: "wait", id: "ageConfirmed", chapter: "id" },
    say("id", "id2", { small: true }),
    { kind: "card", id: "phone", chapter: "what" },
    say("what", "what0", { tap: "goOn" }),
    say("what", "what1"),
    { kind: "card", id: "moveIn", chapter: "what", tap: "ui.slurp.opening.tap.goOn" },
    say("what", "what2", { tap: "andMe" }),
    say("what", "what3"),
    say("what", "cost", { small: true, tap: "gotIt" }),
    say("locked", "locked1", { skipIf: "revealed" }),
    say("locked", "lockedEarly", { onlyIf: { event: "revealed", unseen: "locked1" } }),
    { kind: "wait", id: "revealed", chapter: "locked" },
    ask("locked", "coins", SLP_RAIL_OPTIONS.coins, []),
    say("locked", "coinsWhat", { small: true, tap: "backToIt", when: (answers) => answers.coins === "what" }),
    say("setup", "setup1"),
    { ...ask("setup", "who", SLP_RAIL_OPTIONS.who, []), shortcut: "recommended" },
    ask(
      "setup",
      "connection",
      context.textConnections.map((connection) => connection.id),
      ["generationConnectionId"],
      hasText,
    ),
    say("setup", "noConnection", { when: (answers, ctx) => !hasText(answers, ctx) }),
    ask(
      "setup",
      "pace",
      SLP_RAIL_OPTIONS.pace,
      ["autoPostingScheduleEnabled", "postsPerDay", "postsPerDayCustom"],
      hasText,
    ),
    ask("setup", "pictures", SLP_RAIL_OPTIONS.pictures, ["autoPostingImagesEnabled"]),
    ask(
      "setup",
      "imageConnection",
      context.imageConnections.map((connection) => connection.id),
      ["signUp.imageConnectionId"],
      (answers, ctx) => answers.pictures === "yes" && ctx.imageConnections.length > 0,
    ),
    ask("setup", "spice", SLP_RAIL_OPTIONS.spice, ["spice.max", "spice.guidance"]),
    ask("setup", "names", SLP_RAIL_OPTIONS.names, ["signUp.disclosure"]),
    ask("setup", "nights", SLP_RAIL_OPTIONS.nights, ["nightQuiet"]),
    ask("fun", "fun", SLP_RAIL_OPTIONS.fun, []),
    ask("fun", "fans", SLP_RAIL_OPTIONS.fans, ["audienceTone"], fun),
    ask("fun", "size", SLP_RAIL_OPTIONS.size, ["platformScale"], fun),
    ask("fun", "drama", SLP_RAIL_OPTIONS.drama, ["drama", "storyAutomation", "arcAutoMode", "arcCrossovers"], fun),
    ask("fun", "ads", SLP_RAIL_OPTIONS.ads, ["inlineAdsEnabled", "inlineAdsFrequency"], fun),
    ask("fun", "adTone", SLP_RAIL_OPTIONS.adTone, ["inlineAdsTone"], (a) => fun(a, context) && a.ads !== "none"),
    ask("fun", "pullStrings", SLP_RAIL_OPTIONS.pullStrings, ["supportDesk"], (a) => fun(a, context) && runs(a.who)),
    say("review", context.opening === "again" ? "againReady" : "ready"),
    say("review", "later", { small: true }),
    { kind: "card", id: "doors", chapter: "review" },
    { kind: "wait", id: "opened", chapter: "review" },
    say("done", context.opening === "again" ? "saved" : "leadFeed", { when: (answers) => answers.who === "watch" }),
    say("done", context.opening === "again" ? "saved" : "leadSignup", { when: (answers) => answers.who !== "watch" }),
  ];
}

const BEFORE_SETUP = new Set<SlpRailChapter>(["hello", "id", "what", "locked"]);

/** A step the rail passes without playing: its `when` is false, or a lane or skip covers it. */
function slpRailSkipped(step: SlpRailStep, state: SlpRailState, context: SlpRailContext): boolean {
  if (context.opening === "again" && BEFORE_SETUP.has(step.chapter)) return true;
  // The age check sits before the explainer, so a skip can never reach past it.
  if (
    state.skipIntro &&
    state.events.includes("ageConfirmed") &&
    (step.chapter === "what" || step.chapter === "locked")
  ) {
    return true;
  }
  // The fast lane answers the core questions after "who" and the fun-part offer with defaults. Lines
  // still play, and a fun part switched on later through Change asks its questions.
  const laneCovers = step.kind === "ask" && ((step.chapter === "setup" && step.id !== "who") || step.id === "fun");
  if (laneCovers && state.answers.lane === "recommended") return true;
  if (step.kind === "say" && !state.seen.includes(step.id)) {
    if (step.skipIf && state.events.includes(step.skipIf)) return true;
    if (step.onlyIf && (!state.events.includes(step.onlyIf.event) || state.seen.includes(step.onlyIf.unseen)))
      return true;
  }
  if (step.kind === "say" || step.kind === "ask")
    return step.when ? !step.when(slpRailAnswers(state, context), context) : false;
  return false;
}

function slpRailPassed(step: SlpRailStep, state: SlpRailState): boolean {
  if (step.kind === "wait") return state.events.includes(step.id);
  if (step.kind === "ask") return state.answers[step.id] !== undefined || (step.id === "who" && !!state.answers.lane);
  return state.seen.includes(step.id);
}

/** The step the rail is on, or null when opening day is over. */
export function slpRailNext(state: SlpRailState, context: SlpRailContext): SlpRailStep | null {
  return (
    slpRailSteps(context).find((step) => !slpRailSkipped(step, state, context) && !slpRailPassed(step, state)) ?? null
  );
}

/** Plays every line and card that waits for nothing, up to the next step that needs the player. */
export function slpRailSettle(state: SlpRailState, context: SlpRailContext): SlpRailState {
  const seen = [...state.seen];
  for (;;) {
    const step = slpRailNext({ ...state, seen }, context);
    if (!step || (step.kind !== "say" && step.kind !== "card") || step.tap) break;
    seen.push(step.id);
  }
  return seen.length === state.seen.length ? state : { ...state, seen };
}

/** Everything played so far, in order: what the chat shows above the current step. */
export function slpRailTranscript(state: SlpRailState, context: SlpRailContext): SlpRailStep[] {
  const steps = slpRailSteps(context).filter((step) => !slpRailSkipped(step, state, context));
  const end = steps.findIndex((step) => !slpRailPassed(step, state));
  return end < 0 ? steps : steps.slice(0, end);
}

export function slpRailStop(step: SlpRailStep | null): SlpRailStop {
  return step ? STOP[step.chapter] : "doors";
}

/** "Skip to the questions" shows only while the rail is in the explainer chapters. */
export function slpRailCanSkipIntro(state: SlpRailState, context: SlpRailContext): boolean {
  const step = slpRailNext(state, context);
  return !!step && (step.chapter === "what" || step.chapter === "locked") && state.events.includes("ageConfirmed");
}

const FILE_CORE: readonly SlpRailQuestion[] = [
  "who",
  "connection",
  "pace",
  "pictures",
  "imageConnection",
  "spice",
  "names",
  "nights",
];
const FILE_FUN: readonly SlpRailQuestion[] = ["fans", "size", "drama", "ads", "adTone", "pullStrings"];

/**
 * The rows of the member file (and of "Your Slurp"): every core question that applies, then the fun
 * part's questions when it is on, else one "fun part" row. Connection and pace always show, so a
 * player without a text connection sees why nothing will run.
 */
export function slpRailFileRows(state: SlpRailState, context: SlpRailContext): SlpRailQuestion[] {
  const answers = slpRailAnswers(state, context);
  const asks = new Map(
    slpRailSteps(context).flatMap((step) => (step.kind === "ask" ? [[step.id, step] as const] : [])),
  );
  const applies = (id: SlpRailQuestion) => {
    const step = asks.get(id);
    return !step?.when || step.when(answers, context);
  };
  const core = FILE_CORE.filter((id) => id === "connection" || id === "pace" || applies(id));
  return answers.fun === "sure" ? [...core, ...FILE_FUN.filter(applies)] : [...core, "fun"];
}

const pick = (connections: readonly SlpRailConnection[], current: string | null) =>
  (
    connections.find((connection) => connection.id === current) ??
    connections.find((connection) => connection.isDefault) ??
    connections[0]
  )?.id;

/** Every answer as today's settings say it, so "Run setup again" opens filled in. */
export function slpRailDefaults(context: SlpRailContext): SlpRailAnswers {
  const { settings } = context;
  const pace: SlurpActivityPreset | undefined = !context.textConnections.length
    ? "manual"
    : context.opening === "first"
      ? SLURP_DEFAULT_ACTIVITY_PRESET
      : // A hand-typed number matches no preset: left unset, so the stamp keeps it.
        (slurpActivityPresetForSettings(settings) ?? undefined);
  return {
    who: context.opening === "again" && !context.runsCreators ? "watch" : "both",
    connection: pick(context.textConnections, settings.generationConnectionId),
    pace,
    pictures: settings.autoPostingImagesEnabled ? "yes" : "no",
    imageConnection: pick(context.imageConnections, null),
    spice: context.spice,
    names: "open",
    nights: settings.nightQuiet ? "yes" : "no",
    fans: settings.audienceTone,
    size: settings.platformScale,
    drama: settings.drama.level === "calm" ? "none" : settings.drama.level === "soap" ? "bringIt" : "sometimes",
    ads: !settings.inlineAdsEnabled ? "none" : settings.inlineAdsFrequency === "frequent" ? "lots" : "few",
    adTone: settings.inlineAdsTone === "unhinged" ? "unhinged" : "normal",
    pullStrings: settings.supportDesk.shadyMoves ? "platform" : "fair",
  };
}

/** The defaults with the player's answers on top. No text connection: nothing runs on its own. */
export function slpRailAnswers(state: SlpRailState, context: SlpRailContext): SlpRailAnswers {
  const answers = { ...slpRailDefaults(context), ...stripUndefined(state.answers) };
  return context.textConnections.length ? answers : { ...answers, pace: "manual" };
}

const stripUndefined = (answers: SlpRailAnswers) =>
  Object.fromEntries(Object.entries(answers).filter(([, value]) => value !== undefined)) as SlpRailAnswers;

const DRAMA = {
  none: { level: "calm", storyAutomation: "manual", arcAutoMode: "off", arcCrossovers: false },
  sometimes: { level: "lively", storyAutomation: "suggest", arcAutoMode: "suggest", arcCrossovers: true },
  bringIt: { level: "soap", storyAutomation: "auto", arcAutoMode: "auto", arcCrossovers: true },
} as const;

/** The settings one answer changes. Sign-up fields and the spice go through `slpRailStamp`. */
export function slpRailAnswerPatch(
  question: SlpRailQuestion,
  value: string,
  context: SlpRailContext,
): SlurpSettingsUpdate {
  switch (question) {
    case "connection":
      return { generationConnectionId: value || null };
    case "pace":
      return slurpActivityPresetPatch(value as SlurpActivityPreset);
    case "pictures":
      return { autoPostingImagesEnabled: value === "yes" };
    case "nights":
      return { nightQuiet: value === "yes" };
    case "fans":
      return { audienceTone: value as SlurpSettings["audienceTone"] };
    case "size":
      return { platformScale: value as SlurpSettings["platformScale"] };
    case "drama": {
      const { level, ...story } = DRAMA[value as keyof typeof DRAMA];
      return { drama: { ...context.settings.drama, level }, ...story };
    }
    case "ads":
      return value === "none"
        ? { inlineAdsEnabled: false }
        : { inlineAdsEnabled: true, inlineAdsFrequency: value === "lots" ? "frequent" : "standard" };
    case "adTone":
      return { inlineAdsTone: value === "unhinged" ? "unhinged" : "corporate" };
    case "pullStrings":
      return {
        supportDesk: {
          ...context.settings.supportDesk,
          shadyMoves: value === "platform",
          refusals: value === "platform",
        },
      };
    default:
      return {};
  }
}

export const SLP_RAIL_GUIDANCE: Record<SlpSpiceLevel, "mild" | "steamy" | "explicit"> = {
  flirty: "mild",
  suggestive: "steamy",
  explicit: "explicit",
};

export type SlpRailStamp = {
  settings: SlurpSettingsUpdate;
  /** Null: spice was not asked. Otherwise write `max` and `SLURP_GUIDANCE_PRESETS[guidance]`. */
  spice: { max: SlpSpiceLevel; guidance: "mild" | "steamy" | "explicit" } | null;
  /** For the sign-up that follows, as the Creator wizard takes them. */
  signUp: { disclosure: "hinted" | "open"; imageConnectionId: string | null };
  lead: "feed" | "signup";
};

/**
 * What "Open the doors" (or "Save changes") writes. Only questions the player answered, plus the connection and the pace
 * (a first run's recommendation), and only while their `when` holds, so a skipped fun part or a
 * changed "who" leaves those settings alone.
 */
export function slpRailStamp(state: SlpRailState, context: SlpRailContext): SlpRailStamp {
  const answers = slpRailAnswers(state, context);
  let settings: SlurpSettingsUpdate = {};
  for (const step of slpRailSteps(context)) {
    if (step.kind !== "ask" || (step.when && !step.when(answers, context))) continue;
    const value = answers[step.id];
    const asked = state.answers[step.id] !== undefined || step.id === "connection" || step.id === "pace";
    if (value !== undefined && asked) settings = { ...settings, ...slpRailAnswerPatch(step.id, value, context) };
  }
  if (!context.textConnections.length) settings = { ...settings, ...slurpActivityPresetPatch("manual") };
  const spice = state.answers.spice;
  return {
    settings,
    spice: spice ? { max: spice, guidance: SLP_RAIL_GUIDANCE[spice] } : null,
    signUp: {
      disclosure: answers.names ?? "open",
      imageConnectionId: answers.pictures === "yes" ? (answers.imageConnection ?? null) : null,
    },
    lead: answers.who === "watch" ? "feed" : "signup",
  };
}
