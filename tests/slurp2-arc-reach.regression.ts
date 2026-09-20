import assert from "node:assert/strict";

import {
  makeSlurpProject,
  readSlurpProject,
  type SlurpArcType,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/projects/slp-project.js";
import {
  slurpArcChapterMood,
  slurpArcEffectMultiplier,
  slurpArcImageLine,
  slurpArcResolveProfile,
  slurpProjectDirect,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/projects/slp-arc-progress.js";
import {
  slurpArcTypeFromProject,
  slurpGeneratedArcProject,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/projects/slp-arc-library.js";
import { scoreSlurpRapport } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/messages/slp-rapport.js";
import { slurp2Source } from "./slurp2-source";

const root = "packages/slurp2/src/engine/packages/server/src";
const source = (path: string) => slurp2Source(`${root}/${path}`);
const at = new Date("2026-09-13T10:00:00.000Z");

const type: SlurpArcType = {
  id: "move",
  name: "Moving to Lisbon",
  description: "",
  chapters: [
    { label: "packing", minDays: 0, maxDays: 2, mood: "tired", effects: { growth: 30, earnings: -8 } },
    { label: "arrived", minDays: 0, maxDays: 2, profile: { bio: "New in Lisbon", location: "Lisbon" } },
    { label: "settled", minDays: 0, maxDays: 2 },
  ],
  revertProfileAtEnd: true,
  tags: [],
  tone: "cozy",
  durationDays: 14,
  enabled: true,
  builtin: false,
  hidden: false,
};

const arc = makeSlurpProject("arc-1", { type }, at)!;
assert.equal(arc.reach[0]?.mood, "tired");
assert.deepEqual(readSlurpProject(JSON.parse(JSON.stringify(arc)))!.reach, arc.reach);
assert.equal(slurpArcTypeFromProject(arc, "copy").chapters[1]!.profile?.location, "Lisbon");
assert.equal(arc.history[0]?.effects, undefined, "the first visit predates the record path");

// Effect clamping per setting, including off.
assert.equal(slurpArcEffectMultiplier([arc], "growth", "off"), 1);
assert.equal(slurpArcEffectMultiplier([arc], "growth", "small"), 1.1);
assert.equal(slurpArcEffectMultiplier([arc], "growth", "big"), 1.3);
assert.equal(slurpArcEffectMultiplier([arc], "earnings", "small"), 0.92);
assert.equal(slurpArcEffectMultiplier([arc], "loyalty", "big"), 1);
assert.equal(slurpArcEffectMultiplier([{ ...arc, status: "paused" }], "growth", "big"), 1, "only running arcs count");
// Stored and generated values never exceed ±50.
assert.equal(readSlurpProject({ ...arc, reach: [{ effects: { growth: 900 } }] })!.reach[0]?.effects?.growth, 50);
const generated = slurpGeneratedArcProject(
  "gen",
  { title: "G", chapters: [{ label: "a", mood: "nope", effects: { loyalty: -80 }, profile: { bio: "x" } }] },
  at,
  { origin: "manual", status: "suggested" },
)!;
assert.deepEqual(generated.reach[0], { effects: { loyalty: -50 } }, "invalid mood and generated profile are dropped");

// Loyalty multiplier scales gains only, at the one scoring function.
const facts = {
  subscribed: true,
  lapsed: false,
  subscribedDays: 30,
  tippedCoins: 50,
  unlockedCoins: 0,
  commissionsDelivered: 0,
  viewerMessages: 10,
  creatorMessages: 10,
  averageViewerMessageLength: 60,
  daysSinceViewerMessage: 0,
};
assert.ok(scoreSlurpRapport(facts, undefined, { gain: 1.1 }).score > scoreSlurpRapport(facts).score);

// Multipliers applied at the choke points.
assert.match(source("services/storage/slurp.storage.ts"), /slurpArcEffectMultiplier\([\s\S]{0,200}"earnings"/);
assert.match(source("services/slurp/slurp-world.operation.ts"), /arcEffectMultiplier\(account\.id, "growth"\)/);
assert.match(
  source("services/storage/slurp-messages.storage.ts"),
  /arcEffectMultiplier\(creatorAccountId, "loyalty"\)/,
);

// Mood modifier gated by arcAffectsMood, started from the one arc-change hook.
assert.equal(slurpArcChapterMood(arc, true), "tired");
assert.equal(slurpArcChapterMood(arc, false), null);
assert.match(
  source("services/storage/slurp.storage.ts"),
  /slurpArcChapterMood\(after, \(await this\.getSettings\(\)\)\.arcAffectsMood\)/,
);

// Image prompt carries the chapter line, joined before identity protection.
assert.equal(slurpArcImageLine(arc), "The picture shows this moment of an ongoing story: packing (cozy tone).");
assert.equal(slurpArcImageLine(null), null);
assert.match(
  source("services/slurp/slurp-generation.service.ts"),
  /protectCreatorGeneratedIdentity\(\s*generated\.imagePrompt && arcImageLine/,
);

// Profile proposal lifecycle: propose on chapter start, apply stores previous, revert proposal at end.
const moved = slurpProjectDirect(arc, "skip", at)!;
assert.equal(moved.history.at(-1)?.effects, undefined);
assert.deepEqual(
  { ...moved.pendingProfile, proposedAt: undefined },
  { bio: "New in Lisbon", location: "Lisbon", chapter: 1, revert: false, proposedAt: undefined },
);
const applied = slurpArcResolveProfile(moved, true, { bio: "Old bio", location: "" })!;
assert.deepEqual(applied.write, { bio: "New in Lisbon", location: "Lisbon" });
assert.deepEqual(applied.project.previousProfile, { bio: "Old bio", location: "" });
assert.equal(applied.project.pendingProfile, null);
const ended = slurpProjectDirect(applied.project, "end", at)!;
assert.equal(ended.pendingProfile?.revert, true);
assert.equal(ended.pendingProfile?.bio, "Old bio");
const reverted = slurpArcResolveProfile(ended, true, { bio: "New in Lisbon", location: "Lisbon" })!;
assert.deepEqual(reverted.write, { bio: "Old bio", location: "" });
assert.equal(reverted.project.previousProfile, null);
// Rejected: nothing written, and nothing to revert at the end.
const rejected = slurpArcResolveProfile(moved, false, { bio: "", location: "" })!;
assert.equal(rejected.write, null);
assert.equal(slurpProjectDirect(rejected.project, "end", at)!.pendingProfile, null);
// History records the chapter's effects when it is opened by the record path.
const back = slurpProjectDirect(moved, "back", at)!;
assert.deepEqual(back.history.at(-1)?.effects, { growth: 30, earnings: -8 });
// Single-player, so not owner-gated, and not gated by Director mode.
const routes = source("routes/slurp.routes.ts");
const routeStart = routes.indexOf('"/slurp/accounts/:id/projects/:projectId/profile"');
assert.notEqual(routeStart, -1, "profile route must exist");
const routeEnd = routes.indexOf("\n  app.", routeStart + 1);
const route = routes.slice(routeStart, routeEnd === -1 ? undefined : routeEnd);
assert.doesNotMatch(route, /creatorBelongsToViewer/);
assert.doesNotMatch(route, /arcDirectorMode/);

console.log("slurp2 arc reach regression passed");
