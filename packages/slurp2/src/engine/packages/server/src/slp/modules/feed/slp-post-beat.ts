/**
 * What happens in an ordinary post: a beat, chosen before the post is written.
 *
 * Pure and deterministic, like the other Slurp rule modules. See `docs/WORLD-SIMULATION.md`.
 *
 * ## The problem
 *
 * The planner decided why a post is made and how it goes out, never what happened. The model
 * filled the gap with the same few subjects (laundry, moving, coffee, mirror selfies), every
 * Creator converged on them, and Creators stopped using their own canon. A probe showed that a
 * concrete beat grounded in the card gives far more specific posts, and that a single complication
 * deck makes a new shared formula ("small flaw, keep it or fix it").
 *
 * ## The approach
 *
 * A beat type from a taxonomy (a mishap is one type among twelve), weighted by the Creator's own
 * palette and by what this Creator and the whole feed used lately, is combined with one canon
 * anchor from the card and one written situation template. The intent is derived from the beat,
 * so a post labelled `set` no longer opens as a coffee update.
 */

import type { SlurpContentIntent } from "../../../../../shared/src/slp/slp-content-axes.js";
import { slurpWeightedPick } from "./slp-weighted.js";
import type { SlurpSharedIdea } from "./slp-shared-preseed.js";

/** Shared ideas weigh more than a deck line of the same kind, so level 1 is actually used. */
const SHARED_IDEA_BOOST = 1.5;

export const SLURP_BEAT_TYPES = [
  "achievement",
  "showcase",
  "social_moment",
  "relationship_moment",
  "tease_flirt",
  "opinion",
  "anticipation",
  "sensory_mood",
  "audience_game",
  "routine_twist",
  "mishap",
  "callback",
] as const;
export type SlurpBeatType = (typeof SLURP_BEAT_TYPES)[number];

export const SLURP_ANCHOR_KINDS = ["people", "places", "work", "objects", "habits", "runningJokes"] as const;
export type SlurpAnchorKind = (typeof SLURP_ANCHOR_KINDS)[number];

/** The fixed layer: what the card says this person's life is made of. One cached extraction. */
export type SlurpCanonAnchors = {
  people: { name: string; relation: string }[];
  places: string[];
  work: string[];
  objects: string[];
  habits: string[];
  runningJokes: string[];
  /** Weight 0-5 per beat type. A missing type keeps a small base weight, so variety survives. */
  palette: Partial<Record<SlurpBeatType, number>>;
  /** 0 wholesome, 1 flirty, 2 suggestive, 3 explicit, as the card supports. */
  heat: { min: number; max: number };
  /** A typical day from the card, for Creators without a Conversation Schedule. Absent on old caches. */
  routine?: { time: string; activity: string }[];
};

/** One chosen beat. Stored on the content opportunity, so a retry repeats it. */
export type SlurpBeat = {
  type: SlurpBeatType;
  /** `arc`: the beat is the Creator's active arc chapter, not a card anchor. */
  anchorKind: SlurpAnchorKind | "arc";
  anchor: string;
  line: string;
  /** Named people in the beat. Empty means alone. */
  cast: string[];
  place: string | null;
  /** The shared idea this beat came from, for the per-day cap. Absent for a deck beat. */
  sharedId?: string;
};

type SlurpBeatDeck = {
  /** Intents this beat can serve. `request` and `callback` stay intent-first: they need a source. */
  intents: readonly SlurpContentIntent[];
  /** Situation templates, written, never generated. `{a}` is the anchor. */
  lines: readonly (readonly [SlurpAnchorKind, string])[];
};

// Every non-teaser deck includes `casual`, so an ordinary slot always has a compatible intent.
const DECKS: Record<SlurpBeatType, SlurpBeatDeck> = {
  achievement: {
    intents: ["set", "behind_the_scenes", "casual", "teaser"],
    lines: [
      ["work", "You finally get {a} right after several tries."],
      ["work", "You finish a piece of {a} you are proud of."],
      ["objects", "You finish making or fixing {a}, and it came out well."],
      ["habits", "You keep up {a} longer than ever before."],
    ],
  },
  showcase: {
    intents: ["set", "casual", "teaser"],
    lines: [
      ["work", "You show off one detail of {a} that most people never notice."],
      ["objects", "You show {a} up close and say why it matters to you."],
      ["places", "You show a corner of {a} the way you like it best."],
    ],
  },
  social_moment: {
    intents: ["casual", "appreciation"],
    lines: [
      ["people", "You and {a} share a small, funny moment in the middle of an ordinary task."],
      ["people", "{a} says something that makes you laugh out loud."],
    ],
  },
  relationship_moment: {
    intents: ["casual"],
    lines: [
      ["people", "{a} does something small that shows how well they know you."],
      ["people", "You do something kind for {a} without making a big deal of it."],
      ["people", "You and {a} disagree about something trivial, and neither of you gives in."],
    ],
  },
  tease_flirt: {
    intents: ["casual", "teaser"],
    lines: [
      ["objects", "You tease your followers with {a} and do not explain everything."],
      ["places", "You are at {a}, dressed or posed to be noticed, and you know it."],
      ["habits", "You turn {a} into a little show for whoever is watching."],
    ],
  },
  opinion: {
    intents: ["casual", "behind_the_scenes"],
    lines: [
      ["work", "You have a strong opinion about how {a} should be done, and you share it."],
      ["objects", "You judge {a}, and you are not neutral about it."],
      ["places", "You say what you really think about {a}."],
    ],
  },
  anticipation: {
    intents: ["casual", "business", "teaser"],
    lines: [
      ["work", "Something new with {a} is coming soon, and you can barely wait."],
      ["places", "You are about to go to {a}, and you look forward to it."],
      ["people", "You are waiting for {a} to arrive."],
    ],
  },
  sensory_mood: {
    intents: ["casual", "teaser"],
    lines: [
      ["places", "{a} has a mood right now that you want to keep."],
      ["objects", "The feel, smell, or sound of {a} puts you in a certain mood."],
      ["habits", "{a} gives you a quiet, good moment."],
    ],
  },
  audience_game: {
    intents: ["appreciation", "casual"],
    lines: [
      ["work", "You let your followers pick or guess something about {a}."],
      ["objects", "You ask your followers a playful question about {a}."],
      ["habits", "You dare your followers to try {a} with you."],
    ],
  },
  routine_twist: {
    intents: ["casual", "behind_the_scenes"],
    lines: [
      ["habits", "Your usual {a} goes a little differently today, and you like the change."],
      ["places", "Something at {a} is different from usual today."],
      ["work", "You try a new way of doing {a}."],
    ],
  },
  mishap: {
    intents: ["behind_the_scenes", "casual"],
    lines: [
      ["objects", "{a} does not cooperate today."],
      ["work", "A small thing goes wrong during {a}, and you laugh it off."],
      ["places", "Something small goes wrong at {a}."],
    ],
  },
  callback: {
    intents: ["casual"],
    lines: [
      ["runningJokes", "The running joke about {a} comes up again."],
      ["runningJokes", "Something reminds you of {a}."],
      ["habits", "You are back at {a}, as your regulars knew you would be."],
    ],
  },
};

const BASE_PALETTE_WEIGHT = 1;
const MAX_PALETTE_WEIGHT = 5;
// A mishap is one kind of day, never the default one: the probe's complication deck made every
// beat a complication.
const MAX_MISHAP_WEIGHT = 2;
// Card canon (named people, places, work) is what Creators stopped posting about.
const CANON_KIND_WEIGHT: Record<SlurpAnchorKind, number> = {
  people: 2,
  places: 2,
  work: 2,
  objects: 1,
  habits: 1,
  runningJokes: 1,
};

export function slurpBeatIntents(type: SlurpBeatType): readonly SlurpContentIntent[] {
  return DECKS[type].intents;
}

function anchorValues(anchors: SlurpCanonAnchors, kind: SlurpAnchorKind): string[] {
  return kind === "people" ? anchors.people.map((person) => person.name) : anchors[kind];
}

/** Freshness against this Creator's own last beats, newest first. */
function ownFreshness(type: SlurpBeatType, recentOwn: readonly SlurpBeatType[]): number {
  const index = recentOwn.slice(0, 6).indexOf(type);
  return index < 0 ? 1 : index === 0 ? 0.1 : index < 3 ? 0.35 : 0.7;
}

/**
 * A semantic theme cap across all Creators: a beat type may hold about twice its fair share of the
 * last day, and never fewer than three. Counts beat types, not props, so "everybody at the
 * laundry" cannot come back as "everybody fixing a small flaw".
 */
export function slurpBeatThemeCap(globalCounts: Partial<Record<SlurpBeatType, number>>): number {
  const total = Object.values(globalCounts).reduce((sum, count) => sum + (count ?? 0), 0);
  return Math.max(3, Math.ceil((total / SLURP_BEAT_TYPES.length) * 2));
}

export type SlurpBeatHistory = {
  /** This Creator's last beat types, newest first. */
  recentOwn: readonly SlurpBeatType[];
  /** This Creator's last anchors, so the same person or place does not carry every post. */
  recentAnchors: readonly string[];
  /** Beat types across all Creators in the last day, this one included. */
  globalCounts: Partial<Record<SlurpBeatType, number>>;
  /** Shared ideas used across all Creators in the last day. Absent on callers that predate them. */
  sharedToday?: Readonly<Record<string, number>>;
};

/**
 * The beat for one ordinary slot, or null when the anchors support none (the caller then plans
 * the post the classic way). Deterministic on the Creator, the post count, and the history.
 *
 * `intents` are the intents this slot may take (only `teaser` on a teaser slot). A beat type is
 * eligible when its deck serves one of them and the anchors fill one of its templates.
 */
export function selectSlurpBeat(
  creatorAccountId: string,
  sequence: number,
  anchors: SlurpCanonAnchors,
  history: SlurpBeatHistory,
  intents: readonly SlurpContentIntent[],
  /** Level 1 ideas this Creator may use today, already under their daily cap. */
  shared: readonly SlurpSharedIdea[] = [],
): SlurpBeat | null {
  // Deck lines and shared ideas share one shape: [anchor kind, template, weight, shared id].
  const linesFor = (type: SlurpBeatType) =>
    [
      ...DECKS[type].lines.map(([kind, template]) => [kind, template, CANON_KIND_WEIGHT[kind], undefined] as const),
      ...shared
        .filter((idea) => idea.type === type)
        .map(
          (idea) =>
            [idea.anchorKind, idea.template, CANON_KIND_WEIGHT[idea.anchorKind] * SHARED_IDEA_BOOST, idea.id] as const,
        ),
    ].filter(([kind]) => anchorValues(anchors, kind).length > 0);
  const eligible = SLURP_BEAT_TYPES.filter(
    (type) => DECKS[type].intents.some((intent) => intents.includes(intent)) && linesFor(type).length > 0,
  );
  const cap = slurpBeatThemeCap(history.globalCounts);
  const weigh = (capped: boolean) =>
    eligible.map((type) => {
      const palette = Math.min(
        type === "mishap" ? MAX_MISHAP_WEIGHT : MAX_PALETTE_WEIGHT,
        Math.max(0, anchors.palette[type] ?? BASE_PALETTE_WEIGHT),
      );
      const count = history.globalCounts[type] ?? 0;
      const global = capped && count >= cap ? 0 : 1 / (1 + count / 2);
      return { value: type, weight: palette * ownFreshness(type, history.recentOwn) * global };
    });
  // A feed that used every type up still posts: the cap yields before the slot is lost.
  const weighted = weigh(true).some((option) => option.weight > 0) ? weigh(true) : weigh(false);
  if (!weighted.some((option) => option.weight > 0)) return null;
  const type = slurpWeightedPick("beatType", creatorAccountId, sequence, weighted);
  const [anchorKind, template, , sharedId] = slurpWeightedPick(
    "beatLine",
    creatorAccountId,
    sequence,
    linesFor(type).map((line) => ({ value: line, weight: line[2] })),
  );
  const values = anchorValues(anchors, anchorKind);
  const anchor = slurpWeightedPick(
    "beatAnchor",
    creatorAccountId,
    sequence,
    values.map((value, index) => ({
      value,
      // Earlier entries are the card's most central canon; a recently used one steps back.
      weight: (values.length - index) * (history.recentAnchors.slice(0, 6).includes(value) ? 0.25 : 1),
    })),
  );
  const person = anchorKind === "people" ? anchors.people.find((entry) => entry.name === anchor) : undefined;
  const place =
    anchorKind === "places"
      ? anchor
      : anchors.places.length
        ? slurpWeightedPick(
            "beatPlace",
            creatorAccountId,
            sequence,
            anchors.places.map((value, index) => ({ value, weight: anchors.places.length - index })),
          )
        : null;
  return {
    type,
    anchorKind,
    anchor,
    line: template.replace("{a}", anchor),
    cast: person ? [person.relation ? `${person.name} (${person.relation})` : person.name] : [],
    place,
    ...(sharedId ? { sharedId } : {}),
  };
}

/** Parse a stored beat. Anything malformed reads as no beat, never as a broken plan. */
export function parseSlurpBeat(raw: unknown): SlurpBeat | null {
  try {
    const value = typeof raw === "string" ? (JSON.parse(raw) as unknown) : raw;
    if (!value || typeof value !== "object") return null;
    const beat = value as Record<string, unknown>;
    if (
      !SLURP_BEAT_TYPES.includes(beat.type as SlurpBeatType) ||
      !(beat.anchorKind === "arc" || SLURP_ANCHOR_KINDS.includes(beat.anchorKind as SlurpAnchorKind)) ||
      typeof beat.anchor !== "string" ||
      typeof beat.line !== "string"
    ) {
      return null;
    }
    return {
      type: beat.type as SlurpBeatType,
      anchorKind: beat.anchorKind as SlurpAnchorKind | "arc",
      anchor: beat.anchor,
      line: beat.line,
      cast: Array.isArray(beat.cast) ? beat.cast.filter((entry): entry is string => typeof entry === "string") : [],
      place: typeof beat.place === "string" ? beat.place : null,
      ...(typeof beat.sharedId === "string" ? { sharedId: beat.sharedId } : {}),
    };
  } catch {
    return null;
  }
}

/**
 * An arc post's beat: its current chapter. An arc post used to get an unrelated card beat and the
 * chapter beside it, so the brief and the project block pulled in two directions. The chapter
 * before it is named, so the writer may refer to it without the claim check calling it invented.
 */
export function slurpArcBeat(project: {
  title: string;
  direction: string;
  chapters: readonly string[];
  chapter: number;
}): SlurpBeat {
  const current = project.chapters[project.chapter]?.trim() ?? "";
  const previous = project.chapter > 0 ? (project.chapters[project.chapter - 1]?.trim() ?? "") : "";
  const last = project.chapters.length > 0 && project.chapter >= project.chapters.length - 1;
  return {
    type: project.chapter === 0 ? "anticipation" : last ? "achievement" : "routine_twist",
    anchorKind: "arc",
    anchor: project.title,
    line: current
      ? `${project.title}, now: ${current}.${previous ? ` It follows: ${previous}.` : ""}`
      : `${project.title} goes on: ${project.direction.trim().slice(0, 160)}`,
    cast: [],
    place: null,
  };
}
