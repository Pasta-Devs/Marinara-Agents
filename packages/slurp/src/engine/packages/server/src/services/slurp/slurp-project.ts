/**
 * A thread a Creator keeps posting about.
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

export const SLURP_PROJECT_STATUSES = ["active", "paused", "complete"] as const;

export type SlurpProjectStatus = (typeof SLURP_PROJECT_STATUSES)[number];

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
};

/** Storage key for one Creator's projects. Mirrors the goal and earnings key shape. */
export const slurpProjectsKey = (creatorAccountId: string) => `slurp.creator.${creatorAccountId}.projects`;

const clampText = (value: unknown, max: number): string =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

const readChapters = (value: unknown): string[] =>
  Array.isArray(value)
    ? value
        .map((entry) => clampText(entry, SLURP_PROJECT_CHAPTER_MAX_LENGTH))
        .filter(Boolean)
        .slice(0, SLURP_PROJECT_MAX_CHAPTERS)
    : [];

/**
 * Read one stored project, or null when there is not a usable one.
 *
 * Exported so the storage layer and the tests read a project the same way. A project missing its
 * title is dropped rather than repaired: an untitled thread cannot be chosen or cancelled, and a
 * silent placeholder would leave the player unable to get rid of it.
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
  const startedAt = typeof raw.startedAt === "string" && !Number.isNaN(Date.parse(raw.startedAt)) ? raw.startedAt : "";
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

/** Build a project. Returns null when there is no title, which is the one field it cannot invent. */
export function makeSlurpProject(
  id: string,
  input: { title: string; direction?: string; chapters?: string[] },
  at: Date,
): SlurpProject | null {
  const timestamp = at.toISOString();
  return readSlurpProject({
    id,
    title: input.title,
    direction: input.direction ?? "",
    chapters: input.chapters ?? [],
    chapter: 0,
    status: "active",
    posts: 0,
    startedAt: timestamp,
    updatedAt: timestamp,
  });
}

/** The projects that may claim a post. Paused and complete projects keep everything and claim nothing. */
export function activeSlurpProjects(projects: readonly SlurpProject[]): SlurpProject[] {
  return projects.filter((project) => project.status === "active");
}

/** The chapter a project is on, or null for an open-ended one. */
export function slurpProjectChapter(project: SlurpProject): string | null {
  return project.chapters[project.chapter] ?? null;
}

/**
 * Move a project on by one published post.
 *
 * Called after publication, never at generation: a project that advanced when a post was drafted
 * would skip a chapter every time a generation failed, and the feed would tell a story with holes.
 *
 * An open-ended project never completes on its own. There is no last chapter to pass, and guessing
 * that a thread has ended is the one judgement the player has to make.
 */
export function slurpProjectAdvance(project: SlurpProject, at: Date): SlurpProject {
  const posts = project.posts + 1;
  const updatedAt = at.toISOString();
  if (project.chapters.length === 0) return { ...project, posts, updatedAt };
  const next = project.chapter + 1;
  return next >= project.chapters.length
    ? { ...project, posts, chapter: project.chapters.length - 1, status: "complete", updatedAt }
    : { ...project, posts, chapter: next, updatedAt };
}
