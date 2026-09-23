/**
 * A thread a Creator keeps posting about. The player sees these as Arcs.
 *
 * Pure, like `slurp-goal.ts` and `slurp-milestones.ts` beside it.
 *
 * Slurp could vary a post and it could time a post, but nothing connected two posts to each other.
 * Every automatic feed was therefore a set of unrelated moments by the same person, which is the
 * one thing a real creator page is not: people follow a page to find out what happens next.
 *
 * A project is the smallest thing that supplies a "next". It holds what the thread is about and,
 * optionally, an ordered list of chapters to move through. Chapters are plain strings rather than
 * rows because an open-ended project — "she is renovating the flat, no idea how long it takes" —
 * has to cost nothing, and a table would charge for a plan the player never made.
 *
 * An arc of a known kind (moving, a new job) starts from a template whose chapters carry day
 * ranges. A chapter with a range moves on when enough days have passed and a post has shown it, or
 * when its time runs out; a chapter without one moves on after every post, as projects always did.
 * Time is what stops a five-chapter move finishing in two days because the Creator posts often.
 *
 * A project never owns the feed. It claims some posts and leaves the rest alone; see
 * `slurp-post-variation.ts` for the rotation that decides which.
 */

import { z } from "zod";
import type { SlpArcBlueprint } from "../../../../../shared/src/slp/slp-story-engine.js";

import { SLURP_MODIFIER_KINDS, type SlurpModifierKind } from "../creators/slp-creator-state.js";

/** Longest title. Matches `SLURP_GOAL_LABEL_MAX_LENGTH`: long enough to name a thread, short enough for one line. */
export const SLURP_PROJECT_TITLE_MAX_LENGTH = 80;

/** Longest direction. Room for a paragraph of intent, far short of a script. */
export const SLURP_PROJECT_DIRECTION_MAX_LENGTH = 2000;

/** Longest chapter. A chapter is a line like "the consultation", never a scene. */
export const SLURP_PROJECT_CHAPTER_MAX_LENGTH = 200;

/**
 * Most chapters one project may hold.
 *
 * Fewer than three is not a story and more than a dozen is a plan nobody finishes, so the ceiling
 * is generous at the top and unenforced at the bottom: a project may legitimately have none.
 */
export const SLURP_PROJECT_MAX_CHAPTERS = 12;

/**
 * Most projects one Creator may run at once.
 *
 * The rotation splits project slots between active projects, so a fourth thread would publish so
 * rarely that nobody could follow it. Three is already more than a feed reads as connected.
 */
export const SLURP_PROJECT_MAX_ACTIVE = 3;

/** `suggested` is an automatic arc waiting for the player to accept it. It claims no posts. */
export const SLURP_PROJECT_STATUSES = ["active", "paused", "complete", "suggested"] as const;

export type SlurpProjectStatus = (typeof SLURP_PROJECT_STATUSES)[number];

/**
 * How loudly an arc shows in the feed. A focus arc takes twice the project slots of a background
 * one, and only one arc may be the focus: three equal threads read as no thread at all.
 */
export const SLURP_ARC_INTENSITIES = ["background", "focus"] as const;

export type SlurpArcIntensity = (typeof SLURP_ARC_INTENSITIES)[number];

export const SLURP_ARC_PACES = ["slow", "normal", "fast"] as const;

export type SlurpArcPace = (typeof SLURP_ARC_PACES)[number];

export const SLURP_DEFAULT_ARC_PACE: SlurpArcPace = "normal";

/** Days a chapter lasts. `min` gates advancing on a post; `max` advances without one. */
export type SlurpArcPhaseDays = { min: number; max: number };

/** Longest a single chapter may be set to last. */
const MAX_PHASE_DAYS = 90;

/** Matches the shared Noodle poll limits, so a choice always fits the poll it is posted as. */
export const SLURP_ARC_CHOICE_QUESTION_MAX_LENGTH = 240;
export const SLURP_ARC_CHOICE_OPTION_MAX_LENGTH = 120;
export const SLURP_ARC_CHOICE_MAX_OPTIONS = 4;
/** Chapters one option may insert. A branch is a detour, not a second arc. */
export const SLURP_ARC_BRANCH_MAX_CHAPTERS = 4;
export const SLURP_DEFAULT_ARC_POLL_HOURS = 24;

export type SlurpArcTypeChapter = { label: string; minDays: number; maxDays: number };

/** Percent changes while a chapter runs. Clamped again by `arcStatEffects` where they apply. */
export type SlurpArcEffects = { growth?: number; earnings?: number; loyalty?: number };

export const SLURP_ARC_EFFECT_STATS = ["growth", "earnings", "loyalty"] as const;

export type SlurpArcEffectStat = (typeof SLURP_ARC_EFFECT_STATS)[number];

export const SLURP_ARC_STAT_EFFECTS = ["off", "small", "big"] as const;

export type SlurpArcStatEffects = (typeof SLURP_ARC_STAT_EFFECTS)[number];

export const SLURP_ARC_STAT_EFFECT_CAP: Record<SlurpArcStatEffects, number> = { off: 0, small: 10, big: 50 };

/** A profile change a chapter proposes. Banner changes are not supported: they need an image generation. */
export type SlurpArcProfileChange = { bio?: string; location?: string };

export const SLURP_ARC_BIO_MAX_LENGTH = 500;
export const SLURP_ARC_LOCATION_MAX_LENGTH = 120;

/** What one chapter changes beyond its posts. Stored per chapter index, like choices. */
export type SlurpArcChapterReach = {
  mood?: SlurpModifierKind;
  effects?: SlurpArcEffects;
  profile?: SlurpArcProfileChange;
};

/** A profile change waiting for the player. `revert` puts back what an applied change replaced. */
export type SlurpArcPendingProfile = SlurpArcProfileChange & { chapter: number; proposedAt: string; revert: boolean };

function readEffects(value: unknown): SlurpArcEffects | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const raw = value as Record<string, unknown>;
  const effects: SlurpArcEffects = {};
  for (const stat of SLURP_ARC_EFFECT_STATS) {
    const pct = Number(raw[stat]);
    if (raw[stat] !== undefined && raw[stat] !== null && Number.isFinite(pct) && Math.round(pct) !== 0)
      effects[stat] = Math.max(-50, Math.min(50, Math.round(pct)));
  }
  return Object.keys(effects).length ? effects : undefined;
}

function readProfileChange(value: unknown): SlurpArcProfileChange | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const raw = value as Record<string, unknown>;
  const bio = clampText(raw.bio, SLURP_ARC_BIO_MAX_LENGTH);
  const location = clampText(raw.location, SLURP_ARC_LOCATION_MAX_LENGTH);
  return bio || location ? { ...(bio ? { bio } : {}), ...(location ? { location } : {}) } : undefined;
}

/** A stored or model-written chapter reach, or null when it changes nothing. */
export function readSlurpArcChapterReach(value: unknown): SlurpArcChapterReach | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  const mood = (SLURP_MODIFIER_KINDS as readonly unknown[]).includes(raw.mood)
    ? (raw.mood as SlurpModifierKind)
    : undefined;
  const effects = readEffects(raw.effects);
  const profile = readProfileChange(raw.profile);
  return mood || effects || profile
    ? { ...(mood ? { mood } : {}), ...(effects ? { effects } : {}), ...(profile ? { profile } : {}) }
    : null;
}

/**
 * A question at the end of a chapter. The winning option's chapters are inserted after it; an
 * option with none just carries on.
 */
export type SlurpArcChoice = {
  question: string;
  options: { label: string; chapters: SlurpArcTypeChapter[] }[];
};

/** How a choice was settled, kept on the chapter visit. */
export type SlurpArcPollResult = {
  question: string;
  winner: string;
  votes: { label: string; count: number }[];
  /** `chance`: nobody voted, so a seeded pick decided. */
  decidedBy: "fans" | "director" | "chance";
};

/** A stored or model-written choice, or null when it is not a usable one (a question and 2–4 distinct options). */
export function readSlurpArcChoice(value: unknown): SlurpArcChoice | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  const question = clampText(raw.question, SLURP_ARC_CHOICE_QUESTION_MAX_LENGTH);
  const seen = new Set<string>();
  const options = (Array.isArray(raw.options) ? raw.options : [])
    .flatMap((entry) => {
      if (!entry || typeof entry !== "object") return [];
      const option = entry as Record<string, unknown>;
      const label = clampText(option.label, SLURP_ARC_CHOICE_OPTION_MAX_LENGTH);
      if (!label || seen.has(label.toLocaleLowerCase())) return [];
      seen.add(label.toLocaleLowerCase());
      const chapters = (Array.isArray(option.chapters) ? option.chapters : [])
        .flatMap((chapter) => {
          if (!chapter || typeof chapter !== "object") return [];
          const item = chapter as Record<string, unknown>;
          const chapterLabel = clampText(item.label, SLURP_PROJECT_CHAPTER_MAX_LENGTH);
          const minDays = readDays(item.minDays);
          return chapterLabel
            ? [{ label: chapterLabel, minDays, maxDays: Math.max(minDays, readDays(item.maxDays)) }]
            : [];
        })
        .slice(0, SLURP_ARC_BRANCH_MAX_CHAPTERS);
      return [{ label, chapters }];
    })
    .slice(0, SLURP_ARC_CHOICE_MAX_OPTIONS);
  return question && options.length >= 2 ? { question, options } : null;
}

function readPollResult(value: unknown): SlurpArcPollResult | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  const question = clampText(raw.question, SLURP_ARC_CHOICE_QUESTION_MAX_LENGTH);
  const winner = clampText(raw.winner, SLURP_ARC_CHOICE_OPTION_MAX_LENGTH);
  if (!question || !winner) return null;
  return {
    question,
    winner,
    votes: (Array.isArray(raw.votes) ? raw.votes : []).slice(0, SLURP_ARC_CHOICE_MAX_OPTIONS).flatMap((entry) => {
      const item = entry && typeof entry === "object" ? (entry as Record<string, unknown>) : {};
      const label = clampText(item.label, SLURP_ARC_CHOICE_OPTION_MAX_LENGTH);
      const count = Number(item.count);
      return label ? [{ label, count: Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0 }] : [];
    }),
    decidedBy: raw.decidedBy === "director" || raw.decidedBy === "chance" ? raw.decidedBy : "fans",
  };
}

export type SlurpProject = {
  id: string;
  title: string;
  /** What connects the posts. Free text, supplied to generation as direction rather than a script. */
  direction: string;
  /** Ordered progress points. Empty for an open-ended project. */
  chapters: string[];
  /** Index into `chapters`. Meaningless, and left at zero, when there are none. */
  chapter: number;
  status: SlurpProjectStatus;
  /** Posts published into this project. */
  posts: number;
  startedAt: string;
  updatedAt: string;
  /** The library type this arc was copied from, or null for a custom arc. Only a label: the arc owns its copy. */
  typeId: string | null;
  /** Free tone copied from the type ("cozy", "dramatic"). Empty when none. */
  tone: string;
  /** An open-ended arc started from a type ends after this many days. Null never ends on its own. */
  durationDays: number | null;
  /** Day range per chapter, by index. A missing or null entry advances after every post. */
  phaseDays: (SlurpArcPhaseDays | null)[];
  /** When the current chapter began, for the day ranges. */
  chapterStartedAt: string;
  intensity: SlurpArcIntensity;
  /** Who started it. Only `auto` arcs count toward `arcMaxConcurrentAuto`. */
  origin: SlurpArcOrigin;
  /** Invented by the model for this Creator rather than copied from the library. */
  generated: boolean;
  /** One entry per chapter visit, oldest first. Going back a chapter adds a new visit. */
  history: SlurpArcHistoryEntry[];
  completedAt: string | null;
  /** A one-shot line for the next post in this arc. Empty when none; cleared once a post publishes. */
  twist: string;
  /** Choice per chapter, by index. Cleared once settled. */
  choices: (SlurpArcChoice | null)[];
  /** The post carrying the open choice's poll, once one published. */
  pollPostId: string | null;
  pollClosesAt: string | null;
  /** Mood, stat effects, and profile change per chapter, by index. */
  reach: (SlurpArcChapterReach | null)[];
  /** At the end, propose putting back the profile values applied changes replaced. */
  revertProfileAtEnd: boolean;
  pendingProfile: SlurpArcPendingProfile | null;
  /** Values replaced by applied changes, for the revert. Null when nothing was applied. */
  previousProfile: SlurpArcProfileChange | null;
  /**
   * A crossover's Creators, 2–3, the first one stores the arc. Empty for a single-Creator arc.
   * Every other participant keeps only `{ crossoverOf }` in their own list, resolved on read.
   */
  creatorIds: string[];
  /** A crossover's profile proposals per participant. The top-level two stay null on the stored record. */
  profiles: Record<
    string,
    { pendingProfile: SlurpArcPendingProfile | null; previousProfile: SlurpArcProfileChange | null }
  >;
  /** Read-only view field: the other participants' public display names. Never stored. */
  partnerNames?: string[];
};

export const SLURP_CROSSOVER_MAX_CREATORS = 3;

export const isSlurpCrossover = (project: SlurpProject) => project.creatorIds.length > 1;

/** A chapter as it ran. */
export type SlurpArcHistoryEntry = {
  chapter: number;
  /** The chapter line, or empty for an open-ended arc. */
  label: string;
  startedAt: string;
  endedAt: string | null;
  postIds: string[];
  /** The choice settled at the end of this visit. */
  poll?: SlurpArcPollResult;
  /** Stat effects the chapter carried, before the `arcStatEffects` cap. */
  effects?: SlurpArcEffects;
  /** Crossovers: which Creator published each post, by post id. */
  authors?: Record<string, string>;
};

/** Key posts kept per chapter visit. The timeline links a few, not the whole thread. */
export const SLURP_ARC_HISTORY_POSTS = 6;

export const SLURP_ARC_TWIST_MAX_LENGTH = 300;

/** Random twists for Director mode. Plain lines, no model call. */
export const SLURP_ARC_RANDOM_TWISTS = [
  "Something goes wrong at the worst possible moment.",
  "An old friend turns up out of nowhere.",
  "A plan falls through and they have to improvise.",
  "Good news arrives that changes everything.",
  "They find out something they were not supposed to know.",
  "Money gets tight all of a sudden.",
  "A stranger makes an unexpected offer.",
  "They lose something important.",
] as const;

export type SlurpArcOrigin = "manual" | "auto";

/** One portable arc blueprint. A running arc copies it at start, so later edits never reach it. */
export type SlurpArcType = SlpArcBlueprint;
export const SLURP_ARC_TONE_MAX_LENGTH = 80;
export const SLURP_ARC_MAX_DURATION_DAYS = 365;

/** Storage key for one Creator's projects. Mirrors the goal and earnings key shape. */
export const slurpProjectsKey = (creatorAccountId: string) => `slurp2.creator.${creatorAccountId}.projects`;

export const DAY_MS = 86_400_000;

export function hash(value: string): number {
  let out = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    out ^= value.charCodeAt(index);
    out = Math.imul(out, 0x01000193);
  }
  return out >>> 0;
}

export const clampText = (value: unknown, max: number): string =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

const readChapters = (value: unknown): string[] =>
  Array.isArray(value)
    ? value
        .map((entry) => clampText(entry, SLURP_PROJECT_CHAPTER_MAX_LENGTH))
        .filter(Boolean)
        .slice(0, SLURP_PROJECT_MAX_CHAPTERS)
    : [];

export const readDays = (value: unknown): number =>
  Number.isFinite(Number(value)) ? Math.min(MAX_PHASE_DAYS, Math.max(0, Math.floor(Number(value)))) : 0;

const readPhaseDays = (value: unknown, length: number): (SlurpArcPhaseDays | null)[] =>
  Array.isArray(value)
    ? value.slice(0, length).map((entry) => {
        if (!entry || typeof entry !== "object") return null;
        const min = readDays((entry as Record<string, unknown>).min);
        const max = Math.max(min, readDays((entry as Record<string, unknown>).max));
        return max > 0 ? { min, max } : null;
      })
    : [];

const validDate = (value: unknown): value is string => typeof value === "string" && !Number.isNaN(Date.parse(value));

/**
 * Read one stored project, or null when there is not a usable one.
 *
 * Exported so the storage layer and the tests read a project the same way. A project missing its
 * title is dropped rather than repaired: an untitled thread cannot be chosen or cancelled, and a
 * silent placeholder would leave the player unable to get rid of it.
 *
 * Projects stored before arcs had kinds read as custom background arcs with no day ranges, which
 * is exactly how they behaved. A stored v1 `kind` becomes `typeId` (the seed ids are the old kinds).
 */
export function readSlurpProject(value: unknown): SlurpProject | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  const id = clampText(raw.id, 128);
  const title = clampText(raw.title, SLURP_PROJECT_TITLE_MAX_LENGTH);
  if (!id || !title) return null;
  const chapters = readChapters(raw.chapters);
  const status = (SLURP_PROJECT_STATUSES as readonly string[]).includes(String(raw.status))
    ? (String(raw.status) as SlurpProjectStatus)
    : "active";
  const chapterRaw = Number(raw.chapter);
  // Clamped to the chapter list rather than trusted: a pointer past the end would read as an
  // unfinished project that can never advance, and the generator would have no chapter to name.
  const chapter = Number.isFinite(chapterRaw)
    ? Math.min(Math.max(0, Math.floor(chapterRaw)), Math.max(0, chapters.length - 1))
    : 0;
  const postsRaw = Number(raw.posts);
  const startedAt = validDate(raw.startedAt) ? raw.startedAt : "";
  const legacyKind = raw.kind === "custom" ? "" : clampText(raw.kind, 128);
  const durationRaw = Number(raw.durationDays);
  const chapterStartedAt = validDate(raw.chapterStartedAt) ? raw.chapterStartedAt : startedAt;
  const completedAt = validDate(raw.completedAt)
    ? raw.completedAt
    : status === "complete" && typeof raw.updatedAt === "string"
      ? raw.updatedAt
      : null;
  const history = Array.isArray(raw.history)
    ? raw.history.flatMap((entry): SlurpArcHistoryEntry[] => {
        if (!entry || typeof entry !== "object") return [];
        const item = entry as Record<string, unknown>;
        const index = Number(item.chapter);
        if (!Number.isInteger(index) || index < 0 || !validDate(item.startedAt)) return [];
        const poll = readPollResult(item.poll);
        const effects = readEffects(item.effects);
        const authors =
          item.authors && typeof item.authors === "object"
            ? Object.fromEntries(
                Object.entries(item.authors as Record<string, unknown>)
                  .map(([postId, creatorId]) => [clampText(postId, 128), clampText(creatorId, 128)])
                  .filter(([postId, creatorId]) => postId && creatorId),
              )
            : {};
        return [
          {
            chapter: index,
            label: clampText(item.label, SLURP_PROJECT_CHAPTER_MAX_LENGTH),
            startedAt: item.startedAt,
            endedAt: validDate(item.endedAt) ? item.endedAt : null,
            postIds: (Array.isArray(item.postIds) ? item.postIds : [])
              .map((postId) => clampText(postId, 128))
              .filter(Boolean)
              .slice(-SLURP_ARC_HISTORY_POSTS),
            ...(poll ? { poll } : {}),
            ...(effects ? { effects } : {}),
            ...(Object.keys(authors).length ? { authors } : {}),
          },
        ];
      })
    : [];
  // Records from before history existed: only the current chapter is known.
  if (history.length === 0 && (chapterStartedAt || startedAt))
    history.push({
      chapter,
      label: chapters[chapter] ?? "",
      startedAt: chapterStartedAt || startedAt,
      endedAt: completedAt,
      postIds: [],
    });
  return {
    id,
    title,
    direction: clampText(raw.direction, SLURP_PROJECT_DIRECTION_MAX_LENGTH),
    chapters,
    chapter,
    status,
    posts: Number.isFinite(postsRaw) ? Math.max(0, Math.floor(postsRaw)) : 0,
    startedAt,
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : startedAt,
    typeId: (raw.typeId === undefined ? legacyKind : clampText(raw.typeId, 128)) || null,
    tone: clampText(raw.tone, SLURP_ARC_TONE_MAX_LENGTH),
    durationDays:
      raw.durationDays !== null && Number.isFinite(durationRaw) && durationRaw >= 1
        ? Math.min(SLURP_ARC_MAX_DURATION_DAYS, Math.floor(durationRaw))
        : null,
    phaseDays: readPhaseDays(raw.phaseDays, chapters.length),
    chapterStartedAt,
    intensity: raw.intensity === "focus" ? "focus" : "background",
    // Records from before origin existed: only a suggestion can have come from the world tick.
    origin: raw.origin === "auto" || (raw.origin !== "manual" && status === "suggested") ? "auto" : "manual",
    generated: raw.generated === true,
    history,
    completedAt,
    twist: clampText(raw.twist, SLURP_ARC_TWIST_MAX_LENGTH),
    choices: Array.isArray(raw.choices) ? raw.choices.slice(0, chapters.length).map(readSlurpArcChoice) : [],
    pollPostId: clampText(raw.pollPostId, 128) || null,
    pollClosesAt: validDate(raw.pollClosesAt) ? raw.pollClosesAt : null,
    reach: Array.isArray(raw.reach) ? raw.reach.slice(0, chapters.length).map(readSlurpArcChapterReach) : [],
    revertProfileAtEnd: raw.revertProfileAtEnd === true,
    pendingProfile: readPendingProfile(raw.pendingProfile),
    previousProfile: readPreviousProfile(raw.previousProfile),
    ...(() => {
      const ids = Array.isArray(raw.creatorIds)
        ? [...new Set(raw.creatorIds.map((entry) => clampText(entry, 128)).filter(Boolean))].slice(
            0,
            SLURP_CROSSOVER_MAX_CREATORS,
          )
        : [];
      const creatorIds = ids.length >= 2 ? ids : [];
      const stored = raw.profiles && typeof raw.profiles === "object" ? (raw.profiles as Record<string, unknown>) : {};
      return {
        creatorIds,
        profiles: Object.fromEntries(
          creatorIds.map((id) => {
            const entry = (stored[id] ?? {}) as Record<string, unknown>;
            return [
              id,
              {
                pendingProfile: readPendingProfile(entry.pendingProfile),
                previousProfile: readPreviousProfile(entry.previousProfile),
              },
            ];
          }),
        ),
      };
    })(),
  };
}

function readPendingProfile(value: unknown): SlurpArcPendingProfile | null {
  const pending = value as Record<string, unknown> | null | undefined;
  const change = readPreviousProfile(pending) ?? readProfileChange(pending);
  return pending && change && Number.isInteger(pending.chapter) && validDate(pending.proposedAt)
    ? { ...change, chapter: pending.chapter as number, proposedAt: pending.proposedAt, revert: pending.revert === true }
    : null;
}

function readPreviousProfile(value: unknown): SlurpArcProfileChange | null {
  // Kept even when a value was empty: an empty bio is what a revert puts back.
  const previous = value as Record<string, unknown> | null | undefined;
  if (!previous || typeof previous !== "object") return null;
  const out: SlurpArcProfileChange = {};
  if (typeof previous.bio === "string") out.bio = previous.bio.slice(0, SLURP_ARC_BIO_MAX_LENGTH);
  if (typeof previous.location === "string") out.location = previous.location.slice(0, SLURP_ARC_LOCATION_MAX_LENGTH);
  return Object.keys(out).length ? out : null;
}

/**
 * Bring `after.history` and `completedAt` up to date with the move from `before`.
 *
 * A published post lands on the chapter it was written for, which is `before`'s. A chapter change
 * closes that visit and opens the next; finishing closes the last one. The one place history is
 * written, so advance, tick, edits, and Director actions cannot record it differently.
 */
export function slurpProjectRecord(
  before: SlurpProject,
  after: SlurpProject,
  at: Date,
  postId?: string,
  /** The Creator who published `postId`, kept for crossovers. */
  authorId?: string,
): SlurpProject {
  const stamp = at.toISOString();
  const history = before.history.map((entry) => ({ ...entry, postIds: [...entry.postIds] }));
  const open = () => {
    const effects = after.reach[after.chapter]?.effects;
    history.push({
      chapter: after.chapter,
      label: after.chapters[after.chapter] ?? "",
      startedAt: stamp,
      endedAt: null,
      postIds: [],
      ...(effects ? { effects } : {}),
    });
    return history.at(-1)!;
  };
  let last = history.at(-1) ?? open();
  if (postId && !last.postIds.includes(postId)) {
    last.postIds = [...last.postIds, postId].slice(-SLURP_ARC_HISTORY_POSTS);
    if (authorId && isSlurpCrossover(after))
      last.authors = Object.fromEntries(
        Object.entries({ ...last.authors, [postId]: authorId }).filter(([id]) => last.postIds.includes(id)),
      );
  }
  const completed = after.status === "complete";
  if (after.chapter !== before.chapter) {
    last.endedAt = stamp;
    last = open();
  }
  // Labels may be edited in place; the current visit follows the edit.
  last.label = after.chapters[after.chapter] ?? "";
  if (completed && before.status !== "complete") last.endedAt = stamp;
  if (!completed) last.endedAt = null;
  return {
    ...after,
    history,
    pendingProfile: slurpArcNextPending(before, after, stamp),
    completedAt: completed ? (before.status === "complete" ? before.completedAt : stamp) : null,
  };
}

/**
 * Profile changes wait for the player: a chapter that starts proposes its own, and finishing
 * proposes putting back what applied changes replaced. A newer proposal replaces an unanswered one.
 */
export function slurpArcNextPending(
  before: SlurpProject,
  after: SlurpProject,
  stamp: string,
): SlurpArcPendingProfile | null {
  const change = after.reach[after.chapter]?.profile;
  if (after.status === "complete" && before.status !== "complete")
    return after.revertProfileAtEnd && after.previousProfile
      ? { ...after.previousProfile, chapter: after.chapter, proposedAt: stamp, revert: true }
      : null;
  if (after.chapter !== before.chapter && change)
    return { ...change, chapter: after.chapter, proposedAt: stamp, revert: false };
  return after.pendingProfile;
}

/** Read the stored JSON array back into projects, dropping any entry that is not usable. */
export function readSlurpProjects(raw: string | null): SlurpProject[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(readSlurpProject).filter((project): project is SlurpProject => project !== null);
  } catch {
    return [];
  }
}

/**
 * Build a project. Returns null when there is no title, which is the one field it cannot invent.
 *
 * A library type is copied: blank title, direction, or chapters take the type's. Typed chapters win,
 * and keep a day range only where the label matches one of the type's chapters. A type with no
 * chapters gives an open-ended arc that ends after its duration.
 */
export function makeSlurpProject(
  id: string,
  input: {
    title?: string;
    direction?: string;
    chapters?: string[];
    type?: SlurpArcType | null;
    durationDays?: number | null;
    intensity?: SlurpArcIntensity;
    origin?: SlurpArcOrigin;
  },
  at: Date,
): SlurpProject | null {
  const timestamp = at.toISOString();
  const type = input.type ?? null;
  const chapters = input.chapters?.length ? input.chapters : (type?.chapters.map((chapter) => chapter.label) ?? []);
  const matches = chapters.map((label) => type?.chapters.find((chapter) => chapter.label === label.trim()));
  const phaseDays = matches.map((match) => (match ? { min: match.minDays, max: match.maxDays } : null));
  const choices = matches.map((match) => match?.choice ?? null);
  const reach = matches.map((match) => (match ? readSlurpArcChapterReach(match) : null));
  return readSlurpProject({
    reach: reach.some(Boolean) ? reach : [],
    revertProfileAtEnd: type?.revertProfileAtEnd === true,
    // The first chapter starts here rather than through `slurpProjectRecord`, so it proposes here.
    pendingProfile: reach[0]?.profile
      ? { ...reach[0].profile, chapter: 0, proposedAt: timestamp, revert: false }
      : null,
    id,
    title: input.title?.trim() || type?.name || "",
    direction: input.direction?.trim() || type?.description || "",
    chapters,
    phaseDays: phaseDays.some(Boolean) ? phaseDays : [],
    choices: choices.some(Boolean) ? choices : [],
    chapter: 0,
    status: "active",
    posts: 0,
    startedAt: timestamp,
    updatedAt: timestamp,
    chapterStartedAt: timestamp,
    typeId: type?.id ?? null,
    tone: type?.tone ?? "",
    durationDays: chapters.length || !type ? null : (input.durationDays ?? type.durationDays),
    intensity: input.intensity ?? "background",
    origin: input.origin ?? "manual",
  });
}

/** A pair of Creators the player allows to collab, and what they make together. */
export const slurpCreatorCollabSchema = z.object({
  creatorIds: z.tuple([z.string().min(1).max(128), z.string().min(1).max(128)]),
  content: z.string().trim().max(600).default(""),
});
export type SlurpCreatorCollab = z.infer<typeof slurpCreatorCollabSchema>;
export const slurpCreatorCollabsSchema = z.array(slurpCreatorCollabSchema).max(500);

/** Every collab entry that includes this Creator, as partner id and content. */
export function slurpCollabPartners(
  collabs: readonly SlurpCreatorCollab[],
  creatorId: string,
): { partnerId: string; content: string }[] {
  return collabs.flatMap((collab) => {
    const [a, b] = collab.creatorIds;
    if (a === creatorId && b !== creatorId) return [{ partnerId: b, content: collab.content }];
    if (b === creatorId && a !== creatorId) return [{ partnerId: a, content: collab.content }];
    return [];
  });
}
