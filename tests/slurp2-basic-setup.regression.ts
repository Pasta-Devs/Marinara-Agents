/**
 * The Basic screen of the first run (docs/CONFIGURATOR.md, Onboarding): order and skips, the watcher
 * exit, the recommended fast lane, "Add extras", and what leaving it writes. `completed` is never part of it.
 */
import assert from "node:assert/strict";
import {
  SLP_BASIC_LATER,
  slpBasicCleanState,
  slpBasicDefaults,
  slpBasicExtras,
  slpBasicHeat,
  slpBasicNext,
  slpBasicRecommended,
  slpBasicShows,
  slpBasicStamp,
  type SlpBasicContext,
  type SlpBasicState,
} from "../packages/slurp2/src/engine/packages/client/src/slp/features/onboarding/slp-basic-setup.ts";
import type { SlurpSettings } from "../packages/slurp2/src/engine/packages/client/src/slp/features/settings/slp-settings-contract.ts";
import {
  SLURP_REALISTIC_TUNING,
  slurpAudiencePresetPatch,
} from "../packages/slurp2/src/engine/packages/shared/src/slp/slp-tuning.js";
import { slurp2Source } from "./slurp2-source";

const settings = {
  generationConnectionId: null,
  autoPostingImagesEnabled: false,
  autoPostingScheduleEnabled: true,
  postsPerDay: 4,
  postsPerDayCustom: true,
  fanActivityEnabled: true,
  worldActivity: "normal",
  fanActivityRunsPerDay: 1,
  fanLikesPerRefresh: 1,
  fanRepliesPerRefresh: 1,
  simulationTuning: structuredClone(SLURP_REALISTIC_TUNING),
} as unknown as SlurpSettings;
const text = [
  { id: "t1", name: "One", isDefault: false },
  { id: "t2", name: "Two", isDefault: true },
];
const images = [{ id: "i1", name: "Img", isDefault: true }];
const ctx = (over: Partial<SlpBasicContext> = {}): SlpBasicContext => ({
  firstRun: true,
  settings,
  textConnections: text,
  imageConnections: images,
  heat: "flirty",
  ...over,
});
const empty: SlpBasicState = { answers: {}, unlocked: false };

// 1. First-run defaults: Suggestive, the shipped pace, Realistic, open names, the default connection.
const defaults = slpBasicDefaults(ctx());
assert.equal(defaults.heat, "suggestive");
assert.equal(defaults.pace, "lively");
assert.equal(defaults.crowd, "realistic");
assert.equal(defaults.names, "open");
assert.equal(defaults.connection, "t2", "the default text connection");
assert.equal(defaults.pictures, "yes", "pictures on when an image connection exists");
assert.equal(slpBasicDefaults(ctx({ imageConnections: [] })).pictures, "no");
assert.equal(slpBasicDefaults(ctx({ firstRun: false })).heat, "flirty", "a rerun starts on today's heat");

// 2. Order and skips.
assert.equal(slpBasicNext(empty, ctx()), "who");
assert.equal(slpBasicNext({ answers: { who: "run" }, unlocked: false }, ctx()), "locked");
assert.equal(slpBasicNext({ answers: { who: "run" }, unlocked: true }, ctx()), "connection");
assert.equal(
  slpBasicNext({ answers: { who: "run" }, unlocked: true }, ctx({ textConnections: [text[0]!] })),
  "heat",
  "one connection is not a choice",
);
assert.equal(slpBasicNext(empty, ctx({ firstRun: false })), "connection", "a rerun skips who and the lesson");
const later = { answers: { who: "run", connection: SLP_BASIC_LATER }, unlocked: true } as SlpBasicState;
assert.equal(slpBasicShows("pace", later, ctx()), false, "no pace without a text connection");
assert.equal(slpBasicShows("pace", empty, ctx({ textConnections: [] })), false);
assert.equal(slpBasicShows("pictures", empty, ctx({ imageConnections: [] })), false);
assert.equal(slpBasicShows("imageConnection", empty, ctx()), false, "one image connection is not a choice");

// 3. A watcher is done after "who" and leads to the feed.
const watcher: SlpBasicState = { answers: { who: "watch" }, unlocked: false };
assert.equal(slpBasicNext(watcher, ctx()), null);
assert.equal(slpBasicStamp(watcher, ctx()).lead, "feed");

// 4. The fast lane answers everything open and keeps what was answered.
const fast = slpBasicRecommended({ answers: { heat: "clean" }, unlocked: false }, ctx());
assert.equal(slpBasicNext(fast, ctx()), null);
assert.equal(fast.answers.heat, "clean");
assert.equal(fast.answers.who, "both");

// 5. Heat: one answer sets level, limit and words.
assert.deepEqual(slpBasicHeat("clean"), { level: "none", max: "flirty", language: "soft" });
assert.equal(slpBasicHeat("suggestive").language, "frank");
assert.equal(slpBasicHeat("explicit").language, "dirty");

// 6. The stamp: a first run writes every question; a rerun only the touched ones.
const first = slpBasicStamp(fast, ctx());
assert.equal(first.settings.generationConnectionId, "t2");
assert.equal(first.settings.autoPostingScheduleEnabled, true);
assert.equal(first.settings.postsPerDay, 4);
assert.equal(first.settings.autoPostingImagesEnabled, true);
assert.equal(first.settings.autoCreatorArtworkEnabled, true, "first-run artwork follows pictures");
assert.ok(first.settings.simulationTuning, "the crowd writes its tuning");
assert.equal(first.imageConnectionId, "i1");
assert.equal(first.lead, "creators");
assert.ok(!("onboarding" in first.settings), "the Basic screen never writes onboarding");

const rerun = slpBasicStamp({ answers: { crowd: "lively" }, unlocked: false }, ctx({ firstRun: false }));
assert.equal(rerun.heat, null, "an untouched heat is not written");
assert.equal(rerun.imageConnectionId, null);
assert.deepEqual(
  Object.keys(rerun.settings).sort(),
  Object.keys(slurpAudiencePresetPatch("lively", settings)).sort(),
  "a rerun writes only the crowd",
);
assert.ok(!("autoPostingImagesEnabled" in rerun.settings) && !("generationConnectionId" in rerun.settings));
assert.equal(slpBasicStamp(later, ctx()).settings.autoPostingScheduleEnabled, false, "Later means manual");
assert.equal(
  slpBasicStamp(fast, ctx({ textConnections: [] })).settings.autoPostingScheduleEnabled,
  false,
  "no text connection means manual",
);

// 7. Saved answers: anything this version does not offer is asked again.
assert.deepEqual(
  slpBasicCleanState({ answers: { heat: "lava", crowd: "lively", connection: "t1", x: "y" }, unlocked: 1 }),
  {
    answers: { crowd: "lively", connection: "t1" },
    unlocked: false,
  },
);
assert.deepEqual(slpBasicCleanState(null), { answers: {}, unlocked: false });

// 8. Add extras (slice 4): the last question, several picks, Storylines preselected on a first run.
assert.equal(slpBasicNext({ answers: { ...fast.answers, extras: undefined }, unlocked: true }, ctx()), "extras");
assert.equal(defaults.extras, "storylines", "a first run preselects Storylines only");
assert.equal(
  slpBasicDefaults(ctx({ firstRun: false, settings: { ...settings, extWorld: true, extStir: true } })).extras,
  "world,stir",
  "a rerun starts on today's switches",
);
assert.equal(
  slpBasicDefaults(ctx({ settings: { ...settings, extAds: true, extWorld: true } })).extras,
  "ads,world",
  "a first run on an install with switches on keeps them",
);
assert.deepEqual(slpBasicExtras("stir,nope,ads"), ["ads", "stir"]);
const extraKeys = ["extAds", "extStorylines", "extWorld", "extStir", "extSupportDesk"];
const picked = slpBasicStamp({ answers: { ...fast.answers, extras: "ads,stir" }, unlocked: true }, ctx()).settings;
assert.deepEqual(
  extraKeys.map((key) => picked[key as keyof typeof picked]),
  [true, false, false, true, false],
  "the picks switch on, the rest off",
);
assert.equal(first.settings.extStorylines, true, "the fast lane takes Storylines");
assert.equal(first.settings.extAds, false);
assert.ok(
  extraKeys.every((key) => !(key in rerun.settings)),
  "a rerun that skips extras leaves the switches",
);
assert.deepEqual(slpBasicStamp({ answers: { extras: "" }, unlocked: false }, ctx({ firstRun: false })).settings, {
  extAds: false,
  extStorylines: false,
  extWorld: false,
  extStir: false,
  extSupportDesk: false,
});
assert.deepEqual(slpBasicCleanState({ answers: { extras: "ads,stir" } }).answers, { extras: "ads,stir" });
assert.deepEqual(slpBasicCleanState({ answers: { extras: "stir,ads" } }).answers, {}, "only the written form");
assert.deepEqual(slpBasicCleanState({ answers: { extras: "" } }).answers, { extras: "" }, "none is an answer");
assert.equal(slpBasicCleanState({ answers: {}, extrasDraft: "ads" }).extrasDraft, "ads", "a reload keeps the picks");
assert.equal(slpBasicCleanState({ answers: {}, extrasDraft: "x" }).extrasDraft, undefined);
const screen = slurp2Source(`packages/slurp2/src/engine/packages/client/src/slp/features/onboarding/SlpBasicSetup.tsx`);
assert.match(screen, /toggle: true/u, "the extras cards toggle, they do not move on");
assert.match(
  screen,
  /if \(state\.answers\.extras !== undefined\) markSlpSwitchedOnNoteSeen\(\);/u,
  "only who saw the extras skips the note",
);
const overview = slurp2Source(
  "packages/slurp2/src/engine/packages/client/src/slp/features/backstage/SlpBackstageOverviewPanel.tsx",
);
assert.match(overview, /useState\(\(\) => !slpSwitchedOnNoteSeen\(\)\)/u, "What's switched on shows once");
assert.match(overview, /switchedOnNote && settings\.onboarding === "completed"/u, "not before onboarding");
assert.match(overview, /markSlpSwitchedOnNoteSeen\(\);\s*setSwitchedOnNote\(false\);/u);

// 9. Wiring: the age gate opens the first run; the panel shows the Basic screen before the wizard.
const root = "packages/slurp2/src/engine/packages/client/src/slp/";
const panel = slurp2Source(`${root}features/onboarding/SlpOnboardingPanel.tsx`);
assert.match(panel, /<SlpBasicSetup open=\{open && basic\}/u);
assert.match(panel, /open=\{open && !basic\}/u);
assert.match(
  slurp2Source(`${root}features/onboarding/slp-basic-setup-hooks.ts`),
  /spice[\s\S]*guidance[\s\S]*images/u,
  "write order",
);

console.log("slurp2 basic setup ok");
