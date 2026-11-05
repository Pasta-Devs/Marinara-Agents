/**
 * Arcs run on storylines (docs/STORYLINES.md, PR 3): a project keeps its own storyline and stage, the chapter
 * fields are its view, `when` ways read the Creator's tags, endings complete the run, a stage's condition is
 * set on entering and removed on leaving, and hand-edited chapter fields rebuild the storyline.
 */
import assert from "node:assert/strict";
import {
  makeSlurpProject,
  readSlurpProject,
  type SlurpArcType,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/projects/slp-project.ts";
import {
  slurpProjectAdvance,
  slurpProjectChoose,
  slurpProjectDirect,
  slurpProjectTick,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/projects/slp-arc-progress.ts";
import {
  slurpProjectSync,
  slurpProjectView,
  slurpProjectWithType,
  slurpStageOutcomes,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/projects/slp-project-storyline.ts";
import { slpStorylineSchema } from "../packages/slurp2/src/engine/packages/shared/src/slp/slp-storyline.ts";
import { slurp2Source } from "./slurp2-source";

const at = new Date("2026-10-21T10:00:00.000Z");
const days = (count: number) => new Date(at.getTime() + count * 86_400_000);

// --- A typed arc carries its type's storyline; the chapter fields are its view. ---
const type = {
  id: "move",
  name: "The move",
  description: "",
  chapters: [
    {
      label: "Packing",
      minDays: 1,
      maxDays: 2,
      outcomes: [{ kind: "add-creator-fact", tag: "moving", label: "Moving house" }],
      choice: {
        question: "Where to?",
        options: [
          { label: "The city", chapters: [{ label: "City flat", minDays: 1, maxDays: 1 }] },
          { label: "Stay", chapters: [] },
        ],
      },
    },
    { label: "Settling in", minDays: 1, maxDays: 1 },
  ],
  tags: [],
  tone: "",
  durationDays: 10,
  enabled: true,
  builtin: false,
  hidden: false,
} as unknown as SlurpArcType;
const arc = makeSlurpProject("a1", { type }, at)!;
assert.equal(arc.storyline?.id, "arc:move");
assert.equal(arc.stage, "c1");
assert.deepEqual(arc.chapters, ["Packing", "Settling in"]);
assert.equal(arc.choices[0]?.options[0]?.chapters[0]?.label, "City flat");
assert.deepEqual(arc.storyline!.stages[0]!.enter, [{ kind: "add-creator-fact", tag: "moving", label: "Moving house" }]);
// A stored record reads back the same, and nothing to do is the same object.
const stored = readSlurpProject(JSON.parse(JSON.stringify(arc)))!;
assert.deepEqual(stored, arc);
assert.equal(slurpProjectTick(stored, at), stored, "nothing due: the same object");
// The fans pick the city: the run walks the branch, then rejoins.
const city = slurpProjectChoose(arc, days(1), [3, 1])!;
assert.equal(city.stage, "c1-1-1");
assert.deepEqual(city.chapters, ["Packing", "City flat", "Settling in"]);
assert.equal(city.taken!.c1, "c1-1-1");
const settled = slurpProjectTick(slurpProjectTick(city, days(3)), days(5));
assert.equal(settled.status, "complete");
assert.equal(settled.ending, "end");

// --- A record stored before PR 3 converts on read. ---
const legacy = JSON.parse(JSON.stringify(arc));
delete legacy.storyline;
delete legacy.stage;
delete legacy.taken;
const converted = readSlurpProject(legacy)!;
assert.equal(converted.stage, "c1");
assert.deepEqual(converted.chapters, arc.chapters);
assert.deepEqual(converted.choices, arc.choices);
assert.equal(converted.storyline!.stages.length, 3);
assert.equal(converted.storyline!.stages[0]!.enter.length, 0, "no library at hand: no outcomes yet");
const upgraded = slurpProjectWithType(converted, type);
assert.deepEqual(
  upgraded.storyline!.stages[0]!.enter,
  arc.storyline!.stages[0]!.enter,
  "the library type gives them back",
);
assert.equal(slurpProjectWithType(arc, type), arc, "a run with its own copy is left alone");

// A fans' choice can take a full arc past 12 chapters; it reads back whole.
const twelve = makeSlurpProject(
  "a12",
  {
    type: {
      ...type,
      chapters: [
        type.chapters[0]!,
        ...Array.from({ length: 11 }, (_, index) => ({ label: `Step ${index + 2}`, minDays: 1, maxDays: 1 })),
      ],
    } as unknown as SlurpArcType,
  },
  at,
)!;
const long = slurpProjectChoose(twelve, days(1), [3, 0])!;
assert.equal(long.chapters.length, 13);
const longBack = readSlurpProject(JSON.parse(JSON.stringify(long)))!;
assert.equal(longBack.chapters.length, 13);
assert.equal(longBack.stage, "c1-1-1");
assert.deepEqual(longBack.taken, long.taken);
// Too many branch stages: branches are cut, every choice stays.
const wide = {
  question: "Which way?".padEnd(230, "?"),
  options: Array.from({ length: 4 }, (_, option) => ({
    label: `Way ${option + 1}`,
    chapters: Array.from({ length: 4 }, (_, step) => ({ label: `W${option}-${step}`, minDays: 1, maxDays: 1 })),
  })),
};
const crowded = slurpProjectSync({
  ...makeSlurpProject("w1", { title: "Wide", chapters: ["one", "two", "three"] }, at)!,
  choices: [wide, wide, wide],
});
assert.equal(crowded.choices.filter(Boolean).length, 3);
assert.ok(crowded.storyline!.stages.length <= 40);
assert.equal(crowded.choices[0]!.question.length, 230, "a long poll question is kept");
assert.equal(slurpProjectSync(crowded), crowded, "and stays in agreement");

// --- A v2 storyline: conditions, `when` ways and endings. ---
const baby = slpStorylineSchema.parse({
  id: "baby",
  name: "Baby",
  cast: [{ key: "creator" }],
  track: "body",
  stages: [
    {
      key: "early",
      label: "Early days",
      days: [2, 2],
      condition: { tag: "pregnant", line: "You are pregnant.", look: "a small bump" },
    },
    {
      key: "late",
      label: "Late days",
      days: [1, 1],
      condition: { tag: "pregnant", line: "You are heavily pregnant." },
      next: [{ to: "twins", when: { tag: "twins" } }, { to: "born" }],
    },
    { key: "twins", label: "Two of them", days: [1, 1], next: "born" },
  ],
  endings: [{ key: "born", label: "Born", outcomes: [{ kind: "add-creator-fact", tag: "parent", label: "Parent" }] }],
});
const base = makeSlurpProject("b1", { title: "Baby", chapters: ["x"] }, at)!;
const run = slurpProjectView({ ...base, storyline: baby, stage: "early", taken: {} });
assert.deepEqual(run.chapters, ["Early days", "Late days"]);
assert.equal(slurpProjectSync(run), run, "a run started from a storyline keeps it");
assert.equal(slurpProjectTick(run, days(1)), run, "the minimum holds");
const late = slurpProjectTick(run, days(2));
assert.equal(late.stage, "late");
assert.equal(slurpProjectTick(late, days(3)).ending, "born");
const twins = slurpProjectTick(late, days(3), "normal", new Set(["twins"]));
assert.equal(twins.stage, "twins");
assert.deepEqual(twins.chapters, ["Early days", "Late days", "Two of them"]);
assert.equal(slurpProjectAdvance(twins, days(5)).ending, "born", "a post after the minimum moves on");

// A move writes the stage left, then the stage entered or the ending reached.
assert.deepEqual(slurpStageOutcomes(baby, { enter: "early" }), [
  {
    kind: "add-creator-fact",
    tag: "pregnant",
    label: "Early days",
    track: "body",
    line: "You are pregnant.",
    look: "a small bump",
  },
]);
const next = slurpStageOutcomes(baby, { leave: "early", enter: "late" });
assert.deepEqual(
  next.map((outcome) => outcome.kind),
  ["add-creator-fact"],
  "the same tag goes on: it is replaced, not removed",
);
assert.deepEqual(
  slurpStageOutcomes(baby, { leave: "late", ending: "born" }).map((outcome) => [
    outcome.kind,
    "tag" in outcome ? outcome.tag : null,
  ]),
  [
    ["remove-creator-fact", "pregnant"],
    ["add-creator-fact", "parent"],
  ],
);

// --- The Director inserts after a choice: the choice still decides first. ---
const inserted = slurpProjectDirect(arc, "insert", at, "Saying goodbye")!;
assert.deepEqual(inserted.chapters, ["Packing", "Saying goodbye", "Settling in"]);
assert.deepEqual(
  inserted.choices[0]?.options.map((option) => option.chapters.map((chapter) => chapter.label)),
  [["City flat"], []],
);
const branch = slurpProjectChoose(inserted, days(1), [3, 0])!;
assert.deepEqual(branch.chapters, ["Packing", "City flat", "Saying goodbye", "Settling in"]);
const relabelled = slurpProjectDirect(arc, "label", at, "Boxes everywhere")!;
assert.equal(relabelled.chapters[0], "Boxes everywhere");
assert.equal(relabelled.storyline!.stages[0]!.label, "Boxes everywhere");

// --- Chapter fields edited by hand rebuild the storyline, keeping content by label. ---
const edited = slurpProjectSync({ ...arc, chapters: ["Packing", "New flat", "Settling in"], choices: [] });
assert.deepEqual(
  edited.storyline!.stages.map((stage) => stage.key),
  ["c1", "c2", "c3"],
);
assert.equal(edited.storyline!.stages[0]!.enter.length, 1, "Packing keeps its outcome");
const pointer = slurpProjectSync({ ...arc, chapter: 1 });
assert.equal(pointer.stage, "c2", "a moved chapter follows the line");
assert.equal(pointer.storyline, arc.storyline);

// --- Storage: tags for `when`, stage outcomes on every move. ---
const storage = slurp2Source(
  new URL(
    "../packages/slurp2/src/engine/packages/server/src/slp/data/projects/slp-projects-storage-1.ts",
    import.meta.url,
  ),
);
assert.match(storage, /slurpStageOutcomes\(after\.storyline/);
assert.match(storage, /slpExtensionOn\(settings, "storylines"\)/);
assert.match(
  slurp2Source(
    new URL(
      "../packages/slurp2/src/engine/packages/server/src/slp/data/projects/slp-projects-storage-2.ts",
      import.meta.url,
    ),
  ),
  /slurpProjectTick\(project, at, pace, \(tags \?\?=/,
);

console.log("slurp2 storyline runtime: ok");
