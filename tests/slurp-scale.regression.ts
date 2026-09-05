import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  readSlurpPlatformScale,
  readSlurpWorldActivity,
  slurpPlatformScaleMultiplier,
  slurpWorldActivityMultiplier,
  SLURP_DEFAULT_PLATFORM_SCALE,
  SLURP_DEFAULT_WORLD_ACTIVITY,
} from "../packages/slurp/src/engine/packages/server/src/services/slurp/slurp-scale.js";
import { slurpCreatorReach } from "../packages/slurp/src/engine/packages/server/src/services/slurp/slurp-reach.js";
import { planSlurpWorldTick } from "../packages/slurp/src/engine/packages/server/src/services/slurp/slurp-world.js";
import { planSlurpWorldPulse } from "../packages/slurp/src/engine/packages/server/src/services/slurp/slurp-world-pulse.js";

// ── Off is a real off switch ────────────────────────────────────────────────
// Somebody who wants to write undisturbed should get exactly that, not a quieter version of being
// interrupted. Both the world and the in-session pulse go silent.
assert.equal(slurpWorldActivityMultiplier("off"), 0);
const day = (n: number) => new Date(Date.parse("2026-09-01T00:00:00.000Z") + n * 86_400_000);
assert.deepEqual(
  planSlurpWorldTick({
    since: day(0),
    until: day(30),
    audience: ["a", "b"],
    creators: [{ id: "c1", followers: 500_000, recentPostIds: ["p1"], openRequests: 0 }],
    activity: 0,
  }),
  [],
);
assert.deepEqual(
  planSlurpWorldPulse({
    elapsedMinutes: 600,
    audience: ["a"],
    seed: "s",
    targets: [{ creatorAccountId: "c1", postId: "p", ageHours: 1, creatorReach: 50_000 }],
    activity: 0,
  }),
  [],
);

// ── The dial changes rhythm, not the rules ──────────────────────────────────
// Busy still respects the per-tick ceiling and the unanswered-queue limit, so the dial cannot
// defeat the readable-handful rule.
assert.ok(slurpWorldActivityMultiplier("busy") > slurpWorldActivityMultiplier("normal"));
assert.ok(slurpWorldActivityMultiplier("quiet") < slurpWorldActivityMultiplier("normal"));
const busyPlan = planSlurpWorldTick({
  since: day(0),
  until: day(365),
  audience: ["a"],
  creators: Array.from({ length: 30 }, (_, i) => ({
    id: `c${i}`,
    followers: 500_000,
    recentPostIds: ["p"],
    openRequests: 0,
  })),
  activity: slurpWorldActivityMultiplier("busy"),
});
assert.ok(busyPlan.length <= 4, `busy must still respect the action ceiling, got ${busyPlan.length}`);

// ── Scale moves the invention, never the truth ──────────────────────────────
// Real followers are a count of things that actually happened. Multiplying them would be a lie
// rather than a setting.
const creator = { accountId: "c1", createdAt: "2026-01-01T00:00:00.000Z", realFollowers: 0 };
const at = new Date("2026-09-01T00:00:00.000Z");
assert.ok(slurpCreatorReach({ ...creator, scale: 4 }, at) > slurpCreatorReach(creator, at) * 3);
assert.ok(slurpCreatorReach({ ...creator, scale: 0.25 }, at) < slurpCreatorReach(creator, at));

const realOnly = { ...creator, realFollowers: 40 };
const scaledContribution =
  slurpCreatorReach({ ...realOnly, scale: 4 }, at) - slurpCreatorReach({ ...creator, scale: 4 }, at);
const plainContribution = slurpCreatorReach(realOnly, at) - slurpCreatorReach(creator, at);
assert.equal(scaledContribution, plainContribution, "real followers must contribute the same at any scale");

// An absent or nonsense scale behaves exactly as before the dial existed.
for (const bad of [undefined, 0, -3, Number.NaN]) {
  assert.equal(
    slurpCreatorReach({ ...creator, scale: bad as number }, at),
    slurpCreatorReach(creator, at),
    `scale ${String(bad)} must fall back to unscaled`,
  );
}

// ── Defaults and stored values ──────────────────────────────────────────────
// Confirmed with the maintainer: Normal for both.
assert.equal(SLURP_DEFAULT_WORLD_ACTIVITY, "normal");
assert.equal(SLURP_DEFAULT_PLATFORM_SCALE, "normal");
assert.equal(slurpWorldActivityMultiplier(undefined), 1);
assert.equal(slurpPlatformScaleMultiplier(undefined), 1);
for (const bad of [undefined, null, "nonsense", 7]) {
  assert.equal(readSlurpWorldActivity(bad), "normal");
  assert.equal(readSlurpPlatformScale(bad), "normal");
}

// ── Wiring ──────────────────────────────────────────────────────────────────
const root = join(import.meta.dirname, "..", "packages/slurp/src/engine/packages");
const read = (path: string) => readFileSync(join(root, path), "utf8");

const storage = read("server/src/services/storage/slurp.storage.ts");
assert.match(storage, /worldActivity: z\.enum\(SLURP_WORLD_ACTIVITY\)/u);
assert.match(storage, /platformScale: z\.enum\(SLURP_PLATFORM_SCALE\)/u);

// Both dials must reach the world, or they are decoration.
const world = read("server/src/services/slurp/slurp-world.operation.ts");
assert.match(world, /slurpWorldActivityMultiplier\(settings\.worldActivity\)/u);
assert.match(world, /slurpPlatformScaleMultiplier\(settings\.platformScale\)/u);
assert.match(world, /planSlurpWorldTick\(\{ since, until, creators, audience, activity \}\)/u);

// Every reach call site must be scaled, or one surface would disagree with the others about how
// big the same Creator is.
const routes = read("server/src/routes/slurp.routes.ts");
for (const name of ["countsScale", "projectionScale", "studioScale"]) {
  assert.match(routes, new RegExp(name, "u"), `${name} missing — a reach surface is unscaled`);
}

const settings = read("client/src/components/slurp/SlurpSettings.tsx");
assert.match(settings, /update\("worldActivity", level\)/u);
assert.match(settings, /update\("platformScale", level\)/u);

console.log("slurp scale regression passed");
