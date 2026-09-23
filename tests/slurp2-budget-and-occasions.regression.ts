import assert from "node:assert/strict";
import { slurpModelBudgetCap } from "../packages/slurp2/src/engine/packages/shared/src/slp/slp-model-budget.ts";
import { slurpPlatformEventInstruction } from "../packages/slurp2/src/engine/packages/shared/src/slp/slp-platform-events.ts";

// Player DM replies keep a quarter of every cap; background jobs cannot spend it.
assert.equal(slurpModelBudgetCap(20, "dm_reply"), 20);
assert.equal(slurpModelBudgetCap(20, "continuity"), 15);
assert.equal(slurpModelBudgetCap(1, "continuity"), 1, "a tiny cap must not starve background work entirely");

// An occasion aimed at selected Creators reaches exactly those Creators' prompts.
const at = new Date("2026-10-31T12:00:00Z");
const base = {
  id: "halloween",
  name: "Halloween",
  enabled: true,
  guidance: "spooky",
  activation: { kind: "window", startsAt: "2026-10-30T00:00:00Z", endsAt: "2026-11-01T00:00:00Z" },
  influences: [],
};
const selected = [{ ...base, target: { kind: "selected", creatorIds: ["a"] } }] as never;
assert.match(slurpPlatformEventInstruction(selected, at, { id: "a" }) ?? "", /Halloween/u);
assert.equal(slurpPlatformEventInstruction(selected, at, { id: "b" }), null);
assert.match(slurpPlatformEventInstruction([{ ...base, target: { kind: "all" } }] as never, at) ?? "", /Halloween/u);
// A random subset includes some Creators and not others, stably.
const random = [{ ...base, target: { kind: "random", min: 1, max: 5 } }] as never;
const pick = () =>
  Array.from({ length: 40 }, (_, index) => Boolean(slurpPlatformEventInstruction(random, at, { id: `c${index}` })));
const picks = pick();
assert.ok(picks.some(Boolean) && !picks.every(Boolean), "random must pick a real subset");
assert.deepEqual(picks, pick());

// An occurrence decides its occasion: a suggested one stays out, an active one reaches only its
// participants, and story facts reach the Creators they belong to.
const allEvents = [{ ...base, target: { kind: "all" } }] as never;
const occurrence = (status: string, participantIds: string[]) => ({
  blueprintId: "halloween",
  status,
  startsAt: "2026-10-30T00:00:00Z",
  endsAt: "2026-11-01T00:00:00Z",
  participantIds,
  blueprint: { name: "Halloween", guidance: "spooky" },
});
assert.equal(
  slurpPlatformEventInstruction(allEvents, at, { id: "a" }, { occurrences: [occurrence("suggested", [])], facts: [] }),
  null,
  "a suggested occurrence waits for the player",
);
const activeFor = { occurrences: [occurrence("active", ["a"])], facts: [] };
assert.match(slurpPlatformEventInstruction(allEvents, at, { id: "a" }, activeFor) ?? "", /Halloween/u);
assert.equal(slurpPlatformEventInstruction(allEvents, at, { id: "b" }, activeFor), null);
const facts = {
  occurrences: [],
  facts: [
    { scope: "creator" as const, creatorId: "a", label: "Won the costume contest", expiresAt: null },
    { scope: "world" as const, label: "The city fair is on", expiresAt: null },
  ],
};
assert.match(slurpPlatformEventInstruction([], at, { id: "a" }, facts) ?? "", /costume contest[\s\S]*city fair/u);
assert.doesNotMatch(slurpPlatformEventInstruction([], at, { id: "b" }, facts) ?? "", /costume contest/u);

console.log("slurp2 budget and occasions regression passed");
