/**
 * Per-type comment banks: a Troll stops sounding like a Superfan, and growing the banks stays a
 * nicety that can never damage them.
 *
 * The three risks of this slice are all covered here: a legacy flat bank silently losing lines on
 * upgrade, a batched growth answer being trusted without clamping, and a rebalance preview that
 * disagrees with what the apply writes.
 */
import assert from "node:assert/strict";
import { join } from "node:path";

import {
  mergeSlurpReactionBankBatch,
  slurpNormalizeReactionBanks,
  slurpReactionBodiesForType,
  SLURP_TYPE_BANK_THIN,
} from "../packages/slurp2/src/engine/packages/server/src/services/slurp/slurp-reaction-bank.js";
import {
  SLURP_SHIPPED_REACTIONS,
  SLURP_SHIPPED_TYPE_REACTIONS,
  slurpAudienceReactionFrom,
} from "../packages/slurp2/src/engine/packages/server/src/services/slurp/slurp-world-copy.js";
import {
  planSlurpFanTypeRebalance,
  slurpFanTypesDefault,
} from "../packages/slurp2/src/engine/packages/server/src/services/slurp/slurp-fan-types.js";
import { slurp2Source } from "./slurp2-source";

const read = (relative: string): string =>
  slurp2Source(join("packages/slurp2/src/engine/packages/server/src", relative));

// ── The legacy array normalises into `shared`, without losing a line ────────
const legacy = Array.from({ length: 37 }, (_, index) => `legacy body ${index}`);
const normalized = slurpNormalizeReactionBanks(legacy);
assert.deepEqual(normalized.shared, legacy);
assert.deepEqual(normalized.byType, {});
// The settings schema is what runs that normalisation on every read of an old save. The storage
// module needs an Engine checkout to import, so this is asserted on the source.
assert.match(
  read("services/storage/slurp.storage.ts"),
  /audienceReactionBank: z\.unknown\(\)\.transform\(slurpNormalizeReactionBanks\)/u,
);
// Rubbish reads as empty rather than throwing, and the object form round-trips.
assert.deepEqual(slurpNormalizeReactionBanks(null), { shared: [], byType: {} });
assert.deepEqual(slurpNormalizeReactionBanks({ shared: ["a"], byType: { troll: ["b"], empty: [] } }), {
  shared: ["a"],
  byType: { troll: ["b"] },
});
assert.deepEqual(slurpNormalizeReactionBanks({ shared: [1, "a", ""] }).shared, ["a"]);

// ── A type draws its own bodies, and falls back to shared while thin ────────
const own = Array.from({ length: SLURP_TYPE_BANK_THIN }, (_, index) => `troll body ${index}`);
const full = slurpReactionBodiesForType({ shared: ["shared body"], byType: { troll: own } }, "troll");
assert.deepEqual(full, own, "a type at target says only its own lines");
const thin = slurpReactionBodiesForType({ shared: ["shared body"], byType: { troll: ["only one"] } }, "troll");
assert.ok(thin.includes("only one"));
assert.ok(thin.includes("shared body"), "a thin type still reaches the shared bank");
assert.ok(thin.includes(SLURP_SHIPPED_REACTIONS[0]!), "and the shipped bodies underneath it");
// The shipped starters count as the type's own, so a fresh install already sounds different.
const starters = SLURP_SHIPPED_TYPE_REACTIONS.troll!;
assert.ok(starters.length > 0);
assert.ok(slurpReactionBodiesForType({ shared: [], byType: {} }, "troll", starters).includes(starters[0]!));
// No type at all is the old behaviour: shipped plus shared.
assert.deepEqual(slurpReactionBodiesForType({ shared: ["s"], byType: {} }, null), [...SLURP_SHIPPED_REACTIONS, "s"]);
// The line itself is still deterministic and never blank.
const line = slurpAudienceReactionFrom("post:actor", own);
assert.equal(line, slurpAudienceReactionFrom("post:actor", own));
assert.ok(line.length > 0);
assert.ok(slurpAudienceReactionFrom("seed", []).length > 0, "an empty pool still renders");

// ── Batched growth: parsed, clamped, de-duplicated ──────────────────────────
const banks = { shared: ["already here"], byType: { troll: ["sure ok"] } };
const targets = { shared: 3, troll: 3, lurker: 2 };
const grown = mergeSlurpReactionBankBatch(
  banks,
  {
    shared: ["already here", "ALREADY HERE!", "brand new", "second new", "third new"],
    troll: ["Sure ok.", "whatever", "  quoted  "],
    lurker: ["👀 only", "x".repeat(400), 42, "two"],
    unasked: ["should be ignored"],
  },
  targets,
);
assert.deepEqual(grown.shared, ["already here", "brand new", "second new"], "clamped to target, duplicates dropped");
assert.deepEqual(grown.byType.troll, ["sure ok", "whatever", "quoted"], "case and punctuation are one line");
assert.deepEqual(grown.byType.lurker, ["👀 only", "two"], "over-long and non-string entries are skipped");
assert.ok(!("unasked" in grown.byType), "a key nobody asked for is ignored");
assert.deepEqual(banks, { shared: ["already here"], byType: { troll: ["sure ok"] } }, "the input is not mutated");
// A body already in the shipped bank never gets stored a second time.
assert.deepEqual(mergeSlurpReactionBankBatch(banks, { shared: [SLURP_SHIPPED_REACTIONS[0]] }, targets), banks);

// ── A malformed, refused or empty answer is a no-op ─────────────────────────
for (const answer of [null, undefined, "I cannot help with that", [], {}, { shared: "nope" }, { shared: [""] }]) {
  assert.equal(mergeSlurpReactionBankBatch(banks, answer, targets), banks, "banks are returned unchanged");
}

// ── Rebalance: the preview is what the apply writes, every time ─────────────
const types = slurpFanTypesDefault();
const members = Array.from({ length: 300 }, (_, index) => ({ id: `slurp-fan:m${index}`, fanTypeId: "regular" }));
const plan = planSlurpFanTypeRebalance(members, types);
assert.deepEqual(plan, planSlurpFanTypeRebalance(members, types), "deterministic");
assert.equal(plan.counts.regular!.before, members.length);
const totalAfter = Object.values(plan.counts).reduce((sum, entry) => sum + entry.after, 0);
assert.equal(totalAfter, members.length, "everybody lands on exactly one type");
assert.equal(
  plan.changes.length,
  members.length - plan.counts.regular!.after,
  "the change list is the preview's count",
);
// Applying it and previewing again changes nothing: the draw is on the member id, not the state.
const applied = members.map((member) => {
  const change = plan.changes.find((entry) => entry.memberId === member.id);
  return change ? { ...member, fanTypeId: change.to } : member;
});
const second = planSlurpFanTypeRebalance(applied, types);
assert.equal(second.changes.length, 0, "a second rebalance is a no-op");
assert.deepEqual(
  Object.fromEntries(Object.entries(second.counts).map(([id, entry]) => [id, entry.before])),
  Object.fromEntries(Object.entries(plan.counts).map(([id, entry]) => [id, entry.after])),
  "what the preview promised is what the population holds",
);
// Every enabled type with a share gets somebody: the shares actually reach the existing crowd.
assert.ok(Object.keys(plan.counts).length > 5, "the crowd spreads over the built-ins");

console.log("slurp2 fan banks regression passed");
