/**
 * A project runs on its own copy of a storyline (docs/STORYLINES.md, PR 3). `storyline`, `stage` and `taken`
 * are the truth; the chapter fields every reader uses (`chapters`, `chapter`, `phaseDays`, `choices`, `reach`)
 * are the view of the line the run walks, rebuilt after every move. A caller that edits those fields directly
 * (the editor, a record stored before PR 3) gets a storyline rebuilt from them, each stage keeping its content
 * by label. Pure.
 */
import {
  SLP_STORYLINE_MAX_DAYS,
  SLP_STORYLINE_MAX_STAGES,
  slpStorylineEdges,
  slpStorylineNext,
  slpStorylineObjectSchema,
  slpStorylineStageSchema,
  type SlpStoryline,
  type SlpStorylineOutcome,
  type SlpStorylineStage,
} from "../../../../../shared/src/slp/slp-storyline.js";
import { slpStorylineDraftFromArc } from "../../../../../shared/src/slp/slp-storyline-v1.js";
import {
  SLP_STORY_TRACKS,
  slpArcBlueprintSchema,
  slpStoryOutcomeSchema,
  type SlpStoryOutcome,
} from "../../../../../shared/src/slp/slp-story-engine.js";
import type { SlurpArcChapterReach, SlurpArcChoice, SlurpArcPhaseDays, SlurpProject } from "./slp-project.js";

const END = { key: "end", label: "End" };

const stageOf = (storyline: SlpStoryline, key: string | null | undefined) =>
  storyline.stages.find((stage) => stage.key === key);

/** Where a stage goes when nothing picks: the way the run took, else the edge without `when`, else a choice's default. */
export function slurpStageDefault(storyline: SlpStoryline, key: string, taken: Record<string, string>): string | null {
  if (taken[key]) return taken[key];
  const index = storyline.stages.findIndex((stage) => stage.key === key);
  const stage = storyline.stages[index];
  if (!stage) return null;
  if (stage.next !== undefined) return slpStorylineEdges(stage.next).at(-1)!.to;
  if (stage.choice) return stage.choice.options[stage.choice.default]?.next ?? null;
  return slpStorylineNext(storyline, index)?.at(-1)?.to ?? null;
}

/** The stages the run walks, first to last: the ways taken, then the defaults. */
export function slurpStoryLine(storyline: SlpStoryline, taken: Record<string, string>): string[] {
  const line: string[] = [];
  let key = storyline.stages[0]?.key ?? null;
  while (key && !line.includes(key) && stageOf(storyline, key)) {
    line.push(key);
    key = slurpStageDefault(storyline, key, taken);
  }
  return line;
}

const phaseOf = (stage: SlpStorylineStage): SlurpArcPhaseDays | null =>
  stage.days && stage.days[1] > 0 ? { min: stage.days[0], max: stage.days[1] } : null;

function reachOf(stage: SlpStorylineStage): SlurpArcChapterReach | null {
  const { mood, effects, profile } = stage.condition ?? {};
  return mood || effects || profile
    ? { ...(mood ? { mood } : {}), ...(effects ? { effects } : {}), ...(profile ? { profile } : {}) }
    : null;
}

/** An open choice as the chapter fields show it: each option's stages until it meets the line again. */
function choiceOf(storyline: SlpStoryline, stage: SlpStorylineStage, ahead: ReadonlySet<string>): SlurpArcChoice {
  return {
    question: stage.choice!.question,
    options: stage.choice!.options.map((option) => {
      const chapters: SlurpArcChoice["options"][number]["chapters"] = [];
      for (let key: string | null = option.next; key && !ahead.has(key) && chapters.length < 40;) {
        const branch = stageOf(storyline, key);
        if (!branch) break;
        chapters.push({ label: branch.label, minDays: branch.days?.[0] ?? 0, maxDays: branch.days?.[1] ?? 0 });
        key = slurpStageDefault(storyline, key, {});
      }
      return { label: option.label, chapters };
    }),
  };
}

// A list with nothing in it stays empty, as `makeSlurpProject` stores it.
const compact = <T>(list: (T | null)[], before: readonly unknown[]) =>
  list.some(Boolean) || before.length ? list : [];

/** The chapter fields from the storyline. An open-ended project (no storyline) is returned as it is. */
export function slurpProjectView(project: SlurpProject): SlurpProject {
  const storyline = project.storyline;
  if (!storyline) return project;
  const taken = project.taken ?? {};
  const line = slurpStoryLine(storyline, taken);
  const stages = line.map((key) => stageOf(storyline, key)!);
  const chapter = Math.max(0, line.indexOf(project.stage ?? ""));
  return {
    ...project,
    stage: line[chapter] ?? null,
    taken,
    chapters: stages.map((stage) => stage.label),
    chapter,
    phaseDays: compact(stages.map(phaseOf), project.phaseDays),
    choices: compact(
      stages.map((stage, index) =>
        stage.choice && !taken[stage.key] ? choiceOf(storyline, stage, new Set(line.slice(index + 1))) : null,
      ),
      project.choices,
    ),
    reach: compact(stages.map(reachOf), project.reach),
  };
}

type StageContent = Partial<
  Pick<SlpStorylineStage, "guidance" | "minSpice" | "influences" | "beats" | "deck" | "enter" | "leave">
> & { condition?: SlpStorylineStage["condition"] };

/** A stage's content beyond what the chapter fields hold, found by label. */
function contentOf(content: SlpStoryline | null, label: string): StageContent {
  const stage = content?.stages.find((item) => item.label === label);
  if (!stage) return {};
  const { guidance, minSpice, influences, beats, deck, enter, leave, condition } = stage;
  return Object.fromEntries(
    Object.entries({ guidance, minSpice, influences, beats, deck, enter, leave, condition }).filter(
      (entry) => entry[1] !== undefined,
    ),
  );
}

/**
 * A storyline from the chapter fields: a stage per chapter (`c<n>`), a fans' choice leading into its branch
 * stages (`c<n>-<option>-<step>`) and on, then one ending. `content` gives each stage its outcomes, condition
 * and moments by label, and the storyline its cast, track and endings. Null for a project without chapters.
 */
export function slurpProjectStorylineFrom(project: SlurpProject, content: SlpStoryline | null): SlpStoryline | null {
  if (!project.chapters.length) return null;
  const ending = content?.endings[0]?.key ?? END.key;
  const build = (withChoices: boolean) => {
    const stages: Record<string, unknown>[] = [];
    // Branch stages share what the chapters leave of the stage limit; a long branch is cut, as v1 did.
    let budget = SLP_STORYLINE_MAX_STAGES - project.chapters.length;
    project.chapters.forEach((label, index) => {
      const key = `c${index + 1}`;
      const after = index + 1 < project.chapters.length ? `c${index + 2}` : ending;
      const days = project.phaseDays[index];
      const { condition, ...rest } = contentOf(content, label);
      const { mood, effects, profile } = project.reach[index] ?? {};
      const open = withChoices ? project.choices[index] : null;
      const total = open?.options.reduce((sum, option) => sum + option.chapters.length, 0) ?? 0;
      const per = total <= budget ? Infinity : Math.floor(budget / (open?.options.length ?? 1));
      const choice = open && {
        ...open,
        options: open.options.map((option) => ({ ...option, chapters: option.chapters.slice(0, per) })),
      };
      budget -= choice?.options.reduce((sum, option) => sum + option.chapters.length, 0) ?? 0;
      const merged = { ...condition, mood, effects, profile };
      stages.push({
        ...rest,
        key,
        label,
        ...(days ? { days: [days.min, Math.max(days.min, days.max)] } : {}),
        ...(Object.values(merged).some((value) => value !== undefined)
          ? { condition: Object.fromEntries(Object.entries(merged).filter((entry) => entry[1] !== undefined)) }
          : {}),
        ...(choice
          ? {
              choice: {
                asks: "fans",
                question: choice.question,
                default: 0,
                options: choice.options.map((option, at) => ({
                  label: option.label,
                  next: option.chapters.length ? `${key}-${at + 1}-1` : after,
                })),
              },
            }
          : {}),
        next: after,
      });
      choice?.options.forEach((option, at) =>
        option.chapters.forEach((branch, step) =>
          stages.push({
            ...contentOf(content, branch.label),
            key: `${key}-${at + 1}-${step + 1}`,
            label: branch.label,
            ...(branch.maxDays > 0 ? { days: [branch.minDays, Math.max(branch.minDays, branch.maxDays)] } : {}),
            next: step + 1 < option.chapters.length ? `${key}-${at + 1}-${step + 2}` : after,
          }),
        ),
      );
    });
    return slpStorylineObjectSchema.safeParse({
      id: content?.id ?? `project:${project.id}`.slice(0, 160),
      name: project.title.slice(0, 80) || "Arc",
      cast: content?.cast ?? [{ key: "creator" }],
      ...(content?.track ? { track: content.track } : {}),
      maxDays: SLP_STORYLINE_MAX_DAYS,
      stages,
      endings: content?.endings.length ? content.endings : [END],
      revertProfileAtEnd: project.revertProfileAtEnd,
      ...(content?.source ? { source: content.source } : {}),
    });
  };
  // Anything else unusable in the fields: a run without its open choices still runs.
  const parsed = build(true);
  return parsed.success ? parsed.data : (build(false).data ?? null);
}

/**
 * A record stored before PR 3 has no storyline copy, so it was rebuilt without its type's outcomes. With the
 * library type at hand, rebuild it with them; anything else is returned as it is.
 */
export function slurpProjectWithType(project: SlurpProject, type: unknown): SlurpProject {
  if (!project.storyline?.id.startsWith("project:")) return project;
  const blueprint = slpArcBlueprintSchema.safeParse(type);
  const content = blueprint.success
    ? slpStorylineObjectSchema.safeParse(slpStorylineDraftFromArc(blueprint.data))
    : null;
  if (!content?.success) return project;
  const storyline = slurpProjectStorylineFrom(project, content.data);
  return storyline ? slurpProjectView({ ...project, storyline }) : project;
}

const canon = (value: unknown) =>
  JSON.stringify(value, (_key, item) =>
    item && typeof item === "object" && !Array.isArray(item) ? Object.fromEntries(Object.entries(item).sort()) : item,
  );
const shape = (project: SlurpProject) => canon([project.chapters, project.phaseDays, project.choices, project.reach]);

/**
 * The project with its storyline and chapter fields agreeing. Chapter fields edited by hand win: a moved
 * `chapter` follows the line, any other edit rebuilds the storyline from the fields.
 */
export function slurpProjectSync(project: SlurpProject): SlurpProject {
  if (project.storyline) {
    const view = slurpProjectView(project);
    if (shape(view) === shape(project)) {
      // Already in agreement: the same object back, so callers can tell nothing moved.
      if (view.chapter === project.chapter) return view.stage === project.stage && project.taken ? project : view;
      // ponytail: a hand-moved pointer leaves `taken` as it is, so the line ahead stays the one shown.
      return slurpProjectView({ ...project, stage: slurpStoryLine(project.storyline, view.taken!)[project.chapter] });
    }
  } else if (!project.chapters.length) return project;
  const storyline = slurpProjectStorylineFrom(project, project.storyline ?? null);
  return slurpProjectView({ ...project, storyline, stage: storyline ? `c${project.chapter + 1}` : null, taken: {} });
}

const storyOnly = (outcomes: readonly SlpStorylineOutcome[]) =>
  outcomes.filter((outcome): outcome is SlpStoryOutcome => slpStoryOutcomeSchema.safeParse(outcome).success);

/** A stage's condition as a Creator condition: set on entering, removed on leaving. */
type CreatorFact = Extract<SlpStoryOutcome, { kind: "add-creator-fact" }>;

function conditionFact(storyline: SlpStoryline, stage: SlpStorylineStage): CreatorFact | null {
  const condition = stage.condition;
  if (!condition?.tag) return null;
  const { tag, label, line, look, wardrobe, deck, share } = condition;
  const track = condition.track ?? SLP_STORY_TRACKS.find((item) => item === storyline.track);
  return {
    kind: "add-creator-fact",
    tag,
    label: label ?? stage.label.slice(0, 120),
    ...(track ? { track } : {}),
    ...(line ? { line } : {}),
    ...(look ? { look } : {}),
    ...(wardrobe ? { wardrobe } : {}),
    ...(deck ? { deck } : {}),
    ...(share !== undefined ? { share } : {}),
  } as CreatorFact;
}

/**
 * What a move writes, in order: the stage left (its `leave` outcomes, its condition removed), then the stage
 * entered (its condition, its `enter` outcomes) or the ending reached (its outcomes). Drama outcomes (ties)
 * wait for PR 4.
 */
export function slurpStageOutcomes(
  storyline: SlpStoryline,
  move: { leave?: string | null; enter?: string | null; ending?: string | null },
): SlpStoryOutcome[] {
  const left = stageOf(storyline, move.leave);
  const entered = stageOf(storyline, move.enter);
  const leftFact = left && conditionFact(storyline, left);
  const enteredFact = entered && conditionFact(storyline, entered);
  return [
    ...(left ? storyOnly(left.leave) : []),
    ...(leftFact && leftFact.tag !== enteredFact?.tag
      ? [{ kind: "remove-creator-fact" as const, tag: leftFact.tag }]
      : []),
    ...(enteredFact ? [enteredFact] : []),
    ...(entered ? storyOnly(entered.enter) : []),
    ...storyOnly(storyline.endings.find((ending) => ending.key === move.ending)?.outcomes ?? []),
  ];
}

const outs = (stage: SlpStorylineStage) => [
  ...(stage.choice?.options.map((option) => option.next) ?? []),
  ...(stage.next === undefined ? [] : slpStorylineEdges(stage.next).map((edge) => edge.to)),
];

/**
 * A new stage right after the current one (Director `insert`). Every way out of the current stage and of the
 * branches it opens that met the line at the next stage now passes the new stage first, so a fans' choice
 * still decides before it.
 */
export function slurpStageInsert(project: SlurpProject, label: string): SlurpProject | null {
  const storyline = project.storyline;
  const current = project.stage;
  if (!storyline || !current || storyline.stages.length >= SLP_STORYLINE_MAX_STAGES) return null;
  const taken = project.taken ?? {};
  const target = slurpStageDefault(storyline, current, taken);
  if (!target) return null;
  let number = 1;
  while (storyline.stages.some((stage) => stage.key === `p${number}`)) number += 1;
  const key = `p${number}`;
  // Ways to "the following stage" are written out first, so the new stage's place in the list moves nothing.
  const stages = storyline.stages.map((stage, index) =>
    stage.next === undefined && !stage.choice && stage.days
      ? { ...stage, next: slpStorylineNext(storyline, index)?.[0]?.to }
      : stage,
  );
  const region = new Set<string>();
  for (const queue = [current]; queue.length;) {
    const at = queue.pop()!;
    const stage = stages.find((item) => item.key === at);
    if (at === target || region.has(at) || !stage) continue;
    region.add(at);
    queue.push(...outs(stage), ...(taken[at] ? [taken[at]] : []));
  }
  const swap = (to: string) => (to === target ? key : to);
  const rewired = stages.map((stage) =>
    region.has(stage.key)
      ? {
          ...stage,
          ...(stage.choice
            ? {
                choice: {
                  ...stage.choice,
                  options: stage.choice.options.map((option) => ({ ...option, next: swap(option.next) })),
                },
              }
            : {}),
          ...(stage.next === undefined
            ? {}
            : {
                next:
                  typeof stage.next === "string"
                    ? swap(stage.next)
                    : stage.next.map((edge) => ({ ...edge, to: swap(edge.to) })),
              }),
        }
      : stage,
  ) as SlpStorylineStage[];
  rewired.splice(
    rewired.findIndex((stage) => stage.key === current) + 1,
    0,
    slpStorylineStageSchema.parse({ key, label, next: target }),
  );
  return {
    ...project,
    storyline: { ...storyline, stages: rewired },
    taken: Object.fromEntries(Object.entries(taken).map(([from, to]) => [from, region.has(from) ? swap(to) : to])),
  };
}
