import {
  SLURP_PROJECT_TITLE_MAX_LENGTH,
  SLURP_PROJECT_DIRECTION_MAX_LENGTH,
  SLURP_PROJECT_CHAPTER_MAX_LENGTH,
  SLURP_PROJECT_MAX_CHAPTERS,
  SLURP_PROJECT_MAX_ACTIVE,
  SlurpProjectStatus,
  SLURP_ARC_PACES,
  SlurpArcPace,
  readSlurpArcChapterReach,
  readSlurpArcChoice,
  SlurpProject,
  isSlurpCrossover,
  SlurpArcOrigin,
  SlurpArcType,
  DAY_MS,
  hash,
  clampText,
  readDays,
  readSlurpProject,
  makeSlurpProject,
} from "./slp-project.js";

export const SLURP_ARC_TYPE_NAME_MAX_LENGTH = 80;
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

export const SLURP_ARC_AUTO_MODES = ["off", "suggest", "auto"] as const;

export type SlurpArcAutoMode = (typeof SLURP_ARC_AUTO_MODES)[number];

/**
 * Off by default. The whole reason arcs exist is that every Creator used to be moving house without
 * anybody asking for it; turning life events back on by default would repeat that.
 */
export const SLURP_DEFAULT_ARC_AUTO_MODE: SlurpArcAutoMode = "off";

/** When an automatic arc was last started or suggested for this Creator, for the cooldown. */
export const slurpArcAutoKey = (creatorAccountId: string) => `slurp2.creator.${creatorAccountId}.arcAutoAt`;
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
