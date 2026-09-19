import assert from "node:assert/strict";

import {
  makeSlurpProject,
  readSlurpProject,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/projects/slp-project.js";
import {
  readSlurpCreatorArcConfig,
  resolveSlurpArcConfig,
  SLURP_ARC_LIBRARY_SEED,
  slurpAutoArcCount,
  slurpAutoArcType,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/projects/slp-arc-library.js";

const at = new Date("2026-09-09T10:00:00.000Z");
const DAY = 86_400_000;
const global = { arcAutoMode: "suggest", arcCooldownWeeks: 3, arcPace: "normal" } as const;

// Override resolution: a missing field is global, a stored field wins, junk is dropped.
assert.deepEqual(resolveSlurpArcConfig(global, {}), {
  autoMode: "suggest",
  source: "mixed",
  cooldownWeeks: 3,
  pace: "normal",
  allowedTypeIds: null,
  maxActive: 3,
  crossovers: true,
});
const stored = readSlurpCreatorArcConfig(
  JSON.stringify({
    autoMode: "off",
    pace: "fast",
    cooldownWeeks: 9,
    maxActive: 1,
    source: "mixed",
    allowedTypeIds: ["trip"],
  }),
);
assert.deepEqual(stored, { autoMode: "off", source: "mixed", pace: "fast", allowedTypeIds: ["trip"], maxActive: 1 });
const resolved = resolveSlurpArcConfig(global, stored);
assert.equal(resolved.autoMode, "off");
assert.equal(resolved.cooldownWeeks, 3, "an out-of-range override falls back to global");
assert.equal(resolved.maxActive, 1);
assert.deepEqual(readSlurpCreatorArcConfig("not json"), {});

// Origin: old records are manual unless they are a suggestion.
const manual = makeSlurpProject("m", { title: "Mine" }, at)!;
assert.equal(manual.origin, "manual");
assert.equal(readSlurpProject({ id: "old", title: "Old", status: "suggested" })?.origin, "auto");
assert.equal(readSlurpProject({ id: "old", title: "Old", status: "active" })?.origin, "manual");
const autoArc = makeSlurpProject("a", { title: "Auto", origin: "auto" }, at)!;
assert.equal(slurpAutoArcCount([manual, autoArc, { ...autoArc, status: "complete" }]), 1, "manual arcs do not count");

const base = {
  at,
  projects: [],
  library: SLURP_ARC_LIBRARY_SEED,
  creatorTags: [],
  lastAutoAt: null,
  cooldownWeeks: 1,
} as const;

// Day-seed chance: over 2000 Creators with a 1-week cooldown, about 1 in 7 roll today.
const ids = Array.from({ length: 2000 }, (_, index) => `creator-${index}`);
const hits = ids.filter((creatorAccountId) => slurpAutoArcType({ ...base, creatorAccountId }));
assert.ok(hits.length > 2000 / 7 / 2 && hits.length < (2000 / 7) * 2, `about 1/7 roll, got ${hits.length}`);
const slower = ids.filter((creatorAccountId) => slurpAutoArcType({ ...base, creatorAccountId, cooldownWeeks: 4 }));
assert.ok(slower.length < hits.length, "a longer cooldown spreads the rolls thinner");
const tomorrow = ids.filter((creatorAccountId) =>
  slurpAutoArcType({ ...base, creatorAccountId, at: new Date(at.getTime() + DAY) }),
);
assert.notDeepEqual(tomorrow, hits, "a different day rolls different Creators");
const lucky = hits[0]!;

// Concurrency cap.
assert.ok(slurpAutoArcType({ ...base, creatorAccountId: lucky, concurrentAuto: 1, maxConcurrentAuto: 2 }));
assert.equal(slurpAutoArcType({ ...base, creatorAccountId: lucky, concurrentAuto: 2, maxConcurrentAuto: 2 }), null);

// createdAt eligibility: not before one cooldown has passed since creation.
assert.equal(
  slurpAutoArcType({ ...base, creatorAccountId: lucky, createdAt: new Date(at.getTime() - 6 * DAY).toISOString() }),
  null,
);
assert.ok(
  slurpAutoArcType({ ...base, creatorAccountId: lucky, createdAt: new Date(at.getTime() - 7 * DAY).toISOString() }),
);

// allowedTypeIds narrows the pick.
assert.equal(slurpAutoArcType({ ...base, creatorAccountId: lucky, allowedTypeIds: ["trip"] })?.id, "trip");
assert.equal(slurpAutoArcType({ ...base, creatorAccountId: lucky, allowedTypeIds: [] }), null);

console.log("slurp2 arc config regression passed");
