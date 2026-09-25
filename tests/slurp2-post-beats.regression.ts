import assert from "node:assert/strict";
import {
  SLURP_ARC_LIBRARY_SEED,
  slurpAutoArcPick,
  slurpArcTypeIsOnce,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/projects/slp-arc-library.ts";
import { slurpTimelineMoment } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/creators/slp-creator-schedule-context.ts";
import {
  SLURP_BEAT_TYPES,
  parseSlurpBeat,
  selectSlurpBeat,
  slurpArcBeat,
  slurpPlannedExplicitLevel,
  slurpBeatIntents,
  slurpBeatThemeCap,
  type SlurpBeatHistory,
  type SlurpBeatType,
  type SlurpCanonAnchors,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/feed/slp-post-beat.ts";
import {
  checkSlurpBeatClaims,
  normalizeSlurpCanonAnchors,
  parseSlurpBeatClaims,
  slurpPostBriefSection,
  slurpBeatFactFromPost,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/feed/slp-post-brief.ts";
import {
  slurpPostVariation,
  slurpPostVariationInstruction,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/feed/slp-post-variation.ts";
import { slurpPostAxes } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/feed/slp-content-axes.ts";

// The beats planner picks what happens in an ordinary post from the Creator's own card, so the model
// stops filling the gap with the same few subjects. Invented character; no production data.
const anchors: SlurpCanonAnchors = {
  people: [
    { name: "Juno", relation: "sister" },
    { name: "Mr. Albescu", relation: "landlord" },
  ],
  places: ["the Brass Kettle tea shop", "the rooftop garden"],
  work: ["hand-lettered menu boards"],
  objects: ["a dented copper kettle"],
  habits: ["the Sunday crossword"],
  runningJokes: ["the cursed teaspoon"],
  palette: { showcase: 4, relationship_moment: 3, mishap: 5 },
  heat: { min: 0, max: 1 },
};
const empty: SlurpBeatHistory = { recentOwn: [], recentAnchors: [], globalCounts: {} };
const ordinary = ["casual", "set", "behind_the_scenes", "appreciation", "business"] as const;

// Deterministic: the same Creator, post count and history always give the same beat.
const first = selectSlurpBeat("creator-a", 7, anchors, empty, ordinary);
assert.ok(first, "a card with anchors must produce a beat");
assert.deepEqual(selectSlurpBeat("creator-a", 7, anchors, empty, ordinary), first);
assert.ok(!first.line.includes("{a}"), "the template slot is filled");
assert.ok(first.line.includes(first.anchor), "the beat line names its canon anchor");
if (first.anchorKind === "people") assert.equal(first.cast.length, 1, "a person beat names its cast");
else assert.deepEqual(first.cast, [], "a non-person beat is cast alone");
assert.deepEqual(parseSlurpBeat(JSON.stringify(first)), first, "a stored beat round-trips for retries");
assert.equal(parseSlurpBeat("{broken"), null);

// Palette, quota and theme cap: over many slots every drawn type stays varied, the mishap weight is
// capped even when the palette asks for 5, and no type becomes the default.
const draw = (history: SlurpBeatHistory, count = 400) => {
  const counts: Partial<Record<SlurpBeatType, number>> = {};
  for (let sequence = 0; sequence < count; sequence += 1) {
    const beat = selectSlurpBeat("creator-b", sequence, anchors, history, ordinary)!;
    counts[beat.type] = (counts[beat.type] ?? 0) + 1;
  }
  return counts;
};
const counts = draw(empty);
assert.ok(Object.keys(counts).length >= 8, `beat types stay varied: ${JSON.stringify(counts)}`);
assert.ok((counts.mishap ?? 0) < (counts.showcase ?? 0), "a mishap is one type among many, not the default");
assert.ok((counts.mishap ?? 0) / 400 < 0.2, "the mishap share stays small");

// This Creator's last beat steps back.
const afterShowcase = draw({ ...empty, recentOwn: ["showcase"] });
assert.ok((afterShowcase.showcase ?? 0) < (counts.showcase ?? 0) / 3, "the last beat type is rarely repeated");

// A type the whole feed used too often in the last day is capped across Creators.
assert.equal(slurpBeatThemeCap({}), 3);
assert.equal(slurpBeatThemeCap({ showcase: 30, mishap: 6 }), 6);
const feedFull = draw({ ...empty, globalCounts: { showcase: 3, relationship_moment: 3 } });
assert.equal(feedFull.showcase ?? 0, 0, "a capped type is not drawn");
assert.equal(feedFull.relationship_moment ?? 0, 0);
// Every type capped: the cap yields rather than losing the slot.
const allCapped = Object.fromEntries(SLURP_BEAT_TYPES.map((type) => [type, 3]));
assert.ok(selectSlurpBeat("creator-b", 1, anchors, { ...empty, globalCounts: allCapped }, ordinary));

// A card with no people cannot produce a people-only beat; nothing usable means classic.
const noPeople = { ...anchors, people: [] };
for (let sequence = 0; sequence < 100; sequence += 1) {
  const beat = selectSlurpBeat("creator-c", sequence, noPeople, empty, ordinary)!;
  assert.notEqual(beat.anchorKind, "people");
  assert.ok(!["social_moment", "relationship_moment"].includes(beat.type));
}
assert.equal(normalizeSlurpCanonAnchors({ people: [], places: [] }), null, "an empty extraction is no anchors");

// Beat -> intent: a teaser slot only takes beats that can tease, and the derived intent always fits.
for (let sequence = 0; sequence < 60; sequence += 1) {
  const beat = selectSlurpBeat("creator-d", sequence, anchors, empty, ["teaser"])!;
  assert.ok(slurpBeatIntents(beat.type).includes("teaser"), `${beat.type} cannot tease`);
  const ordinaryBeat = selectSlurpBeat("creator-d", sequence, anchors, empty, ordinary)!;
  const axes = slurpPostAxes("creator-d", sequence, {
    images: true,
    intentsAllowed: slurpBeatIntents(ordinaryBeat.type),
  });
  assert.ok(slurpBeatIntents(ordinaryBeat.type).includes(axes.intent), `${ordinaryBeat.type} -> ${axes.intent}`);
  assert.ok(!["request", "callback"].includes(axes.intent), "commitments stay intent-first");
}

// The brief closes the gaps the writer used to fill: cast, place, time, what came before, free zone.
const personBeat = {
  type: "relationship_moment" as const,
  anchorKind: "people" as const,
  anchor: "Juno",
  line: "Juno does something small that shows how well they know you.",
  cast: ["Juno (sister)"],
  place: "the Brass Kettle tea shop",
};
const brief = slurpPostBriefSection(personBeat, new Date(2026, 8, 25, 19, 30), (value) => value);
assert.match(brief, /^# This post\nWhat happens: Juno does something small/u);
assert.match(brief, /Cast: Juno \(sister\)\. Nobody else is named\./u);
assert.match(brief, /Place: the Brass Kettle tea shop/u);
assert.match(brief, /Time: evening/u);
assert.match(brief, /Just before: nothing relevant\./u);
assert.match(
  brief,
  /Free zone: you may invent reactions, feelings, sensory detail, jokes, and wording\. Do not add people, earlier events, times, or lasting changes/u,
);
assert.match(brief, /# End this post$/u);
assert.match(
  slurpPostBriefSection({ ...personBeat, cast: [], place: null }, new Date(2026, 8, 25, 8), (value) => value),
  /Cast: no named people\. You are alone\.[\s\S]*Place: wherever today's schedule puts you/u,
);
assert.match(
  slurpPostBriefSection(personBeat, new Date(), (value) => value.replace("Juno", "J.")),
  /Cast: J\. \(sister\)/u,
);

// The beat replaces the vague axis prose; camera and company stay.
const variation = slurpPostVariation("creator-e", 3);
const classic = slurpPostVariationInstruction(variation, "Camera: CAMERA_LINE.");
const beats = slurpPostVariationInstruction(variation, "Camera: CAMERA_LINE.", { beat: true });
assert.match(classic, /^Place: /mu);
assert.match(classic, /Let their own life supply the specifics/u);
assert.doesNotMatch(beats, /^Place: |^Moment: |Let their own life supply the specifics/mu);
assert.match(beats, /CAMERA_LINE/u);
assert.match(beats, /^Company: /mu);

// Claims: people outside the cast, unsupported earlier events and lasting changes are mismatches.
const claims = parseSlurpBeatClaims({
  title: "t",
  content: "c",
  claims: {
    people: ["Juno", "Wren Holloway", "followers", "Tamsin"],
    earlierEvents: ["the tea shop opening", "our trip to Lisbon"],
    stateChanges: ["quit my job"],
  },
});
const check = checkSlurpBeatClaims(claims, personBeat, ["Tamsin", "tamsin_tea"]);
assert.equal(check.ok, false);
assert.deepEqual(check.problems, [
  "person not in the cast: Wren Holloway",
  "earlier event not in the brief: our trip to Lisbon",
  "lasting change: quit my job",
]);
assert.equal(
  checkSlurpBeatClaims(
    parseSlurpBeatClaims({ claims: { people: ["Juno"], earlierEvents: [], stateChanges: [] } }),
    personBeat,
    [],
  ).ok,
  true,
);
// A model that ignores the field is recorded, never failed.
assert.deepEqual(checkSlurpBeatClaims(parseSlurpBeatClaims({ title: "t" }), personBeat, []), {
  ok: true,
  problems: [],
  claims: null,
});

// The company line may put unnamed people in the scene; the cast must agree, and the claim check
// accepts an unnamed role then, but still rejects an invented named person.
assert.match(
  slurpPostBriefSection({ ...personBeat, cast: [] }, new Date(), (value) => value, "in a public place among strangers"),
  /Cast: no named people\. Anyone else stays unnamed, as the company line says: in a public place among strangers\./u,
);
{
  const mixed = { people: ["a stranger", "Marco"], earlierEvents: [], stateChanges: [] };
  const withCompany = checkSlurpBeatClaims(mixed, { ...personBeat, cast: [] }, ["Tamsin"], true);
  assert.deepEqual(withCompany.problems, ["person not in the cast: Marco"]);
  const alone = checkSlurpBeatClaims(mixed, { ...personBeat, cast: [] }, ["Tamsin"], false);
  assert.equal(alone.problems.length, 2, "alone: an unnamed stranger is also an addition");
}

// A published beat post establishes its beat for a week; a post without one establishes nothing.
{
  const post = {
    id: "post-1",
    access: "locked",
    createdAt: "2026-09-25T10:00:00.000Z",
    metadata: { slurpBeat: { type: "showcase", line: "You show the finished cape", anchor: "cape" } },
  };
  const fact = slurpBeatFactFromPost(post);
  assert.equal(fact?.text, "Posted about: You show the finished cape");
  assert.equal(fact?.audienceScope, "creator_private", "a locked post's moment stays with the Creator");
  assert.equal(fact?.expiresAt.toISOString(), "2026-10-02T10:00:00.000Z");
  assert.equal(slurpBeatFactFromPost({ ...post, metadata: {} }), null);
}

// The day plan: the block running at publication and the one before, from a schedule or a routine.
{
  const day = [
    { time: "07:30", activity: "breakfast at home" },
    { time: "10:00", activity: "working the bar" },
    { time: "23:00", activity: "asleep" },
  ];
  assert.deepEqual(slurpTimelineMoment(day, new Date(2026, 8, 25, 12, 0)), {
    current: "working the bar",
    previous: "breakfast at home",
    queued: false,
  });
  // Before the first block, last night's sleep is still running: nobody posts asleep, so the
  // post was written in the last block before it.
  assert.deepEqual(slurpTimelineMoment(day, new Date(2026, 8, 25, 5, 0)), {
    current: "working the bar",
    previous: "breakfast at home",
    queued: true,
  });
  // Gym and set are post material, not "cannot post".
  assert.equal(
    slurpTimelineMoment([{ time: "09:00", activity: "gym session" }], new Date(2026, 8, 25, 10))?.current,
    "gym session",
  );
  assert.equal(
    slurpTimelineMoment([{ time: "00:00", activity: "asleep" }], new Date()),
    null,
    "only sleep: say nothing",
  );
  assert.equal(slurpTimelineMoment([], new Date()), null);
  const brief = slurpPostBriefSection(personBeat, new Date(2026, 8, 25, 12), (value) => value, null, {
    current: "working the bar",
    previous: "breakfast at home",
  });
  assert.match(brief, /Right now in your day: working the bar\./u);
  assert.match(brief, /Just before: breakfast at home\./u);
  const anchors = normalizeSlurpCanonAnchors({
    places: ["the bar"],
    routine: [
      { time: "08:00", activity: "opening the bar" },
      { time: "late", activity: "bad time" },
    ],
  });
  assert.deepEqual(anchors?.routine, [{ time: "08:00", activity: "opening the bar" }], "only HH:MM blocks survive");
}

// Arcs on the beat rails: the chapter is the beat, the chapter before it is named, and the claim
// check allows the change an arc chapter is.
{
  const arc = slurpArcBeat({
    title: "Moving house",
    direction: "",
    chapters: ["packing up", "moving day", "settling in"],
    chapter: 1,
  });
  assert.equal(arc.anchorKind, "arc");
  assert.equal(arc.type, "routine_twist");
  assert.equal(arc.line, "Moving house, now: moving day. It follows: packing up.");
  assert.equal(slurpArcBeat({ title: "T", direction: "", chapters: ["a", "b"], chapter: 1 }).type, "achievement");
  const claims = { people: [], earlierEvents: ["packing up"], stateChanges: ["moved into a new flat"] };
  assert.equal(checkSlurpBeatClaims(claims, arc, ["Tamsin"]).ok, true, "an arc chapter may change a life");
  assert.match(
    slurpPostBriefSection(arc, new Date(), (value) => value),
    /This chapter may change your life/u,
  );
}

// Knockout: a once-type (moving) never starts automatically again for a Creator who had it.
{
  const moving = SLURP_ARC_LIBRARY_SEED.find((type) => type.id === "moving")!;
  const trip = SLURP_ARC_LIBRARY_SEED.find((type) => type.id === "trip")!;
  assert.equal(slurpArcTypeIsOnce(moving), true);
  assert.equal(slurpArcTypeIsOnce(trip), false);
  assert.equal(slurpArcTypeIsOnce({ ...trip, once: true }), true, "a custom type can opt in");
  const pastMove = { typeId: "moving", status: "completed" } as never;
  let movedAgain = false;
  for (let day = 0; day < 400; day += 1) {
    const pick = slurpAutoArcPick({
      creatorAccountId: "creator-k",
      at: new Date(Date.UTC(2026, 0, 1) + day * 86_400_000),
      projects: [pastMove],
      library: [moving, trip],
      creatorTags: [],
      lastAutoAt: null,
      cooldownWeeks: 1,
    });
    if (pick && "type" in pick && pick.type.id === "moving") movedAgain = true;
  }
  assert.equal(movedAgain, false, "a Creator who moved never moves again on their own");
  let movedFresh = false;
  for (let day = 0; day < 400 && !movedFresh; day += 1) {
    const pick = slurpAutoArcPick({
      creatorAccountId: "creator-k",
      at: new Date(Date.UTC(2026, 0, 1) + day * 86_400_000),
      projects: [],
      library: [moving, trip],
      creatorTags: [],
      lastAutoAt: null,
      cooldownWeeks: 1,
    });
    movedFresh = Boolean(pick && "type" in pick && pick.type.id === "moving");
  }
  assert.equal(movedFresh, true, "without a past move the same draw does pick moving");
}

// The schedule decides where they are: a place the block is about wins, another is rare and
// becomes a plan or a memory.
{
  const barAnchors = {
    people: [],
    places: ["the bar", "the beach"],
    work: ["mixing cocktails"],
    objects: [],
    habits: [],
    runningJokes: [],
    palette: {},
    heat: { min: 0, max: 1 },
  };
  const history = { recentOwn: [], recentAnchors: [], globalCounts: {} };
  let beach = 0;
  let bar = 0;
  for (let sequence = 0; sequence < 300; sequence += 1) {
    const beat = selectSlurpBeat("creator-b", sequence, barAnchors, history, ["casual"], [], "working the bar");
    if (!beat) continue;
    if (beat.anchor === "the beach") {
      beach += 1;
      assert.equal(beat.elsewhere, true, "the beach during a bar shift is posted as a plan or memory");
    }
    if (beat.anchor === "the bar" || beat.place === "the bar") bar += 1;
    if (beat.anchor !== "the beach")
      assert.notEqual(beat.place, "the beach", "the ambient place is never one the schedule contradicts");
  }
  assert.ok(bar > beach * 3, `bar ${bar} vs beach ${beach}`);
  const elsewhere = {
    ...personBeat,
    anchorKind: "places" as const,
    anchor: "the beach",
    place: "the beach",
    elsewhere: true,
  };
  assert.match(
    slurpPostBriefSection(elsewhere, new Date(), (value) => value, null, {
      current: "working the bar",
      previous: null,
    }),
    /not where you are right now: post about it from where you are, as a plan, a memory, or a wish/u,
  );
  assert.match(
    slurpPostBriefSection(personBeat, new Date(), (value) => value, null, {
      current: "working the bar",
      previous: null,
      queued: true,
    }),
    /You wrote this post just before; do not mention sleeping, being awake, or being on the road\./u,
  );
  const arc = slurpArcBeat({ title: "Moving house", direction: "", chapters: ["moving day"], chapter: 0 });
  assert.match(
    slurpPostBriefSection(arc, new Date(), (value) => value, null, { current: "working the bar", previous: null }),
    /Your usual plan for now: working the bar\. Today the arc changes that: the chapter decides what you do\./u,
  );
}

// Heat plan: never above the dial, never below the card's floor, mostly at the top.
{
  const levels = ["none", "suggestive", "nudity", "explicit"];
  const counts: Record<string, number> = {};
  for (let sequence = 0; sequence < 400; sequence += 1) {
    const level = slurpPlannedExplicitLevel("nudity", 1, "creator-h", sequence);
    counts[level] = (counts[level] ?? 0) + 1;
    assert.ok(levels.indexOf(level) >= 1 && levels.indexOf(level) <= 2, level);
  }
  assert.ok((counts.nudity ?? 0) > (counts.suggestive ?? 0) * 2, JSON.stringify(counts));
  assert.equal(slurpPlannedExplicitLevel("none", 3, "creator-h", 1), "none", "the dial always wins");
  assert.equal(slurpPlannedExplicitLevel("explicit", 3, "creator-h", 1), "explicit", "an explicit card stays explicit");
  assert.equal(
    slurpPlannedExplicitLevel("nudity", 1, "creator-h", 7),
    slurpPlannedExplicitLevel("nudity", 1, "creator-h", 7),
    "a retry plans the same heat",
  );
}

console.log("slurp2 post beats regression checks passed");
