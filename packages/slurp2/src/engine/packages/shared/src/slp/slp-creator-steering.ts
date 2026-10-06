/**
 * What the player steers about one Creator: what is going on in their life right now, and one-off
 * ideas for the next posts. Steering decides WHAT happens; the Creator's own card and past posts
 * decide HOW they do it (see the server's `slp-creator-flavour.ts`).
 *
 * Every field is plain words the player typed or picked. Nothing here is a number the model sees.
 */
import { SLP_SPICE_CHIP_MAX, SLP_SPICE_CHIPS_MAX, slpSpiceList } from "./slp-spice.js";

export const SLP_STEERING_MOODS = ["bright", "cozy", "restless", "low", "flirty", "stressed"] as const;
export type SlpSteeringMood = (typeof SLP_STEERING_MOODS)[number];

/** How often this Creator posts next to everybody else. `break` posts nothing on its own. */
export const SLP_STEERING_PACES = ["break", "quiet", "usual", "busy", "very_busy"] as const;
export type SlpSteeringPace = (typeof SLP_STEERING_PACES)[number];

/** Share of the usual posting rate per pace. */
export const SLP_STEERING_PACE_FACTOR: Record<SlpSteeringPace, number> = {
  break: 0,
  quiet: 0.5,
  usual: 1,
  busy: 1.6,
  very_busy: 2.4,
};

/**
 * How they do relationships (polyamory, 0.3.5). Null: read from their card (poly words there make them
 * polyamorous, else monogamous). Only matters while polyamory is on in Settings › Stir.
 */
export const SLP_RELATIONSHIP_STYLES = ["mono", "poly"] as const;
export type SlpRelationshipStyle = (typeof SLP_RELATIONSHIP_STYLES)[number];
/** Card words that make a Creator polyamorous when the player has not picked a style. */
export const SLP_POLY_CARD_WORDS =
  /\b(polyamor\w*|poly|open relationships?|non-?monogam\w*|ethically non-?monogam\w*)\b/iu;

export const SLP_STEERING_TEXT_MAX = 160;
export const SLP_STEERING_TOPIC_MAX = 40;
export const SLP_STEERING_TOPICS_MAX = 6;
export const SLP_STEERING_NUDGE_MAX = 160;
export const SLP_STEERING_NUDGES_MAX = 6;

export const SLP_ROMANCE_ONLY_MAX = 100;
export type SlpCreatorRomance = { off: boolean; only: string[] };

/** Whether both Creators' romance settings allow the two of them together (0.3.17). */
export function slpRomanceAllows(
  a: { id: string; romance?: SlpCreatorRomance },
  b: { id: string; romance?: SlpCreatorRomance },
): boolean {
  const allows = (self: typeof a, other: typeof b) =>
    !self.romance?.off && (!self.romance?.only.length || self.romance.only.includes(other.id));
  return allows(a, b) && allows(b, a);
}

/** The same, for two Creators Slurp runs; a player's page, or nobody cast yet, is never held to it. */
export const slpRomancePairAllowed = (
  a: { id: string; automatic: boolean; romance?: SlpCreatorRomance } | undefined,
  b: { id: string; automatic: boolean; romance?: SlpCreatorRomance } | undefined,
) => !a || !b || !a.automatic || !b.automatic || slpRomanceAllows(a, b);

/** A one-off idea for one upcoming post ("gym post tonight"). Used once, then gone. */
export type SlpCreatorNudge = { id: string; text: string; story: boolean; createdAt: string };

export type SlpCreatorSteering = {
  /** What they are into or working on these days ("training for a competition"). */
  focus: string;
  /** Where their life is ("just moved to Berlin", "exam season"). */
  lifePhase: string;
  mood: SlpSteeringMood | null;
  /** Monogamous, polyamorous, or null = from their card (0.3.5). */
  relationshipStyle: SlpRelationshipStyle | null;
  /**
   * Romance with other Creators (0.3.17): `off` = never; `only` = just these Creators (empty = anyone
   * who fits). The world, storylines and drama keep to it; the player's own Stir set-up may override.
   */
  romance: SlpCreatorRomance;
  /** Topics that come up more. */
  push: string[];
  /** Topics they leave alone for now. */
  avoid: string[];
  pace: SlpSteeringPace;
  nudges: SlpCreatorNudge[];
  /** What turns them on and what they like showing (spice). */
  turnOns: string[];
  /** What they never do, on the page or in chats. Always wins over the player's taste. */
  hardNoes: string[];
  /** The sign-up chat's likes and noes were moved here out of the strategy text. */
  limitsMoved: boolean;
  /** What the last talk with Slurp Support changed, so Creator tools can show it and undo it. */
  support: SlpSteeringSupportNote | null;
};

/** One talk with Slurp Support: what it changed and what the fields said before, for Undo. */
export type SlpSteeringSupportNote = {
  at: string;
  mood: SlpSteeringMood | null;
  focus: string;
  more: string;
  less: string;
  idea: string;
  /** The queued idea Support added, removed again on Undo when it is still waiting. */
  ideaId: string | null;
  /** The memory Support left (its continuity source hash), retired on Undo. */
  memory: string | null;
  before: Pick<SlpCreatorSteering, "mood" | "focus" | "push" | "avoid">;
};

export const SLP_DEFAULT_STEERING: SlpCreatorSteering = {
  focus: "",
  lifePhase: "",
  mood: null,
  relationshipStyle: null,
  romance: { off: false, only: [] },
  push: [],
  avoid: [],
  pace: "usual",
  nudges: [],
  support: null,
  turnOns: [],
  hardNoes: [],
  limitsMoved: false,
};

const text = (value: unknown, max: number) =>
  typeof value === "string" ? value.replace(/\s+/gu, " ").trim().slice(0, max).trim() : "";

function topics(value: unknown): string[] {
  const seen = new Set<string>();
  return (Array.isArray(value) ? value : [])
    .map((entry) => text(entry, SLP_STEERING_TOPIC_MAX))
    .filter((entry) => entry && !seen.has(entry.toLocaleLowerCase()) && seen.add(entry.toLocaleLowerCase()))
    .slice(0, SLP_STEERING_TOPICS_MAX);
}

const mood = (value: unknown): SlpSteeringMood | null =>
  SLP_STEERING_MOODS.includes(value as SlpSteeringMood) ? (value as SlpSteeringMood) : null;

function supportNote(raw: unknown): SlpSteeringSupportNote | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const value = raw as Record<string, unknown>;
  const before = value.before && typeof value.before === "object" ? (value.before as Record<string, unknown>) : {};
  const at = text(value.at, 40);
  if (!at) return null;
  return {
    at,
    mood: mood(value.mood),
    focus: text(value.focus, SLP_STEERING_TEXT_MAX),
    more: text(value.more, SLP_STEERING_TOPIC_MAX),
    less: text(value.less, SLP_STEERING_TOPIC_MAX),
    idea: text(value.idea, SLP_STEERING_NUDGE_MAX),
    ideaId: text(value.ideaId, 64) || null,
    memory: text(value.memory, 200) || null,
    before: {
      mood: mood(before.mood),
      focus: text(before.focus, SLP_STEERING_TEXT_MAX),
      push: topics(before.push),
      avoid: topics(before.avoid),
    },
  };
}

function romance(raw: unknown): SlpCreatorRomance {
  const value = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const only = Array.isArray(value.only) ? value.only.map((id) => text(id, 128)).filter(Boolean) : [];
  return { off: value.off === true, only: [...new Set(only)].slice(0, SLP_ROMANCE_ONLY_MAX) };
}

export function normalizeSlpCreatorSteering(raw: unknown): SlpCreatorSteering {
  const value = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  return {
    focus: text(value.focus, SLP_STEERING_TEXT_MAX),
    lifePhase: text(value.lifePhase, SLP_STEERING_TEXT_MAX),
    mood: mood(value.mood),
    relationshipStyle: SLP_RELATIONSHIP_STYLES.includes(value.relationshipStyle as SlpRelationshipStyle)
      ? (value.relationshipStyle as SlpRelationshipStyle)
      : null,
    romance: romance(value.romance),
    push: topics(value.push),
    avoid: topics(value.avoid),
    pace: SLP_STEERING_PACES.includes(value.pace as SlpSteeringPace) ? (value.pace as SlpSteeringPace) : "usual",
    nudges: (Array.isArray(value.nudges) ? value.nudges : [])
      .map((entry) => (entry && typeof entry === "object" ? (entry as Record<string, unknown>) : {}))
      .map((entry) => ({
        id: text(entry.id, 64),
        text: text(entry.text, SLP_STEERING_NUDGE_MAX),
        story: entry.story === true,
        createdAt: text(entry.createdAt, 40),
      }))
      .filter((entry) => entry.id && entry.text)
      .slice(0, SLP_STEERING_NUDGES_MAX),
    support: supportNote(value.support),
    turnOns: slpSpiceList(value.turnOns, SLP_SPICE_CHIP_MAX, SLP_SPICE_CHIPS_MAX),
    hardNoes: slpSpiceList(value.hardNoes, SLP_SPICE_CHIP_MAX, SLP_SPICE_CHIPS_MAX),
    limitsMoved: value.limitsMoved === true,
  };
}
