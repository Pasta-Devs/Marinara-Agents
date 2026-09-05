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
assert.match(operation, /populationNoodlerFanIdentityProvider\(castWithHistory\)/u);
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

// Real payments move the funnel, not only the world tick. Without this the funnel records a
// fraction of what actually happened and could never be believed as a follower count.
const slurpStorage = read("services/storage/slurp.storage.ts");
assert.match(slurpStorage, /advanceAudienceTie\(viewerAccountId, creatorAccountId, \{\s*stage: "subscriber"/u);
assert.match(slurpStorage, /advanceAudienceTie\(viewerAccountId, post\.authorAccountId, \{ stage: "liker"/u);
assert.match(slurpStorage, /advanceAudienceTie\(viewerAccountId, creator\.id, \{ stage: "regular"/u);
// Unsubscribing drops the tie, so a lost subscriber leaves the funnel as well as the feed.
assert.match(slurpStorage, /\.lapseTie\(viewerAccountId, creatorAccountId\)/u);
// A funnel write must never roll back the payment that caused it.
assert.match(slurpStorage, /\[slurp-population\] Could not advance the tie/u);

// Churn: the long-silent drift out so the named cast rotates instead of freezing.
const world = read("services/slurp/slurp-world.operation.ts");
assert.match(world, /CHURN_SILENT_DAYS/u);
// Subscribers are left alone — their tie ends when the subscription does, by its own path.
assert.match(world, /tie\.stage === "subscriber"\) continue;/u);

// The world must draw from the generated population, not only the six ambient profiles.
// allowRandomUsers governs whether ambient profiles join the feed; it is not a switch for whether
// a Creator has an audience, and it defaults to false — gating the tick on it left the whole
// obligation layer dark on a fresh install.
assert.match(world, /const returning = \(await population\.listAll\(WORLD_AUDIENCE_POOL\)\)/u);
assert.match(
  world,
  /const audience = \[\.\.\.returning, \.\.\.newcomers\.map\(\(member\) => member\.id\), \.\.\.ambient\]/u,
);
// An actor is either an ambient account row or a population member with no row at all. Resolving
// only accounts silently dropped every population action.
assert.match(world, /async function resolveActor/u);
assert.match(world, /createSlurpPopulationStorage\(db\)\.get\(actorAccountId\)/u);

// listAll orders by lastActiveAt, so without touch() it keeps ordering by creation time: the same
// earliest members are redrawn forever and anybody who shows up sinks out of the pool.
assert.match(world, /population\.touch\(actor\.id\)/u);
const fanRun = read("services/slurp/slurp-fan-activity.operation.ts");
assert.match(fanRun, /cast\.map\(\(member\) => population\.touch\(member\.id\)/u);

// Fan activity is the highest-volume thing the audience does, and it fed nothing into the funnel:
// follower counts barely moved from the very people who were most active.
assert.match(fanRun, /advanceTie\(activity\.actorId, activity\.creatorId/u);
assert.match(fanRun, /activity\.type === "repost" \? "follower" : "liker"/u, "a repost carries further than a like");

// ── Cross-boundary defects found by an interaction review ───────────────────
// Three id spaces reach an actor label: a persona, a Slurp account, and a population member. The
// population was added after the notification name resolver and never wired into it, so every
// world-driven event rendered as "Someone".
const slurpRoutes2 = read("routes/slurp.routes.ts");
assert.match(slurpRoutes2, /\(await population\.get\(id\)\)\?\.displayName/u);

// Following and the funnel were two counts of the same person, and reach added both at 25x each.
// Following now moves the funnel, and the social list is no longer summed on top of it.
assert.match(slurpRoutes2, /advanceAudienceTie\(viewer\.id, creator\.id, \{ stage: "follower" \}\)/u);
assert.doesNotMatch(
  slurpRoutes2,
  /realFollowers: \(followerCounts\.get/u,
  "reach must have a single source for real followers",
);

// A legacy `noodler-fan:` id names an archetype slot, not a person. Persisted day plans still
// carry them, and a tie for one is a follower who can never be resolved but still inflates reach.
assert.match(slurpStorage, /if \(memberId\.startsWith\(NOODLER_FAN_IDENTITY_PREFIX\)\) return;/u);
assert.match(fanRun, /!activity\.actorId\.startsWith\(NOODLER_FAN_IDENTITY_PREFIX\)/u);

// Lapsing must not invent a relationship at the moment it ends.
const popStorage = read("services/storage/slurp-population.storage.ts");
const lapse = popStorage.slice(popStorage.indexOf("async lapseTie"));
assert.doesNotMatch(lapse.slice(0, 500), /ensureTie/u, "lapsing must not create a tie");
assert.match(lapse.slice(0, 500), /if \(!rows\[0\]\) return;/u);

// Churn is a full scan and the catch-up runs on every notifications read.
assert.match(world, /CHURN_MIN_ELAPSED_DAYS/u);

// ── The model must be told who is speaking ──────────────────────────────────
// The fan-activity prompt received `{ handle, weight }` and nothing else, so every generated
// comment came from a name with no person behind it. Traits, spend tier, and the relationship to
// this Creator were all stored and thrown away — in an AI-assisted product, that is the whole
// point of having a population at all.
const fanService = read("services/slurp/slurp-fan-activity.service.ts");
assert.match(fanService, /relationship: describeFanRelationship\(identity\.persona\)/u);
assert.match(fanService, /traits: identity\.persona\.traits/u);
assert.match(
  fanService,
  /Actors carry traits and a relationship to the creator\./u,
  "the system prompt must tell the model to use them",
);
// A paragraph per fan would crowd out the posts they are reacting to.
assert.match(fanService, /Kept to a sentence\./u);

const provider = read("services/slurp/slurp-fan-identity-provider.ts");
assert.match(provider, /persona\?: \{/u);
assert.match(fanRun, /populationNoodlerFanIdentityProvider\(castWithHistory\)/u);

// ── Being a particular fan has to change something ──────────────────────────
// A Creator answered a whale who had spent four hundred coins exactly as they answered a stranger:
// the comment-reply prompt carried a display name and a handle and nothing else. The direct-message
// path has had rapport since it shipped; the comment path never did — and comments are where most
// people are actually seen.
const replyService = read("services/slurp/slurp-reply-generation.service.ts");
assert.match(replyService, /relationship: input\.relationship \?\? "no history with this creator yet"/u);
assert.match(replyService, /Let the relationship set the warmth\./u);
assert.match(replyService, /async function describeCommenterRelationship/u);
// A reply is one or two sentences; a paragraph of history would dominate the comment it answers.
assert.match(replyService, /Deliberately short\./u);
// A missing relationship must never refuse a reply.
assert.match(replyService, /A missing relationship is not a reason to refuse a reply\./u);

console.log("slurp population regression passed");
