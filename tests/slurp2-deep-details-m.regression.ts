/**
 * M — Deep details overhaul: the record keeps what shaped a post (flavour brief as parts, viewpoint
 * phrase per model family, tie partners, the posts a purpose points at), and the phone summary and
 * the tablet/desktop chart tell it in plain in-world words.
 */
import assert from "node:assert/strict";
import { SLP_DEFAULT_STEERING } from "../packages/slurp2/src/engine/packages/shared/src/slp/slp-creator-steering.ts";
import type {
  SlpDeepDetailsImageRun,
  SlpDeepDetailsRecord,
  SlpDeepDetailsResponse,
} from "../packages/slurp2/src/engine/packages/shared/src/slp/slp-deep-details.ts";
import { compileSlurpFlavourBrief } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/creators/slp-creator-flavour.ts";
import { buildSlurpDeepDetailsRecord } from "../packages/slurp2/src/engine/packages/server/src/slp/features/feed/slp-deep-details-record.ts";
import { slurpCreatorStrategy } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/creators/slp-creator-strategy.ts";
import {
  buildSlpDeepDetailsStory,
  slpDeepDetailsCost,
  slpEnhanceChanges,
  type SlpDeepRow,
} from "../packages/slurp2/src/engine/packages/client/src/slp/modules/post/slp-deep-details-story.ts";
import { buildSlpDeepDetailsFlow } from "../packages/slurp2/src/engine/packages/client/src/slp/modules/post/slp-deep-details-flow.ts";
import {
  layoutSlpFlowCanvas,
  routeSlpFlowGraph,
} from "../packages/slurp2/src/engine/packages/client/src/slp/modules/post/slp-deep-details-canvas-layout.ts";
import { FLAVOUR_FIXTURES, type FlavourFixture } from "./slurp2-flavour-fixtures.ts";
import { join } from "node:path";
import { slurp2Source as readSource } from "./slurp2-source.ts";

const slurp2Source = (path: string) => readSource(join(import.meta.dirname, "..", "packages/slurp2/src/engine", path));

const mira = FLAVOUR_FIXTURES[0] as FlavourFixture;
const steering = {
  ...SLP_DEFAULT_STEERING,
  mood: "restless" as const,
  lifePhase: "just moved in with Tess",
  focus: "the bouldering comp",
  push: ["night sessions", "coffee"],
  avoid: ["her ex"],
};

// 1. The flavour brief as parts: the same draw as the prompt text, nothing invented.
for (let sequence = 0; sequence < 24; sequence += 1) {
  const brief = compileSlurpFlavourBrief(
    {
      accountId: mira.id,
      name: mira.name,
      card: mira.card,
      anchors: mira.anchors,
      ownLines: mira.captions,
      steering: sequence % 2 ? steering : null,
    },
    { use: "post", sequence },
  );
  const shaped = brief.shaped;
  assert.equal(shaped.details.length, brief.bits.length, "one part per detail drawn");
  for (const detail of shaped.details) {
    assert.ok(brief.text.includes(detail.text), `detail "${detail.text}" is in the brief`);
    assert.doesNotMatch(detail.text, /^(Someone in your life|A place you are often|Part of your work):/u, "no lead-in");
  }
  assert.equal(shaped.voice, brief.sample);
  if (shaped.opener) {
    assert.ok(brief.text.includes(`“${shaped.opener.phrase}”`), "the opener is the one the brief named");
    assert.equal(brief.text.includes("open differently this time"), !shaped.opener.allowed);
  }
  if (shaped.day === "flat") assert.match(brief.text, /flat days/u);
  if (shaped.day === "good") assert.match(brief.text, /good day/u);
  if (sequence % 2) {
    assert.equal(shaped.day, null, "a mood set by the player means no day texture");
    assert.equal(shaped.steering?.mood, "restless");
    assert.deepEqual(shaped.steering?.leftOut, ["her ex"]);
    assert.ok(
      brief.text.toLocaleLowerCase().includes(`${shaped.steering!.topic} keeps coming up`),
      "the pushed topic of this post",
    );
  } else assert.equal(shaped.steering, null);
}
// The day texture still happens sometimes (same seeded draw as before M).
const days = new Set(
  Array.from(
    { length: 80 },
    (_, sequence) =>
      compileSlurpFlavourBrief(
        { accountId: mira.id, name: mira.name, card: mira.card, anchors: mira.anchors },
        { use: "post", sequence },
      ).shaped.day,
  ),
);
assert.ok(days.has(null) && days.size >= 3, "flat / good / small days and plain ones");

// 2. The record keeps the parts; an older record without them still reads.
const recordBase = {
  input: {
    generatedAt: new Date("2026-09-28T10:00:00Z"),
    request: { access: "locked" },
    connection: { id: "txt", name: "Main", provider: "openai", model: "gpt-test" },
  },
  sequence: 4,
  completionOptions: { temperature: 0.9 },
  attempts: 2,
  opportunity: null,
  axes: { intent: "set", delivery: "single_image" },
  isTeaser: false,
  storyVariation: false,
  format: "caption",
  variation: null,
  campaignId: null,
  shootId: null,
  reusedSource: null,
  demandTopic: null,
  project: null,
  projectChapter: null,
  camera: "selfie",
  effort: "casual",
  strategy: slurpCreatorStrategy("m-creator", undefined),
  sentMessages: [{ role: "user", content: "write" }],
  content: "{}",
  generated: { content: "c" },
  draftImagePrompt: "brief",
  askModelForImagePrompt: false,
};
const flavour: NonNullable<SlpDeepDetailsRecord["flavour"]> = {
  details: [
    { kind: "people", text: "Jonas (brother)" },
    { kind: "habit", text: "icing her fingers" },
  ],
  voice: "thermos survived another fall",
  opener: { phrase: "champ energy only", allowed: false },
  day: null,
  relationship: null,
  steering: {
    mood: "restless",
    life: "just moved in with Tess",
    focus: null,
    topic: "night sessions",
    leftOut: ["her ex"],
  },
};
const recorded = buildSlurpDeepDetailsRecord({ ...recordBase, flavour });
assert.deepEqual(recorded.flavour, flavour);
assert.equal("flavour" in buildSlurpDeepDetailsRecord(recordBase), false, "no flavour key when none was compiled");

// 3. The summary story.
const run = (over: Partial<SlpDeepDetailsImageRun> = {}): SlpDeepDetailsImageRun => ({
  trigger: "generation",
  startedAt: "2026-09-28T10:00:05Z",
  connection: {
    id: "img",
    name: "Flux",
    provider: "x",
    model: "flux-dev",
    source: null,
    service: null,
    hasFallback: false,
  },
  size: { width: 1024, height: 1280 },
  styleProfile: { id: "s", name: "Soft film", chosenBy: "creator", styleText: "", positiveTags: "", negativeTags: "" },
  settings: { includeDescriptions: true, avatarReferences: false, interpretation: true },
  appearance: { source: "stage", text: "red hair" },
  viewpoint: { source: "selfie", family: "tags", phrase: "selfie, outstretched arm, reaching towards viewer" },
  referenceImages: 0,
  templatePrompt: "t",
  styledPrompt: "s",
  rewrite: {
    status: "accepted",
    input: "red hair, climbing gym, chalk on hands, selfie, outstretched arm",
    output: "red hair, climbing gym at night, chalk on hands, selfie, outstretched arm, soft film grain",
    reason: null,
  },
  finalPrompt: "final",
  negativePrompt: "holding phone",
  attempts: [
    { attempt: 1, startedAt: "2026-09-28T10:00:05Z", durationMs: 4000, route: "host", ok: false, error: "429" },
    { attempt: 2, startedAt: "2026-09-28T10:00:15Z", durationMs: 9000, route: "host", ok: true, error: null },
  ],
  result: { status: "saved", mediaPath: "p.png", error: null },
  ...over,
});
const beat = (over: Partial<NonNullable<NonNullable<SlpDeepDetailsRecord["planner"]>["beat"]>> = {}) => ({
  type: "moment",
  anchorKind: "places",
  anchor: "the bouldering gym",
  line: "You finally send the project at the bouldering gym.",
  cast: [],
  place: "the bouldering gym",
  ...over,
});
const response = (over: {
  details?: Partial<SlpDeepDetailsRecord> | null;
  metadata?: Record<string, unknown>;
  access?: string;
  related?: SlpDeepDetailsResponse["related"];
  people?: SlpDeepDetailsResponse["people"];
}): SlpDeepDetailsResponse => ({
  post: {
    id: "p1",
    title: null,
    content: "sent it!!",
    access: over.access ?? "public",
    source: "generated",
    createdAt: "2026-09-28T10:01:00Z",
    updatedAt: "2026-09-28T10:01:00Z",
    imageUrl: "/img.png",
    imagePrompt: null,
    images: [],
    metadata: over.metadata ?? {},
  },
  creator: { id: "c1", displayName: "Mira Vale", handle: "miravale" },
  details: over.details === null ? null : { ...recorded, imageRuns: [run()], ...over.details },
  plan: null,
  links: [],
  related: over.related,
  people: over.people,
  stats: { likes: 3, replies: 1, unlocks: 0 },
});
const rowOf = (rows: SlpDeepRow[], id: SlpDeepRow["id"]) => rows.find((row) => row.id === id);
const words = (row: SlpDeepRow | undefined) =>
  JSON.stringify([row?.line, row?.chain, row?.sentences, row?.items, row?.quote, row?.facts]);

// Tease → drop, with the drop up and named by its text.
{
  const rows = buildSlpDeepDetailsStory(
    response({
      metadata: { slurpPurpose: { kind: "tease", postId: "p2", dropAt: "2026-09-28T19:00:00Z" } },
      related: { p2: { text: "the full set from tonight", createdAt: "2026-09-28T19:00:00Z", access: "locked" } },
    }),
  );
  const why = rowOf(rows, "why")!;
  assert.equal(why.title, "Why it went up");
  assert.deepEqual(
    why.chain?.map((step) => [step.label, step.state]),
    [
      ["Tease", "this"],
      ["Drop", "done"],
    ],
  );
  assert.equal(why.chain?.[1]?.text, "the full set from tonight");
}
// A tease whose drop is still to come.
{
  const why = rowOf(
    buildSlpDeepDetailsStory(
      response({ metadata: { slurpPurpose: { kind: "tease", dropAt: "2026-09-28T19:00:00Z", held: true } } }),
    ),
    "why",
  )!;
  assert.equal(why.chain?.[1]?.state, "next");
  assert.match(why.chain![1]!.text, /^Locked, due .*\(the slot is held\)$/u);
}
// Poll → answer.
{
  const why = rowOf(
    buildSlpDeepDetailsStory(
      response({
        metadata: { slurpPurpose: { kind: "poll_answer", pollPostId: "s1", answer: "Ridge loop at sunrise" } },
        details: {
          planner: { mode: "beats", beat: beat({ anchorKind: "steer", sharedId: "poll:s1" }), claimCheck: null },
        },
      }),
    ),
    "why",
  )!;
  assert.deepEqual(
    why.chain?.map((step) => step.label),
    ["Poll", "Fans picked", "Answer"],
  );
  assert.equal(why.chain?.[1]?.text, "Ridge loop at sunrise");
}
// A poll's answer is the fans' pick, not the player's steering (screenshot finding).
assert.equal(
  rowOf(
    buildSlpDeepDetailsStory(
      response({
        details: {
          flavour: undefined,
          planner: { mode: "beats", beat: beat({ anchorKind: "steer", sharedId: "poll:s1" }), claimCheck: null },
        },
      }),
    ),
    "steering",
  ),
  undefined,
);
// A pack's moment (S) leads the chain and names the occasion.
{
  const rows = buildSlpDeepDetailsStory(
    response({
      details: {
        planner: {
          mode: "beats",
          beat: beat({ anchorKind: "life", anchor: "SlurpCon", sharedId: "occasion:slurpcon:2026-08-14:1" }),
          claimCheck: null,
        },
      },
    }),
  );
  assert.equal(rowOf(rows, "why")?.chain?.[0]?.text, "A SlurpCon moment");
  assert.match(words(rowOf(rows, "happens")), /Part of SlurpCon/u);
}
// Flavour, steering, spice, a collab with its split, the picture, cost.
{
  const rows = buildSlpDeepDetailsStory(
    response({
      access: "locked",
      metadata: { slurpSpice: { kind: "lingerie", taste: "feet" } },
      people: { k1: { displayName: "Kai Torres", handle: "kai" } },
      details: {
        planner: {
          mode: "beats",
          beat: beat({
            anchorKind: "collab",
            nudgeId: undefined,
            tie: { kind: "collab", partnerId: "k1", hostShare: 60 },
          }),
          claimCheck: { ok: true, problems: [], claims: null, revised: true },
          heat: { dial: "explicit", planned: "suggestive" },
        },
      },
    }),
  );
  const voice = rowOf(rows, "voice")!;
  assert.equal(voice.title, "Who Mira was today");
  assert.deepEqual(voice.items?.[0], { text: "Jonas (brother)", note: "someone in their life" });
  assert.equal(voice.quote?.text, "thermos survived another fall");
  assert.match(words(voice), /opened with “champ energy only” a lot/u);
  const steer = rowOf(rows, "steering")!;
  assert.match(words(steer), /restless/u);
  assert.match(words(steer), /night sessions/u);
  assert.match(words(steer), /her ex/u);
  const spice = rowOf(rows, "spice")!;
  assert.equal(spice.line, "Flirty · a lingerie shoot · a nod to feet");
  assert.match(words(spice), /Planned at Flirty\. Mira goes up to Explicit\./u);
  assert.match(words(spice), /Your fans have been into feet lately/u);
  const together = rowOf(rows, "together")!;
  assert.equal(together.line, "A collab with @kai");
  assert.match(words(together), /Mira keeps 60 %, @kai gets 40 %/u);
  const picture = rowOf(rows, "picture")!;
  assert.equal(picture.status, "retried");
  assert.match(words(picture), /Seen as: “selfie, outstretched arm, reaching towards viewer”, in tag words/u);
  assert.match(words(picture), /Style kept: Soft film, the Creator's own/u);
  assert.match(words(picture), /1 try failed before it worked/u);
  assert.deepEqual(picture.changes, { added: ["climbing gym at night", "soft film grain"], dropped: ["climbing gym"] });
  assert.match(words(rowOf(rows, "writing")), /sent back once to fix a fact/u);
  assert.deepEqual(slpDeepDetailsCost(response({}).details), { writing: 2, enhance: 1, pictures: 2, total: 5 });
  assert.equal(rowOf(rows, "cost")?.line, "5 AI calls · 2 picture tries");
  // Plain in-world words: no prompt labels or raw ids on the summary lines.
  for (const row of rows) {
    assert.doesNotMatch(
      row.line ?? "",
      /\b(intent|delivery|beat|anchorKind|nudity|suggestive|claim)\b|_/u,
      `${row.id}: ${row.line}`,
    );
  }
}
// Brand deals, rivalries and couples say who and what in plain words.
{
  const tie = (value: Record<string, unknown>, people = {}) =>
    rowOf(buildSlpDeepDetailsStory(response({ metadata: { slurpTie: value }, people, details: {} })), "together");
  assert.equal(tie({ kind: "sponsor", id: "d", brand: "PeakFuel" })?.line, "Paid partnership with PeakFuel");
  assert.equal(tie({ kind: "sponsor", id: "d", brand: "PeakFuel", declined: true })?.line, "Turned down PeakFuel");
  assert.equal(
    tie({ kind: "rival", id: "r", partnerId: "n" }, { n: { displayName: "Noor", handle: "noor" } })?.line,
    "Rivalry with @noor",
  );
  const couple = tie(
    { kind: "couple", id: "c", partnerId: "k", moment: "cameo" },
    { k: { displayName: "Kai", handle: "kai" } },
  );
  assert.equal(couple?.line, "Couple with @kai · a cameo by their partner");
  assert.match(words(couple), /own post about their life: no collab tag, no split/u);
  assert.match(
    words(tie({ kind: "collab", id: "x", partnerId: "k", announce: true })),
    /Announces a collab with another Creator/u,
  );
}
// Rows that do not apply stay out; an old record and a hand-made post still read.
{
  const old = buildSlpDeepDetailsStory(
    response({ details: { flavour: undefined, planner: undefined, imageRuns: undefined } }),
  );
  assert.deepEqual(
    old.map((row) => row.id),
    ["why", "happens", "picture", "writing", "cost", "since"],
  );
  const manual = buildSlpDeepDetailsStory(response({ details: null }));
  assert.deepEqual(
    manual.map((row) => [row.id, row.line]),
    [
      ["why", null],
      ["happens", null],
      ["picture", "saved"],
      ["writing", null],
      ["since", "3 likes · 1 reply"],
    ],
  );
}
assert.equal(
  slpEnhanceChanges(run({ rewrite: { status: "rejected", input: "a", output: "b", reason: "copied" } })),
  null,
);

// 4. The chart (tablet/desktop) carries the same story: new value cards feed the steps they shaped,
// and the canvas still places and routes every card.
{
  const data = response({
    access: "locked",
    metadata: { slurpPurpose: { kind: "drop", teasePostId: "t1" }, slurpSpice: { kind: "nudes" } },
    details: {
      planner: {
        mode: "beats",
        beat: beat({ anchorKind: "steer", nudgeId: "n1", anchor: "gym post tonight" }),
        claimCheck: null,
        heat: { dial: "nudity", planned: "nudity" },
      },
    },
  });
  const graph = buildSlpDeepDetailsFlow(data, run())!;
  const ids = graph.nodes.map((node) => node.id);
  for (const id of ["story-why", "story-voice", "story-steering", "story-spice"]) assert.ok(ids.includes(id), id);
  const edge = (from: string, to: string) => graph.edges.some((entry) => entry.from === from && entry.to === to);
  assert.ok(edge("story-why", "plan") && edge("story-voice", "writing-prompt") && edge("story-spice", "brief"));
  assert.ok(edge("story-steering", "angle") && edge("story-steering", "writing-prompt"));
  const rewrite = graph.nodes.find((node) => node.id === "rewrite")!;
  assert.equal(rewrite.outputs.find((row) => row.label === "Added")?.value, "climbing gym at night, soft film grain");
  const final = graph.nodes.find((node) => node.id === "final")!;
  assert.match(final.outputs.find((row) => row.label === "Viewpoint")?.note ?? "", /in tag words/u);
  for (const node of graph.nodes) {
    const labels = [...node.inputs, ...node.outputs].map((row) => row.label);
    assert.equal(new Set(node.outputs.map((row) => row.label)).size, node.outputs.length, `${node.id}: labels unique`);
    assert.ok(labels.every(Boolean), `${node.id}: every row has a label`);
  }
  for (const cols of [2, 3, Number.POSITIVE_INFINITY]) {
    const { boxes } = layoutSlpFlowCanvas(graph, cols);
    assert.equal(boxes.size, graph.nodes.length, "every card has a place");
    assert.equal(
      new Set([...boxes.values()].map((box) => `${box.row}:${box.col}`)).size,
      boxes.size,
      "one card per cell",
    );
    assert.equal(routeSlpFlowGraph(graph, boxes).size, graph.edges.length, "every arrow is drawn");
  }
}

// 5. Wiring: the generation records the brief's parts, the images service the viewpoint, the route the names.
const generation = slurp2Source("packages/server/src/slp/features/feed/slp-generation-service.ts");
assert.match(generation, /shaped: \(value\) => \(flavourShaped = value\)/u);
assert.match(generation, /flavour: flavourShaped,/u);
assert.match(generation, /saveSlurpNewPostDeepDetails\(\s*db,\s*account\.id,\s*buildSlurpDeepDetailsRecord\(\{/u);
assert.match(
  slurp2Source("packages/server/src/slp/features/media/slp-images-service.ts"),
  /run\.viewpoint =\s+viewpoint && !skipInterpretation/u,
);
const route = slurp2Source("packages/server/src/slp/features/feed/slp-deep-details-routes.ts");
assert.match(route, /people: Object\.fromEntries/u);
assert.match(route, /related: Object\.fromEntries/u);
const summary = slurp2Source("packages/client/src/slp/modules/post/SlpDeepDetailsSummary.tsx");
assert.match(summary, /buildSlpDeepDetailsStory\(data, i18next\.language\)/u);
assert.match(summary, /<details className="group">/u, "rows still open and close");
assert.doesNotMatch(summary, /\buppercase\b/u);

console.log("slurp2 deep details M regression passed");
