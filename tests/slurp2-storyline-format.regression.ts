/**
 * Story Pack format v2 (docs/STORYLINES.md, PR 2): every built-in arc, event, situation and drama converts
 * to a valid storyline and runs to an end on paper; the validator rejects a cycle, a missing target, an
 * unreachable stage and an unknown role; a v1 pack parses as v2.
 */
import assert from "node:assert/strict";
import { slpArcBlueprintSchema } from "../packages/slurp2/src/engine/packages/shared/src/slp/slp-story-engine.ts";
import { slpStorylineSchema } from "../packages/slurp2/src/engine/packages/shared/src/slp/slp-storyline.ts";
import {
  parseSlpStoryPackV2,
  slpStorylinesFromV1,
} from "../packages/slurp2/src/engine/packages/shared/src/slp/slp-storyline-v1.ts";
import {
  slpStoryPackDryRun,
  slpStorylineDryRun,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/storylines/slp-storyline-dry-run.ts";
import { slpBundledStoryPacks } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/world/events/slp-story-packs.ts";
import {
  SLURP_BUILTIN_DRAMAS,
  SLURP_BUILTIN_SITUATIONS,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/world/events/slp-drama-packs.ts";

// --- Every built-in converts and ends. ---
const bundled = slpBundledStoryPacks();
const v1 = {
  arcs: bundled.flatMap((pack) => pack.arcs),
  events: bundled.flatMap((pack) => pack.events),
  situations: [...SLURP_BUILTIN_SITUATIONS],
  dramas: [...SLURP_BUILTIN_DRAMAS],
};
const converted = slpStorylinesFromV1(v1);
assert.deepEqual(converted.errors, [], "every built-in converts");
const total = v1.arcs.length + v1.events.length + v1.situations.length + v1.dramas.length;
assert.equal(converted.storylines.length, total);
assert.ok(v1.arcs.length > 10 && v1.events.length > 5 && v1.situations.length > 0 && v1.dramas.length > 0);

const pack = {
  format: "marinara-slurp-story-pack" as const,
  schemaVersion: 2 as const,
  id: "builtins",
  version: "1",
  name: "Built-ins",
  description: "",
  tracks: [],
  storylines: converted.storylines,
};
for (const summary of slpStoryPackDryRun(pack, "seed", 30)) {
  const storyline = converted.storylines.find((item) => item.id === summary.id)!;
  const kind = storyline.source!.kind;
  if (kind === "situation") assert.deepEqual(summary.endings, { stands: 30 }, `${summary.id} stands`);
  else assert.deepEqual(Object.keys(summary.endings), ["end"], `${summary.id} always ends`);
  if (kind === "arc" || kind === "event") assert.equal(summary.overLong, 0, `${summary.id} fits its maxDays`);
}
// An arc's fans' choice leads into its branch chapters, then on; same seed, same run.
const [arc] = slpStorylinesFromV1({
  arcs: [
    slpArcBlueprintSchema.parse({
      id: "move",
      name: "The move",
      description: "",
      chapters: [
        {
          label: "Packing",
          minDays: 1,
          maxDays: 3,
          choice: {
            question: "Where to?",
            options: [
              { label: "The city", chapters: [{ label: "City flat", minDays: 1, maxDays: 2 }] },
              { label: "Stay", chapters: [] },
            ],
          },
        },
        { label: "Settling in", minDays: 2, maxDays: 4 },
      ],
    }),
  ],
  events: [],
  situations: [],
  dramas: [],
}).storylines;
assert.deepEqual(
  arc!.stages.map((stage) => [stage.key, stage.next ?? stage.choice!.options.map((option) => option.next)]),
  [
    ["c1", ["c1-1-1", "c2"]],
    ["c1-1-1", "c2"],
    ["c2", "end"],
  ],
);
assert.deepEqual(slpStorylineDryRun(arc!, "a"), slpStorylineDryRun(arc!, "a"));
const paths = new Set(
  Array.from({ length: 40 }, (_, run) =>
    slpStorylineDryRun(arc!, `r${run}`)
      .path.map((step) => step.stage)
      .join(">"),
  ),
);
assert.deepEqual([...paths].sort(), ["c1>c1-1-1>c2", "c1>c2"]);

// A drama needs its situation's tag; the situation sets it.
const needy = SLURP_BUILTIN_DRAMAS.find((drama) => drama.requires);
if (needy) {
  const storyline = converted.storylines.find((item) => item.id === `drama:${needy.id}`)!;
  assert.deepEqual(storyline.requires.tags, [needy.requires!.situation]);
  assert.equal(storyline.start.within, `situation:${needy.requires!.situation}`);
  const situation = converted.storylines.find((item) => item.id === `situation:${needy.requires!.situation}`);
  assert.equal(situation?.stages[0]!.condition?.tag, needy.requires!.situation);
}

// --- The validator. ---
const base = {
  id: "test",
  name: "Test",
  cast: [{ key: "her" }],
  stages: [
    { key: "a", label: "A", days: [1, 2] },
    { key: "b", label: "B", days: [1, 2] },
  ],
  endings: [{ key: "done", label: "Done" }],
};
assert.equal(slpStorylineSchema.safeParse(base).success, true);
const messages = (draft: unknown) => {
  const parsed = slpStorylineSchema.safeParse(draft);
  return parsed.success ? [] : parsed.error.issues.map((issue) => issue.message);
};
const loop = {
  ...base,
  stages: [
    { key: "a", label: "A", days: [1, 2], next: "b" },
    { key: "b", label: "B", days: [1, 2], next: "a" },
  ],
};
assert.ok(
  messages(loop).some((message) => /leads back to itself/u.test(message)),
  "a cycle is rejected",
);
assert.ok(
  messages({ ...base, stages: [{ key: "a", label: "A", days: [1, 2], next: "nowhere" }] }).some((message) =>
    /"nowhere" does not exist/u.test(message),
  ),
);
assert.ok(
  messages({ ...base, stages: [{ key: "a", label: "A", days: [1, 2], next: "done" }, base.stages[1]] }).some(
    (message) => /nobody reaches: b/u.test(message),
  ),
);
assert.ok(
  messages({
    ...base,
    stages: [{ key: "a", label: "A", days: [1, 2], beats: [{ role: "him", channel: "dm", to: "her", seed: "hi" }] }],
  }).some((message) => /unknown role "him"/u.test(message)),
);
assert.ok(messages({ ...base, maxDays: 1 }).some((message) => /maxDays/u.test(message)));
// `when` edges: the run follows the tag it set.
const branching = slpStorylineSchema.parse({
  ...base,
  stages: [
    { key: "a", label: "A", days: [1, 1], enter: [{ kind: "add-creator-fact", tag: "moved", label: "Moved" }] },
    { key: "b", label: "B", days: [1, 1], next: [{ to: "c", when: { tag: "moved" } }, { to: "done" }] },
    { key: "c", label: "C", days: [1, 1] },
  ],
});
assert.deepEqual(
  slpStorylineDryRun(branching, "x").path.map((step) => step.stage),
  ["a", "b", "c"],
);

// Review fixes: only a lone stage stands; `next` beside a choice is checked; a reversed arc pair is read as
// its low end; situations start by themselves; a drama inside a situation casts from it; pack tracks.
assert.ok(
  messages({ ...base, stages: [{ key: "a", label: "A" }, base.stages[1]] }).some((message) =>
    /"a" has nowhere to go/u.test(message),
  ),
);
assert.ok(messages({ ...base, endings: [] }).some((message) => /"b" has nowhere to go/u.test(message)));
const choice = {
  asks: "player",
  question: "Which?",
  default: 0,
  options: [
    { label: "Done", next: "done" },
    { label: "B", next: "b" },
  ],
};
assert.ok(
  messages({ ...base, stages: [{ key: "a", label: "A", days: [1, 2], choice, next: "nowhere" }, base.stages[1]] }).some(
    (message) => /"nowhere" does not exist/u.test(message),
  ),
);
const reversed = slpStorylinesFromV1({
  arcs: [
    slpArcBlueprintSchema.parse({
      id: "odd",
      name: "Odd",
      description: "",
      chapters: [{ label: "One", minDays: 5, maxDays: 2 }],
    }),
  ],
  events: [],
  situations: [],
  dramas: [],
});
assert.deepEqual(reversed.errors, []);
assert.deepEqual(reversed.storylines[0]!.stages[0]!.days, [5, 5]);
for (const storyline of converted.storylines.filter((item) => item.source?.kind === "situation"))
  assert.equal(storyline.start.mode, "auto", `${storyline.id} starts by itself`);
const tracked = (track: string, tracks: string[] = []) =>
  parseSlpStoryPackV2({ ...pack, tracks, storylines: [{ ...base, track }] });
assert.notEqual(tracked("body").pack, null);
assert.equal(tracked("school").pack, null, "an unknown track is refused");
assert.notEqual(tracked("school", ["school"]).pack, null, "a pack may add a track");

// --- Packs in either format. ---
const fromV1 = parseSlpStoryPackV2(bundled[0]);
assert.deepEqual(fromV1.errors, []);
assert.equal(fromV1.pack!.schemaVersion, 2);
assert.equal(fromV1.pack!.storylines.length, bundled[0]!.arcs.length + bundled[0]!.events.length);
const again = parseSlpStoryPackV2(JSON.parse(JSON.stringify(fromV1.pack)));
assert.deepEqual(again, fromV1, "a v2 pack reads back the same");
assert.equal(parseSlpStoryPackV2({ ...pack, storylines: [loop] }).pack, null, "a bad v2 pack is refused whole");

console.log("slurp2 storyline format: ok");
