import assert from "node:assert/strict";
import {
  SLURP_CAMERA_SOURCE_RULE,
  SLURP_CAMERA_SOURCES,
  slurpCameraSourceInstruction,
  slurpPermittedCameraSources,
  slurpPostCameraSource,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/feed/slp-camera-source.ts";
import {
  slurpPostVariation,
  slurpPostVariationInstruction,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/feed/slp-post-variation.ts";

// A Creator who is alone cannot be photographed by somebody else. This is the whole point of the
// module: the scene has to pay for the camera position.
assert.equal(slurpPermittedCameraSources({ companyCanHoldCamera: false }).includes("partner"), false);
assert.equal(slurpPermittedCameraSources({ companyCanHoldCamera: true }).includes("partner"), true);

// Every source stays reachable when somebody is there, so no source is dead code.
assert.deepEqual(
  [...slurpPermittedCameraSources({ companyCanHoldCamera: true })].sort(),
  [...SLURP_CAMERA_SOURCES].sort(),
);

// Selection never returns a source the scene cannot pay for, at any point in the rotation.
for (let sequence = 0; sequence < 50; sequence += 1) {
  const source = slurpPostCameraSource("creator-alone", sequence, { companyCanHoldCamera: false });
  assert.notEqual(source, "partner", `alone creator got a partner camera at ${sequence}`);
  assert.ok(SLURP_CAMERA_SOURCES.includes(source));
}

// Consecutive posts differ, which is what rotating rather than drawing at random buys.
for (const companyCanHoldCamera of [true, false]) {
  for (let sequence = 0; sequence < 20; sequence += 1) {
    assert.notEqual(
      slurpPostCameraSource("creator-a", sequence, { companyCanHoldCamera }),
      slurpPostCameraSource("creator-a", sequence + 1, { companyCanHoldCamera }),
      `consecutive posts repeated a camera source at ${sequence}`,
    );
  }
}

// Two Creators set up the same day must not march through the sources in lockstep.
const a = Array.from({ length: 12 }, (_, i) => slurpPostCameraSource("creator-a", i, { companyCanHoldCamera: true }));
const b = Array.from({ length: 12 }, (_, i) => slurpPostCameraSource("creator-b", i, { companyCanHoldCamera: true }));
assert.notDeepEqual(a, b);

// A bad post count must not index nothing and hand the caller an undefined source.
for (const sequence of [Number.NaN, -5, 1.7, Number.POSITIVE_INFINITY]) {
  assert.ok(
    SLURP_CAMERA_SOURCES.includes(slurpPostCameraSource("creator-a", sequence, { companyCanHoldCamera: true })),
  );
}

// Every source carries the prohibition. Stated softly, the image model reintroduces the
// unexplained angle, so it must be present on every single one.
for (const source of SLURP_CAMERA_SOURCES) {
  assert.match(slurpCameraSourceInstruction(source), /Describe the photograph, not the scene/u);
  assert.ok(slurpCameraSourceInstruction(source).includes(SLURP_CAMERA_SOURCE_RULE));
}

// Produce mode replaces the free-floating framing axis rather than adding to it. Emitting both
// would reintroduce the unexplained cameraman underneath the fix.
const variation = slurpPostVariation("creator-a", 3);
const classic = slurpPostVariationInstruction(variation);
const produce = slurpPostVariationInstruction(variation, slurpCameraSourceInstruction("selfie"));
assert.match(classic, /Framing for the image:/u);
assert.doesNotMatch(produce, /Framing for the image:/u);
assert.match(produce, /Camera: their own phone/u);
// The rest of the angle survives, so produce mode loses no situational variety.
for (const line of [`Place: ${variation.place}.`, `Moment: ${variation.moment}.`, `Company: ${variation.company}.`]) {
  assert.ok(classic.includes(line) && produce.includes(line), `both modes must keep "${line}"`);
}

console.log("slurp camera source regression checks passed");
