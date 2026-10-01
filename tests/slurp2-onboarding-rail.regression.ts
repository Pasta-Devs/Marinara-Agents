/** The first-run Support ticket rail (docs/ONBOARDING-RAIL.md): order, the age check, branching, and the stamp. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  slpRailCleanAnswers,
  SLP_RAIL_OPTIONS,
  slpRailAnswerPatch,
  slpRailCanSkipIntro,
  slpRailDefaults,
  slpRailFileRows,
  slpRailNext,
  slpRailSettle,
  slpRailStamp,
  slpRailSteps,
  slpRailStop,
  slpRailTranscript,
  type SlpRailAnswers,
  type SlpRailContext,
  type SlpRailState,
} from "../packages/slurp2/src/engine/packages/client/src/slp/features/onboarding/slp-site-welcome.ts";

const settings: SlpRailContext["settings"] = {
  generationConnectionId: null,
  autoPostingScheduleEnabled: false,
  postsPerDay: 4,
  postsPerDayCustom: false,
  autoPostingImagesEnabled: false,
  nightQuiet: true,
  audienceTone: "mixed",
  platformScale: "normal",
  drama: { level: "lively", enabled: ["x"], dials: {} },
  storyAutomation: "suggest",
  arcAutoMode: "suggest",
  arcCrossovers: true,
  inlineAdsEnabled: true,
  inlineAdsFrequency: "standard",
  inlineAdsTone: "corporate",
  supportDesk: {
    tickets: "off",
    noticeMilestones: true,
    noticeTrending: true,
    noticeResults: true,
    refusals: true,
    shadyMoves: true,
    leaving: true,
    toYourCreators: true,
    gamesWithYourCreators: false,
    trustRate: "normal",
    suspicionRate: "normal",
    winBackDays: 3,
  },
};
const context = (patch: Partial<SlpRailContext> = {}): SlpRailContext => ({
  opening: "first",
  textConnections: [
    { id: "t1", name: "Writer" },
    { id: "t2", name: "Default writer", isDefault: true },
  ],
  imageConnections: [{ id: "i1", name: "Painter" }],
  runsCreators: false,
  settings,
  spice: "explicit",
  ...patch,
});
const empty = (): SlpRailState => ({ answers: {}, events: [], seen: [] });

/** Plays the rail like a player: every bubble read, every event fired, each answer from `picks`. */
function play(ctx: SlpRailContext, picks: SlpRailAnswers, from: SlpRailState = empty(), stopAt?: string) {
  let state = from;
  const ids: string[] = [];
  for (let guard = 0; guard < 80; guard += 1) {
    const step = slpRailNext(state, ctx);
    if (!step || step.id === stopAt) return { state, ids, step };
    ids.push(step.id);
    if (step.kind === "wait") state = { ...state, events: [...state.events, step.id] };
    else if (step.kind === "ask") {
      const value = (picks as Record<string, string | undefined>)[step.id] ?? step.options[0];
      if (step.id === "who" && picks.lane) state = { ...state, answers: { ...state.answers, lane: picks.lane } };
      else state = { ...state, answers: { ...state.answers, [step.id]: value } };
    } else state = { ...state, seen: [...state.seen, step.id] };
  }
  throw new Error("the rail never ended");
}

// Order: a full first run, Run Creators, the fun part, pictures with an image connection.
const intro = ["hello1", "hello2", "start", "id1", "pastapay", "ageConfirmed", "id2"];
const explainer = ["what1", "sampleCreator", "what2", "what3", "cost", "locked1", "lockedDemo", "revealed", "coins"];
const handOff = ["review1", "memberFile", "stamped", "stamp", "rating"];
const full = play(context(), { who: "run", pictures: "yes", fun: "sure", ads: "lots", rating: "5" });
assert.deepEqual(full.ids, [
  ...intro,
  ...explainer,
  "setup1",
  "who",
  "connection",
  "pace",
  "pictures",
  "imageConnection",
  "spice",
  "names",
  "nights",
  "fun",
  "fans",
  "size",
  "drama",
  "ads",
  "adTone",
  "pullStrings",
  ...handOff,
  "rated5",
  "leadSignup",
]);
assert.equal(slpRailNext(full.state, context()), null, "the ticket ends");
assert.deepEqual(
  slpRailTranscript(full.state, context()).map((step) => step.id),
  full.ids,
  "the transcript is what played",
);
assert.equal(slpRailStop(null), "done");

// The age check cannot be skipped: "Skip to the questions" is ignored until the card is confirmed.
const atAge = play(context(), {}, { ...empty(), skipIntro: true }, "ageConfirmed");
assert.deepEqual(atAge.ids, intro.slice(0, 5));
assert.equal(atAge.step?.id, "ageConfirmed");
assert.equal(slpRailStop(atAge.step), "hello");
assert.equal(slpRailCanSkipIntro(atAge.state, context()), false, "no skip on the age check");
const confirmed = { ...atAge.state, events: [...atAge.state.events, "ageConfirmed" as const] };
assert.equal(slpRailNext(confirmed, context())?.id, "id2", "the approval line still plays");
// After the check, skipping jumps from the explainer straight to the questions.
const inExplainer = play(context(), {}, empty(), "what2").state;
assert.equal(slpRailCanSkipIntro(inExplainer, context()), true);
assert.equal(slpRailStop(slpRailNext(inExplainer, context())), "slurp");
assert.equal(slpRailNext({ ...inExplainer, skipIntro: true }, context())?.id, "setup1");
const inLocked = play(context(), {}, empty(), "revealed").state;
assert.equal(slpRailCanSkipIntro(inLocked, context()), true, "the locked demo can be skipped too");
assert.equal(slpRailNext({ ...inLocked, skipIntro: true }, context())?.id, "setup1");
// "What are coins?" adds one bubble and returns to the rail.
const coins = play(context(), { coins: "what" }, empty(), "setup1");
assert.deepEqual(coins.ids.slice(-2), ["coins", "coinsWhat"]);

// Branching on "who": a watcher is never asked to pull strings and goes to the feed.
const watcher = play(context(), { who: "watch", fun: "sure" });
assert.ok(!watcher.ids.includes("pullStrings"));
assert.ok(watcher.ids.includes("leadFeed") && !watcher.ids.includes("leadSignup"));
assert.equal(slpRailStamp(watcher.state, context()).lead, "feed");
const both = play(context(), { who: "both", fun: "sure" });
assert.ok(both.ids.includes("pullStrings"));
assert.equal(slpRailStamp(both.state, context()).lead, "signup");

// Pictures: the image connection is asked only on Yes and only when one exists.
assert.ok(!play(context(), { pictures: "no" }).ids.includes("imageConnection"));
assert.ok(!play(context({ imageConnections: [] }), { pictures: "yes" }).ids.includes("imageConnection"));

// No text connection: one line instead of the connection question, no pace question, pace manual.
const offline = context({ textConnections: [] });
const noConnection = play(offline, { pace: "veryActive" });
assert.ok(noConnection.ids.includes("noConnection"));
assert.ok(!noConnection.ids.includes("connection") && !noConnection.ids.includes("pace"));
assert.equal(slpRailDefaults(offline).pace, "manual");
assert.deepEqual(slpRailStamp(noConnection.state, offline).settings.autoPostingScheduleEnabled, false);
const forced = slpRailStamp(
  { ...noConnection.state, answers: { ...noConnection.state.answers, pace: "lively" } },
  offline,
);
assert.equal(forced.settings.autoPostingScheduleEnabled, false, "an earlier pace answer cannot switch posting on");

// Fast lane: one tap after "who" jumps to the member file with every default.
const lane = play(context(), { lane: "recommended" });
assert.deepEqual(lane.ids, [...intro, ...explainer, "setup1", "who", ...handOff, "ratedLess", "leadSignup"]);
assert.deepEqual(slpRailStamp(lane.state, context()), {
  settings: { generationConnectionId: "t2", autoPostingScheduleEnabled: true, postsPerDay: 4 },
  spice: null,
  signUp: { disclosure: "open", imageConnectionId: null },
  lead: "signup",
});
const laneOffline = play(offline, { lane: "recommended" }, empty());
assert.ok(laneOffline.ids.includes("noConnection"), "the no-connection line still plays on the fast lane");

// A fun part switched on later through Change still asks its questions on the fast lane.
const laneFun = { ...lane.state, answers: { ...lane.state.answers, fun: "sure" as const } };
assert.equal(slpRailNext(laneFun, context())?.id, "fans");

// Settle plays every line and card that waits for nothing, and stops at the next tap or question.
assert.deepEqual(slpRailSettle(empty(), context()).seen, ["hello1", "hello2"], "stops at the Hi! chip");
const started = slpRailSettle({ ...empty(), seen: ["hello1", "hello2"], events: ["start"] }, context());
assert.deepEqual(started.seen, ["hello1", "hello2", "id1", "pastapay"], "stops at the age check");
assert.equal(slpRailNext(started, context())?.id, "ageConfirmed");
const confirmedSettled = slpRailSettle({ ...started, events: ["start", "ageConfirmed"] }, context());
assert.equal(slpRailNext(confirmedSettled, context())?.id, "sampleCreator", "the sample card waits for Go on");
const settledState = slpRailSettle(empty(), context());
assert.equal(slpRailSettle(settledState, context()), settledState, "nothing to play: the same state");

// The member file: core rows that apply, then the fun part's rows or one "fun part" row.
assert.deepEqual(slpRailFileRows(lane.state, context()), [
  "who",
  "connection",
  "pace",
  "pictures",
  "spice",
  "names",
  "nights",
  "fun",
]);
assert.deepEqual(slpRailFileRows(full.state, context()), [
  "who",
  "connection",
  "pace",
  "pictures",
  "imageConnection",
  "spice",
  "names",
  "nights",
  "fans",
  "size",
  "drama",
  "ads",
  "adTone",
  "pullStrings",
]);
assert.ok(!slpRailFileRows(watcher.state, context()).includes("pullStrings"), "a watcher has no strings to pull");
assert.deepEqual(
  slpRailFileRows(noConnection.state, offline).slice(1, 3),
  ["connection", "pace"],
  "shown without a connection",
);

// Skip the fun part: those questions are not asked and their settings stay untouched.
const skipFun = play(context(), { fun: "skip", who: "run" });
assert.ok(!["fans", "size", "drama", "ads", "adTone", "pullStrings"].some((id) => skipFun.ids.includes(id)));
assert.equal(skipFun.ids[skipFun.ids.indexOf("fun") + 1], "review1");
const fanThenSkip = { ...skipFun.state, answers: { ...skipFun.state.answers, fans: "unfiltered" as const } };
assert.equal(
  slpRailStamp(fanThenSkip, context()).settings.audienceTone,
  undefined,
  "a skipped fun part writes nothing",
);
// Ads off: no tone question.
assert.ok(!play(context(), { fun: "sure", ads: "none" }).ids.includes("adTone"));

// "Run setup again" opens at the questions with today's values.
const again = context({
  opening: "again",
  runsCreators: true,
  spice: "flirty",
  settings: {
    ...settings,
    generationConnectionId: "t1",
    autoPostingScheduleEnabled: true,
    postsPerDay: 8,
    postsPerDayCustom: true,
    autoPostingImagesEnabled: true,
    audienceTone: "warm",
    drama: { ...settings.drama, level: "soap" },
    inlineAdsFrequency: "frequent",
    inlineAdsTone: "unhinged",
    supportDesk: { ...settings.supportDesk, shadyMoves: false },
  },
});
assert.equal(slpRailNext(empty(), again)?.id, "setup1");
assert.deepEqual(slpRailDefaults(again), {
  who: "both",
  connection: "t1",
  pace: "veryActive",
  pictures: "yes",
  imageConnection: "i1",
  spice: "flirty",
  names: "open",
  nights: "yes",
  fans: "warm",
  size: "normal",
  drama: "bringIt",
  ads: "lots",
  adTone: "unhinged",
  pullStrings: "fair",
});
assert.equal(slpRailDefaults(context({ opening: "again" })).who, "watch", "nobody run yet: a watcher");
const custom = context({
  opening: "again",
  settings: { ...settings, autoPostingScheduleEnabled: true, postsPerDay: 5, postsPerDayCustom: true },
});
assert.equal(slpRailDefaults(custom).pace, undefined, "a hand-typed pace is no preset");
assert.deepEqual(
  slpRailStamp({ ...empty(), answers: { lane: "recommended" } }, custom).settings,
  {
    generationConnectionId: "t2",
  },
  "an unchanged rerun keeps the hand-typed pace",
);

// The exact settings each answer writes.
const patch = (question: Parameters<typeof slpRailAnswerPatch>[0], value: string) =>
  slpRailAnswerPatch(question, value, context());
assert.deepEqual(patch("connection", "t1"), { generationConnectionId: "t1" });
assert.deepEqual(patch("pace", "manual"), { autoPostingScheduleEnabled: false });
assert.deepEqual(patch("pace", "occasional"), { autoPostingScheduleEnabled: true, postsPerDay: 2 });
assert.deepEqual(patch("pace", "veryActive"), { autoPostingScheduleEnabled: true, postsPerDay: 8 });
assert.deepEqual(patch("pictures", "yes"), { autoPostingImagesEnabled: true });
assert.deepEqual(patch("pictures", "no"), { autoPostingImagesEnabled: false });
assert.deepEqual(patch("nights", "no"), { nightQuiet: false });
assert.deepEqual(patch("fans", "unfiltered"), { audienceTone: "unfiltered" });
assert.deepEqual(patch("size", "intimate"), { platformScale: "intimate" });
assert.deepEqual(patch("size", "large"), { platformScale: "large" });
assert.deepEqual(patch("drama", "none"), {
  drama: { level: "calm", enabled: ["x"], dials: {} },
  storyAutomation: "manual",
  arcAutoMode: "off",
  arcCrossovers: false,
});
assert.deepEqual(patch("drama", "sometimes"), {
  drama: { level: "lively", enabled: ["x"], dials: {} },
  storyAutomation: "suggest",
  arcAutoMode: "suggest",
  arcCrossovers: true,
});
assert.deepEqual(patch("drama", "bringIt"), {
  drama: { level: "soap", enabled: ["x"], dials: {} },
  storyAutomation: "auto",
  arcAutoMode: "auto",
  arcCrossovers: true,
});
assert.deepEqual(patch("ads", "none"), { inlineAdsEnabled: false });
assert.deepEqual(patch("ads", "few"), { inlineAdsEnabled: true, inlineAdsFrequency: "standard" });
assert.deepEqual(patch("ads", "lots"), { inlineAdsEnabled: true, inlineAdsFrequency: "frequent" });
assert.deepEqual(patch("adTone", "normal"), { inlineAdsTone: "corporate" });
assert.deepEqual(patch("adTone", "unhinged"), { inlineAdsTone: "unhinged" });
assert.deepEqual(patch("pullStrings", "fair"), {
  supportDesk: { ...settings.supportDesk, shadyMoves: false, refusals: false },
});
assert.deepEqual(patch("pullStrings", "platform"), {
  supportDesk: { ...settings.supportDesk, shadyMoves: true, refusals: true },
});
for (const question of ["who", "spice", "names", "imageConnection", "fun", "coins", "rating"] as const) {
  assert.deepEqual(patch(question, "x"), {}, `${question} is no Slurp setting`);
}
// Every ask names exactly what its answers touch.
for (const step of slpRailSteps(context())) {
  if (step.kind !== "ask") continue;
  for (const value of step.options) {
    for (const key of Object.keys(slpRailAnswerPatch(step.id, value, context()))) {
      assert.ok(step.writes.includes(key), `${step.id}=${value} writes ${key} but does not say so`);
    }
  }
}

// Spice, names and the image connection go through the stamp.
const spicy = play(context(), { spice: "flirty", names: "hinted", pictures: "yes", imageConnection: "i1" });
assert.deepEqual(slpRailStamp(spicy.state, context()).spice, { max: "flirty", guidance: "mild" });
assert.deepEqual(slpRailStamp(spicy.state, context()).signUp, { disclosure: "hinted", imageConnectionId: "i1" });
for (const [max, guidance] of [
  ["suggestive", "steamy"],
  ["explicit", "explicit"],
] as const) {
  const state = { ...spicy.state, answers: { ...spicy.state.answers, spice: max } };
  assert.deepEqual(slpRailStamp(state, context()).spice, { max, guidance });
}
const textOnly = { ...spicy.state, answers: { ...spicy.state.answers, pictures: "no" as const } };
assert.equal(slpRailStamp(textOnly, context()).signUp.imageConnectionId, null, "no pictures, no image connection");
// The full run's stamp: every answer once, nothing else.
assert.deepEqual(slpRailStamp(full.state, context()), {
  settings: {
    generationConnectionId: "t1",
    autoPostingScheduleEnabled: false,
    autoPostingImagesEnabled: true,
    nightQuiet: true,
    audienceTone: "warm",
    platformScale: "intimate",
    drama: { level: "calm", enabled: ["x"], dials: {} },
    storyAutomation: "manual",
    arcAutoMode: "off",
    arcCrossovers: false,
    inlineAdsEnabled: true,
    inlineAdsFrequency: "frequent",
    inlineAdsTone: "corporate",
    supportDesk: { ...settings.supportDesk, shadyMoves: false, refusals: false },
  },
  spice: { max: "flirty", guidance: "mild" },
  signUp: { disclosure: "hinted", imageConnectionId: "i1" },
  lead: "signup",
});

// Every line, chip, question, answer and label the rail names exists in every locale.
const localeDir = "packages/slurp2/src/engine/packages/client/src/slp/locales";
const keys: string[] = [
  "ui.slurp.site.a.rating",
  "ui.slurp.site.a.connection.default",
  "ui.slurp.site.tap.recommended",
];
for (const key of ["ticket", "status.open", "status.resolved", "memberFile", "stamped", "card.sample"])
  keys.push(`ui.slurp.site.${key}`);
for (const key of ["value.none", "label.fun", "close", "reply", "log", "typing", "previewEmpty", "yourFile", "again"])
  keys.push(`ui.slurp.site.${key}`);
keys.push(
  "ui.slurp.site.tap.skipIntro",
  "ui.slurp.site.tap.connections",
  "ui.slurp.site.tap.stamp",
  "ui.slurp.site.tap.pickList",
);
for (const stop of ["hello", "slurp", "locked", "setup", "done"]) keys.push(`ui.slurp.site.stop.${stop}`);
for (const step of slpRailSteps(context())) {
  if (step.kind === "say") keys.push(step.key);
  if (step.kind !== "ask" && step.tap) keys.push(step.tap);
  if (step.kind !== "ask") continue;
  keys.push(`ui.slurp.site.q.${step.id}`);
  if (!["coins", "fun", "rating"].includes(step.id)) keys.push(`ui.slurp.site.label.${step.id}`);
  const fixed = (SLP_RAIL_OPTIONS as Record<string, readonly string[]>)[step.id];
  if (fixed && step.id !== "pace" && step.id !== "rating") {
    for (const value of fixed) keys.push(`ui.slurp.site.a.${step.id}.${value}`);
  }
}
for (const locale of ["en", "de", "ko", "pl"]) {
  const strings = JSON.parse(readFileSync(`${localeDir}/${locale}.json`, "utf8")) as Record<string, string>;
  const missing = [...new Set(keys)].filter((key) => !strings[key]);
  assert.deepEqual(missing, [], `${locale} is missing rail copy`);
}

console.log("slurp2 onboarding rail regression passed");

// Saved answers this version does not offer are dropped, so the rail asks them again.
assert.deepEqual(
  slpRailCleanAnswers({ spice: "x", pace: "lively", who: 3, connection: "c1", imageConnection: "i1", bogus: "yes" }),
  { pace: "lively", connection: "c1", imageConnection: "i1" },
);
assert.deepEqual(slpRailCleanAnswers(null), {});
