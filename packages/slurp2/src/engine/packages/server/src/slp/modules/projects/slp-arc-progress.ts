import { type SlurpModifierKind } from "../creators/slp-creator-state.js";
import {
  SLURP_PROJECT_CHAPTER_MAX_LENGTH,
  SLURP_PROJECT_MAX_CHAPTERS,
  SlurpArcPace,
  SLURP_DEFAULT_ARC_PACE,
  SlurpArcEffectStat,
  SlurpArcStatEffects,
  SLURP_ARC_STAT_EFFECT_CAP,
  SlurpArcProfileChange,
  SlurpArcPollResult,
  SlurpProject,
  SLURP_ARC_TWIST_MAX_LENGTH,
  SLURP_ARC_RANDOM_TWISTS,
  hash,
  clampText,
  slurpProjectRecord,
} from "./slp-project.js";

const PACE_MULTIPLIER: Record<SlurpArcPace, number> = { slow: 1.5, normal: 1, fast: 0.5 };

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
