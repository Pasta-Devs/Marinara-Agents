import { createSlpPoll } from "../../../../../shared/src/slp/slp-polls.js";
import type { SlpPoll } from "../../../../../shared/src/slp/slp-social.types.js";
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
import { slpStorylineEdges, slpStorylineNext } from "../../../../../shared/src/slp/slp-storyline.js";
import { slurpProjectSync, slurpProjectView, slurpStageInsert, slurpStoryLine } from "./slp-project-storyline.js";

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
  "hold",
  "release",
  "insert",
] as const;

export type SlurpArcDirectorAction = (typeof SLURP_ARC_DIRECTOR_ACTIONS)[number];

/** Chapter control: open without Director mode, because steering the storyline is the player's. */
export const SLURP_ARC_CHAPTER_ACTIONS: readonly SlurpArcDirectorAction[] = [
  "skip",
  "back",
  "label",
  "hold",
  "release",
  "insert",
];

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
  const run = slurpProjectSync(project);
  const storyline = run.storyline;
  const line = storyline ? slurpStoryLine(storyline, run.taken ?? {}) : [];
  const updatedAt = at.toISOString();
  const moveTo = (chapter: number): SlurpProject | null =>
    chapter < 0 || chapter >= line.length
      ? null
      : { ...run, stage: line[chapter]!, chapterStartedAt: updatedAt, pollPostId: null, pollClosesAt: null };
  let next: SlurpProject | null = null;
  switch (action) {
    case "pause":
      next = run.status === "active" ? { ...run, status: "paused" } : null;
      break;
    case "resume":
      next = run.status === "paused" ? { ...run, status: "active" } : null;
      break;
    case "skip": {
      // "Move on" also lets go of a held chapter.
      const moved = moveTo(run.chapter + 1);
      next = moved ? { ...moved, held: false } : null;
      break;
    }
    case "hold":
      next = run.chapters.length && !run.held ? { ...run, held: true } : null;
      break;
    case "release":
      next = run.held ? { ...run, held: false } : null;
      break;
    case "insert": {
      // A new stage right after this one, so the player can say what happens next.
      const label = clampText(value, SLURP_PROJECT_CHAPTER_MAX_LENGTH);
      next = label && line.length < SLURP_PROJECT_MAX_CHAPTERS ? slurpStageInsert(run, label) : null;
      break;
    }
    case "back":
      next = moveTo(run.chapter - 1);
      break;
    case "label": {
      const label = clampText(value, SLURP_PROJECT_CHAPTER_MAX_LENGTH);
      next =
        label && storyline
          ? {
              ...run,
              storyline: {
                ...storyline,
                stages: storyline.stages.map((stage) => (stage.key === run.stage ? { ...stage, label } : stage)),
              },
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
      next = { ...run, twist };
      break;
    }
    case "end":
      next = { ...run, status: "complete" };
      break;
  }
  return next ? slurpProjectRecord(project, slurpProjectView({ ...next, updatedAt }), at) : null;
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

/** Move to `to`, a stage or an ending, and remember the way taken. */
function enterStage(project: SlurpProject, to: string, at: Date): SlurpProject {
  const updatedAt = at.toISOString();
  const taken = project.stage ? { ...project.taken, [project.stage]: to } : { ...project.taken };
  return slurpProjectView(
    project.storyline?.stages.some((stage) => stage.key === to)
      ? { ...project, taken, stage: to, chapterStartedAt: updatedAt, updatedAt }
      : { ...project, taken, status: "complete", ending: to, updatedAt },
  );
}

/**
 * The next stage: the way taken on an earlier visit, else the first way out whose `when` holds on `tags`. A
 * choice leaves only by `slurpProjectChoose` or its `next`; a standing stage stays.
 */
function nextChapter(project: SlurpProject, at: Date, tags: ReadonlySet<string>): SlurpProject {
  const storyline = project.storyline;
  const index = storyline ? storyline.stages.findIndex((stage) => stage.key === project.stage) : -1;
  if (!storyline || index < 0) return project;
  const stage = storyline.stages[index]!;
  const edges = stage.choice
    ? stage.next === undefined
      ? null
      : slpStorylineEdges(stage.next)
    : slpStorylineNext(storyline, index);
  const to =
    project.taken?.[stage.key] ?? edges?.find((edge) => !edge.when || tags.has(edge.when.tag) === edge.when.set)?.to;
  return to ? enterStage(project, to, at) : project;
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
  /** The Creator's story tags, for `when` ways out of a stage. */
  tags: ReadonlySet<string> = new Set(),
): SlurpProject {
  const posted = { ...slurpProjectSync(project), posts: project.posts + 1, updatedAt: at.toISOString() };
  if (project.chapters.length === 0 || project.held) return posted;
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
  return nextChapter(posted, at, tags);
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
  /** The Creator's story tags, for `when` ways out of a stage. */
  tags: ReadonlySet<string> = new Set(),
): SlurpProject {
  if (project.status !== "active") return project;
  project = slurpProjectSync(project);
  if (project.chapters.length === 0) {
    const elapsed = (at.getTime() - Date.parse(project.startedAt)) / 86_400_000;
    return project.durationDays && elapsed >= project.durationDays * PACE_MULTIPLIER[pace]
      ? { ...project, status: "complete", updatedAt: at.toISOString() }
      : project;
  }
  // Settled by `slurpProjectChoose` once `slurpProjectPollDue` says so, never by the clock alone.
  if (project.choices[project.chapter] || project.held) return project;
  const days = project.phaseDays[project.chapter];
  if (!days || daysInChapter(project, at) < days.max * PACE_MULTIPLIER[pace]) return project;
  return nextChapter(project, at, tags);
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
 * Settle the open choice on the current stage: take the chosen option's way, record the result on this visit,
 * and move on. `option` is the Director's pick; without one the most votes win, and a tie (or nobody voting)
 * is a pick among the leaders seeded on the arc and the chapter. Null when there is no open choice or the
 * option does not exist.
 */
export function slurpProjectChoose(
  project: SlurpProject,
  at: Date,
  votes: readonly number[],
  option: number | null = null,
): SlurpProject | null {
  project = slurpProjectSync(project);
  const choice = project.choices[project.chapter];
  const stage = project.storyline?.stages.find((item) => item.key === project.stage);
  if (!choice || !stage?.choice || (project.status !== "active" && project.status !== "paused")) return null;
  if (option !== null && !(Number.isInteger(option) && option >= 0 && option < choice.options.length)) return null;
  const counts = choice.options.map((_, index) => Math.max(0, Math.floor(votes[index] ?? 0)));
  const top = Math.max(...counts);
  const leaders = counts.flatMap((count, index) => (count === top ? [index] : []));
  const picked = option ?? leaders[hash(`${project.id}:${project.chapter}:choice`) % leaders.length]!;
  const poll: SlurpArcPollResult = {
    question: choice.question,
    winner: choice.options[picked]!.label,
    votes: choice.options.map((entry, index) => ({ label: entry.label, count: counts[index]! })),
    decidedBy: option !== null ? "director" : top > 0 ? "fans" : "chance",
  };
  const settled: SlurpProject = {
    ...project,
    pollPostId: null,
    pollClosesAt: null,
    history: project.history.map((entry, index, list) => (index === list.length - 1 ? { ...entry, poll } : entry)),
  };
  return slurpProjectRecord(settled, enterStage(settled, stage.choice.options[picked]!.next, at), at);
}

/** A storyline's vote on this post has closed, so later votes do not land (R1-035). */
export function slurpArcVoteClosed(
  projects: readonly Pick<SlurpProject, "pollPostId" | "pollClosesAt">[],
  postId: string,
  now = Date.now(),
): boolean {
  const arc = projects.find((project) => project.pollPostId === postId);
  return Boolean(arc?.pollClosesAt && Date.parse(arc.pollClosesAt) <= now);
}

/**
 * An open arc choice, posted as a real poll on the arc's next post (attached, never parsed from the
 * text). `protect` keeps the Creator's source identity out of the question and the options.
 */
export function slurpArcPoll(
  project: SlurpProject | null,
  protect: (value: string, maxLength: number) => string | null,
): SlpPoll | null {
  const choice = project && !project.pollPostId ? (project.choices[project.chapter] ?? null) : null;
  return choice
    ? createSlpPoll({
        question: protect(choice.question, 240),
        options: choice.options.map((option) => protect(option.label, 120)),
      })
    : null;
}
