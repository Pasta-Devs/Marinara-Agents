/**
 * A storyline run on paper (docs/STORYLINES.md, PR 2): stage lengths and choices drawn from a seed, `when`
 * edges read from the tags the run itself sets. Pure; a pack author sees where a storyline can go and how
 * long it takes before anything runs on a Creator.
 */
import {
  slpStorylineNext,
  type SlpStoryline,
  type SlpStoryPackV2,
} from "../../../../../shared/src/slp/slp-storyline.js";
import { hash } from "../projects/slp-project.js";

export type SlpStorylineDryRun = {
  path: { stage: string; days: number }[];
  /** The ending reached, or null when the run stops on a standing stage. */
  ending: string | null;
  days: number;
};

export function slpStorylineDryRun(
  storyline: SlpStoryline,
  seed: string,
  tags: readonly string[] = [],
): SlpStorylineDryRun {
  const set = new Set([...storyline.requires.tags, ...tags]);
  const apply = (outcomes: SlpStoryline["stages"][number]["enter"]) => {
    for (const outcome of outcomes) {
      if (outcome.kind === "add-creator-fact") set.add(outcome.tag);
      if (outcome.kind === "remove-creator-fact") set.delete(outcome.tag);
    }
  };
  const index = new Map(storyline.stages.map((stage, at) => [stage.key, at]));
  const path: SlpStorylineDryRun["path"] = [];
  let days = 0;
  let at = 0;
  // The validator rejects cycles, so a run visits each stage at most once.
  for (let step = 0; step < storyline.stages.length; step += 1) {
    const stage = storyline.stages[at]!;
    const [low, high] = stage.days ?? [0, 0];
    const length = low + (hash(`${seed}#days#${step}`) % (high - low + 1));
    path.push({ stage: stage.key, days: length });
    days += length;
    if (stage.condition?.tag) set.add(stage.condition.tag);
    apply(stage.enter);
    apply(stage.leave);
    const edges = slpStorylineNext(storyline, at);
    if (!edges) return { path, ending: null, days };
    const edge = stage.choice
      ? edges[hash(`${seed}#choice#${step}`) % edges.length]!
      : (edges.find((item) => !item.when || set.has(item.when.tag) === item.when.set) ?? edges.at(-1)!);
    // The condition holds while the stage runs, so the edge reads it; then it is gone.
    if (stage.condition?.tag) set.delete(stage.condition.tag);
    const next = index.get(edge.to);
    if (next === undefined) return { path, ending: edge.to, days };
    at = next;
  }
  throw new Error(`storyline "${storyline.id}" did not end`);
}

export type SlpStorylineDryRunSummary = {
  id: string;
  /** How often each ending was reached; `stands` counts runs that stop on a standing stage. */
  endings: Record<string, number>;
  longestDays: number;
  /** Runs that took longer than `maxDays`. */
  overLong: number;
};

/** Every storyline of a pack, run `runs` times on seeds derived from `seed`. */
export function slpStoryPackDryRun(pack: SlpStoryPackV2, seed: string, runs = 20): SlpStorylineDryRunSummary[] {
  return pack.storylines.map((storyline) => {
    const summary: SlpStorylineDryRunSummary = { id: storyline.id, endings: {}, longestDays: 0, overLong: 0 };
    for (let run = 0; run < runs; run += 1) {
      const result = slpStorylineDryRun(storyline, `${seed}#${storyline.id}#${run}`);
      const ending = result.ending ?? "stands";
      summary.endings[ending] = (summary.endings[ending] ?? 0) + 1;
      summary.longestDays = Math.max(summary.longestDays, result.days);
      if (result.days > storyline.maxDays) summary.overLong += 1;
    }
    return summary;
  });
}
