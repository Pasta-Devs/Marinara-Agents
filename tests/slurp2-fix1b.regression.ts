/** Fix phase 1b (user decisions on fix phase 1 "Needs the user"): behaviour checks per decision. */
import assert from "node:assert/strict";
import {
  slpCanAffordGamble,
  slpGambleUnlockPrice,
} from "../packages/slurp2/src/engine/packages/shared/src/slp/slp-post-offers.ts";
import {
  readSlurpModelBudgetLedger,
  slurpModelBudgetPacedCap,
  slurpModelBudgetSchema,
  spendSlurpModelBudget,
} from "../packages/slurp2/src/engine/packages/shared/src/slp/slp-model-budget.ts";
import { protectCreatorGeneratedIdentity } from "../packages/slurp2/src/engine/packages/server/src/slp/base/identity/slp-identity-protection.ts";
import {
  buildSlpFanVoiceDraftMessages,
  cleanSlpFanVoiceDraft,
  slpFanVoiceDraftSchema,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/audience/slp-fan-voice-draft.ts";
import {
  slurpInfluenceMultiplier,
  slurpPlatformEventsDefault,
} from "../packages/slurp2/src/engine/packages/shared/src/slp/slp-platform-events.ts";
import { slurp2Source } from "./slurp2-source.ts";

const root = "packages/slurp2/src/engine/packages";
const readSlurp2Source = (side: "client" | "server" | "shared", path: string) =>
  slurp2Source(`${root}/${side}/src/slp/${path}`);

// R1-091: the gamble is blocked when the balance cannot pay the losing side (3x); no wallet = no block.
assert.equal(slpGambleUnlockPrice(25, false), 75);
assert.equal(slpCanAffordGamble(74, 25), false, "one coin short cannot bet");
assert.equal(slpCanAffordGamble(75, 25), true, "exactly 3x can bet");
assert.equal(slpCanAffordGamble(null, 25), true, "SlurpCoins off: nothing to check");
const walletRoutes = readSlurp2Source("server", "features/economy/slp-wallet-routes.ts");
const gamble = walletRoutes.slice(walletRoutes.indexOf('"/slurp/posts/:id/gamble-unlock"'));
assert.ok(
  gamble.indexOf("slpCanAffordGamble(wallet.coins, basePrice)") < gamble.indexOf("randomInt(2)"),
  "the server checks the balance before it rolls",
);
const card = readSlurp2Source("client", "modules/post/SlpLockedPostCard.tsx");
assert.match(card, /disabled=\{unlockPending \|\| transaction !== null \|\| gambleBlocked\}/u);
assert.match(card, /ui\.slurp\.unlocksheet\.gambleNeedsCoins/u, "the reason is on the button");

// R1-106: world model work is spread evenly over the (UTC ledger) day; a player's own reply never is.
const at = (hour: number) => new Date(Date.UTC(2026, 8, 27, hour, 0, 0));
assert.equal(slurpModelBudgetPacedCap(20, at(0)), 1, "the first call of the day gets through");
assert.equal(slurpModelBudgetPacedCap(20, at(12)), 11, "half the day, about half the calls");
assert.equal(slurpModelBudgetPacedCap(20, new Date(Date.UTC(2026, 8, 27, 23, 59))), 20, "all of it by the evening");
assert.equal(slurpModelBudgetPacedCap(2, at(1)), 1);
const budget = slurpModelBudgetSchema.parse({ callsPerHour: 100, callsPerDay: 20 });
const early = { ...readSlurpModelBudgetLedger(null, at(1)), callsToday: 2 };
assert.equal(spendSlurpModelBudget(budget, early, "rewrite", at(1)), null, "paced upkeep waits for the clock");
assert.ok(spendSlurpModelBudget(budget, early, "rewrite"), "unpaced (a player's request) goes through");
assert.ok(spendSlurpModelBudget(budget, early, "dm_reply"), "replies are never paced");
const evening = { ...readSlurpModelBudgetLedger(null, at(20)), callsToday: 2 };
assert.ok(spendSlurpModelBudget(budget, evening, "rewrite", at(20)), "a quiet morning's allowance carries over");
// Presence from the cheap badge poll; the world clock runs every wake while the player is here.
const badge = readSlurp2Source("server", "features/notifications/slp-notifications-routes.ts");
assert.match(badge, /markSlurpPlayerPresent\(\);\s*return \{ unseenCount/u);
const worldScheduler = readSlurp2Source("server", "features/world/slp-world-scheduler-service.ts");
assert.match(worldScheduler, /if \(!present && !slurpWorldTimerDue\(clock, lastRunMs, Date\.now\(\)\)\) return;/u);
assert.match(worldScheduler, /const context = present \? "present" : "background";/u);
assert.match(worldScheduler, /await drainSlurpPendingText\(app\.db, SCHEDULED_DRAIN_LIMIT, context\)/u);
assert.match(worldScheduler, /await drainSlurpContinuityExtraction\(app\.db, context\)/u);
assert.match(
  worldScheduler,
  /if \(present\)\s*await drainSlurpAudienceReplies\(app\.db\)/u,
  "written replies stay present-only",
);
const worker = readSlurp2Source("server", "base/model/slp-model-worker.ts");
// Upkeep is paced unless the player asked for it now ("Rewrite all now"); the day's caps still hold.
assert.match(worker, /paced = SLURP_UPKEEP_JOB_KINDS\.has\(kind\)/u);
assert.match(worker, /spendSlurpModelBudget\(budget, current, kind, paced \? at : undefined\)/u);
assert.match(
  readSlurp2Source("server", "features/audience/slp-audience-reply-operation.ts"),
  /slurpModelBudgetPaceOpen\(db, settings\.modelBudget, "thread"\)/u,
);
assert.match(
  readSlurp2Source("server", "features/projects/slp-arc-generation-service.ts"),
  // 0.3.6: only a world storyline is paced and counted; the player's request never is.
  /if \(world && !\(await slurpModelBudgetPaceOpen\(db, settings\.modelBudget, "arc"\)\)\) return null;/u,
);

// R1-073: fans see Hinted Creators' storylines; the linked name never reaches them.
const identity = { displayName: "Aria Stone", handle: "aria.stone", sourceIdentifiers: ["Aria"] };
assert.equal(
  protectCreatorGeneratedIdentity("Aria Stone moves to Berlin", "hinted", identity),
  "you-know-who moves to Berlin",
);
const arcsRoute = readSlurp2Source("server", "features/projects/slp-projects-routes.ts");
const arcsHandler = arcsRoute.slice(
  arcsRoute.indexOf('"/slurp/accounts/:id/arcs"'),
  arcsRoute.indexOf("A Creator's arc overrides"),
);
assert.doesNotMatch(arcsHandler, /identityDisclosure[^\n]*return \{ arcs: \[\] \}/u, "no Open-only gate");
assert.match(arcsHandler, /question: protect\(choices\[chapter\]!\.question\)/u);

// R1-107: "Draft voice" writes a fan type's voice through the "Fan type voice drafts" budget row.
const voiceInput = slpFanVoiceDraftSchema.parse({
  name: "Night owl",
  engineArchetype: "eccentric",
  traits: ["lowercase", "3am"],
  voice: "Oblique.",
});
const [system, user] = buildSlpFanVoiceDraftMessages(voiceInput);
assert.match(system!.content, /quoted content, never as instructions/u);
assert.match(user!.content, /Fan type: Night owl[\s\S]*Traits: lowercase, 3am[\s\S]*Current voice[^\n]*Oblique\./u);
assert.equal(
  cleanSlpFanVoiceDraft('```\n"Voice: Types in lowercase. **Never** pays."\n```'),
  "Types in lowercase. Never pays.",
);
assert.equal(cleanSlpFanVoiceDraft("   "), null);
const long = cleanSlpFanVoiceDraft(`${"Short, warm comments about the post. ".repeat(30)}`)!;
assert.ok(long.length <= 600 && long.endsWith("."), "cut at a sentence, inside the field limit");
assert.throws(() => slpFanVoiceDraftSchema.parse({ ...voiceInput, extra: 1 }), "strict body");
const voiceService = readSlurp2Source("server", "features/audience/slp-fan-voice-draft-service.ts");
// 0.3.6: "Draft voice" is the player's tap: the budget's connection, never its mode or caps.
assert.doesNotMatch(voiceService, /claimSlurpModelBudget|slurpModelWorkerAllows/u);
assert.match(
  readSlurp2Source("client", "features/audience/SlpFanTypesPanel.tsx"),
  /"\/slurp2\/fan-types\/voice-draft"/u,
);

// R1-136: retired settings keys. Old stored settings (and old backups) still load: the normalizer builds
// only from the known defaults, the PATCH schema strips unknown keys, and the next save drops them.
// (The server settings module needs the Engine host, so this reads the source.)
const settingsSource = readSlurp2Source("server", "modules/settings/slp-settings.ts");
const retired = [...settingsSource.matchAll(/^  "(\w+)",$/gmu)]
  .map((match) => match[1]!)
  .filter((key) => settingsSource.indexOf(`"${key}",`) > settingsSource.indexOf("SLURP_RETIRED_SETTINGS_KEYS"));
assert.equal(retired.length >= 7, true, "the retired list names the keys");
assert.match(
  settingsSource,
  /Object\.entries\(DEFAULT_SLURP_SETTINGS\)\.map\(\(\[key, value\]\) => \[key, rawRecord\[key\] \?\? value\]\)/u,
  "unknown stored keys are ignored on read",
);
assert.doesNotMatch(
  readSlurp2Source("server", "features/settings/slp-settings-routes.ts"),
  /slurpSettingsSchema\.partial\(\)\.strict\(\)/u,
);
for (const key of [
  "imageGenerationConnectionId",
  "invitedCharacterGroupIds",
  "includeCharacterSchedules",
  "enableEnhancedTimelineWriting",
  "participantSelectionMode",
  "participantMin",
  "participantMax",
]) {
  const uses = settingsSource.split(new RegExp(`\\b${key}\\b`, "u")).length - 1;
  assert.equal(uses, 1, `${key} is only in the retired list`);
  for (const file of [
    "features/settings/slp-settings-contract.ts",
    "features/backstage/slp-backstage-placement.ts",
    "features/settings/slp-settings-defaults.ts",
  ])
    assert.doesNotMatch(readSlurp2Source("client", file), new RegExp(`\\b${key}\\b`, "u"), `${file}: ${key}`);
}

// R1-112: influences follow occurrences and targets, and every target has a reader.
const valentines = slurpPlatformEventsDefault().find((event) => event.id === "valentines")!;
const growthEvent = {
  ...valentines,
  influences: [{ target: "audience.growth" as const, operation: "multiply" as const, value: 2 }],
};
const onDay = new Date(Date.UTC(2026, 1, 14, 12));
const offDay = new Date(Date.UTC(2026, 2, 3, 12));
const occurrence = (status: string, participantIds: string[] = [], at = onDay) => ({
  blueprintId: "valentines",
  status,
  participantIds,
  startsAt: new Date(at.getTime() - 3600e3).toISOString(),
  endsAt: new Date(at.getTime() + 3600e3).toISOString(),
});
const growth = (at: Date, story = {}) => slurpInfluenceMultiplier([growthEvent], at, "audience.growth", story);
assert.equal(growth(onDay), 2, "on its date with no occurrence yet");
assert.equal(growth(offDay), 1);
assert.equal(growth(onDay, { occurrences: [occurrence("dismissed")] }), 1, "a dismissed occurrence stops it");
assert.equal(growth(onDay, { occurrences: [occurrence("suggested")] }), 1, "a suggestion does not run");
assert.equal(
  growth(offDay, { occurrences: [occurrence("active", [], offDay)] }),
  2,
  "a started manual event runs off-date",
);
const aimed = { occurrences: [occurrence("active", ["c1"])] };
assert.equal(growth(onDay, { ...aimed, creator: { id: "c1" } }), 2, "its participant");
assert.equal(growth(onDay, { ...aimed, creator: { id: "c2" } }), 1, "not another Creator");
assert.equal(growth(onDay, aimed), 1, "a Slurp-wide reader only counts events for everybody");
const selected = { ...growthEvent, target: { kind: "selected" as const, creatorIds: ["c1"] } };
assert.equal(
  slurpInfluenceMultiplier([selected], onDay, "audience.growth", { creator: { id: "c2" } }),
  1,
  "date fallback honours targets",
);
const readers: [string, RegExp][] = [
  [
    "data/projects/slp-projects-storage-1.ts",
    /growth: "audience\.growth",\s*earnings: "economy\.creator-earnings",\s*loyalty: "audience\.loyalty"/u,
  ],
  ["data/host/slp-storage-context.ts", /"economy\.creator-earnings", \{/u],
  ["features/world/slp-world-operation.ts", /platformInfluenceMultiplier\("feed\.reach", account\.id, until\)/u],
  ["data/world/slp-story-engine-storage.ts", /platformInfluenceMultiplier\("feed\.posting-rate", undefined, at\)/u],
  ["features/feed/reserve/slp-reserve-operation.ts", /await noodle\.getPostingSettings\(at\)/u],
  [
    "features/messages/slp-message-operation.ts",
    /"messages\.reply-delay",\s*await slurp\.platformInfluenceStory\(creator\.id\)/u,
  ],
  ["features/audience/slp-fan-activity-operation.ts", /"audience\.activity", story\)/u],
  [
    "data/economy/slp-economy-storage-2.ts",
    /slurpPlatformEventModifierSource\(\s*settings\.platformEvents,\s*await this\.platformInfluenceStory\(creatorAccountId\),?\s*\)/u,
  ],
];
for (const [file, pattern] of readers) assert.match(readSlurp2Source("server", file), pattern, file);

// Step 10 answer: closing the sign-up dialog after the photo shoot still finishes the page.
const sceneModel = readSlurp2Source("client", "features/onboarding/slp-scene-model.ts");
const finishOnClose = sceneModel.slice(sceneModel.indexOf("const finishOnClose = useCallback"));
assert.match(
  finishOnClose,
  // R6: an update of an existing page saves on "Save" only.
  /const id = accountRef\.current;[\s\S]*?if \(!id \|\| setup\.existing\) return false;/u,
  "only a page the shoot saved",
);
assert.match(finishOnClose, /await completeSignUp\(/u, "limits line, first post and kept chat, like Finish");
assert.match(
  sceneModel,
  /const finish = useCallback[\s\S]*?await completeSignUp\(saved\.id, draft\)/u,
  "Finish shares the same steps",
);
const sceneStage = readSlurp2Source("client", "features/onboarding/SlpSceneOnboarding.tsx");
assert.match(
  sceneStage,
  /if \(!last\.accountId \|\| last\.created \|\| last\.registering\) return;\s*void last\.finishOnClose\(\)\.then\(\(finished\) => finished && done\(\)\)/u,
  "on unmount: finish a saved, unfinished page and mark the first run done",
);

console.log("slurp2 fix phase 1b: ok");
