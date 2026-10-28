/**
 * Story state (docs/STORYLINES.md, "State"): one condition per track, a budget of two lines and one
 * look, a closet that follows the condition, and a deck that takes only its share of posts.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  applySlpStoryOutcomes,
  putSlpStoryFact,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/world/events/slp-story-runtime.ts";
import {
  slurpConditionBeat,
  slurpConditionCloset,
  slurpStoryNow,
  slurpStoryState,
  slurpTieTags,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/storylines/slp-story-state.ts";
import {
  slurpPostBriefSection,
  slurpRightNowLine,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/feed/slp-post-brief.ts";
import type { SlpStoryFact } from "../packages/slurp2/src/engine/packages/shared/src/slp/slp-story-engine.js";

const at = new Date("2026-10-12T12:00:00.000Z");
const fact = (over: Partial<SlpStoryFact>): SlpStoryFact => ({
  id: "f",
  scope: "creator",
  creatorId: "jen",
  tag: "t",
  label: "Label",
  sourceKind: "player",
  sourceId: "p",
  createdAt: "2026-10-01T00:00:00.000Z",
  expiresAt: null,
  ...over,
});

// --- A track holds one condition: a second one on the same track replaces the first. ---
const first = applySlpStoryOutcomes({
  outcomes: [{ kind: "add-creator-fact", tag: "moving", label: "Moving", track: "home", line: "Packing boxes." }],
  participants: ["jen"],
  sourceKind: "arc",
  sourceId: "a1",
  at,
  facts: [],
  opportunities: [],
});
const second = applySlpStoryOutcomes({
  outcomes: [{ kind: "add-creator-fact", tag: "new-flat", label: "New flat", track: "home", line: "Just moved in." }],
  participants: ["jen"],
  sourceKind: "arc",
  sourceId: "a2",
  at,
  facts: first.facts,
  opportunities: [],
});
assert.deepEqual(
  second.facts.map((item) => [item.tag, item.expiresAt]),
  [
    ["moving", at.toISOString()],
    ["new-flat", null],
  ],
  "the home track keeps one live condition; the old one expires",
);

// --- Budget and order: body before home, at most two lines, one look; expired and other Creators out. ---
const state = slurpStoryState({
  creatorId: "jen",
  at,
  tieTags: ["partner"],
  facts: [
    fact({ id: "w", track: "work", line: "Work line.", createdAt: "2026-10-10T00:00:00.000Z" }),
    fact({
      id: "h",
      track: "home",
      line: "Home line.",
      look: "boxes behind her",
      wardrobe: { prefer: ["comfy"], avoid: [] },
    }),
    fact({
      id: "b",
      track: "body",
      tag: "pregnant",
      line: "Body line.",
      look: "visible bump",
      wardrobe: { prefer: [], avoid: ["tight"] },
      deck: [{ line: "Feeling a kick." }, { line: "Nursery shopping.", withPartner: true }],
      share: 0.5,
    }),
    fact({ id: "old", track: "love", line: "Expired.", expiresAt: "2026-10-11T00:00:00.000Z" }),
    fact({ id: "other", creatorId: "sam", track: "body", line: "Not hers." }),
    fact({ id: "tag", tag: "plain-tag" }),
  ],
});
assert.deepEqual(state.lines, ["Body line.", "Home line."], "two lines, body track first");
assert.equal(state.look, "visible bump", "one look, from the first track that has one");
assert.deepEqual(state.wardrobe, { prefer: ["comfy"], avoid: ["tight"] });
assert.ok(state.tags.includes("pregnant") && state.tags.includes("plain-tag") && state.tags.includes("partner"));
assert.ok(!state.lines.includes("Expired.") && !state.lines.includes("Not hers."));
assert.equal(state.deck.length, 2);
assert.ok(state.deck.every((beat) => beat.share === 0.5));

// --- Ties are tags. ---
assert.deepEqual(
  slurpTieTags(
    {
      couples: [
        { aId: "jen", bId: "sam", stage: "dating" } as never,
        { aId: "jen", bId: "max", stage: "split" } as never,
      ],
      bonds: [{ aId: "jen", bId: "kim", kind: "roommate", endedAt: null } as never],
      ties: { rivalries: [{ fromId: "lee", toId: "jen", stage: "over" } as never] },
      deals: [
        { creatorId: "jen", status: "planned" },
        { creatorId: "jen", status: "declined" },
      ],
    },
    "jen",
  ).sort(),
  ["deal", "ex", "partner", "roommate"],
);

// --- The closet follows the condition, and never ends up empty. ---
const looks = [
  { id: "a", tags: ["Tight", "night"] },
  { id: "b", tags: ["comfy"] },
  { id: "c", tags: ["casual"] },
];
assert.deepEqual(
  slurpConditionCloset(looks, { prefer: [], avoid: ["tight"] }).map((look) => look.id),
  ["b", "c"],
);
assert.deepEqual(
  slurpConditionCloset(looks, { prefer: ["comfy"], avoid: ["tight"] }).map((look) => look.id),
  ["b"],
);
assert.deepEqual(
  slurpConditionCloset(looks, { prefer: ["missing"], avoid: [] }).map((look) => look.id),
  ["a", "b", "c"],
);
assert.deepEqual(
  slurpConditionCloset([looks[0]!], { prefer: [], avoid: ["tight"] }).map((look) => look.id),
  ["a"],
  "a condition that would empty the closet leaves it as it was",
);

// --- The deck takes about its share of slots, skips recent lines, and needs a partner for partner beats. ---
const intents = [
  "casual",
  "teaser",
  "set",
  "behind_the_scenes",
  "request",
  "appreciation",
  "callback",
  "business",
] as never;
const beats = Array.from({ length: 400 }, (_, sequence) =>
  slurpConditionBeat({
    creatorAccountId: "jen",
    sequence,
    state,
    history: { recentAnchors: [] },
    intents,
    partner: null,
  }),
);
const taken = beats.filter(Boolean);
assert.ok(taken.length > 120 && taken.length < 280, `share 0.5 takes about half: ${taken.length}/400`);
assert.ok(
  taken.every((beat) => beat!.anchorKind === "condition" && beat!.line === "Feeling a kick." && !beat!.cast.length),
  "without a partner, partner beats never come up",
);
assert.ok(
  Array.from({ length: 200 }, (_, sequence) =>
    slurpConditionBeat({
      creatorAccountId: "jen",
      sequence,
      state,
      history: { recentAnchors: ["Feeling a kick."] },
      intents,
      partner: null,
    }),
  ).every((beat) => beat === null),
  "a line used lately is skipped",
);
const withPartner = Array.from({ length: 200 }, (_, sequence) =>
  slurpConditionBeat({
    creatorAccountId: "jen",
    sequence,
    state,
    history: { recentAnchors: ["Feeling a kick."] },
    intents,
    partner: "Sam",
  }),
).filter(Boolean);
assert.ok(withPartner.length > 0);
assert.ok(withPartner.every((beat) => beat!.type === "relationship_moment" && beat!.cast[0] === "Sam"));
assert.equal(
  slurpConditionBeat({
    creatorAccountId: "jen",
    sequence: 1,
    state: { ...state, deck: [] },
    history: { recentAnchors: [] },
    intents,
    partner: null,
  }),
  null,
);

// --- The brief carries the lines as a standing truth, not as the subject. ---
const brief = slurpPostBriefSection(
  { type: "sensory_mood", anchorKind: "habits", anchor: "tea", line: "Tea on the balcony.", cast: [], place: null },
  at,
  (value) => value,
  null,
  null,
  state.lines,
);
assert.match(
  brief,
  /Right now: Body line\. Home line\. This stays true in this post; mention it only if this post is about it\./,
);
assert.doesNotMatch(
  slurpPostBriefSection(
    { type: "sensory_mood", anchorKind: "habits", anchor: "tea", line: "Tea.", cast: [], place: null },
    at,
    (value) => value,
  ),
  /Right now:/,
);

// --- Wiring: the condition beat sits after occasions and before steering; arc chapters apply outcomes. ---
const server = (path: string) =>
  readFileSync(new URL(`../packages/slurp2/src/engine/packages/server/src/slp/${path}`, import.meta.url), "utf8");
const beatService = server("features/feed/slp-post-beat-service.ts");
assert.ok(
  beatService.indexOf("planSlurpOccasionBeat(") < beatService.indexOf("slurpConditionBeat(") &&
    beatService.indexOf("slurpConditionBeat(") < beatService.indexOf("slurpSteeredBeat("),
  "condition moments come after occasions and before steering",
);
assert.match(
  server("data/projects/slp-projects-storage-1.ts"),
  /slurpStageOutcomes\(after\.storyline[\s\S]{0,240}enter: moved \|\| \(started && before\.status !== "paused"\)[\s\S]{0,400}await this\.applyStoryOutcomes\(/u,
  "a stage that starts applies its outcomes from the run's storyline, never again on a resume",
);
for (const path of ["features/media/slp-images-service.ts", "features/media/slp-public-images-service.ts"])
  assert.match(server(path), /withSlurpConditionLook\(/u, `${path} carries the condition look`);
assert.match(server("features/messages/slp-message-generation-service.ts"), /happeningNow: \[\.\.\.\(input\.rightNow/u);

assert.match(
  server("features/media/slp-images-service.ts"),
  /if \(!input\.skipCondition && !input\.suppressCharacterContext\)/u,
  "a commission of the player never takes the Creator's condition",
);
assert.match(server("features/assist/slp-assist-service.ts"), /skipCondition: slot !== null/u);
const routes = server("features/storylines/slp-story-state-routes.ts");
assert.match(routes, /\.slice\(0, 64\)/u, "a long label still makes a valid tag");
assert.match(routes, /slpStoryFactSchema\.safeParse\(/u, "a player condition is checked as stored");

// --- Review fixes: a condition without a line reaches the writer; avoided topics leave the deck. ---
assert.deepEqual(
  slurpStoryState({ creatorId: "jen", at, facts: [fact({ track: "body", label: "Pregnant", look: "bump" })] }).lines,
  ["Pregnant"],
);
assert.ok(
  Array.from({ length: 100 }, (_, sequence) =>
    slurpConditionBeat({
      creatorAccountId: "jen",
      sequence,
      state,
      history: { recentAnchors: [] },
      intents,
      partner: null,
      avoid: ["KICK"],
    }),
  ).every((beat) => beat === null),
  "a moment that names an avoided topic is left out",
);

// --- A post with no beat (the classic planner) is about a deck moment at the same share; never a partner one. ---
const plain = Array.from({ length: 400 }, (_, sequence) => slurpStoryNow(state, "jen", sequence, [], true));
const moments = plain.filter((now) => now.moment);
assert.ok(moments.length > 120 && moments.length < 280, `share 0.5 takes about half: ${moments.length}/400`);
assert.ok(moments.every((now) => now.moment === "Feeling a kick."));
assert.ok(plain.every((now) => now.lines.length === 2));
assert.equal(
  slurpStoryNow(state, "jen", 1, [], false).moment,
  null,
  "a post with a beat or a direction has its subject",
);
assert.ok(
  Array.from({ length: 50 }, (_, sequence) => slurpStoryNow(state, "jen", sequence, ["kick"], true)).every(
    (now) => !now.moment,
  ),
);
assert.match(
  slurpRightNowLine(["You are pregnant."], (value) => value, "Feeling a kick"),
  /^Right now: You are pregnant\. This post is about one small moment of it, in your own words: Feeling a kick\.$/,
);
assert.match(
  server("features/feed/slp-generation-service.ts"),
  /storyNow: slurpStoryNow\(story\.state, account\.id, sequence, steering\?\.avoid, !\(beat \|\| directed \|\| project\)\)/u,
);

// --- Review fixes 2: a new condition expires the old one on its track and keeps it; arcs write none while
// Storylines is off; arc generation never reads a condition as a theme. ---
const kept = putSlpStoryFact([fact({ id: "old", track: "body" }), fact({ id: "home", track: "home" })], {
  ...fact({ id: "new", track: "body" }),
  createdAt: "2026-10-12T00:00:00.000Z",
});
assert.deepEqual(
  kept.map((item) => [item.id, item.expiresAt]),
  [
    ["old", "2026-10-12T00:00:00.000Z"],
    ["home", null],
    ["new", null],
  ],
);
assert.match(
  server("data/projects/slp-projects-storage-1.ts"),
  /settings &&\s+slpExtensionOn\(settings, "storylines"\)/u,
);
assert.match(
  server("features/projects/slp-arc-generation-service.ts"),
  /fact\.creatorId === creator\.id &&\s+!fact\.track/u,
);

console.log("slurp2 story state regression passed");
