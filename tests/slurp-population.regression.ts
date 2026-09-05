import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  generateSlurpPopulationMember,
  SLURP_FUNNEL_STAGES,
  SLURP_NAMED_CAST_LIMIT,
  SLURP_POPULATION_NAME_SPACE,
} from "../packages/slurp/src/engine/packages/server/src/services/slurp/slurp-population.js";

const at = new Date("2026-09-05T00:00:00.000Z");
const member = (seed: string) => generateSlurpPopulationMember(seed, at);

// ── Deterministic ───────────────────────────────────────────────────────────
// Everything derives from the seed, so a member can be regenerated from their id alone rather
// than needing a row before they are interesting.
assert.deepEqual(member("seed-1"), member("seed-1"));
assert.notEqual(member("seed-1").handle, member("seed-2").handle);
assert.equal(member("abc").id, "slurp-fan:abc");

// Sequential seeds must not produce near-identical people. Plain FNV-1a barely avalanches its
// last byte, and seeds here are sequential, so the finalizer is load-bearing.
const sequential = Array.from({ length: 12 }, (_, index) => member(`s${index}`));
assert.ok(
  new Set(sequential.map((entry) => entry.handle)).size >= 11,
  "consecutive seeds must not collapse onto the same handle",
);

// ── The cast never runs out ─────────────────────────────────────────────────
// The whole finding was that Slurp had twelve people in it. A generator that runs dry would be the
// same failure with a bigger number.
assert.ok(SLURP_POPULATION_NAME_SPACE > 10_000, `name space too small: ${SLURP_POPULATION_NAME_SPACE}`);

const sample = Array.from({ length: 5_000 }, (_, index) => member(`p${index}`));
const displayNames = new Set(sample.map((entry) => entry.displayName));
// Display names must clear a named cast comfortably. Two people with one name inside a
// thirty-person cast reads as a bug, and by the birthday bound that needs far more than 30² names.
assert.ok(
  displayNames.size > SLURP_NAMED_CAST_LIMIT * SLURP_NAMED_CAST_LIMIT,
  `display names must clear the named cast: ${displayNames.size} for a cast of ${SLURP_NAMED_CAST_LIMIT}`,
);

// ── The crowd looks like an audience ────────────────────────────────────────
// Mostly free readers with a thin paying tail. A crowd where everyone pays is neither believable
// nor interesting, because the few who do pay stop meaning anything.
const tiers = new Map<string, number>();
for (const entry of sample) tiers.set(entry.spendTier, (tiers.get(entry.spendTier) ?? 0) + 1);
const share = (tier: string) => (tiers.get(tier) ?? 0) / sample.length;
assert.ok(share("none") > 0.5, `most of the audience must not pay, got ${share("none")}`);
assert.ok(share("whale") < 0.06, `whales must stay rare, got ${share("whale")}`);
assert.ok(share("whale") > 0, "there must be some whales");

// Archetypes spread rather than piling onto one, or the cast behaves identically.
const archetypes = new Map<string, number>();
for (const entry of sample) archetypes.set(entry.archetype, (archetypes.get(entry.archetype) ?? 0) + 1);
assert.equal(archetypes.size, 6);
for (const [name, count] of archetypes) {
  assert.ok(count / sample.length > 0.1, `archetype ${name} is starved at ${count / sample.length}`);
}

// Everyone is usable: a handle, a name, at least one trait, and an hour the world clock can read.
for (const entry of sample.slice(0, 400)) {
  assert.ok(entry.handle.length > 2 && !entry.handle.includes(" "), `bad handle: ${entry.handle}`);
  assert.ok(entry.displayName.length > 2);
  assert.ok(entry.traits.length >= 1 && entry.traits.length <= 2);
  assert.equal(new Set(entry.traits).size, entry.traits.length, "traits must not repeat within a member");
  assert.ok(Number.isInteger(entry.activeHour) && entry.activeHour >= 0 && entry.activeHour < 24);
}

// ── Wiring ──────────────────────────────────────────────────────────────────
const root = join(import.meta.dirname, "..", "packages/slurp/src/engine/packages/server/src");
const read = (path: string) => readFileSync(join(root, path), "utf8");

// The six fixed identities with placeholder handles are no longer what fan activity draws from.
const operation = read("services/slurp/slurp-fan-activity.operation.ts");
assert.match(operation, /populationNoodlerFanIdentityProvider\(cast\)/u);
// Regulars recur so they can be recognised; new faces arrive so the cast churns. A frozen cast of
// thirty is the old six-account problem with thirty faces.
assert.match(operation, /FAN_RUN_RETURNING/u);
assert.match(operation, /FAN_RUN_NEWCOMERS/u);

const storage = read("services/storage/slurp-population.storage.ts");
// A stage is never lowered by advancing: that is churn's job and it has its own reasons.
assert.match(storage, /nextIndex > currentIndex && nextIndex >= 0 \? input\.stage! : tie\.stage/u);
assert.equal(SLURP_NAMED_CAST_LIMIT, 30);
// The funnel is ordered, and the order is what a follower count is counted from.
assert.equal(SLURP_FUNNEL_STAGES.indexOf("subscriber") > SLURP_FUNNEL_STAGES.indexOf("follower"), true);
assert.equal(SLURP_FUNNEL_STAGES.indexOf("follower") > SLURP_FUNNEL_STAGES.indexOf("liker"), true);

const schema = read("db/schema/slurp.ts");
assert.match(schema, /fileTable\(\s*"slurp_population"/u);
assert.match(schema, /fileTable\(\s*"slurp_audience_ties"/u);
// One tie per member per Creator, or the funnel counts the same person twice.
assert.match(schema, /uniqueBy: \[\{ keys: \["memberId", "creatorAccountId"\] \}\]/u);

console.log("slurp population regression passed");
