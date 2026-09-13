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

export const SLURP_ARC_KINDS = ["custom", "moving", "new_job", "trip", "fitness", "renovation", "breakup"] as const;

export type SlurpArcKind = (typeof SLURP_ARC_KINDS)[number];

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
  kind: SlurpArcKind;
  /** Day range per chapter, by index. A missing or null entry advances after every post. */
  phaseDays: (SlurpArcPhaseDays | null)[];
  /** When the current chapter began, for the day ranges. */
  chapterStartedAt: string;
  intensity: SlurpArcIntensity;
};

type Template = { title: string; direction: string; phases: readonly (readonly [string, number, number])[] };

/**
 * The shipped arc kinds. Chapters are beats, not scenes: "packing" leaves the Creator's own life to
 * say what packing looks like for them.
 */
export const SLURP_ARC_TEMPLATES: Record<Exclude<SlurpArcKind, "custom">, Template> = {
  moving: {
    title: "Moving house",
    direction: "Leaving the old place for a new one, from the decision to finally feeling at home.",
    phases: [
      ["deciding to move", 2, 5],
      ["packing up the old place", 3, 6],
      ["moving day", 1, 1],
      ["the new place is still empty", 2, 4],
      ["settling in", 4, 10],
    ],
  },
  new_job: {
    title: "A new job",
    direction: "Starting somewhere new, from the offer to finding their feet.",
    phases: [
      ["the offer", 1, 3],
      ["working out the notice period", 5, 10],
      ["the first day", 1, 1],
      ["finding their feet", 5, 12],
    ],
  },
  trip: {
    title: "A trip away",
    direction: "Getting away for a while and coming back.",
    phases: [
      ["planning the trip", 2, 5],
      ["packing", 1, 2],
      ["away", 3, 7],
      ["back home", 1, 3],
    ],
  },
  fitness: {
    title: "Getting in shape",
    direction: "A real attempt at getting fitter, with the boring middle left in.",
    phases: [
      ["the decision", 1, 3],
      ["the first weeks", 7, 14],
      ["the plateau", 5, 10],
      ["starting to see it", 7, 14],
    ],
  },
  renovation: {
    title: "Redoing a room",
    direction: "Fixing up one room, mess included.",
    phases: [
      ["picking a plan", 2, 5],
      ["tearing it out", 2, 4],
      ["living in the mess", 5, 10],
      ["the reveal", 1, 2],
    ],
  },
  breakup: {
    title: "A breakup",
    direction: "A relationship ending and life carrying on after it.",
    phases: [
      ["it ended", 1, 2],
      ["the raw part", 4, 8],
      ["going out again", 5, 10],
      ["fine, actually", 4, 8],
    ],
  },
};

/** Storage key for one Creator's projects. Mirrors the goal and earnings key shape. */
export const slurpProjectsKey = (creatorAccountId: string) => `slurp2.creator.${creatorAccountId}.projects`;

export const SLURP_ARC_AUTO_MODES = ["off", "suggest", "auto"] as const;

export type SlurpArcAutoMode = (typeof SLURP_ARC_AUTO_MODES)[number];

/**
 * Off by default. The whole reason arcs exist is that every Creator used to be moving house without
 * anybody asking for it; turning life events back on by default would repeat that.
 */
export const SLURP_DEFAULT_ARC_AUTO_MODE: SlurpArcAutoMode = "off";

export const SLURP_TEMPLATED_ARC_KINDS = SLURP_ARC_KINDS.filter(
  (kind): kind is Exclude<SlurpArcKind, "custom"> => kind !== "custom",
);

/** A breakup is a heavy thing to hand a Creator unasked, so automatic arcs leave it out unless chosen. */
export const SLURP_DEFAULT_ARC_ALLOWED_KINDS = SLURP_TEMPLATED_ARC_KINDS.filter((kind) => kind !== "breakup");

/** When an automatic arc was last started or suggested for this Creator, for the cooldown. */
export const slurpArcAutoKey = (creatorAccountId: string) => `slurp2.creator.${creatorAccountId}.arcAutoAt`;

const WEEK_MS = 7 * 86_400_000;

function hash(value: string): number {
  let out = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    out ^= value.charCodeAt(index);
    out = Math.imul(out, 0x01000193);
  }
  return out >>> 0;
}

/**
 * The arc kind to start for a Creator right now, or null.
 *
 * Deterministic, like audience arcs: seeded on the Creator and the week, so running the world tick
 * twice cannot start two arcs, and the same week always gives the same answer. Only one eligible
 * week in three rolls an arc, so a fresh install does not hand every Creator a life event at once.
 *
 * A Creator who already has a running or suggested arc gets nothing: automatic arcs fill silence,
 * they never stack on a story the player is already telling.
 */
export function slurpAutoArcKind(input: {
  creatorAccountId: string;
  at: Date;
  projects: readonly SlurpProject[];
  allowed: readonly SlurpArcKind[];
  lastAutoAt: string | null;
  cooldownWeeks: number;
}): Exclude<SlurpArcKind, "custom"> | null {
  if (input.projects.some((project) => project.status === "active" || project.status === "suggested")) return null;
  const allowed = SLURP_TEMPLATED_ARC_KINDS.filter((kind) => input.allowed.includes(kind));
  if (allowed.length === 0) return null;
  const last = input.lastAutoAt ? Date.parse(input.lastAutoAt) : Number.NaN;
  if (Number.isFinite(last) && input.at.getTime() - last < Math.max(1, input.cooldownWeeks) * WEEK_MS) return null;
  const roll = hash(`${input.creatorAccountId}:${Math.floor(input.at.getTime() / WEEK_MS)}`);
  if (roll % 3 !== 0) return null;
  return allowed[(roll >>> 2) % allowed.length]!;
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
 * is exactly how they behaved.
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
    kind: (SLURP_ARC_KINDS as readonly string[]).includes(String(raw.kind)) ? (raw.kind as SlurpArcKind) : "custom",
    phaseDays: readPhaseDays(raw.phaseDays, chapters.length),
    chapterStartedAt: validDate(raw.chapterStartedAt) ? raw.chapterStartedAt : startedAt,
    intensity: raw.intensity === "focus" ? "focus" : "background",
  };
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
 * A templated kind with no chapters of its own takes the template's chapters, day ranges, and, when
 * left blank, its title and direction. Chapters the player typed win over the template.
 */
export function makeSlurpProject(
  id: string,
  input: {
    title?: string;
    direction?: string;
    chapters?: string[];
    kind?: SlurpArcKind;
    intensity?: SlurpArcIntensity;
  },
  at: Date,
): SlurpProject | null {
  const timestamp = at.toISOString();
  const kind = input.kind ?? "custom";
  const template = kind === "custom" ? null : SLURP_ARC_TEMPLATES[kind];
  const useTemplate = Boolean(template) && !input.chapters?.length;
  return readSlurpProject({
    id,
    title: input.title?.trim() || template?.title || "",
    direction: input.direction?.trim() || template?.direction || "",
    chapters: useTemplate ? template!.phases.map(([label]) => label) : (input.chapters ?? []),
    phaseDays: useTemplate ? template!.phases.map(([, min, max]) => ({ min, max })) : [],
    chapter: 0,
    status: "active",
    posts: 0,
    startedAt: timestamp,
    updatedAt: timestamp,
    chapterStartedAt: timestamp,
    kind,
    intensity: input.intensity ?? "background",
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
  return chapter ? `${arc.title} (${chapter})` : arc.title;
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
  /** This project's own recent posts, newest last, already formatted and protected. */
  history: readonly string[];
}): string {
  return [
    "# Ongoing project",
    `Title: ${input.title}`,
    ...(input.direction ? [`What this is about: ${input.direction}`] : []),
    ...(input.chapter ? [`Where you are now: ${input.chapter}`] : []),
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
): SlurpProject {
  const posted = { ...project, posts: project.posts + 1, updatedAt: at.toISOString() };
  if (project.chapters.length === 0) return posted;
  const days = project.phaseDays[project.chapter];
  if (days && daysInChapter(project, at) < days.min * PACE_MULTIPLIER[pace]) return posted;
  return nextChapter(posted, at);
}

/**
 * Move a project on because its chapter's time ran out, posted or not.
 *
 * Without this a move stalls forever on a Creator who stopped posting. Chapters without a day
 * range never time out: they have no clock to run out.
 */
export function slurpProjectTick(
  project: SlurpProject,
  at: Date,
  pace: SlurpArcPace = SLURP_DEFAULT_ARC_PACE,
): SlurpProject {
  if (project.status !== "active") return project;
  const days = project.phaseDays[project.chapter];
  if (!days || daysInChapter(project, at) < days.max * PACE_MULTIPLIER[pace]) return project;
  return nextChapter(project, at);
}
