/**
 * 7b-1 "more life, same people": life moments (fit filter, real signals, variety), new storylines
 * that only start where they fit, the other Agents' data in the flavour brief, and the question
 * about prepared posts after a steering change.
 */
import assert from "node:assert/strict";
import {
  SLURP_NO_LIFE_SIGNALS,
  slurpFittingLifeMoments,
  slurpLifeBeat,
  slurpLifeSignalsFrom,
  type SlurpLifeCreator,
  type SlurpLifeSignals,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/feed/slp-life-moments.ts";
import { parseSlurpBeat } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/feed/slp-post-beat.ts";
import { checkSlurpBeatClaims } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/feed/slp-post-brief.ts";
import {
  SLURP_ARC_LIBRARY_SEED,
  slurpArcFitsCreator,
  slurpAutoArcPick,
  slurpNormalizeArcLibrary,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/projects/slp-arc-library.ts";
import { compileSlurpFlavourBrief } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/creators/slp-creator-flavour.ts";
import {
  slurpPlanRewritable,
  slurpPreparedRewriteCost,
  slurpSteeringContentChanged,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/feed/slp-prepared-rewrite.ts";
import { SLP_DEFAULT_STEERING } from "../packages/slurp2/src/engine/packages/shared/src/slp/slp-creator-steering.ts";
import { FLAVOUR_FIXTURES, type FlavourFixture } from "./slurp2-flavour-fixtures.ts";
import { slurp2Source } from "./slurp2-source.ts";

const root = "packages/slurp2/src/engine/packages";
const server = (path: string) => slurp2Source(`${root}/server/src/slp/${path}`);
const client = (path: string) => slurp2Source(`${root}/client/src/slp/${path}`);

const creatorOf = (fixture: FlavourFixture): SlurpLifeCreator => ({
  text: [fixture.card.description, fixture.card.personality, fixture.card.backstory].join("\n"),
  anchors: fixture.anchors,
});
const [mira, kai, anna, rue] = FLAVOUR_FIXTURES.map(creatorOf) as [
  SlurpLifeCreator,
  SlurpLifeCreator,
  SlurpLifeCreator,
  SlurpLifeCreator,
];
const ids = (creator: SlurpLifeCreator, signals: SlurpLifeSignals = SLURP_NO_LIFE_SIGNALS) =>
  slurpFittingLifeMoments(creator, signals).map((moment) => moment.id);
const CASUAL = ["casual", "set", "behind_the_scenes", "appreciation", "business"] as const;
const DRAMA = ["copycat", "shade", "misread"];

// --- Fit: a moment that does not fit the Creator is not used ---------------------------------
assert.ok(ids(mira).includes("workout"), "a climbing coach can post a workout");
assert.ok(!ids(kai).includes("workout") && !ids(anna).includes("workout"), "no gym for a tattoo artist or a baker");
assert.ok(ids(anna).includes("cooking"), "a baker cooks");
assert.ok(!ids(rue).includes("cooking"), "a streamer with no kitchen in their card does not");
for (const creator of [mira, kai, anna, rue]) {
  for (const id of DRAMA) assert.ok(!ids(creator).includes(id), `no drama for a Creator who is not like that: ${id}`);
}
const noGym: SlurpLifeCreator = {
  ...mira,
  text: `${mira.text}\nShe climbs outdoors only and hates the gym and every workout plan.`,
};
assert.ok(!ids(noGym).includes("workout"), "a card that says they hate the gym rules the workout out");
assert.ok(!ids(noGym).includes("workout-sore"));
assert.ok(!ids({ ...mira, avoid: ["workouts"] }).includes("workout"), "a leave-out topic blocks the moment");
assert.ok(ids({ ...mira, avoid: ["Tess"] }).includes("workout"), "an unrelated leave-out topic does not");
const sassy: SlurpLifeCreator = { ...rue, text: `${rue.text}\nSassy, petty, and never lets a slight go.` };
assert.ok(
  DRAMA.every((id) => ids(sassy).includes(id)),
  "drama only for a sassy, petty Creator",
);
// Their own life: work moments need work, people moments need people.
assert.ok(!ids({ ...rue, anchors: { ...rue.anchors, people: [] } }).includes("people-plans"));
assert.ok(ids(mira).includes("people-plans") && ids(mira).includes("work-bad-day"));

// --- Real signals only -------------------------------------------------------------------------
for (const signal of ["milestone", "viral", "fan-gift", "comment-fight", "back-after-quiet"])
  assert.ok(!ids(mira).includes(signal), `no ${signal} without it really happening`);
const happened: SlurpLifeSignals = {
  quietDays: 4,
  milestone: 1000,
  viral: { id: "post-9", label: "purple route sent" },
  gift: true,
  busyComments: true,
};
for (const signal of ["milestone", "viral", "fan-gift", "comment-fight", "back-after-quiet"])
  assert.ok(ids(mira, happened).includes(signal), `${signal} when it happened`);

const AT = Date.parse("2026-09-27T12:00:00.000Z");
const at = new Date(AT);
const hoursAgo = (hours: number) => new Date(AT - hours * 3_600_000).toISOString();
const post = (id: string, hours: number, likes: number, repliers: string[] = [], access = "public") => ({
  id,
  createdAt: hoursAgo(hours),
  access,
  title: null,
  content: `post ${id} about the purple route and a lot of chalk everywhere`,
  likes,
  repliers,
});
const quiet = slurpLifeSignalsFrom({
  at,
  posts: [post("a", 100, 3), post("b", 130, 4), post("c", 150, 2), post("d", 170, 5)],
  followers: 540,
  milestoneReached: 500,
  tipTimes: [hoursAgo(200)],
});
assert.equal(quiet.quietDays, 4);
assert.equal(quiet.milestone, 500, "540 followers: 500 was just passed");
assert.equal(quiet.viral, null, "nothing took off");
assert.equal(quiet.gift, false, "a tip eight days ago is old news");
assert.equal(quiet.busyComments, false);
assert.equal(
  slurpLifeSignalsFrom({ at, posts: [], followers: 700, milestoneReached: 500, tipTimes: [] }).milestone,
  null,
  "700 followers: the 500 milestone is long past",
);
const busy = slurpLifeSignalsFrom({
  at,
  posts: [
    post("a", 5, 90, ["f1", "f2", "f3", "f1", "f2", "f3"]),
    post("b", 30, 4),
    post("c", 60, 5),
    post("d", 90, 3),
    post("e", 120, 60, [], "locked"),
  ],
  followers: 90,
  milestoneReached: null,
  tipTimes: [hoursAgo(10)],
});
assert.equal(busy.viral?.id, "a", "90 likes against a usual 5 took off");
assert.ok(busy.viral!.label.split(" ").length <= 9, "the post is named in a few words");
assert.equal(busy.gift, true);
assert.equal(busy.busyComments, true, "six replies from three people");
assert.equal(busy.quietDays, 0);
assert.equal(
  slurpLifeSignalsFrom({
    at,
    posts: [post("a", 5, 90, ["f1", "f1", "f1", "f1", "f1", "f1"])],
    followers: 0,
    milestoneReached: null,
    tipTimes: [],
  }).busyComments,
  false,
  "one person replying six times is not a comment fight",
);

// --- The beat ------------------------------------------------------------------------------------
const beat = (
  creator: SlurpLifeCreator,
  id: string,
  sequence: number,
  extra: Partial<Parameters<typeof slurpLifeBeat>[3]> = {},
  used: string[] = [],
  today: Record<string, number> = {},
) =>
  slurpLifeBeat(
    id,
    sequence,
    creator,
    { ...SLURP_NO_LIFE_SIGNALS, ...extra },
    { recentAnchors: [], sharedToday: today },
    used,
    [...CASUAL],
  );
assert.equal(
  slurpLifeBeat("fixture-mira", 1, mira, SLURP_NO_LIFE_SIGNALS, { recentAnchors: [] }, [], ["teaser"]),
  null,
  "never on a teaser slot",
);
let taken = 0;
for (let sequence = 0; sequence < 300; sequence += 1) {
  const life = beat(mira, "fixture-mira", sequence);
  if (!life) continue;
  taken += 1;
  assert.equal(life.anchorKind, "life");
  assert.ok(life.sharedId?.startsWith("life:"));
  assert.ok(!/\{a\}|\{n\}|\{post\}/u.test(life.line), "every slot is filled");
  assert.deepEqual(parseSlurpBeat(JSON.stringify(life)), life, "a stored life beat reads back");
  // A life moment is free-standing: it may not add a lasting change to their life.
  assert.equal(
    checkSlurpBeatClaims({ people: [], earlierEvents: [], stateChanges: ["moved out"] }, life, ["Mira Vale"]).ok,
    false,
  );
}
assert.ok(taken / 300 > 0.22 && taken / 300 < 0.45, `about one ordinary post in three: ${taken}/300`);
// Something real that just happened is posted about more often, and only once.
let milestones = 0;
for (let sequence = 0; sequence < 100; sequence += 1)
  if (beat(mira, "fixture-mira", sequence, { milestone: 1000 })?.sharedId === "life:milestone:1000") milestones += 1;
assert.ok(milestones >= 25, `a fresh milestone gets posted about: ${milestones}/100`);
for (let sequence = 0; sequence < 100; sequence += 1)
  assert.notEqual(
    beat(mira, "fixture-mira", sequence, { milestone: 1000 }, ["life:milestone:1000"])?.sharedId,
    "life:milestone:1000",
    "a milestone already posted about never comes back",
  );
const milestoneBeat = [...Array(100).keys()]
  .map((sequence) => beat(mira, "fixture-mira", sequence, { milestone: 1000 }))
  .find((life) => life?.sharedId === "life:milestone:1000")!;
assert.match(milestoneBeat.line, /1,000 followers/u);
// One moment reaches at most two Creators a day.
for (let sequence = 0; sequence < 200; sequence += 1)
  assert.notEqual(beat(mira, "fixture-mira", sequence, {}, [], { "life:bad-day": 2 })?.sharedId, "life:bad-day");

// --- Variety on a batch (the 7b0 measure: nothing identical to the previous one, low overlap) ---
const words = (value: string) =>
  new Set(
    value
      .toLocaleLowerCase()
      .split(/[^\p{L}]+/u)
      .filter((word) => word.length > 3),
  );
const jaccard = (left: string, right: string) => {
  const a = words(left);
  const b = words(right);
  const shared = [...a].filter((word) => b.has(word)).length;
  return shared / Math.max(1, new Set([...a, ...b]).size);
};
// Four Creators post side by side; a day is six slots each (the feed-wide cap is per day).
let today: Record<string, number> = {};
let overlapSum = 0;
let overlapCount = 0;
const runs = FLAVOUR_FIXTURES.map((fixture) => ({
  fixture,
  creator: creatorOf(fixture),
  used: [] as string[],
  kinds: [] as string[],
  previous: null as string | null,
}));
for (let sequence = 0; sequence < 60; sequence += 1) {
  if (sequence % 6 === 0) today = {};
  for (const run of runs) {
    if (run.used.length >= 12) continue;
    const life = slurpLifeBeat(
      run.fixture.id,
      sequence,
      run.creator,
      SLURP_NO_LIFE_SIGNALS,
      { recentAnchors: [], sharedToday: today },
      run.used,
      [...CASUAL],
    );
    if (!life) continue;
    assert.ok(
      !run.used.slice(0, 6).includes(life.sharedId!),
      `${run.fixture.name}: no moment again within six: ${life.sharedId}`,
    );
    if (run.previous) {
      assert.notEqual(life.line, run.previous);
      overlapSum += jaccard(run.previous, life.line);
      overlapCount += 1;
    }
    run.kinds.push(
      slurpFittingLifeMoments(run.creator, SLURP_NO_LIFE_SIGNALS).find(
        (moment) => `life:${moment.id}` === life.sharedId,
      )!.kind,
    );
    run.used.unshift(life.sharedId!);
    today[life.sharedId!] = (today[life.sharedId!] ?? 0) + 1;
    assert.ok(today[life.sharedId!]! <= 2, "no moment for more than two Creators a day");
    run.previous = life.line;
  }
}
for (const { fixture, used, kinds } of runs) {
  assert.ok(used.length >= 10, `${fixture.name}: enough life in sixty slots (${used.length})`);
  assert.ok(
    new Set(used).size >= 8,
    `${fixture.name}: twelve life moments are varied (${new Set(used).size} different)`,
  );
  for (let index = 2; index < kinds.length; index += 1)
    assert.ok(
      !(kinds[index] === kinds[index - 1] && kinds[index] === kinds[index - 2]),
      `${fixture.name}: never three of a kind in a row`,
    );
}
assert.ok(
  overlapSum / overlapCount < 0.15,
  `word overlap with the previous moment: ${(overlapSum / overlapCount).toFixed(2)}`,
);

// --- Storylines: more of them, and only where they fit ------------------------------------------
const seedIds = SLURP_ARC_LIBRARY_SEED.map((type) => type.id);
for (const id of ["new_look", "busy_season", "new_hobby", "saving_up", "family_visit"]) assert.ok(seedIds.includes(id));
assert.equal(new Set(seedIds).size, seedIds.length, "no duplicate storyline ids");
const saved = slurpNormalizeArcLibrary([
  { ...SLURP_ARC_LIBRARY_SEED[0], hidden: true, enabled: false },
  ...SLURP_ARC_LIBRARY_SEED.slice(1, 6),
]);
assert.equal(saved.length, SLURP_ARC_LIBRARY_SEED.length, "new built-ins join a saved library");
assert.equal(saved[0]!.hidden, true, "a built-in the player deleted stays deleted");
const breakup = { id: "breakup" };
assert.equal(slurpArcFitsCreator(breakup, creatorOf(FLAVOUR_FIXTURES[0]!).text), false, "no breakup without a partner");
assert.equal(slurpArcFitsCreator(breakup, "She lives with her girlfriend Noor."), true);
assert.equal(slurpArcFitsCreator({ id: "family_visit" }, anna.text + "\nIlse Mutter"), true);
assert.equal(slurpArcFitsCreator({ id: "family_visit" }, "A streamer who lives alone."), false);
assert.equal(slurpArcFitsCreator({ id: "fitness" }, "He hates the gym and never exercises."), false);
assert.equal(slurpArcFitsCreator({ id: "trip" }, ""), true, "types without a rule fit everyone");
const picks = new Set<string>();
for (let day = 0; day < 400; day += 1) {
  const pick = slurpAutoArcPick({
    creatorAccountId: "fixture-kai",
    at: new Date(AT + day * 86_400_000),
    projects: [],
    library: SLURP_ARC_LIBRARY_SEED,
    creatorTags: [],
    lastAutoAt: null,
    cooldownWeeks: 1,
    creatorText: "A tattoo artist who lives alone with a cat.",
  });
  if (pick && "type" in pick) picks.add(pick.type.id);
}
assert.ok(
  picks.size >= 3 && !picks.has("breakup") && !picks.has("family_visit"),
  `fitting storylines only: ${[...picks]}`,
);

// --- What the player's other Agents know, in the brief -------------------------------------------
const fixture = FLAVOUR_FIXTURES[1]!;
const lately = [
  { kind: "outfit" as const, text: "Lately you have been wearing a green flannel shirt." },
  { kind: "memory" as const, text: "Kai once tattooed a whole sleeve in one night for a friend." },
  { kind: "mood" as const, text: "You have been feeling tense lately." },
];
const brief = (sequence: number, mood: "cozy" | null = null) =>
  compileSlurpFlavourBrief(
    {
      accountId: fixture.id,
      name: fixture.name,
      card: fixture.card,
      anchors: fixture.anchors,
      ownLines: fixture.captions,
      steering: mood ? { ...SLP_DEFAULT_STEERING, mood } : null,
      lately,
    },
    { use: "post", sequence },
  );
const reached = new Set(Array.from({ length: 12 }, (_, sequence) => brief(sequence).bits).flat());
for (const line of lately)
  assert.ok(
    [...reached].some((key) => key.startsWith(`lately:${line.kind}`)),
    `${line.kind} reaches the brief`,
  );
for (let sequence = 0; sequence < 12; sequence += 1) {
  assert.ok(!brief(sequence, "cozy").text.includes("tense"), "the player's mood outranks another Agent's reading");
  assert.ok(
    !/\b(Long-Term Memory|Character Tracker|World State|Persona Stats)\b/u.test(brief(sequence).text),
    "no Agent names in the brief",
  );
}
assert.match(server("modules/settings/slp-settings.ts"), /flavourFromAgents: true,/u, "on by default");
const flavourSource = server("data/creators/slp-flavour-source.ts");
assert.match(
  flavourSource,
  /input\.disclosureMode === "open" && settings\?\.flavourFromAgents\s*\?\s*await readSlurpAgentMemoryLines/u,
  "behind the one switch, never for a concealed Creator",
);
const agentSource = server("data/creators/slp-agent-memory-source.ts");
assert.match(agentSource, /eq\(gameStateSnapshots\.committed, 1\)/u, "only the accepted chat state");
assert.doesNotMatch(agentSource, /getCapabilityService|long-term-memory/u, "Long-Term Memory comes through recall");
assert.doesNotMatch(agentSource, /\.(create|update|updateLatest|set|delete|insert|commit)\(/u, "read-only");
assert.match(client("features/settings/SlpEngineLinkPanel.tsx"), /update\("flavourFromAgents", value\)/u);

// --- Prepared posts after a steering change: ask, never act unanswered ---------------------------
const steering = { ...SLP_DEFAULT_STEERING };
assert.equal(slurpSteeringContentChanged(steering, { ...steering, mood: "low" }), true);
assert.equal(slurpSteeringContentChanged(steering, { ...steering, avoid: ["her ex"] }), true);
assert.equal(slurpSteeringContentChanged(steering, { ...steering, pace: "more" }), false, "pace is not what posts say");
assert.equal(
  slurpSteeringContentChanged(steering, {
    ...steering,
    nudges: [{ id: "n", text: "gym", story: false, createdAt: "" }],
  }),
  false,
  "an idea waits for the next post",
);
const future = new Date(AT + 3_600_000).toISOString();
assert.deepEqual(
  slurpPreparedRewriteCost(
    [
      { creatorAccountId: "c1", state: "prepared", publishAt: future, imagePrompt: "a photo" },
      { creatorAccountId: "c1", state: "prepared", publishAt: future, imagePrompt: null },
      { creatorAccountId: "c1", state: "prepared", publishAt: hoursAgo(1), imagePrompt: "due" },
      { creatorAccountId: "c1", state: "scheduled", publishAt: future },
      { creatorAccountId: "c2", state: "prepared", publishAt: future, imagePrompt: "other" },
    ],
    "c1",
    at,
  ),
  { posts: 2, calls: 3 },
  "two future posts, one with a picture: three AI calls",
);
const plan = (overrides: Record<string, unknown> = {}) =>
  ({
    sourceEventId: null,
    beat: { type: "mishap", anchorKind: "work", anchor: "x", line: "x", cast: [], place: null },
    ...overrides,
  }) as Parameters<typeof slurpPlanRewritable>[0];
assert.equal(slurpPlanRewritable(plan(), false), true);
assert.equal(slurpPlanRewritable(plan({ sourceEventId: "promise" }), false), false, "a promise keeps its slot");
assert.equal(slurpPlanRewritable(plan(), true), false, "a campaign stage keeps its slot");
assert.equal(slurpPlanRewritable(plan({ beat: { ...plan()!.beat!, anchorKind: "arc" } }), false), false);
assert.equal(
  slurpPlanRewritable(plan({ beat: { ...plan()!.beat!, nudgeId: "n1" } }), false),
  false,
  "a used idea is not lost",
);
const routes = server("features/creators/slp-steering-routes.ts");
assert.match(routes, /slurpSteeringContentChanged\(before, steering\)/u);
assert.match(routes, /app\.post\("\/slurp\/accounts\/:id\/steering\/rewrite-prepared"/u);
const card = client("features/creators/SlpCreatorSteeringCard.tsx");
assert.match(card, /answer\.prepared && setPrepared\(answer\.prepared\)/u, "the app asks after the change");
assert.match(card, /onClick=\{rewrite\}/u, "rewriting only on the player's Rewrite");
assert.match(card, /onClick=\{\(\) => setPrepared\(null\)\}/u, "Keep does nothing but close the question");
assert.equal((card.match(/rewritePrepared\.mutate/gu) ?? []).length, 1, "no other path rewrites");
const en = JSON.parse(slurp2Source(`${root}/client/src/slp/locales/en.json`)) as Record<string, string>;
assert.equal(
  en["ui.slurp.steering.preparedQuestion"]!.replace("{{count}}", "3").replace(
    "{{calls}}",
    en["ui.slurp.steering.preparedCalls"]!.replace("{{count}}", "4"),
  ),
  "3 posts are already prepared. Rewrite them to match? (4 AI calls)",
);
const rewrite = server("data/feed/reserve/slp-reserve-rewrite.ts");
assert.match(
  rewrite,
  /state: "scheduled"/u,
  "a rewrite reopens the slot; the reserve writes it inside the usual budget",
);
assert.doesNotMatch(rewrite, /generateCreatorPost|completeSlurp/u, "no AI call from the route itself");

// --- 7b-q: "Daily life" rate; the schedule and the card give the main beat -----------------------
const lifeAt = (
  creator: SlurpLifeCreator,
  id: string,
  sequence: number,
  activity: string | null,
  rate?: "rarely" | "sometimes" | "often",
) =>
  slurpLifeBeat(id, sequence, creator, SLURP_NO_LIFE_SIGNALS, { recentAnchors: [] }, [], [...CASUAL], activity, rate);
const shareOf = (rate?: "rarely" | "sometimes" | "often") =>
  Array.from({ length: 600 }, (_, sequence) => lifeAt(mira, "fixture-mira", sequence, null, rate)).filter(Boolean)
    .length / 600;
const [rarely, sometimes, often] = [shareOf("rarely"), shareOf("sometimes"), shareOf("often")];
assert.equal(shareOf(), sometimes, "Sometimes is the default");
assert.ok(rarely > 0.07 && rarely < 0.2, `Rarely is about 1 in 7: ${rarely}`);
assert.ok(sometimes > 0.22 && sometimes < 0.45, `Sometimes is about 1 in 3: ${sometimes}`);
assert.ok(often > 0.4 && often < 0.62, `Often is about 1 in 2: ${often}`);
// A moment that says what they are doing now never replaces what the schedule (or the card's
// routine) has them doing: it only comes when it is about the same thing.
const DOING = [
  "work-long-day",
  "work-bad-day",
  "place-stuck",
  "workout",
  "cold",
  "errands",
  "self-care",
  "cooking",
  "home-reset",
];
const scheduleCases: { creator: SlurpLifeCreator; id: string; activity: string; allowed: string[] }[] = [
  // Kai is tattooing at the studio: no gym, no kitchen, no errands, no day at home.
  {
    creator: kai,
    id: "fixture-kai",
    activity: "Tattooing a cover-up at Needle & Thread",
    allowed: ["work-long-day", "work-bad-day", "place-stuck"],
  },
  // Mira is asleep: nothing she does can be the post, only how she feels or what happened.
  { creator: mira, id: "fixture-mira", activity: "Sleeping", allowed: [] },
  // Mira coaches at the bouldering hall: a workout or a long coaching day fits, cooking does not.
  {
    creator: mira,
    id: "fixture-mira",
    activity: "Coaching beginners at the bouldering hall",
    allowed: ["work-long-day", "work-bad-day", "place-stuck", "workout"],
  },
  // Anna bakes in the Backstube: baking fits; a workout would replace her shift.
  {
    creator: anna,
    id: "fixture-anna",
    activity: "Backen in der Backstube in Altona",
    allowed: ["work-long-day", "work-bad-day", "place-stuck", "cooking"],
  },
];
for (const { creator, id, activity, allowed } of scheduleCases) {
  let filled = 0;
  for (let sequence = 0; sequence < 600; sequence += 1) {
    const life = lifeAt(creator, id, sequence, activity);
    if (!life) continue;
    filled += 1;
    const moment = life.sharedId!.split(":")[1]!;
    assert.ok(
      !DOING.includes(moment) || allowed.includes(moment),
      `"${activity}" stays the main beat; ${moment} would replace it`,
    );
    if (life.place)
      assert.ok(
        activity.toLowerCase().includes(life.place.replace(/^(the|die|der) /u, "").toLowerCase()),
        `the place is where the schedule says: ${life.place}`,
      );
  }
  assert.ok(filled / 600 > 0.15, `daily life still fills around "${activity}": ${filled}/600`);
}
// Without a schedule or routine the card alone decides, as before.
assert.ok(
  Array.from({ length: 600 }, (_, sequence) => lifeAt(kai, "fixture-kai", sequence, null)).some(
    (life) => life?.sharedId === "life:errands" || life?.sharedId === "life:self-care",
  ),
);
const beatService = server("features/feed/slp-post-beat-service.ts");
assert.match(
  beatService,
  /input\.intents,\s*\/\/[^\n]*\n\s*input\.context\.day\?\.current \?\? null,\s*input\.context\.life\.rate,/u,
  "the life moment sees the schedule's current activity and the rate",
);
assert.match(server("features/feed/slp-generation-service.ts"), /rate: settings\.lifeMomentRate/u);
assert.match(server("modules/settings/slp-settings.ts"), /lifeMomentRate: "sometimes"/u);
assert.match(client("features/feed/SlpPublishingPanel.tsx"), /settingKey="lifeMomentRate"/u);

console.log("slurp2 life moments regression: pass");
