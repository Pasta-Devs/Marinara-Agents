/** 7b0 "steering with flavour": the flavour brief, the steering state, steered beats, pace, chapter control. */
import assert from "node:assert/strict";
import {
  compileSlurpFlavourBrief,
  slurpSignaturePhrase,
  type SlurpFlavourSource,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/creators/slp-creator-flavour.ts";
import {
  normalizeSlpCreatorSteering,
  SLP_DEFAULT_STEERING,
  SLP_STEERING_NUDGES_MAX,
  type SlpCreatorSteering,
} from "../packages/slurp2/src/engine/packages/shared/src/slp/slp-creator-steering.ts";
import {
  parseSlurpBeat,
  slurpAnchorsWithout,
  slurpNudgeBeat,
  slurpSteeredBeat,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/feed/slp-post-beat.ts";
import { checkSlurpBeatClaims } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/feed/slp-post-brief.ts";
import {
  slurpPacedPostsPerDay,
  slurpPickCreatorForSlot,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/feed/slp-posting-interval.ts";
import {
  SLURP_ARC_CHAPTER_ACTIONS,
  slurpProjectAdvance,
  slurpProjectDirect,
  slurpProjectTick,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/projects/slp-arc-progress.ts";
import {
  readSlurpProject,
  SLURP_PROJECT_MAX_CHAPTERS,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/projects/slp-project.ts";
import { FLAVOUR_FIXTURES, type FlavourFixture } from "./slurp2-flavour-fixtures.ts";
import { slurp2Source } from "./slurp2-source.ts";

const source = (fixture: FlavourFixture, steering: SlpCreatorSteering | null = null): SlurpFlavourSource => ({
  accountId: fixture.id,
  name: fixture.name,
  card: fixture.card,
  anchors: fixture.anchors,
  ownLines: fixture.captions,
  steering,
});
const [mira, kai, anna, rue] = FLAVOUR_FIXTURES as [FlavourFixture, FlavourFixture, FlavourFixture, FlavourFixture];

// --- Varied subset: consecutive requests never share a detail, and a dozen requests reach most of a life.
for (const fixture of FLAVOUR_FIXTURES) {
  for (const use of ["post", "story", "dm", "comment"] as const) {
    let previous: string[] = [];
    const reached = new Set<string>();
    for (let sequence = 0; sequence < 40; sequence += 1) {
      const brief = compileSlurpFlavourBrief(source(fixture), { use, sequence });
      assert.equal(
        brief.bits.filter((bit) => previous.includes(bit)).length,
        0,
        `${fixture.name} ${use} #${sequence} repeats a detail from the request before`,
      );
      if (sequence < 12) brief.bits.forEach((bit) => reached.add(bit));
      previous = brief.bits;
    }
    if (use === "post") assert.ok(reached.size >= 8, `${fixture.name}: 12 posts reach only ${reached.size} details`);
  }
}
// Deterministic: the same request compiles the same brief.
assert.deepEqual(
  compileSlurpFlavourBrief(source(mira), { use: "post", sequence: 7 }),
  compileSlurpFlavourBrief(source(mira), { use: "post", sequence: 7 }),
);

// --- No technical stuff: no labels, no JSON, no macros, no roleplay lines about the player.
for (const fixture of FLAVOUR_FIXTURES) {
  for (let sequence = 0; sequence < 12; sequence += 1) {
    const { text } = compileSlurpFlavourBrief(
      source(fixture, { ...SLP_DEFAULT_STEERING, mood: "cozy", focus: "a new project", push: ["cats"] }),
      { use: "post", sequence },
    );
    assert.doesNotMatch(text, /^[A-Z][A-Za-z ]{1,24}: /mu, "no field labels at a line start");
    assert.doesNotMatch(text, /[{}[\]]|=\d|\bnull\b|\bundefined\b/u, "no JSON, no values like mood=3");
    assert.doesNotMatch(text, /\{\{|<START>|the player/iu, "macros resolved, roleplay-with-the-player lines dropped");
    assert.doesNotMatch(text, /\b(Description|Personality|Scenario|Backstory|mes_example|first_mes)\b/u);
  }
}

// --- Flavour kept: who they are, in their own voice.
{
  const brief = compileSlurpFlavourBrief(source(mira), { use: "post", sequence: 0 });
  assert.match(brief.text, /^Mira Vale is a 27-year-old climbing coach/u, "the card's opening is the core");
  assert.match(brief.text, /calls everyone 'champ'/u, "the card's voice lines stay");
  assert.doesNotMatch(brief.text, /newest student/u, "a sentence about {{user}} is dropped");
  const samples = new Set(
    Array.from(
      { length: 20 },
      (_, sequence) => compileSlurpFlavourBrief(source(mira), { use: "post", sequence }).sample,
    ),
  );
  assert.ok(samples.has("Rest is a myth invented by people who don't own a hangboard."), "example dialogue is a voice");
  assert.ok(samples.size >= 4, "the voice line varies");
  for (const newest of mira.captions.slice(0, 2))
    assert.ok(!samples.has(newest), "the newest captions are not samples");
  // Kai's card says "never uses exclamation marks"; that sentence reaches his briefs over time.
  const kaiText = Array.from({ length: 12 }, (_, sequence) =>
    compileSlurpFlavourBrief(source(kai), { use: "dm", sequence }),
  ).map((brief) => brief.text);
  assert.ok(kaiText.every((text) => text.includes("Never uses exclamation marks")));
  // A thin card still gets a brief from its anchors and past lines.
  assert.match(compileSlurpFlavourBrief(source(rue), { use: "post", sequence: 1 }).text, /Rue Okafor streams/u);
  // Hand-over notes and chats close differently from posts.
  assert.match(compileSlurpFlavourBrief(source(mira), { use: "dm", sequence: 1 }).text, /Never quote it/u);
  assert.doesNotMatch(compileSlurpFlavourBrief(source(mira), { use: "dm", sequence: 1 }).text, /post brief/u);
}

// --- Light repetition only: an overused opener is called out most of the time, allowed now and then.
assert.equal(slurpSignaturePhrase(mira.captions), "champ energy only today");
assert.equal(slurpSignaturePhrase(anna.captions), "Boah ich");
assert.equal(slurpSignaturePhrase(kai.captions), null);
{
  const lines = Array.from(
    { length: 40 },
    (_, sequence) => compileSlurpFlavourBrief(source(anna), { use: "post", sequence }).text,
  );
  // No voice line opens with the habit the brief asks them to drop.
  for (let sequence = 0; sequence < 40; sequence += 1) {
    const sample = compileSlurpFlavourBrief(source(anna), { use: "post", sequence }).sample ?? "";
    assert.ok(!/^Boah ich/iu.test(sample), `sample ${sequence} opens with the overused phrase`);
  }
  const calledOut = lines.filter((text) => /You opened with “Boah ich” a lot lately/u.test(text)).length;
  const allowed = lines.filter((text) => /“Boah ich” is a thing you say/u.test(text)).length;
  assert.equal(calledOut + allowed, 40, "every brief says something about the overused opener");
  assert.ok(allowed >= 4 && allowed <= 18, `allowed now and then, not every time (${allowed}/40)`);
}

// --- Steering applied, in plain words; avoided topics leave the details and the voice line.
{
  const steering = normalizeSlpCreatorSteering({
    focus: "a bouldering competition in November",
    lifePhase: "just moved in with Tess",
    mood: "restless",
    push: ["new chalk bag", "night sessions"],
    avoid: ["Jonas"],
  });
  const briefs = Array.from({ length: 12 }, (_, sequence) =>
    compileSlurpFlavourBrief(source(mira, steering), { use: "post", sequence }),
  );
  for (const brief of briefs) {
    assert.match(brief.text, /These days your life is about this: just moved in with Tess\./u);
    assert.match(brief.text, /Lately you are focused on a bouldering competition in November\./u);
    assert.match(brief.text, /You feel restless lately/u);
    assert.match(brief.text, /Leave Jonas out of it for now\./u);
    assert.equal(brief.text.split("Jonas").length - 1, 1, "Jonas only in the leave-out line");
    assert.doesNotMatch(brief.text, /flat days|good day, and it shows/u, "a set mood replaces the random day texture");
  }
  const pushed = briefs.map(
    (brief) => /New chalk bag keeps coming up|Night sessions keeps coming up/u.exec(brief.text)?.[0],
  );
  assert.ok(new Set(pushed).size === 2, "pushed topics take turns");
}

// --- Steering state: plain values, bounded, bad input dropped.
{
  const normalized = normalizeSlpCreatorSteering({
    focus: `  ${"x".repeat(300)}  `,
    mood: "furious",
    pace: "turbo",
    push: ["gym", "GYM", " ", "a".repeat(80), "b", "c", "d", "e", "f"],
    nudges: [
      ...Array.from({ length: 9 }, (_, index) => ({ id: `n${index}`, text: `idea ${index}`, story: index === 0 })),
      { id: "", text: "no id" },
      { id: "x", text: "" },
    ],
  });
  assert.equal(normalized.focus.length, 160);
  assert.equal(normalized.mood, null);
  assert.equal(normalized.pace, "usual");
  assert.deepEqual(normalized.push.slice(0, 2), ["gym", "a".repeat(40)], "case-insensitive dedupe, clipped");
  assert.equal(normalized.push.length, 6);
  assert.equal(normalized.nudges.length, SLP_STEERING_NUDGES_MAX);
  assert.equal(normalized.nudges[0]!.story, true);
  assert.deepEqual(normalizeSlpCreatorSteering(null), SLP_DEFAULT_STEERING);
}

// --- Steering decides WHAT happens: the idea is the beat, the focus takes some posts, avoided anchors go.
{
  const nudge = slurpNudgeBeat({ id: "n1", text: "gym post with Tess tonight!" }, mira.anchors, ["casual", "set"]);
  assert.equal(nudge.anchorKind, "steer");
  assert.equal(nudge.nudgeId, "n1");
  assert.equal(nudge.line, "The idea for this one: gym post with Tess tonight. Make it yours.");
  assert.deepEqual(nudge.cast, ["Tess (roommate)"], "card people the idea names are the cast");
  assert.equal(slurpNudgeBeat({ id: "n2", text: "tease" }, null, ["teaser"]).type, "anticipation");
  assert.deepEqual(parseSlurpBeat(JSON.stringify(nudge)), nudge, "a stored idea beat survives a retry");
  // The idea may change their life ("new tattoo"); only an unrelated invented person is a mismatch.
  const check = checkSlurpBeatClaims(
    { people: ["Tess"], earlierEvents: [], stateChanges: ["got a new tattoo"] },
    nudge,
    ["Mira Vale"],
  );
  assert.equal(check.ok, true);

  const steering = normalizeSlpCreatorSteering({ focus: "the competition", push: ["chalk bags"] });
  const steered = Array.from({ length: 200 }, (_, sequence) =>
    slurpSteeredBeat(mira.id, sequence, steering, mira.anchors, ["casual", "set"]),
  );
  const share = steered.filter(Boolean).length / steered.length;
  assert.ok(share > 0.3 && share < 0.5, `about two posts in five are steered (${share})`);
  assert.ok(steered.some((beat) => beat?.anchor === "the competition"));
  assert.ok(steered.some((beat) => beat?.anchor === "chalk bags"));
  assert.ok(steered.every((beat) => !beat || /^\p{Lu}/u.test(beat.line)));
  assert.equal(slurpSteeredBeat(mira.id, 3, SLP_DEFAULT_STEERING, mira.anchors, ["casual"]), null);
  assert.ok(
    Array.from({ length: 50 }, (_, sequence) => slurpSteeredBeat(mira.id, sequence, steering, null, ["teaser"])).every(
      (beat) => beat === null,
    ),
    "a teaser slot is not steered",
  );
  const without = slurpAnchorsWithout(mira.anchors, ["jonas", "thermos"]);
  assert.deepEqual(
    without.people.map((person) => person.name),
    ["Tess"],
  );
  assert.deepEqual(without.objects, ["her hangboard"]);
}

// --- Per-Creator pace: a busier Creator may post again sooner and wins an equal wait; a break never posts.
assert.equal(slurpPacedPostsPerDay(4, 1), 4);
assert.equal(slurpPacedPostsPerDay(4, 0.5), 2);
assert.equal(slurpPacedPostsPerDay(4, 2.4), 10);
assert.equal(slurpPacedPostsPerDay(1, 0.5), 1);
{
  const at = Date.parse("2026-09-27T12:00:00Z");
  const hours = (count: number) => at - count * 3_600_000;
  const creators = [
    { id: "quiet", last: hours(10), pace: 0.5 },
    { id: "busy", last: hours(4), pace: 1.6 },
    { id: "usual", last: hours(6), pace: 1 },
    { id: "resting", last: hours(40), pace: 0 },
  ];
  const pick = (list: typeof creators) =>
    slurpPickCreatorForSlot(
      list,
      (entry) => entry.last,
      (entry) => entry.pace,
      at,
    )?.id;
  assert.equal(pick(creators), "busy", "6.4 > 6 > 5 weighted hours; the resting one is never picked");
  assert.equal(pick([{ id: "new", last: 0, pace: 0.5 }, ...creators]), "new", "never-posted first");
  assert.equal(pick([creators[3]!]), undefined);
}

// --- Storyline chapters: stay, move on, add what happens next.
{
  const at = new Date("2026-09-27T12:00:00Z");
  const base = readSlurpProject({
    id: "p1",
    title: "Moving out",
    direction: "",
    chapters: ["packing", "moving day", "first night"],
    chapter: 0,
    status: "active",
    startedAt: at.toISOString(),
    choices: [null, { question: "Which flat?", options: [{ label: "A" }, { label: "B" }] }],
    reach: [null, null, { mood: "afterglow" }],
  })!;
  const held = slurpProjectDirect(base, "hold", at)!;
  assert.equal(held.held, true);
  assert.equal(slurpProjectAdvance(held, at).chapter, 0, "a held chapter does not move on after a post");
  assert.equal(slurpProjectTick({ ...held, phaseDays: [{ min: 0, max: 0 }] }, at).chapter, 0, "nor on the clock");
  assert.equal(slurpProjectDirect(held, "hold", at), null, "already held");
  assert.equal(slurpProjectDirect(held, "release", at)!.held, false);
  const skipped = slurpProjectDirect(held, "skip", at)!;
  assert.equal(skipped.chapter, 1);
  assert.equal(skipped.held, false, "moving on lets go");
  const inserted = slurpProjectDirect(base, "insert", at, "saying goodbye to the old flat")!;
  assert.deepEqual(inserted.chapters, ["packing", "saying goodbye to the old flat", "moving day", "first night"]);
  assert.equal(inserted.choices[2]?.question, "Which flat?", "chapter-aligned lists shift with the insert");
  assert.equal(inserted.choices[1], null);
  assert.equal(inserted.reach[3]?.mood, "afterglow");
  assert.equal(slurpProjectDirect(base, "insert", at, "  "), null);
  const full = {
    ...base,
    chapters: Array.from({ length: SLURP_PROJECT_MAX_CHAPTERS }, (_, index) => `c${index}`),
  };
  assert.equal(slurpProjectDirect(full, "insert", at, "one more"), null);
  assert.equal(readSlurpProject({ ...held })!.held, true, "held survives storage");
  assert.equal(readSlurpProject({ ...base })!.held, undefined);
  for (const action of ["pause", "resume", "twist", "end", "choose"] as const)
    assert.ok(!SLURP_ARC_CHAPTER_ACTIONS.includes(action), `${action} stays a Director tool`);
}

// --- Wiring pins: where the brief and the steering reach the calls.
const root = "packages/slurp2/src/engine/packages";
const server = (path: string) => slurp2Source(`${root}/server/src/slp/${path}`);
{
  const generation = server("features/feed/slp-generation-service.ts");
  assert.match(generation, /resolveSlurpCreatorFlavour\(db, \{/u);
  assert.match(generation, /use: storyVariation \? "story" : "post"/u);
  // The idea is removed only after the model answered, so a failed call keeps it.
  assert.ok(
    generation.indexOf("await completeSlurpCreatorPost(") < generation.indexOf("removeSlurpCreatorNudge(db"),
    "the idea is used up after the answer",
  );
  const prompt = server("features/feed/slp-post-prompt.ts");
  assert.match(prompt, /\["# Who you are", protect\(input\.flavourBrief\)\]/u, "the brief replaces the card dump");
  for (const path of [
    "features/messages/slp-message-generation-service.ts",
    "features/messages/slp-reply-generation-service.ts",
  ]) {
    const text = server(path);
    assert.match(text, /# Who you are\\n\$\{protect\(input\.flavourBrief\)\}/u, `${path} carries the brief, protected`);
    assert.match(text, /input\.characterCanon && !input\.flavourBrief\?\.trim\(\)/u, `${path} drops the card dump`);
  }
  assert.match(server("features/messages/slp-message-generation-service.ts"), /use: "dm"/u);
  assert.match(server("features/messages/slp-reply-generation-service.ts"), /use: "comment"/u);
  assert.match(server("features/feed/reserve/slp-reserve-operation.ts"), /slurpPickCreatorForSlot\(/u);
  for (const path of ["data/feed/reserve/slp-reserve-storage-1.ts", "data/feed/reserve/slp-reserve-storage-2.ts"])
    assert.match(server(path), /slurpPacedPostsPerDay\(/u, `${path} keeps each Creator's own spacing`);
  assert.match(server("slp-server-entry.ts"), /await slpSteeringRoutes\(app, deps\);/u);
  assert.match(
    server("features/projects/slp-projects-routes.ts"),
    /SLURP_ARC_CHAPTER_ACTIONS\.includes\(parsed\.data\.action\)/u,
  );
  // Improvised steering never reaches an Engine card: it lives in Slurp's own app setting.
  const storage = server("data/creators/slp-steering-storage.ts");
  assert.match(storage, /slurp2\.creator\.\$\{creatorAccountId\}\.steering/u);
  assert.doesNotMatch(storage, /createCharactersStorage|updateCharacter/u);
  assert.doesNotMatch(
    server("data/creators/slp-flavour-source.ts"),
    /\.update\(|\.set\(/u,
    "the brief reads, never writes",
  );
}

console.log("slurp2 steering-flavour regressions passed");
