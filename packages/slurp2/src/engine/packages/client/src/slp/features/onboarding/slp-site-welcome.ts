/**
 * The player's own join as one Slurp Support ticket (docs/ONBOARDING-RAIL.md): hello, the age
 * check, what Slurp is, the locked-post demo, the core questions, the optional fun part, the member
 * file, and the hand-off. One ordered script on a rail; the player answers with taps.
 *
 * Scripted, not generated: the player has not picked an AI connection yet, and a join should
 * cost nothing. Nothing is written before "Stamp it": `slpRailStamp` returns the one patch.
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

/** The progress bar shows these stops, not every chapter or bubble. */
export const SLP_RAIL_STOPS = ["hello", "slurp", "locked", "setup", "done"] as const;
export type SlpRailStop = (typeof SLP_RAIL_STOPS)[number];
const STOP: Record<SlpRailChapter, SlpRailStop> = {
  hello: "hello",
  id: "hello",
  what: "slurp",
  locked: "locked",
  setup: "setup",
  fun: "setup",
  review: "setup",
  done: "done",
};

export type SlpRailEvent = "start" | "ageConfirmed" | "revealed" | "stamped";
export type SlpRailCard = "pastapay" | "sampleCreator" | "lockedDemo" | "memberFile" | "stamp";

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
  rating: ["1", "2", "3", "4", "5"],
} as const;
type Fixed = typeof SLP_RAIL_OPTIONS;
export type SlpRailQuestion = keyof Fixed | "connection" | "imageConnection";

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
/** `tap`: the chip (i18n key) the player taps before the rail goes on. */
export type SlpRailStep =
  | { kind: "say"; id: string; chapter: SlpRailChapter; key: string; tap?: string; when?: When }
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

const say = (chapter: SlpRailChapter, id: string, extra: { tap?: string; when?: When } = {}): SlpRailStep => ({
  kind: "say",
  id,
  chapter,
  key: `ui.slurp.site.say.${id}`,
  ...(extra.tap ? { tap: `ui.slurp.site.tap.${extra.tap}` } : {}),
  ...(extra.when ? { when: extra.when } : {}),
});
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
    say("hello", "hello2"),
    { kind: "wait", id: "start", chapter: "hello", tap: "ui.slurp.site.tap.start" },
    say("id", "id1"),
    { kind: "card", id: "pastapay", chapter: "id" },
    { kind: "wait", id: "ageConfirmed", chapter: "id" },
    say("id", "id2"),
    say("what", "what1"),
    { kind: "card", id: "sampleCreator", chapter: "what", tap: "ui.slurp.site.tap.goOn" },
    say("what", "what2", { tap: "goOn" }),
    say("what", "what3", { tap: "goOn" }),
    say("what", "cost", { tap: "gotIt" }),
    say("locked", "locked1"),
    { kind: "card", id: "lockedDemo", chapter: "locked" },
    { kind: "wait", id: "revealed", chapter: "locked" },
    ask("locked", "coins", SLP_RAIL_OPTIONS.coins, []),
    say("locked", "coinsWhat", { tap: "backToIt", when: (answers) => answers.coins === "what" }),
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
    say("review", "review1"),
    { kind: "card", id: "memberFile", chapter: "review" },
    { kind: "wait", id: "stamped", chapter: "review" },
    { kind: "card", id: "stamp", chapter: "done" },
    ask("done", "rating", SLP_RAIL_OPTIONS.rating, []),
    say("done", "rated5", { when: (answers) => answers.rating === "5" }),
    say("done", "ratedLess", { when: (answers) => answers.rating !== undefined && answers.rating !== "5" }),
    say("done", "leadFeed", { when: (answers) => answers.who === "watch" }),
    say("done", "leadSignup", { when: (answers) => answers.who !== "watch" }),
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
  // The fast lane answers every question after "who" with its default. Lines still play.
  const laneCovers = step.kind === "ask" && (step.chapter === "setup" || step.chapter === "fun") && step.id !== "who";
  if (laneCovers && state.answers.lane === "recommended") return true;
  if (step.kind === "say" || step.kind === "ask")
    return step.when ? !step.when(slpRailAnswers(state, context), context) : false;
  return false;
}

function slpRailPassed(step: SlpRailStep, state: SlpRailState): boolean {
  if (step.kind === "wait") return state.events.includes(step.id);
  if (step.kind === "ask") return state.answers[step.id] !== undefined || (step.id === "who" && !!state.answers.lane);
  return state.seen.includes(step.id);
}

/** The step the rail is on, or null when the ticket is done. */
export function slpRailNext(state: SlpRailState, context: SlpRailContext): SlpRailStep | null {
  return (
    slpRailSteps(context).find((step) => !slpRailSkipped(step, state, context) && !slpRailPassed(step, state)) ?? null
  );
}

/** Everything played so far, in order: what the chat shows above the current step. */
export function slpRailTranscript(state: SlpRailState, context: SlpRailContext): SlpRailStep[] {
  const steps = slpRailSteps(context).filter((step) => !slpRailSkipped(step, state, context));
  const end = steps.findIndex((step) => !slpRailPassed(step, state));
  return end < 0 ? steps : steps.slice(0, end);
}

export function slpRailStop(step: SlpRailStep | null): SlpRailStop {
  return step ? STOP[step.chapter] : "done";
}

/** "Skip to the questions" shows only while the rail is in the explainer chapters. */
export function slpRailCanSkipIntro(state: SlpRailState, context: SlpRailContext): boolean {
  const step = slpRailNext(state, context);
  return !!step && (step.chapter === "what" || step.chapter === "locked") && state.events.includes("ageConfirmed");
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
 * What "Stamp it" writes. Only questions the player answered, plus the connection and the pace
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

// The five-question welcome that `SlpSiteWelcome.tsx` still renders. Phase 2b renders the rail
// above instead and removes these.

export const SLP_SITE_WELCOME_QUESTIONS = ["who", "pace", "pictures", "nights", "names"] as const;
export type SlpSiteWelcomeQuestion = (typeof SLP_SITE_WELCOME_QUESTIONS)[number];

export const SLP_SITE_WELCOME_OPTIONS = {
  who: ["watch", "run", "both"],
  pace: SLURP_ACTIVITY_PRESETS,
  pictures: ["yes", "no"],
  nights: ["yes", "no"],
  names: ["hinted", "open"],
} as const satisfies Record<SlpSiteWelcomeQuestion, readonly string[]>;

export type SlpSiteWelcomeAnswers = Partial<{
  who: "watch" | "run" | "both";
  pace: SlurpActivityPreset;
  pictures: "yes" | "no";
  nights: "yes" | "no";
  names: "hinted" | "open";
}>;

/** The first question still open, or null when the form is done. */
export function slpSiteWelcomeNext(answers: SlpSiteWelcomeAnswers): SlpSiteWelcomeQuestion | null {
  return SLP_SITE_WELCOME_QUESTIONS.find((question) => answers[question] === undefined) ?? null;
}

/** Where the join leads: a watcher goes to the feed first, everyone else signs someone up. */
export function slpSiteWelcomeLead(answers: SlpSiteWelcomeAnswers): "feed" | "signup" {
  return answers.who === "watch" ? "feed" : "signup";
}

/** The wizard settings one answer changes. "who" only decides where the join leads. */
export function slpSiteWelcomeSetting(
  question: SlpSiteWelcomeQuestion,
  value: string,
):
  | { kind: "pace"; value: SlurpActivityPreset }
  | { kind: "pictures" | "nights"; value: boolean }
  | { kind: "names"; value: "hinted" | "open" }
  | null {
  if (question === "pace") return { kind: "pace", value: value as SlurpActivityPreset };
  if (question === "pictures" || question === "nights") return { kind: question, value: value === "yes" };
  if (question === "names") return { kind: "names", value: value === "open" ? "open" : "hinted" };
  return null;
}
