import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  slurpPlatformEventSchema,
  slurpRunningPlatformEventIds,
} from "../packages/slurp2/src/engine/packages/shared/src/slp/slp-platform-events.ts";
import { slurpAccountRowIsCreator } from "../packages/slurp2/src/engine/packages/shared/src/slp/slp-audience-characters.ts";

// Fix phase 1, batch I (REVIEW-1 world and audience low): R1-110 … R1-120. The pure helpers are run;
// the storage, route and hook changes import Engine paths, so they are source pins.
const pkg = join(import.meta.dirname, "..", "packages/slurp2/src/engine/packages");
const read = (path: string) => readFileSync(join(pkg, path), "utf8");
const en = JSON.parse(read("client/src/slp/locales/en.json")) as Record<string, string>;

// ── R1-112: "Running now" follows the occurrence, then the date ──
const at = new Date("2026-06-10T12:00:00Z");
const event = (id: string, activation: unknown) =>
  slurpPlatformEventSchema.parse({
    id,
    contentId: id,
    name: id,
    enabled: true,
    guidance: "",
    storyTags: [],
    activation,
    target: { kind: "all" },
    influences: [],
    arcOpportunities: [],
    outcomes: [],
    automation: "inherit",
    builtin: false,
    hidden: false,
  });
const annual = event("annual", { kind: "annual", month: 6, day: 10, durationDays: 1 });
const manual = event("manual", { kind: "manual", durationDays: 3 });
const occurrence = (blueprintId: string, status: string) => ({
  blueprintId,
  status,
  startsAt: "2026-06-10T00:00:00Z",
  endsAt: "2026-06-11T00:00:00Z",
  participantIds: [],
  blueprint: { name: blueprintId },
});
// A date-active event with no occurrence runs; a manual one does not.
assert.deepEqual([...slurpRunningPlatformEventIds([annual, manual], [], at)], ["annual"]);
// A started manual event runs; a dismissed date event does not.
assert.deepEqual(
  [
    ...slurpRunningPlatformEventIds(
      [annual, manual],
      [occurrence("manual", "active"), occurrence("annual", "dismissed")],
      at,
    ),
  ],
  ["manual"],
);
// An occurrence outside its window decides nothing.
assert.deepEqual(
  [
    ...slurpRunningPlatformEventIds(
      [annual, manual],
      [{ ...occurrence("manual", "active"), endsAt: "2026-06-10T06:00:00Z" }],
      at,
    ),
  ],
  ["annual"],
);
assert.match(
  read("client/src/slp/features/world/SlpPlatformEventsPanel.tsx"),
  /slurpRunningPlatformEventIds\(events,/u,
);

// ── R1-117: only Creator rows count as Creators ──
assert.equal(slurpAccountRowIsCreator({ kind: "character", invited: "false" }), true);
assert.equal(slurpAccountRowIsCreator({ kind: "persona", invited: "false" }), true);
assert.equal(slurpAccountRowIsCreator({ kind: "persona", invited: "true" }), false);
assert.equal(slurpAccountRowIsCreator({ kind: "random_user", invited: "false" }), false);
assert.equal(slurpAccountRowIsCreator(null), false);
assert.match(
  read("server/src/slp/features/maintenance/slp-maintenance-routes.ts"),
  /creators: accounts\.filter\(slurpAccountRowIsCreator\)\.length/u,
);
assert.equal(
  (read("server/src/slp/features/maintenance/slp-backup-jobs.ts").match(/filter\(slurpAccountRowIsCreator\)/gu) ?? [])
    .length,
  3,
);

// ── R1-111: "Start now" starts the event and applies its outcomes ──
const story = read("server/src/slp/data/world/slp-story-engine-storage.ts");
const start = story.slice(story.indexOf("async startStoryEvent"), story.indexOf("async setStoryOccurrenceStatus"));
assert.match(start, /status: "active",/u);
assert.doesNotMatch(start, /"suggested"/u);
assert.match(start, /applySlpStoryOutcomes\(\{\s*outcomes: event\.outcomes,/u);

// ── R1-113: AI Off has its own answer; the call is claimed only for a run with work ──
const fan = read("server/src/slp/features/audience/slp-fan-activity-operation.ts");
assert.match(fan, /return \{ status: "ai_off", created: 0 \}/u);
const noWork = fan.indexOf('status: "no_eligible_posts"');
const claim = fan.indexOf("await claimSlurpModelBudget(input.db, settings.modelBudget,");
assert.ok(noWork > 0 && claim > noWork, "the budget claim comes after the no-eligible-posts exit");
assert.match(read("server/src/slp/features/audience/slp-audience-routes.ts"), /result\.status === "ai_off"/u);
// W, changed in 0.3.6: "Run audience" (Stir's "Wake the fans") is the player's tap: AI Off never blocks it,
// and a manual run spends no budget.
assert.doesNotMatch(read("server/src/slp/features/assist/slp-action-preview.ts"), /slurpModelWorkerAllows/u);
assert.doesNotMatch(read("server/src/slp/features/assist/slp-stir-levers.ts"), /The AI budget is off\./u);
assert.match(fan, /const world = input\.mode !== "manual";/u);
assert.match(
  fan,
  /if \(world && !\(await claimSlurpModelBudget\(input\.db, settings\.modelBudget, "thread", at\)\)\)/u,
);

// ── R1-114: load error state; every continuity view refreshes after an action ──
assert.match(
  read("client/src/slp/features/creators/SlpContinuityPanel.tsx"),
  /if \(query\.isError\) return <SlpErrorState/u,
);
assert.equal(
  (
    read("client/src/slp/features/creators/slp-continuity-hooks.ts").match(
      /invalidateQueries\(\{ queryKey: \[\.\.\.slpKeys\.noodlerRoot\(\), "continuity"\] \}\)/gu,
    ) ?? []
  ).length,
  2,
);

// ── R1-115: keep-posts purge touches only posts with media, and never stamps them edited ──
const purge = read("server/src/slp/features/maintenance/slp-autopurge.ts");
assert.match(purge, /const hasMedia = Boolean\(path \|\| post\.imageUrl \|\| attachmentsByPost\.has\(post\.id\)\);/u);
const strip = purge.slice(purge.indexOf("for (const post of postsToStrip)"), purge.indexOf("for (const message of"));
assert.doesNotMatch(strip, /updatedAt:/u);

// ── R1-118: the bank top-up merges into the bank as it is after the model call ──
const bank = read("server/src/slp/features/world/slp-reaction-bank-operation.ts");
assert.match(
  bank,
  /const current = \(await noodle\.getSettings\(\)\)\.audienceReactionBank;\s*const merged = mergeSlurpReactionBankBatch\(current,/u,
);

// ── R1-119: tick messages and commission requests go through the capped storage ──
assert.equal(
  (
    read("server/src/slp/features/world/slp-world-actions.ts").match(
      /createSlurpMessagesStorage\(db, \(\) => noodle\)/gu,
    ) ?? []
  ).length,
  2,
);

// ── R1-110 / R1-116 / R1-119 / R1-120: copy tells the truth ──
assert.doesNotMatch(en["ui.slurp.settings.simulation.fields.clock.tickMinutes.detail"]!, /world time/u);
assert.match(en["ui.slurp.settings.simulation.fields.clock.backgroundTimer.detail"]!, /four times a day/u);
assert.match(en["ui.slurp.settings.simulation.estimate.detail"]!, /Fan Types, tips, unlocks/u);
assert.match(en["ui.slurp.settings.audience.creatorRepliesPerDayDetail"]!, /free replies from the world do not count/u);
assert.equal(en["ui.slurp.settings.events.startsEveryYear"], "Starts every year");
assert.equal(en["ui.slurp.settings.prompts.tone.warm"], "Kind tone");
assert.equal(en["ui.slurp.settings.prompts.tone.mixed"], "Honest tone");
const pulse = read("client/src/slp/modules/chrome/SlpPulse.tsx");
assert.match(pulse, /"audience-activity": \["ui\.slurp\.pulse\.audienceActivity",/u);
assert.doesNotMatch(pulse, /"Just now"/u);
assert.doesNotMatch(
  read("client/src/slp/features/world/SlpWorldTimeline.tsx"),
  />\s*(Dismiss|Start event|End event)\s*</u,
);

console.log("slurp2 fix1 world and audience low regression passed");
