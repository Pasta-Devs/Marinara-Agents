/**
 * Fan Types: the audience becomes editable without the world behaving differently on day one.
 *
 * The whole risk of this slice is a silent behaviour change. Archetype, spend tier, traits and
 * active hour used to be four unrelated hashes of one seed; they all hang off a Fan Type now, so
 * the built-ins have to reproduce the old aggregate — the 62/25/11/2 spend mix and the
 * 0 / 0.02 / 0.05 / 0.12 daily conversion — or every existing save quietly earns different money.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  SLURP_BUILTIN_FAN_TYPES,
  slurpFallbackFanType,
  slurpFanTypeSpendTier,
  slurpFanTypeWeeklyBudget,
  slurpFanTypesDefault,
  slurpFanTypeSchema,
  slurpFanVoiceForPrompt,
  slurpNormalizeFanTypes,
  slurpPickFanType,
  slurpResolveFanType,
} from "../packages/slurp2/src/engine/packages/server/src/services/slurp/slurp-fan-types.js";
import { generateSlurpPopulationMember } from "../packages/slurp2/src/engine/packages/server/src/services/slurp/slurp-population.js";
import {
  slurpAudienceConversionChance,
  SLURP_AUDIENCE_WEEKLY_BUDGET,
} from "../packages/slurp2/src/engine/packages/server/src/services/slurp/slurp-audience-subscription.js";
import { populationNoodlerFanIdentityProvider } from "../packages/slurp2/src/engine/packages/server/src/services/slurp/slurp-fan-identity-provider.js";
import { planSlurpWorldPulse } from "../packages/slurp2/src/engine/packages/server/src/services/slurp/slurp-world-pulse.js";

const at = new Date("2026-09-05T00:00:00.000Z");

// ── The defaults are valid, and there are eight of them ─────────────────────
assert.equal(SLURP_BUILTIN_FAN_TYPES.length, 8);
for (const type of slurpFanTypesDefault()) {
  assert.doesNotThrow(() => slurpFanTypeSchema.parse(type), `built-in ${type.id} must validate`);
  assert.equal(type.builtIn, true);
  assert.equal(type.enabled, true);
  assert.ok(type.voice.length > 0 && type.voice.length <= 600, `built-in ${type.id} needs a short voice`);
}
// Every Engine archetype must have a built-in, or a legacy member could resolve to nothing.
assert.equal(new Set(SLURP_BUILTIN_FAN_TYPES.map((type) => type.engineArchetype)).size, 6);
// A default copy is a copy. Editing one must not edit the built-ins the reset button restores.
slurpFanTypesDefault()[0]!.name = "edited";
assert.equal(SLURP_BUILTIN_FAN_TYPES[0]!.name, "Regular");

// Out-of-range values clamp rather than throw: an import or a hand edit must not cost the list.
const clamped = slurpFanTypeSchema.parse({ id: "x", name: "X", share: 9_999, funnel: { followChance: 4 } });
assert.equal(clamped.share, 1000);
assert.equal(clamped.funnel.followChance, 1);

// ── Generation is deterministic and matches the shares ──────────────────────
assert.deepEqual(generateSlurpPopulationMember("seed-1", at), generateSlurpPopulationMember("seed-1", at));
const sample = Array.from({ length: 8_000 }, (_, index) => generateSlurpPopulationMember(`f${index}`, at));
const totalShare = SLURP_BUILTIN_FAN_TYPES.reduce((sum, type) => sum + type.share, 0);
for (const type of SLURP_BUILTIN_FAN_TYPES) {
  const got = sample.filter((member) => member.fanTypeId === type.id).length / sample.length;
  const want = type.share / totalShare;
  assert.ok(Math.abs(got - want) < 0.03, `${type.id} share was ${got.toFixed(3)}, wanted ${want.toFixed(3)}`);
}
// The archetype must stay in step with the type, or the Engine fan-identity interface lies.
for (const member of sample.slice(0, 500)) {
  const type = SLURP_BUILTIN_FAN_TYPES.find((entry) => entry.id === member.fanTypeId)!;
  assert.equal(member.archetype, type.engineArchetype);
  assert.ok(type.traits.length === 0 || member.traits.every((trait) => type.traits.includes(trait)));
}

// ── Today's money, reproduced ───────────────────────────────────────────────
// The old constants: 62% of the crowd never pays, 25% light, 11% regular, 2% whale.
const mix = new Map<string, number>();
for (const member of sample) mix.set(member.spendTier, (mix.get(member.spendTier) ?? 0) + 1);
const shareOf = (tier: string) => (mix.get(tier) ?? 0) / sample.length;
for (const [tier, want] of [
  ["none", 0.62],
  ["light", 0.25],
  ["regular", 0.11],
  ["whale", 0.02],
] as const) {
  assert.ok(Math.abs(shareOf(tier) - want) < 0.03, `${tier} was ${shareOf(tier).toFixed(3)}, wanted ${want}`);
}
// The tier tables the older callers still read are derived from the built-ins, and must land on
// exactly the numbers they used to be written out as.
assert.deepEqual(SLURP_AUDIENCE_WEEKLY_BUDGET, { none: 0, light: 20, regular: 60, whale: 200 });
assert.equal(slurpAudienceConversionChance("none", 0, 0, 0), 0);
assert.equal(slurpAudienceConversionChance("light", 0, 0, 0), 0.02);
assert.equal(slurpAudienceConversionChance("regular", 0, 0, 0), 0.05);
assert.equal(slurpAudienceConversionChance("whale", 0, 0, 0), 0.12);
// A member's own Fan Type outranks the tier table.
assert.equal(slurpAudienceConversionChance("none", 0, 0, 0, 0.4), 0.4);

// A budget is stable for one member and spread across the type's range.
const superfan = SLURP_BUILTIN_FAN_TYPES.find((type) => type.id === "superfan")!;
assert.equal(slurpFanTypeWeeklyBudget(superfan, "slurp-fan:a"), slurpFanTypeWeeklyBudget(superfan, "slurp-fan:a"));
const budgets = Array.from({ length: 400 }, (_, index) => slurpFanTypeWeeklyBudget(superfan, `slurp-fan:b${index}`));
assert.ok(Math.min(...budgets) >= superfan.spend.weeklyBudget[0]);
assert.ok(Math.max(...budgets) <= superfan.spend.weeklyBudget[1]);
assert.ok(new Set(budgets).size > 10, "a range must actually spread");
assert.equal(slurpFanTypeSpendTier(0), "none");
assert.equal(slurpFanTypeSpendTier(20), "light");
assert.equal(slurpFanTypeSpendTier(60), "regular");
assert.equal(slurpFanTypeSpendTier(200), "whale");

// ── Deleting or disabling a type must not crash a tick ──────────────────────
const without = slurpFanTypesDefault().filter((type) => type.id !== "superfan");
assert.equal(slurpResolveFanType(without, { fanTypeId: "superfan", archetype: "ordinary" }).id, "regular");
const disabled = slurpFanTypesDefault().map((type) => (type.id === "lurker" ? { ...type, enabled: false } : type));
assert.equal(slurpResolveFanType(disabled, { fanTypeId: "lurker", archetype: "freeResource" }).id, "regular");
assert.equal(slurpPickFanType(disabled, "seed").enabled, true, "a disabled type is never drawn");
for (let index = 0; index < 500; index += 1) {
  assert.notEqual(slurpPickFanType(disabled, `s${index}`).id, "lurker");
}
// An empty or all-disabled list still answers, rather than throwing inside the tick.
assert.ok(slurpFallbackFanType([]).id.length > 0);
assert.ok(slurpPickFanType([], "seed").id.length > 0);
assert.equal(slurpNormalizeFanTypes([]).length, 8);
assert.equal(slurpNormalizeFanTypes("nonsense").length, 8);
assert.ok(
  slurpNormalizeFanTypes(slurpFanTypesDefault().map((type) => ({ ...type, enabled: false }))).some(
    (type) => type.enabled,
  ),
  "an all-disabled list must re-enable built-in Regular",
);
// Duplicate ids collapse, so a bad import cannot double a type's share.
assert.equal(slurpNormalizeFanTypes([...slurpFanTypesDefault(), ...slurpFanTypesDefault()]).length, 8);

// ── An old row has no fanTypeId, and must not need a migration pass ─────────
const legacy = { archetype: "eccentric" as const };
assert.equal(slurpResolveFanType(slurpFanTypesDefault(), legacy).id, "night-owl");
assert.equal(slurpResolveFanType(slurpFanTypesDefault(), { fanTypeId: null, archetype: "raider" }).id, "troll");
assert.equal(slurpResolveFanType(slurpFanTypesDefault(), {}).id, "regular");

// ── The voice reaches the prompt ────────────────────────────────────────────
const identities = populationNoodlerFanIdentityProvider([
  {
    id: "slurp-fan:v",
    handle: "moth_hour",
    displayName: "Moth Hour",
    archetype: "ordinary",
    traits: ["collector"],
    spendTier: "light",
    voice: "  Writes\nin   fragments.  ",
  },
]).resolve(
  {
    ordinary: 1,
    eccentric: 0,
    crossFandom: 0,
    raider: 0,
    organicDiscovery: 0,
    freeResource: 0,
  },
  "creator-1",
);
assert.equal(identities[0]!.persona?.voice, "Writes in fragments.");
// A player-editable value must be cut before it reaches a prompt that carries one per actor.
assert.equal(slurpFanVoiceForPrompt("x".repeat(5_000))!.length, 240);
assert.equal(slurpFanVoiceForPrompt(""), undefined);
assert.equal(slurpFanVoiceForPrompt(null), undefined);

const root = join(import.meta.dirname, "..", "packages/slurp2/src/engine/packages/server/src");
const read = (path: string) => readFileSync(join(root, path), "utf8");

// The fan-activity prompt has to be told the voice matters, and be handed it.
const fanService = read("services/slurp/slurp-fan-activity.service.ts");
assert.match(fanService, /identity\.persona\.voice \? \{ voice: identity\.persona\.voice \} : \{\}/u);
assert.match(fanService, /An actor's voice is how that kind of person writes\./u);
// The rewrite and the direct-message prompts carry it too.
assert.match(read("services/slurp/slurp-pending-text.service.ts"), /speakerVoice:/u);
assert.match(
  read("services/slurp/slurp-message-generation.service.ts"),
  /input\.fanVoice \? \{ voice: input\.fanVoice \} : \{\}/u,
);

// ── Behaviour weights are read, not just stored ─────────────────────────────
const world = read("services/slurp/slurp-world.operation.ts");
assert.match(world, /actorWeights/u, "the pulse must be told what each actor's type makes them do");
assert.match(world, /slurpFanTypeCommissionBudget/u, "commission settlement reads the type, not a constant");
assert.match(world, /slurpPickFanType\(settings\.fanTypes, tie\.memberId\)/u, "ambient accounts map to a type");
const pulse = read("services/slurp/slurp-world-pulse.ts");
assert.match(pulse, /followChance/u);
// Settings hold the list, and the population row remembers which type somebody is.
assert.match(read("services/storage/slurp.storage.ts"), /fanTypes: slurpFanTypesSchema/u);
assert.match(read("db/schema/slurp.ts"), /fanTypeId: text\("fan_type_id"\)/u);

// ── The weighted pulse behaves, and the default is unchanged ────────────────
const targets = [{ creatorAccountId: "c1", postId: "p1", ageHours: 1, creatorReach: 60_000 }];
const audience = Array.from({ length: 40 }, (_, index) => `m${index}`);
const plain = planSlurpWorldPulse({ elapsedMinutes: 600, targets, audience, seed: "s" });
assert.ok(plain.length > 0);
// No weights means the plan is exactly what it always was.
assert.deepEqual(planSlurpWorldPulse({ elapsedMinutes: 600, targets, audience, seed: "s" }), plain);
const weights = new Map(
  audience.map((id) => [id, { activity: 1, like: 1, follow: 1, comment: 0, followChance: 0 }] as const),
);
const likesOnly = planSlurpWorldPulse({ elapsedMinutes: 600, targets, audience, seed: "s", actorWeights: weights });
assert.ok(likesOnly.length > 0);
assert.ok(
  likesOnly.every((action) => action.kind === "like"),
  "a crowd that never comments and never follows only likes",
);

console.log("slurp2 fan types regression passed");
