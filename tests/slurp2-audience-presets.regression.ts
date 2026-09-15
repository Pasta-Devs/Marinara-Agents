/**
 * Audience presets: one Activity choice that writes the tuning, the fan-run numbers and the world
 * dial together, and reads back as the same choice until the player edits something by hand.
 */
import assert from "node:assert/strict";
import {
  SLURP_AUDIENCE_PRESETS,
  slurpAudiencePresetFor,
  slurpAudiencePresetPatch,
} from "../packages/slurp2/src/engine/packages/server/src/services/slurp/slurp-tuning.js";
import { readFileSync } from "node:fs";
import { SLURP_REALISTIC_TUNING } from "../packages/slurp2/src/engine/packages/server/src/services/slurp/slurp-tuning.js";
import { populationNoodlerFanIdentityProvider } from "../packages/slurp2/src/engine/packages/server/src/services/slurp/slurp-fan-identity-provider.js";

// The storage module pulls in the database layer, so its shipped numbers are read as text.
const storage = readFileSync(
  "packages/slurp2/src/engine/packages/server/src/services/storage/slurp.storage.ts",
  "utf8",
);
const shipped = (key: string) => Number(new RegExp(`\\n  ${key}: (\\d+),`, "u").exec(storage)?.[1]);
assert.match(storage, /\n  fanActivityEnabled: true,/u);
assert.match(storage, /worldActivity: SLURP_DEFAULT_WORLD_ACTIVITY,/u);
const base = {
  fanActivityEnabled: true,
  worldActivity: "normal",
  fanActivityRunsPerDay: shipped("fanActivityRunsPerDay"),
  fanLikesPerRefresh: shipped("fanLikesPerRefresh"),
  fanRepliesPerRefresh: shipped("fanRepliesPerRefresh"),
  simulationTuning: structuredClone(SLURP_REALISTIC_TUNING),
};
assert.equal(slurpAudiencePresetFor(base), "realistic", "shipped defaults must read as Realistic");

for (const preset of SLURP_AUDIENCE_PRESETS) {
  const next = { ...base, ...slurpAudiencePresetPatch(preset, base) };
  assert.equal(slurpAudiencePresetFor(next), preset, `${preset} must round-trip`);
}

const off = slurpAudiencePresetPatch("off", base);
assert.deepEqual(off, { fanActivityEnabled: false, worldActivity: "off" }, "Off leaves the numbers alone");

assert.equal(slurpAudiencePresetFor({ ...base, worldActivity: "busy" }), "custom");
assert.equal(slurpAudiencePresetFor({ ...base, fanLikesPerRefresh: base.fanLikesPerRefresh + 1 }), "custom");

const edited = structuredClone(base);
edited.simulationTuning.prompts.fanActivityExtra = "keep me";
edited.simulationTuning.clock.backgroundTimer = true;
const lively = slurpAudiencePresetPatch("lively", edited);
assert.equal(lively.simulationTuning?.prompts.fanActivityExtra, "keep me", "a preset must keep prompts");
assert.equal(lively.simulationTuning?.clock.backgroundTimer, true, "a preset must keep the background timer");
assert.equal(lively.simulationTuning?.preset, "lively");

const [member] = populationNoodlerFanIdentityProvider([
  {
    id: "slurp-fan:t",
    handle: "sharp",
    displayName: "Sharp",
    archetype: "ordinary",
    traits: [],
    spendTier: "none",
    tone: "unfiltered",
  },
]).resolve({ ordinary: 1, eccentric: 1, crossFandom: 1, raider: 1, organicDiscovery: 1, freeResource: 1 }, "c1");
assert.equal(member?.persona?.tone, "unfiltered", "the identity provider must pass the fan type tone");

console.log("slurp2 audience presets regression passed");
