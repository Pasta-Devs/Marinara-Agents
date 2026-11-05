/**
 * The Basic screen of the first run (docs/CONFIGURATOR.md, Onboarding): the owner's decisions, asked
 * on the stage one at a time, each with a recommended answer. Pure, so the order, the skips and the
 * write run in tests.
 *
 * What it writes (`slpBasicStamp`): on a first run every question, answered or recommended; on "Run
 * setup again" only the questions the player answered. It never writes `onboarding`: `completed` is
 * written last, after the first Creators (or the watcher exit), by the caller.
 */
import {
  SLURP_ACTIVITY_PRESETS,
  SLURP_DEFAULT_ACTIVITY_PRESET,
  slurpActivityPresetForSettings,
  slurpActivityPresetPatch,
  type SlurpActivityPreset,
} from "../../modules/creator/slp-activity-presets";
import {
  SLP_SPICE_STEPS,
  slpExplicitOfStep,
  type SlpExplicitLevelName,
  type SlpSpiceLanguage,
  type SlpSpiceLevel,
  type SlpSpiceStep,
} from "../../../../../shared/src/slp/slp-spice.js";
import {
  slurpAudiencePresetFor,
  slurpAudiencePresetPatch,
  type SlurpAudiencePreset,
} from "../../../../../shared/src/slp/slp-tuning.js";
import {
  SLP_EXTENSION_KEYS,
  slpExtensionOn,
  type SlpExtensionId,
} from "../../../../../shared/src/slp/slp-extensions.js";
import type { SlurpSettings, SlurpSettingsUpdate } from "../settings/slp-settings-contract";

/** The crowd offered on the first run; "off" stays on the Basic page. */
export const SLP_BASIC_CROWDS = [
  "quiet",
  "realistic",
  "lively",
  "generous",
] as const satisfies readonly SlurpAudiencePreset[];

/** The extensions offered at the end ("Add extras"); Engine link has no switch yet. Storylines is the pick. */
export const SLP_BASIC_EXTRAS = [
  "storylines",
  "ads",
  "world",
  "stir",
  "supportDesk",
] as const satisfies readonly SlpExtensionId[];
export type SlpBasicExtra = (typeof SLP_BASIC_EXTRAS)[number];

export const SLP_BASIC_OPTIONS = {
  who: ["watch", "run", "both"],
  heat: SLP_SPICE_STEPS,
  pace: SLURP_ACTIVITY_PRESETS,
  pictures: ["yes", "no"],
  crowd: SLP_BASIC_CROWDS,
  names: ["open", "hinted"],
} as const;

/**
 * `connection` and `imageConnection` offer the player's own connections, so they have no fixed list.
 * `extras` picks several: its answer is the picked ids joined with commas ("" is none).
 */
export type SlpBasicQuestion = keyof typeof SLP_BASIC_OPTIONS | "connection" | "imageConnection" | "extras";

/** Stage order. `locked` is a beat, not a question: Mari's locked post, unlocked with a tap. */
export const SLP_BASIC_ORDER = [
  "who",
  "locked",
  "connection",
  "heat",
  "pace",
  "pictures",
  "imageConnection",
  "crowd",
  "names",
  "extras",
] as const;
export type SlpBasicStep = (typeof SLP_BASIC_ORDER)[number];

export type SlpBasicAnswers = Partial<{
  who: "watch" | "run" | "both";
  connection: string;
  heat: SlpSpiceStep;
  pace: SlurpActivityPreset;
  pictures: "yes" | "no";
  imageConnection: string;
  crowd: (typeof SLP_BASIC_CROWDS)[number];
  names: "open" | "hinted";
  extras: string;
}>;

/** The picked extras of an `extras` answer. */
export const slpBasicExtras = (answer: string): SlpBasicExtra[] =>
  SLP_BASIC_EXTRAS.filter((id) => answer.split(",").includes(id));

/** "Later" in the connection question: no text connection now, so the pace is manual. */
export const SLP_BASIC_LATER = "later";

export type SlpBasicConnection = { id: string; name: string; isDefault: boolean };

export type SlpBasicContext = {
  firstRun: boolean;
  settings: SlurpSettings;
  textConnections: readonly SlpBasicConnection[];
  imageConnections: readonly SlpBasicConnection[];
  /** The Slurp-wide heat today (the default level, else the limit). */
  heat: SlpSpiceStep;
};

export type SlpBasicState = {
  answers: SlpBasicAnswers;
  /** The `locked` beat was played (or skipped with the fast lane). */
  unlocked: boolean;
  /** "Add extras" picks before "Done", so a reload keeps them. */
  extrasDraft?: string;
};

const pick = (list: readonly SlpBasicConnection[], fallback: string) =>
  list.find((entry) => entry.isDefault)?.id ?? list[0]?.id ?? fallback;
const has = (list: readonly SlpBasicConnection[], id: string | null | undefined) =>
  Boolean(id) && list.some((entry) => entry.id === id);

/** The answer each question starts on: the recommendation on a first run, today's value on a rerun. */
export function slpBasicDefaults(context: SlpBasicContext): Required<Omit<SlpBasicAnswers, "who">> & {
  who: "both";
} {
  const { settings, firstRun } = context;
  const crowd = slurpAudiencePresetFor(settings);
  const pace = slurpActivityPresetForSettings(settings);
  return {
    who: "both",
    connection: has(context.textConnections, settings.generationConnectionId)
      ? settings.generationConnectionId!
      : pick(context.textConnections, SLP_BASIC_LATER),
    heat: firstRun ? "suggestive" : context.heat,
    pace: firstRun || !pace || pace === "grows" ? SLURP_DEFAULT_ACTIVITY_PRESET : pace,
    pictures: context.imageConnections.length > 0 && (firstRun || settings.autoPostingImagesEnabled) ? "yes" : "no",
    imageConnection: pick(context.imageConnections, ""),
    crowd: firstRun || crowd === "custom" || crowd === "off" ? "realistic" : crowd,
    names: "open",
    // An install that already has switches on keeps them, first run or not.
    extras: (firstRun && !SLP_BASIC_EXTRAS.some((id) => slpExtensionOn(settings, id))
      ? ["storylines"]
      : SLP_BASIC_EXTRAS.filter((id) => slpExtensionOn(settings, id))
    ).join(","),
  };
}

/** The answers in effect: what the player picked, else the default. A saved connection that is gone falls back. */
export function slpBasicAnswers(state: SlpBasicState, context: SlpBasicContext) {
  const defaults = slpBasicDefaults(context);
  const answers = { ...defaults, ...state.answers };
  if (answers.connection !== SLP_BASIC_LATER && !has(context.textConnections, answers.connection))
    answers.connection = defaults.connection;
  if (!has(context.imageConnections, answers.imageConnection)) answers.imageConnection = defaults.imageConnection;
  return answers;
}

/** Whether a step is on the stage at all for this player and these answers. */
export function slpBasicShows(step: SlpBasicStep, state: SlpBasicState, context: SlpBasicContext): boolean {
  const answers = slpBasicAnswers(state, context);
  switch (step) {
    // A rerun is an owner checking settings: no "who are you", no lesson.
    case "who":
    case "locked":
      return context.firstRun;
    // One connection (or none) is not a choice; none is said on the pace step.
    case "connection":
      return context.textConnections.length > 1;
    case "pace":
      return context.textConnections.length > 0 && answers.connection !== SLP_BASIC_LATER;
    case "pictures":
      return context.imageConnections.length > 0;
    case "imageConnection":
      return answers.pictures === "yes" && context.imageConnections.length > 1;
    default:
      return true;
  }
}

/** The next open step, or null when the Basic screen is done. A watcher is done after "who". */
export function slpBasicNext(state: SlpBasicState, context: SlpBasicContext): SlpBasicStep | null {
  if (state.answers.who === "watch") return null;
  return (
    SLP_BASIC_ORDER.find(
      (step) =>
        slpBasicShows(step, state, context) &&
        (step === "locked" ? !state.unlocked : state.answers[step] === undefined),
    ) ?? null
  );
}

/** "Use the recommended setup": every open question takes its default, the beat counts as seen. */
export function slpBasicRecommended(state: SlpBasicState, context: SlpBasicContext): SlpBasicState {
  const { who: _who, ...defaults } = slpBasicDefaults(context);
  return { answers: { ...defaults, who: "both", ...state.answers }, unlocked: true };
}

/**
 * One heat answer sets the whole Slurp-wide heat: the default level, the limit no Creator goes past,
 * and the words posts use. Clean keeps the limit at Flirty (the lowest limit).
 */
export function slpBasicHeat(step: SlpSpiceStep): {
  level: SlpExplicitLevelName;
  max: SlpSpiceLevel;
  language: SlpSpiceLanguage;
} {
  const max: SlpSpiceLevel = step === "clean" ? "flirty" : step;
  const language: SlpSpiceLanguage = step === "explicit" ? "dirty" : step === "suggestive" ? "frank" : "soft";
  return { level: slpExplicitOfStep(step), max, language };
}

export type SlpBasicStamp = {
  settings: SlurpSettingsUpdate;
  /** Null: heat is not written (a rerun that did not touch it). */
  heat: ReturnType<typeof slpBasicHeat> | null;
  /** The Slurp-wide image connection, or null to leave it. */
  imageConnectionId: string | null;
  /** For the Creator step that follows. */
  disclosure: "open" | "hinted";
  lead: "feed" | "creators";
};

/** What leaving the Basic screen writes. See the file comment for which questions count. */
export function slpBasicStamp(state: SlpBasicState, context: SlpBasicContext): SlpBasicStamp {
  const answers = slpBasicAnswers(state, context);
  const asked = (question: keyof SlpBasicAnswers) => context.firstRun || state.answers[question] !== undefined;
  let settings: SlurpSettingsUpdate = {};
  const noText = context.textConnections.length === 0 || answers.connection === SLP_BASIC_LATER;
  if (asked("connection") && !noText) settings.generationConnectionId = answers.connection;
  if (noText) settings = { ...settings, ...slurpActivityPresetPatch("manual") };
  else if (asked("pace")) settings = { ...settings, ...slurpActivityPresetPatch(answers.pace) };
  if (asked("pictures")) {
    settings.autoPostingImagesEnabled = answers.pictures === "yes";
    // First run only: background avatars and banners follow the pictures answer.
    if (context.firstRun) settings.autoCreatorArtworkEnabled = answers.pictures === "yes";
  }
  if (asked("crowd")) settings = { ...settings, ...slurpAudiencePresetPatch(answers.crowd, context.settings) };
  if (asked("extras")) {
    const picked = slpBasicExtras(answers.extras);
    for (const id of SLP_BASIC_EXTRAS) settings[SLP_EXTENSION_KEYS[id]] = picked.includes(id);
  }
  return {
    settings,
    heat: asked("heat") ? slpBasicHeat(answers.heat) : null,
    imageConnectionId:
      answers.pictures === "yes" && answers.imageConnection && asked("imageConnection")
        ? answers.imageConnection
        : null,
    disclosure: answers.names,
    lead: answers.who === "watch" ? "feed" : "creators",
  };
}

/** Saved answers from localStorage, minus any value this version does not offer: it is asked again. */
export function slpBasicCleanState(raw: unknown): SlpBasicState {
  const source = raw && typeof raw === "object" ? (raw as { answers?: unknown; unlocked?: unknown }) : {};
  const answers: Record<string, string> = {};
  if (source.answers && typeof source.answers === "object") {
    for (const [question, value] of Object.entries(source.answers)) {
      if (typeof value !== "string") continue;
      const options = (SLP_BASIC_OPTIONS as Record<string, readonly string[]>)[question];
      const extras = question === "extras" && slpBasicExtras(value).join(",") === value;
      if (options ? options.includes(value) : extras || question === "connection" || question === "imageConnection")
        answers[question] = value;
    }
  }
  const draft = (source as { extrasDraft?: unknown }).extrasDraft;
  return {
    answers: answers as SlpBasicAnswers,
    unlocked: source.unlocked === true,
    ...(typeof draft === "string" && slpBasicExtras(draft).join(",") === draft ? { extrasDraft: draft } : {}),
  };
}
