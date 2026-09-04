import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  slurpFollowerMilestone,
  slurpMilestonesCrossed,
} from "../packages/slurp/src/engine/packages/server/src/services/slurp/slurp-milestones.js";
import {
  openSlurpGoal,
  readSlurpGoal,
  slurpGoalProgress,
} from "../packages/slurp/src/engine/packages/server/src/services/slurp/slurp-goal.js";

// ── Milestones ──────────────────────────────────────────────────────────────
// Before the first target there is nothing reached yet, but there is still something to aim at.
assert.deepEqual(slurpFollowerMilestone(0), { reached: null, next: 100, progress: 0, remaining: 100 });
assert.equal(slurpFollowerMilestone(40).next, 100);
assert.equal(slurpFollowerMilestone(40).reached, null);

// Progress runs from the previous milestone, not from zero. Measuring from zero makes every step
// past the first look almost finished, which reads as progress the player did not make.
const at600 = slurpFollowerMilestone(600);
assert.equal(at600.reached, 500);
assert.equal(at600.next, 1_000);
assert.equal(at600.remaining, 400);
assert.ok(at600.progress > 0.19 && at600.progress < 0.21, `expected ~0.2, got ${at600.progress}`);

// Landing exactly on a target counts as reaching it, and moves the aim to the next one.
assert.equal(slurpFollowerMilestone(500).reached, 500);
assert.equal(slurpFollowerMilestone(500).next, 1_000);

// The ladder ends rather than looping.
const past = slurpFollowerMilestone(5_000_000);
assert.equal(past.next, null);
assert.equal(past.progress, 1);
assert.equal(past.remaining, 0);

// Nonsense input must not produce NaN in the one place the player looks to understand progress.
for (const value of [-50, 12.7]) {
  const milestone = slurpFollowerMilestone(value);
  assert.ok(Number.isFinite(milestone.progress), `progress was not finite for ${value}`);
  assert.ok(milestone.progress >= 0 && milestone.progress <= 1);
}

// ── Milestones crossed between two visits ───────────────────────────────────
// A quiet week can pass several, and the catch-up panel reports them oldest first.
assert.deepEqual(slurpMilestonesCrossed(90, 2_600), [100, 250, 500, 1_000, 2_500]);
assert.deepEqual(slurpMilestonesCrossed(500, 500), [], "standing still crosses nothing");
assert.deepEqual(slurpMilestonesCrossed(1_200, 400), [], "losing followers crosses nothing");
assert.deepEqual(slurpMilestonesCrossed(499, 500), [500], "landing exactly on a target counts");

// ── Tip goals ───────────────────────────────────────────────────────────────
const opened = openSlurpGoal("New set on Friday", 500, 1_200, new Date("2026-09-01T00:00:00.000Z"));
assert.ok(opened);
assert.equal(opened.startLifetime, 1_200);

// Progress is measured from lifetime earnings at the moment the goal opened, never from the
// balance. A balance falls when money is withdrawn, and a goal that slid backwards because the
// Creator was paid would be nonsense.
assert.equal(slurpGoalProgress(opened, 1_200).raised, 0);
assert.equal(slurpGoalProgress(opened, 1_450).raised, 250);
assert.equal(slurpGoalProgress(opened, 1_450).remaining, 250);
assert.equal(slurpGoalProgress(opened, 1_450).met, false);

// A passed goal reads as complete, not as 340%.
const passed = slurpGoalProgress(opened, 3_000);
assert.equal(passed.raised, 500);
assert.equal(passed.progress, 1);
assert.equal(passed.remaining, 0);
assert.equal(passed.met, true);

// A reversal after the goal opened must not drive progress negative.
assert.equal(slurpGoalProgress(opened, 900).raised, 0);
assert.equal(slurpGoalProgress(opened, 900).progress, 0);

// A goal needs both a label and a believable target.
assert.equal(openSlurpGoal("   ", 500, 0, new Date()), null);
assert.equal(openSlurpGoal("ok", 0, 0, new Date()), null);
assert.equal(openSlurpGoal("ok", 5_000_000, 0, new Date()), null);
assert.equal(openSlurpGoal("ok", 1.5, 0, new Date()), null);

// Stored goals fall back rather than throwing, like every other Slurp blob.
assert.equal(readSlurpGoal(null), null);
assert.equal(readSlurpGoal("not json"), null);
assert.equal(readSlurpGoal('{"label":"x"}'), null);
assert.equal(readSlurpGoal('{"label":"","target":5,"startLifetime":0,"startedAt":"2026-01-01T00:00:00.000Z"}'), null);
assert.equal(
  readSlurpGoal('{"label":"x","target":5,"startLifetime":0,"startedAt":"whenever"}'),
  null,
  "an unparseable start time must not produce a goal",
);

// ── Wiring ──────────────────────────────────────────────────────────────────
const root = join(import.meta.dirname, "..", "packages/slurp/src/engine/packages");
const read = (path: string) => readFileSync(join(root, path), "utf8");

const routes = read("server/src/routes/slurp.routes.ts");
assert.match(routes, /app\.get\("\/noodler\/studio"/u);
// Only Creators this persona operates. A character-backed Creator has no operator, so it must
// never appear in someone's studio.
assert.match(routes, /operated = accounts\.filter\(\(account\) => creatorBelongsToViewer\(account, viewer\)\)/u);
// A first read has no mark to measure from. Null and zero are different and render differently.
assert.match(routes, /followersDelta: previous \? followers - previous\.followers : null/u);
assert.match(routes, /earningsDelta: previous \? earnings\.lifetime - previous\.lifetimeEarnings : null/u);

const home = read("client/src/components/slurp/SlurpHome.tsx");
assert.match(home, /function SlurpStudioView/u);
assert.match(home, /useSlurpStudio/u);

// Reading the studio rewrites the snapshot, so a refetch would silently zero the deltas the
// player is currently looking at.
const hooks = read("client/src/hooks/use-slurp.ts");
const studioHook = hooks.slice(hooks.indexOf("export function useSlurpStudio"));
assert.match(studioHook.slice(0, 700), /staleTime: Infinity/u);
assert.match(studioHook.slice(0, 700), /refetchOnWindowFocus: false/u);

// Only the operating persona may set a goal.
assert.match(routes, /app\.put\("\/noodler\/accounts\/:id\/goal"/u);
assert.match(routes, /Only the Creator's owner can set a goal\./u);
assert.match(home, /function SlurpGoalEditor/u);

const shell = read("client/src/components/slurp/SlurpShell.tsx");
assert.match(shell, /onOpenStudio && hasOperatedCreator/u, "the studio entry needs an operated Creator");

console.log("slurp studio regression passed");
