import assert from "node:assert/strict";
import {
  SLURP_POST_EFFORTS,
  SLURP_PRODUCTION_STYLES,
  slurpEffortInstruction,
  slurpPostEffort,
  slurpProductionInstruction,
  slurpProductionProfile,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/creators/slp-production-profile.ts";
import {
  SLURP_CAMERA_SOURCES,
  slurpPostCameraSource,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/feed/slp-camera-source.ts";
import { slurpPromptDescriptions } from "../packages/slurp2/src/engine/packages/server/src/slp/base/prompting/slp-prompt-blocks.ts";

// A production style must survive every edit to the character card. Keying it on the prose would
// reshuffle how a Creator shoots the first time somebody fixed a typo in their bio.
const first = slurpProductionProfile("creator-a");
assert.deepEqual(slurpProductionProfile("creator-a"), first, "a Creator's style must be stable");
assert.ok(SLURP_PRODUCTION_STYLES.includes(first.style));

// The whole point: unrelated Creators must not share one production grammar.
const styles = new Set(Array.from({ length: 60 }, (_, i) => slurpProductionProfile(`creator-${i}`).style));
assert.equal(styles.size, SLURP_PRODUCTION_STYLES.length, "every production style must actually be reachable");

// Even the theatrical Creator has ordinary days. A uniformly polished feed is as monotonous as a
// feed where every post is the same situation.
for (let i = 0; i < 60; i += 1) {
  const profile = slurpProductionProfile(`creator-${i}`);
  const efforts = new Set(Array.from({ length: 12 }, (_, s) => slurpPostEffort(profile, s)));
  assert.ok(efforts.size > 1, `${profile.style} is uniformly ${[...efforts][0]}`);
  for (const effort of efforts) assert.ok(SLURP_POST_EFFORTS.includes(effort));
}
// A bad post count must not index nothing.
for (const sequence of [Number.NaN, -2, 1.5, Number.POSITIVE_INFINITY]) {
  assert.ok(SLURP_POST_EFFORTS.includes(slurpPostEffort(first, sequence)));
}

// Preference must never override permission: a Creator who likes being photographed by somebody
// else still cannot be, alone.
for (let i = 0; i < 20; i += 1) {
  const profile = slurpProductionProfile(`creator-${i}`);
  for (let sequence = 0; sequence < 40; sequence += 1) {
    const source = slurpPostCameraSource(`creator-${i}`, sequence, {
      companyCanHoldCamera: false,
      prefers: profile.prefers,
    });
    assert.notEqual(source, "partner", `${profile.style} got a partner camera while alone`);
    assert.ok(SLURP_CAMERA_SOURCES.includes(source));
  }
}

// Weighted selection can repeat. The preference must still bias the long-run result.
for (let i = 0; i < 20; i += 1) {
  const profile = slurpProductionProfile(`creator-${i}`);
  for (const companyCanHoldCamera of [true, false]) {
    const sequence = Array.from({ length: 120 }, (_, index) =>
      slurpPostCameraSource(`creator-${i}`, index, { companyCanHoldCamera, prefers: profile.prefers }),
    );
    assert.ok(sequence.some((source, index) => source === sequence[index - 1]));
  }
}

// A preference has to actually bias the result, or the profile is decoration.
const homemade = slurpProductionProfile("creator-a");
const counts = Array.from({ length: 120 }, (_, s) =>
  slurpPostCameraSource("creator-a", s, { companyCanHoldCamera: true, prefers: homemade.prefers }),
);
const favoured = counts.filter((source) => homemade.prefers.includes(source)).length;
assert.ok(favoured / counts.length > 0.5, `favoured cameras were only ${favoured} of ${counts.length}`);

// Every style says something about the work, and every effort level says something about the shot.
for (const style of SLURP_PRODUCTION_STYLES) {
  const profile = Array.from({ length: 60 }, (_, i) => slurpProductionProfile(`creator-${i}`)).find(
    (candidate) => candidate.style === style,
  )!;
  assert.match(slurpProductionInstruction(profile), /# How you make things/u);
  assert.ok(profile.transparency.length > 20, `${style} must say how it makes things`);
}
for (const effort of SLURP_POST_EFFORTS) assert.ok(slurpEffortInstruction(effort).startsWith("Effort:"));

// Optional, so the Classic prompt preset can switch it off.
const productionBlock = slurpPromptDescriptions()
  .find((prompt) => prompt.id === "post")!
  .blocks.find((block) => block.id === "production");
assert.equal(productionBlock?.optional, true);

console.log("slurp production profile regression checks passed");
