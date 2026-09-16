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

import { SLURP_MODIFIER_KINDS, type SlurpModifierKind } from "./slurp-creator-state.js";

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

const PACE_MULTIPLIER: Record<SlurpArcPace, number> = { slow: 1.5, normal: 1, fast: 0.5 };

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
 * The multiplier for one stat right now: the current chapters of every running arc add their
 * percent, and the sum is clamped to the `arcStatEffects` cap. The single rule every choke point reads.
 */
export function slurpArcEffectMultiplier(
  projects: readonly SlurpProject[],
  stat: SlurpArcEffectStat,
  setting: SlurpArcStatEffects,
): number {
  const cap = SLURP_ARC_STAT_EFFECT_CAP[setting] ?? 0;
  const pct = activeSlurpProjects(projects).reduce(
    (sum, project) => sum + (project.reach[project.chapter]?.effects?.[stat] ?? 0),
    0,
  );
  return 1 + Math.max(-cap, Math.min(cap, pct)) / 100;
}

/** The mood modifier a chapter starts, or null when it has none or `arcAffectsMood` is off. */
export function slurpArcChapterMood(project: SlurpProject, affectsMood: boolean): SlurpModifierKind | null {
  return affectsMood ? (project.reach[project.chapter]?.mood ?? null) : null;
}

/** One line for an arc post's image prompt: the moment and the tone. Raw text; the caller protects it. */
export function slurpArcImageLine(project: SlurpProject | null | undefined): string | null {
  const chapter = project ? slurpProjectChapter(project) : null;
  if (!project || !chapter) return null;
  return `The picture shows this moment of an ongoing story: ${chapter}${project.tone ? ` (${project.tone} tone)` : ""}.`;
}

/**
 * Apply or reject the pending profile change. Apply returns what to write; the first applied change
 * keeps the values it replaced, so a revert at the end puts the original profile back.
 */
export function slurpArcResolveProfile(
  project: SlurpProject,
  apply: boolean,
  current: { bio: string; location: string },
): { project: SlurpProject; write: SlurpArcProfileChange | null } | null {
  const pending = project.pendingProfile;
  if (!pending) return null;
  if (!apply) return { project: { ...project, pendingProfile: null }, write: null };
  const write: SlurpArcProfileChange = {
    ...(pending.bio !== undefined ? { bio: pending.bio } : {}),
    ...(pending.location !== undefined ? { location: pending.location } : {}),
  };
  const replaced: SlurpArcProfileChange = {
    ...(write.bio !== undefined ? { bio: current.bio } : {}),
    ...(write.location !== undefined ? { location: current.location } : {}),
  };
  return {
    project: {
      ...project,
      pendingProfile: null,
      previousProfile: pending.revert ? null : { ...replaced, ...project.previousProfile },
    },
    write,
  };
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

/** A participant's stand-in for a crossover stored in another Creator's list. */
export type SlurpCrossoverRef = { crossoverOf: { ownerCreatorId: string; projectId: string } };

export function readSlurpCrossoverRef(value: unknown): SlurpCrossoverRef["crossoverOf"] | null {
  const ref = value && typeof value === "object" ? (value as { crossoverOf?: unknown }).crossoverOf : null;
  if (!ref || typeof ref !== "object") return null;
  const ownerCreatorId = clampText((ref as Record<string, unknown>).ownerCreatorId, 128);
  const projectId = clampText((ref as Record<string, unknown>).projectId, 128);
  return ownerCreatorId && projectId ? { ownerCreatorId, projectId } : null;
}

export const isSlurpCrossover = (project: SlurpProject) => project.creatorIds.length > 1;

/** One participant's view: their own profile proposal in the top-level fields. */
export function slurpCrossoverView(project: SlurpProject, creatorId: string): SlurpProject {
  if (!isSlurpCrossover(project)) return project;
  const own = project.profiles[creatorId];
  return { ...project, pendingProfile: own?.pendingProfile ?? null, previousProfile: own?.previousProfile ?? null };
}

/** A new arc turned into a crossover: every participant gets the first chapter's proposal. */
export function slurpCrossoverStart(project: SlurpProject, creatorIds: readonly string[]): SlurpProject {
  const ids = [...new Set(creatorIds)].slice(0, SLURP_CROSSOVER_MAX_CREATORS);
  if (ids.length < 2) return project;
  return {
    ...project,
    creatorIds: ids,
    profiles: Object.fromEntries(
      ids.map((id) => [id, { pendingProfile: project.pendingProfile, previousProfile: null }]),
    ),
    pendingProfile: null,
    previousProfile: null,
  };
}

/**
 * Write one participant's edited view back onto the stored record. The actor's proposal is what the
 * view says; every other participant gets the proposal the same move makes for them (a new chapter's
 * change, or a revert of what they applied), so proposals stay per participant.
 */
export function slurpCrossoverMerge(
  stored: SlurpProject,
  view: SlurpProject,
  creatorId: string,
  at: Date,
): SlurpProject {
  if (!isSlurpCrossover(stored)) return view;
  const { partnerNames: _names, ...rest } = view;
  const stamp = at.toISOString();
  const profiles = Object.fromEntries(
    stored.creatorIds.map((id) => {
      if (id === creatorId) return [id, { pendingProfile: view.pendingProfile, previousProfile: view.previousProfile }];
      const before = slurpCrossoverView(stored, id);
      const pendingProfile = slurpArcNextPending(
        before,
        { ...rest, pendingProfile: before.pendingProfile, previousProfile: before.previousProfile },
        stamp,
      );
      return [id, { pendingProfile, previousProfile: before.previousProfile }];
    }),
  );
  return { ...rest, creatorIds: stored.creatorIds, profiles, pendingProfile: null, previousProfile: null };
}

/** A participant leaves (their Creator was deleted). Below two, it is a normal arc of whoever is left. */
export function slurpCrossoverLeave(project: SlurpProject, creatorId: string): SlurpProject {
  if (!project.creatorIds.includes(creatorId)) return project;
  const creatorIds = project.creatorIds.filter((id) => id !== creatorId);
  const { [creatorId]: _gone, ...profiles } = project.profiles;
  if (creatorIds.length >= 2) return { ...project, creatorIds, profiles };
  const last = profiles[creatorIds[0] ?? ""];
  return {
    ...project,
    creatorIds: [],
    profiles: {},
    pendingProfile: last?.pendingProfile ?? null,
    previousProfile: last?.previousProfile ?? null,
  };
}

/**
 * The partner for an automatic crossover, or null. About one roll in four, seeded on the Creator and
 * the day like the arc roll itself. A partner shares a tag or already has a relationship (a follow or
 * subscription either way) and passed the caller's eligibility checks.
 */
export function slurpCrossoverPartner(input: {
  creatorAccountId: string;
  at: Date;
  creatorTags: readonly string[];
  candidates: readonly { id: string; tags: readonly string[]; related: boolean; eligible: boolean }[];
  /** Creators the player paired with this one as collab partners. Preferred over tag matches. */
  collabIds?: readonly string[];
}): string | null {
  const day = Math.floor(input.at.getTime() / DAY_MS);
  if (hash(`${input.creatorAccountId}:${day}:crossover`) % 4 !== 0) return null;
  const tags = new Set(input.creatorTags.map((tag) => tag.toLocaleLowerCase()));
  const paired = input.candidates
    .filter((candidate) => candidate.eligible && input.collabIds?.includes(candidate.id))
    .map((candidate) => candidate.id)
    .sort();
  if (paired.length) return paired[hash(`${input.creatorAccountId}:${day}:partner`) % paired.length]!;
  const fits = input.candidates
    .filter(
      (candidate) =>
        candidate.eligible &&
        candidate.id !== input.creatorAccountId &&
        (candidate.related || candidate.tags.some((tag) => tags.has(tag.toLocaleLowerCase()))),
    )
    .map((candidate) => candidate.id)
    .sort();
  return fits.length ? fits[hash(`${input.creatorAccountId}:${day}:partner`) % fits.length]! : null;
}

/**
 * The timeline's crossover part for one viewer: the partners the viewer may see, and history posts
 * only from participants they may see. A hidden participant is left out entirely.
 */
export function slurpCrossoverForViewer(
  project: SlurpProject,
  selfId: string,
  visible: (creatorId: string) => boolean,
): { partnerIds: string[]; history: SlurpArcHistoryEntry[] } {
  const hidden = new Set(project.creatorIds.filter((id) => id !== selfId && !visible(id)));
  return {
    partnerIds: project.creatorIds.filter((id) => id !== selfId && !hidden.has(id)),
    history: hidden.size
      ? project.history.map((entry) => {
          const postIds = entry.postIds.filter((postId) => !hidden.has(entry.authors?.[postId] ?? ""));
          const authors = Object.fromEntries(Object.entries(entry.authors ?? {}).filter(([, id]) => !hidden.has(id)));
          return { ...entry, postIds, authors };
        })
      : project.history,
  };
}

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

/** One entry of the `arcLibrary` setting. A running arc copies it at start, so edits never reach running arcs. */
export type SlurpArcType = {
  id: string;
  name: string;
  description: string;
  chapters: (SlurpArcTypeChapter & { choice?: SlurpArcChoice } & SlurpArcChapterReach)[];
  revertProfileAtEnd?: boolean;
  /** Only offered to Creators with one of these tags. Empty offers it to everyone. */
  tags: string[];
  tone: string;
  /** Days an arc of this type runs when it has no chapters. */
  durationDays: number;
  /** Off: never picked automatically, still usable by hand. */
  enabled: boolean;
  /** Shipped entry; can be reset to its default. */
  builtin: boolean;
  /** A deleted built-in stays here hidden, so a reset can bring it back. */
  hidden: boolean;
};

export const SLURP_ARC_TYPE_NAME_MAX_LENGTH = 80;
export const SLURP_ARC_TONE_MAX_LENGTH = 80;
export const SLURP_ARC_MAX_DURATION_DAYS = 365;
export const SLURP_DEFAULT_ARC_DURATION_DAYS = 14;

const seed = (
  id: string,
  name: string,
  description: string,
  chapters: readonly (readonly [string, number, number])[],
): SlurpArcType => ({
  id,
  name,
  description,
  chapters: chapters.map(([label, minDays, maxDays]) => ({ label, minDays, maxDays })),
  tags: [],
  tone: "",
  durationDays: SLURP_DEFAULT_ARC_DURATION_DAYS,
  enabled: true,
  builtin: true,
  hidden: false,
});

/**
 * The shipped arc types; ids are the old arc kinds. Chapters are beats, not scenes: "packing"
 * leaves the Creator's own life to say what packing looks like for them.
 */
export const SLURP_ARC_LIBRARY_SEED: readonly SlurpArcType[] = [
  seed("moving", "Moving house", "Leaving the old place for a new one, from the decision to finally feeling at home.", [
    ["deciding to move", 2, 5],
    ["packing up the old place", 3, 6],
    ["moving day", 1, 1],
    ["the new place is still empty", 2, 4],
    ["settling in", 4, 10],
  ]),
  seed("new_job", "A new job", "Starting somewhere new, from the offer to finding their feet.", [
    ["the offer", 1, 3],
    ["working out the notice period", 5, 10],
    ["the first day", 1, 1],
    ["finding their feet", 5, 12],
  ]),
  seed("trip", "A trip away", "Getting away for a while and coming back.", [
    ["planning the trip", 2, 5],
    ["packing", 1, 2],
    ["away", 3, 7],
    ["back home", 1, 3],
  ]),
  seed("fitness", "Getting in shape", "A real attempt at getting fitter, with the boring middle left in.", [
    ["the decision", 1, 3],
    ["the first weeks", 7, 14],
    ["the plateau", 5, 10],
    ["starting to see it", 7, 14],
  ]),
  seed("renovation", "Redoing a room", "Fixing up one room, mess included.", [
    ["picking a plan", 2, 5],
    ["tearing it out", 2, 4],
    ["living in the mess", 5, 10],
    ["the reveal", 1, 2],
  ]),
  seed("breakup", "A breakup", "A relationship ending and life carrying on after it.", [
    ["it ended", 1, 2],
    ["the raw part", 4, 8],
    ["going out again", 5, 10],
    ["fine, actually", 4, 8],
  ]),
];

/**
 * The library for settings stored before it existed. Types left out of the old `arcAllowedKinds`
 * start disabled; with no stored list every type is enabled.
 */
export function slurpArcLibraryFromLegacy(allowedKinds: unknown): SlurpArcType[] {
  const allowed = Array.isArray(allowedKinds) ? allowedKinds.map(String) : null;
  return SLURP_ARC_LIBRARY_SEED.map((type) => ({
    ...type,
    chapters: type.chapters.map((chapter) => ({ ...chapter })),
    enabled: allowed ? allowed.includes(type.id) : true,
  }));
}

/** Storage key for one Creator's projects. Mirrors the goal and earnings key shape. */
export const slurpProjectsKey = (creatorAccountId: string) => `slurp2.creator.${creatorAccountId}.projects`;

export const SLURP_ARC_AUTO_MODES = ["off", "suggest", "auto"] as const;

export type SlurpArcAutoMode = (typeof SLURP_ARC_AUTO_MODES)[number];

/**
 * Off by default. The whole reason arcs exist is that every Creator used to be moving house without
 * anybody asking for it; turning life events back on by default would repeat that.
 */
export const SLURP_DEFAULT_ARC_AUTO_MODE: SlurpArcAutoMode = "off";

/** When an automatic arc was last started or suggested for this Creator, for the cooldown. */
export const slurpArcAutoKey = (creatorAccountId: string) => `slurp2.creator.${creatorAccountId}.arcAutoAt`;

const DAY_MS = 86_400_000;
const WEEK_MS = 7 * DAY_MS;

export const SLURP_ARC_SOURCES = ["library", "generated", "mixed"] as const;

export type SlurpArcSource = (typeof SLURP_ARC_SOURCES)[number];

/** Per-Creator overrides of the arc settings. A missing field uses the global setting. */
export type SlurpCreatorArcConfig = {
  autoMode?: SlurpArcAutoMode;
  source?: SlurpArcSource;
  cooldownWeeks?: number;
  pace?: SlurpArcPace;
  /** Subset of the library. Missing: every enabled type matching the Creator's tags. */
  allowedTypeIds?: string[];
  maxActive?: number;
  /** Whether automatic crossovers may include this Creator. Missing: the `arcCrossovers` setting. */
  crossovers?: boolean;
};

export const slurpArcConfigKey = (creatorAccountId: string) => `slurp2.creator.${creatorAccountId}.arcConfig`;

const intIn = (value: unknown, min: number, max: number): number | undefined =>
  Number.isInteger(value) && (value as number) >= min && (value as number) <= max ? (value as number) : undefined;

/** Read a stored config, dropping every field that is not usable. */
export function readSlurpCreatorArcConfig(value: unknown): SlurpCreatorArcConfig {
  let raw = value;
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      return {};
    }
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const record = raw as Record<string, unknown>;
  const config: SlurpCreatorArcConfig = {};
  if ((SLURP_ARC_AUTO_MODES as readonly unknown[]).includes(record.autoMode))
    config.autoMode = record.autoMode as SlurpArcAutoMode;
  if ((SLURP_ARC_SOURCES as readonly unknown[]).includes(record.source))
    config.source = record.source as SlurpArcSource;
  const cooldownWeeks = intIn(record.cooldownWeeks, 1, 8);
  if (cooldownWeeks !== undefined) config.cooldownWeeks = cooldownWeeks;
  if ((SLURP_ARC_PACES as readonly unknown[]).includes(record.pace)) config.pace = record.pace as SlurpArcPace;
  if (Array.isArray(record.allowedTypeIds))
    config.allowedTypeIds = [...new Set(record.allowedTypeIds.map((id) => clampText(id, 128)).filter(Boolean))];
  const maxActive = intIn(record.maxActive, 1, SLURP_PROJECT_MAX_ACTIVE);
  if (maxActive !== undefined) config.maxActive = maxActive;
  if (typeof record.crossovers === "boolean") config.crossovers = record.crossovers;
  return config;
}

export type SlurpResolvedArcConfig = {
  autoMode: SlurpArcAutoMode;
  source: SlurpArcSource;
  cooldownWeeks: number;
  pace: SlurpArcPace;
  allowedTypeIds: string[] | null;
  maxActive: number;
  crossovers: boolean;
};

/** The one place a Creator's overrides meet the global settings. Every arc rule reads this. */
export function resolveSlurpArcConfig(
  global: {
    arcAutoMode: SlurpArcAutoMode;
    arcCooldownWeeks: number;
    arcPace: SlurpArcPace;
    arcSource?: SlurpArcSource;
    arcCrossovers?: boolean;
  },
  config: SlurpCreatorArcConfig,
): SlurpResolvedArcConfig {
  return {
    crossovers: config.crossovers ?? global.arcCrossovers ?? true,
    autoMode: config.autoMode ?? global.arcAutoMode,
    source: config.source ?? global.arcSource ?? "mixed",
    cooldownWeeks: config.cooldownWeeks ?? global.arcCooldownWeeks,
    pace: config.pace ?? global.arcPace,
    allowedTypeIds: config.allowedTypeIds ?? null,
    maxActive: config.maxActive ?? SLURP_PROJECT_MAX_ACTIVE,
  };
}

/**
 * Automatic arcs running or waiting for the player. Manual arcs never count toward the cap. Given the
 * list's Creator, a crossover counts only in its first participant's list, so it counts once per arc.
 */
export const slurpAutoArcCount = (projects: readonly SlurpProject[], creatorAccountId?: string): number =>
  projects.filter(
    (project) =>
      project.origin === "auto" &&
      (project.status === "active" || project.status === "suggested") &&
      (creatorAccountId === undefined || !isSlurpCrossover(project) || project.creatorIds[0] === creatorAccountId),
  ).length;

function hash(value: string): number {
  let out = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    out ^= value.charCodeAt(index);
    out = Math.imul(out, 0x01000193);
  }
  return out >>> 0;
}

/**
 * The library type to start for a Creator right now, or null. Only enabled, visible types whose
 * tags meet the Creator's (a type with no tags fits everyone).
 *
 * Deterministic, like audience arcs: seeded on the Creator and the day, so running the world tick
 * twice cannot start two arcs, and the same day always gives the same answer. Each eligible day
 * rolls with chance 1 / (cooldown days), which spreads Creators across the cooldown window. A new
 * Creator is not eligible until one cooldown after it was created, and nobody gets one while
 * `maxConcurrentAuto` automatic arcs already run elsewhere.
 *
 * A Creator who already has a running or suggested arc gets nothing: automatic arcs fill silence,
 * they never stack on a story the player is already telling.
 */
export function slurpAutoArcType(input: Parameters<typeof slurpAutoArcPick>[0]): SlurpArcType | null {
  const pick = slurpAutoArcPick({ ...input, source: "library" });
  return pick && "type" in pick ? pick.type : null;
}

/**
 * The same roll as `slurpAutoArcType`, with the source decided too. `generated` asks the model;
 * `mixed` uses the library when a type fits and still generates about one day in three, seeded on
 * the Creator and day like the roll itself so a repeated tick gives the same answer.
 */
export function slurpAutoArcPick(input: {
  creatorAccountId: string;
  at: Date;
  projects: readonly SlurpProject[];
  library: readonly SlurpArcType[];
  creatorTags: readonly string[];
  lastAutoAt: string | null;
  cooldownWeeks: number;
  /** Null or missing: every enabled type matching the tags. */
  allowedTypeIds?: readonly string[] | null;
  /** The Creator account's creation time. */
  createdAt?: string | null;
  /** Automatic arcs active or suggested across all Creators right now. */
  concurrentAuto?: number;
  maxConcurrentAuto?: number;
  source?: SlurpArcSource;
}): { type: SlurpArcType } | { generated: true } | null {
  if (input.projects.some((project) => project.status === "active" || project.status === "suggested")) return null;
  if (input.maxConcurrentAuto !== undefined && (input.concurrentAuto ?? 0) >= input.maxConcurrentAuto) return null;
  const creatorTags = new Set(input.creatorTags.map((tag) => tag.toLocaleLowerCase()));
  const allowed = input.library.filter(
    (type) =>
      type.enabled &&
      !type.hidden &&
      (!input.allowedTypeIds || input.allowedTypeIds.includes(type.id)) &&
      (type.tags.length === 0 || type.tags.some((tag) => creatorTags.has(tag.toLocaleLowerCase()))),
  );
  const source = input.source ?? "library";
  if (allowed.length === 0 && source === "library") return null;
  const cooldownWeeks = Math.max(1, input.cooldownWeeks);
  const last = input.lastAutoAt ? Date.parse(input.lastAutoAt) : Number.NaN;
  if (Number.isFinite(last) && input.at.getTime() - last < cooldownWeeks * WEEK_MS) return null;
  const created = input.createdAt ? Date.parse(input.createdAt) : Number.NaN;
  if (Number.isFinite(created) && input.at.getTime() - created < cooldownWeeks * WEEK_MS) return null;
  const day = Math.floor(input.at.getTime() / DAY_MS);
  const roll = hash(`${input.creatorAccountId}:${day}`);
  if (roll % (cooldownWeeks * 7) !== 0) return null;
  if (
    source === "generated" ||
    allowed.length === 0 ||
    (source === "mixed" && hash(`${input.creatorAccountId}:${day}:source`) % 3 === 0)
  )
    return { generated: true };
  return { type: allowed[(roll >>> 8) % allowed.length]! };
}

/**
 * A project from the model's `{ title, direction, tone, chapters[{label,minDays,maxDays}], durationDays? }`,
 * or null when it has no title. Every value goes through the same clamps as a stored project.
 */
export function slurpGeneratedArcProject(
  id: string,
  value: unknown,
  at: Date,
  input: { origin: SlurpArcOrigin; status: SlurpProjectStatus },
): SlurpProject | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  const chapters = (Array.isArray(raw.chapters) ? raw.chapters : [])
    .map((entry) => (entry && typeof entry === "object" ? (entry as Record<string, unknown>) : {}))
    .map((entry) => ({
      label: clampText(entry.label, SLURP_PROJECT_CHAPTER_MAX_LENGTH),
      min: readDays(entry.minDays),
      max: readDays(entry.maxDays),
      choice: readSlurpArcChoice(entry.choice),
      // Generated arcs may carry mood and effects; profile changes are the player's to write.
      reach: readSlurpArcChapterReach({ mood: entry.mood, effects: entry.effects }),
    }))
    .filter((entry) => entry.label)
    .slice(0, SLURP_PROJECT_MAX_CHAPTERS);
  // At most one choice per generated arc: the first usable one.
  const firstChoice = chapters.findIndex((chapter) => chapter.choice);
  const project = makeSlurpProject(
    id,
    {
      title: clampText(raw.title, SLURP_PROJECT_TITLE_MAX_LENGTH),
      direction: clampText(raw.direction, SLURP_PROJECT_DIRECTION_MAX_LENGTH),
      chapters: chapters.map((chapter) => chapter.label),
      origin: input.origin,
    },
    at,
  );
  if (!project) return null;
  const durationRaw = Number(raw.durationDays);
  return readSlurpProject({
    ...project,
    status: input.status,
    tone: raw.tone,
    phaseDays: chapters.map((chapter) => ({ min: chapter.min, max: Math.max(chapter.min, chapter.max) })),
    choices: chapters.map((chapter, index) => (index === firstChoice ? chapter.choice : null)),
    reach: chapters.map((chapter) => chapter.reach),
    durationDays: chapters.length
      ? null
      : Number.isFinite(durationRaw) && durationRaw >= 1
        ? durationRaw
        : SLURP_DEFAULT_ARC_DURATION_DAYS,
    generated: true,
  });
}

/** A custom library type copied from an arc, for "Save to library". Chapters without days keep 0–0. */
export function slurpArcTypeFromProject(project: SlurpProject, id: string): SlurpArcType {
  return {
    id,
    name: project.title.slice(0, SLURP_ARC_TYPE_NAME_MAX_LENGTH),
    description: project.direction,
    chapters: project.chapters.map((label, index) => ({
      label,
      minDays: project.phaseDays[index]?.min ?? 0,
      maxDays: project.phaseDays[index]?.max ?? 0,
      ...(project.choices[index] ? { choice: project.choices[index] } : {}),
      ...project.reach[index],
    })),
    ...(project.revertProfileAtEnd ? { revertProfileAtEnd: true } : {}),
    tags: [],
    tone: project.tone,
    durationDays: project.durationDays ?? SLURP_DEFAULT_ARC_DURATION_DAYS,
    enabled: true,
    builtin: false,
    hidden: false,
  };
}

const clampText = (value: unknown, max: number): string =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

const readChapters = (value: unknown): string[] =>
  Array.isArray(value)
    ? value
        .map((entry) => clampText(entry, SLURP_PROJECT_CHAPTER_MAX_LENGTH))
        .filter(Boolean)
        .slice(0, SLURP_PROJECT_MAX_CHAPTERS)
    : [];

const readDays = (value: unknown): number =>
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
function slurpArcNextPending(before: SlurpProject, after: SlurpProject, stamp: string): SlurpArcPendingProfile | null {
  const change = after.reach[after.chapter]?.profile;
  if (after.status === "complete" && before.status !== "complete")
    return after.revertProfileAtEnd && after.previousProfile
      ? { ...after.previousProfile, chapter: after.chapter, proposedAt: stamp, revert: true }
      : null;
  if (after.chapter !== before.chapter && change)
    return { ...change, chapter: after.chapter, proposedAt: stamp, revert: false };
  return after.pendingProfile;
}

export const SLURP_ARC_DIRECTOR_ACTIONS = [
  "pause",
  "resume",
  "skip",
  "back",
  "label",
  "twist",
  "end",
  "choose",
] as const;

export type SlurpArcDirectorAction = (typeof SLURP_ARC_DIRECTOR_ACTIONS)[number];

/**
 * One Director mode action, or null when it does not apply: a suggestion or a finished arc, skip
 * past the last chapter, back before the first, or a blank label. Skip never finishes an arc; that
 * is what `end` is for. A twist of "random" or blank picks a line from `SLURP_ARC_RANDOM_TWISTS`.
 * History is recorded here too.
 */
export function slurpProjectDirect(
  project: SlurpProject,
  action: SlurpArcDirectorAction,
  at: Date,
  value = "",
  random = Math.random,
  /** Poll votes per option, for `choose`. The player's pick wins, the counts are only recorded. */
  votes: readonly number[] = [],
): SlurpProject | null {
  if (project.status !== "active" && project.status !== "paused") return null;
  if (action === "choose") {
    const option = Number(value);
    return Number.isInteger(option) && value.trim() !== "" ? slurpProjectChoose(project, at, votes, option) : null;
  }
  const updatedAt = at.toISOString();
  const moveTo = (chapter: number) =>
    chapter < 0 || chapter >= project.chapters.length
      ? null
      : { ...project, chapter, chapterStartedAt: updatedAt, pollPostId: null, pollClosesAt: null };
  let next: SlurpProject | null;
  switch (action) {
    case "pause":
      next = project.status === "active" ? { ...project, status: "paused" } : null;
      break;
    case "resume":
      next = project.status === "paused" ? { ...project, status: "active" } : null;
      break;
    case "skip":
      next = moveTo(project.chapter + 1);
      break;
    case "back":
      next = moveTo(project.chapter - 1);
      break;
    case "label": {
      const label = clampText(value, SLURP_PROJECT_CHAPTER_MAX_LENGTH);
      next =
        label && project.chapters.length
          ? {
              ...project,
              chapters: project.chapters.map((entry, index) => (index === project.chapter ? label : entry)),
            }
          : null;
      break;
    }
    case "twist": {
      const typed = clampText(value, SLURP_ARC_TWIST_MAX_LENGTH);
      const twist =
        typed && typed.toLowerCase() !== "random"
          ? typed
          : SLURP_ARC_RANDOM_TWISTS[Math.floor(random() * SLURP_ARC_RANDOM_TWISTS.length)]!;
      next = { ...project, twist };
      break;
    }
    case "end":
      next = { ...project, status: "complete" };
      break;
  }
  return next ? slurpProjectRecord(project, { ...next, updatedAt }, at) : null;
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

/** The projects that may claim a post. Paused and complete projects keep everything and claim nothing. */
export function activeSlurpProjects(projects: readonly SlurpProject[]): SlurpProject[] {
  return projects.filter((project) => project.status === "active");
}

/** The rotation list: the focus arc appears twice, so it takes twice the slots of a background one. */
export function slurpArcRotation(projects: readonly SlurpProject[]): SlurpProject[] {
  return [...projects, ...projects.filter((project) => project.intensity === "focus")];
}

/** Every project demoted to background, for the moment another one becomes the focus. */
export function slurpArcsWithoutFocus(projects: readonly SlurpProject[]): SlurpProject[] {
  return projects.map((project) => (project.intensity === "focus" ? { ...project, intensity: "background" } : project));
}

/** The chapter a project is on, or null for an open-ended one. */
export function slurpProjectChapter(project: SlurpProject): string | null {
  return project.chapters[project.chapter] ?? null;
}

/**
 * One clause for what is going on in the Creator's own life, for prompts outside the feed.
 *
 * The focus arc if there is one, else the newest running arc. Null when nothing is running, so a
 * Creator with no arc has no life event invented for them in a DM either. Raw project text: the
 * caller protects it, as the post path does.
 */
export function slurpArcLifeLine(projects: readonly SlurpProject[]): string | null {
  const active = activeSlurpProjects(projects);
  const arc = active.find((project) => project.intensity === "focus") ?? active[0];
  if (!arc) return null;
  const chapter = slurpProjectChapter(arc);
  const line = chapter ? `${arc.title} (${chapter})` : arc.title;
  const choice = arc.choices[arc.chapter];
  const lastPoll = [...arc.history].reverse().find((entry) => entry.poll)?.poll;
  return [
    line,
    ...(arc.partnerNames?.length ? [`together with ${arc.partnerNames.join(" and ")}`] : []),
    ...(arc.tone ? [`tone: ${arc.tone}`] : []),
    ...(choice
      ? [`fans are voting on: ${choice.question}`]
      : lastPoll
        ? [`fans voted "${lastPoll.question}": ${lastPoll.winner}`]
        : []),
  ].join(", ");
}

/**
 * The project as prompt text. One block, so the caller does not assemble it in three places.
 *
 * Takes already-protected strings. Identity protection belongs to the caller that knows the
 * disclosure mode; passing raw project text through here would leak a Secret Creator's city
 * because they typed it into a direction field.
 *
 * The block states the thread and then refuses two specific failures: restating the last post,
 * and announcing an outcome the feed has not shown. Both are what turn a project into a summary
 * of itself rather than a story that is still happening.
 */
export function slurpProjectInstruction(input: {
  title: string;
  direction: string;
  chapter: string | null;
  /** Free tone ("cozy", "dark"). Empty adds nothing. */
  tone?: string;
  /** A one-shot Director twist for this post. Empty adds nothing. */
  twist?: string;
  /** An open choice this post puts to the fans. The poll itself is attached by the caller. */
  choice?: { question: string; options: readonly string[] } | null;
  /** This project's own recent posts, newest last, already formatted and protected. */
  history: readonly string[];
  /** A crossover's other Creators by public display name. Empty for a single-Creator arc. */
  partners?: readonly string[];
}): string {
  return [
    "# Ongoing project",
    `Title: ${input.title}`,
    ...(input.direction ? [`What this is about: ${input.direction}`] : []),
    ...(input.partners?.length
      ? [
          `This is a shared story with ${input.partners.join(" and ")}. They post their side of it; write only your own side, from your point of view.`,
        ]
      : []),
    ...(input.chapter ? [`Where you are now: ${input.chapter}`] : []),
    ...(input.tone ? [`Tone: ${input.tone}. Write this thread in that tone.`] : []),
    ...(input.twist ? [`Twist for this post: ${input.twist}. Show it happening in this post.`] : []),
    ...(input.choice
      ? [
          `Your fans decide what happens next. In this post, ask them in your own voice: ${input.choice.question} (options: ${input.choice.options.join(" / ")}). A poll with those options is attached for you, so do not list them as a poll and do not decide the answer.`,
        ]
      : []),
    ...(input.history.length ? ["Your last posts in this project:", ...input.history.map((line) => `- ${line}`)] : []),
    "This post continues that thread. Do not restate what those posts already said, and do not claim anything has happened that they have not shown happening yet.",
    "This is what the post is about. The angle above still decides where you are and how the picture is taken.",
  ].join("\n");
}

const daysInChapter = (project: SlurpProject, at: Date) =>
  (at.getTime() - Date.parse(project.chapterStartedAt || project.startedAt)) / 86_400_000 || 0;

function nextChapter(project: SlurpProject, at: Date): SlurpProject {
  const updatedAt = at.toISOString();
  const next = project.chapter + 1;
  return next >= project.chapters.length
    ? { ...project, chapter: project.chapters.length - 1, status: "complete", updatedAt }
    : { ...project, chapter: next, chapterStartedAt: updatedAt, updatedAt };
}

/**
 * Move a project on by one published post.
 *
 * Called after publication, never at generation: a project that advanced when a post was drafted
 * would skip a chapter every time a generation failed, and the feed would tell a story with holes.
 *
 * A chapter with a day range stays put until its minimum has passed, so a Creator who posts four
 * times a day does not pack, move, and settle in before lunch.
 *
 * An open-ended project never completes on its own. There is no last chapter to pass, and guessing
 * that a thread has ended is the one judgement the player has to make.
 */
export function slurpProjectAdvance(
  project: SlurpProject,
  at: Date,
  pace: SlurpArcPace = SLURP_DEFAULT_ARC_PACE,
  /** The published post, when it carries this chapter's poll. Opens the poll for `hours`. */
  poll?: { postId: string; hours: number },
): SlurpProject {
  const posted = { ...project, posts: project.posts + 1, updatedAt: at.toISOString() };
  if (project.chapters.length === 0) return posted;
  // A chapter with an open choice waits for its poll to be settled, however many posts go by.
  if (project.choices[project.chapter])
    return project.pollPostId || !poll
      ? posted
      : {
          ...posted,
          pollPostId: poll.postId,
          pollClosesAt: new Date(at.getTime() + poll.hours * 3_600_000).toISOString(),
        };
  const days = project.phaseDays[project.chapter];
  if (days && daysInChapter(project, at) < days.min * PACE_MULTIPLIER[pace]) return posted;
  return nextChapter(posted, at);
}

/**
 * Move a project on because its chapter's time ran out, posted or not.
 *
 * Without this a move stalls forever on a Creator who stopped posting. Chapters without a day
 * range never time out: they have no clock to run out. An open-ended arc with a duration finishes
 * when the duration runs out.
 */
export function slurpProjectTick(
  project: SlurpProject,
  at: Date,
  pace: SlurpArcPace = SLURP_DEFAULT_ARC_PACE,
): SlurpProject {
  if (project.status !== "active") return project;
  if (project.chapters.length === 0) {
    const elapsed = (at.getTime() - Date.parse(project.startedAt)) / 86_400_000;
    return project.durationDays && elapsed >= project.durationDays * PACE_MULTIPLIER[pace]
      ? { ...project, status: "complete", updatedAt: at.toISOString() }
      : project;
  }
  // Settled by `slurpProjectChoose` once `slurpProjectPollDue` says so, never by the clock alone.
  if (project.choices[project.chapter]) return project;
  const days = project.phaseDays[project.chapter];
  if (!days || daysInChapter(project, at) < days.max * PACE_MULTIPLIER[pace]) return project;
  return nextChapter(project, at);
}

/**
 * Whether the open choice should be settled now: its poll has closed, or no poll ever published
 * and the chapter's time ran out (so a Creator who stopped posting does not stall the arc).
 */
export function slurpProjectPollDue(
  project: SlurpProject,
  at: Date,
  pace: SlurpArcPace = SLURP_DEFAULT_ARC_PACE,
): boolean {
  if (project.status !== "active" || !project.choices[project.chapter]) return false;
  if (project.pollClosesAt) return Date.parse(project.pollClosesAt) <= at.getTime();
  const days = project.phaseDays[project.chapter];
  return Boolean(days) && daysInChapter(project, at) >= days!.max * PACE_MULTIPLIER[pace];
}

/**
 * Simulated audience votes, one count per option: 3–12 fans, each seeded on the arc, the chapter,
 * and the fan, so a repeated tick gives the same result. No model call.
 */
export function slurpArcFanVotes(project: SlurpProject, options: number): number[] {
  const counts = Array.from({ length: options }, () => 0);
  if (options < 1) return counts;
  const seedKey = `${project.id}:${project.chapter}`;
  const fans = 3 + (hash(`${seedKey}:fans`) % 10);
  for (let fan = 0; fan < fans; fan += 1) counts[hash(`${seedKey}:${fan}`) % options]! += 1;
  return counts;
}

/**
 * Settle the open choice on the current chapter: insert the chosen option's chapters after it,
 * record the result on this visit, and move on. `option` is the Director's pick; without one the
 * most votes win, and a tie (or nobody voting) is a pick among the leaders seeded on the arc and
 * chapter. Null when there is no open choice or the option does not exist.
 */
export function slurpProjectChoose(
  project: SlurpProject,
  at: Date,
  votes: readonly number[],
  option: number | null = null,
): SlurpProject | null {
  const choice = project.choices[project.chapter];
  if (!choice || (project.status !== "active" && project.status !== "paused")) return null;
  if (option !== null && !(Number.isInteger(option) && option >= 0 && option < choice.options.length)) return null;
  const counts = choice.options.map((_, index) => Math.max(0, Math.floor(votes[index] ?? 0)));
  const top = Math.max(...counts);
  const leaders = counts.flatMap((count, index) => (count === top ? [index] : []));
  const picked = option ?? leaders[hash(`${project.id}:${project.chapter}:choice`) % leaders.length]!;
  const winner = choice.options[picked]!;
  const branch = winner.chapters.slice(0, Math.max(0, SLURP_PROJECT_MAX_CHAPTERS - project.chapters.length));
  const after = project.chapter + 1;
  const spread = <T>(list: readonly (T | null)[], items: (T | null)[]) => {
    const full: (T | null)[] = project.chapters.map((_, index) => list[index] ?? null);
    full.splice(after, 0, ...items);
    return full;
  };
  const poll: SlurpArcPollResult = {
    question: choice.question,
    winner: winner.label,
    votes: choice.options.map((entry, index) => ({ label: entry.label, count: counts[index]! })),
    decidedBy: option !== null ? "director" : top > 0 ? "fans" : "chance",
  };
  const settled: SlurpProject = {
    ...project,
    chapters: [
      ...project.chapters.slice(0, after),
      ...branch.map((chapter) => chapter.label),
      ...project.chapters.slice(after),
    ],
    phaseDays: spread(
      project.phaseDays,
      branch.map((chapter) => ({ min: chapter.minDays, max: Math.max(chapter.minDays, chapter.maxDays) })),
    ),
    choices: spread(
      project.choices.map((entry, index) => (index === project.chapter ? null : entry)),
      branch.map(() => null),
    ),
    reach: spread(
      project.reach,
      branch.map(() => null),
    ),
    pollPostId: null,
    pollClosesAt: null,
    history: project.history.map((entry, index, list) => (index === list.length - 1 ? { ...entry, poll } : entry)),
  };
  return slurpProjectRecord(settled, nextChapter(settled, at), at);
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
