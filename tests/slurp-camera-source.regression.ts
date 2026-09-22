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

// Produce mode draws from weights. Repetition is valid, and the sequence remains deterministic.
for (const companyCanHoldCamera of [true, false]) {
  const sequence = Array.from({ length: 200 }, (_, index) =>
    slurpPostCameraSource("creator-a", index, { companyCanHoldCamera }),
  );
  assert.ok(
    sequence.some((source, index) => source === sequence[index - 1]),
    "weighted draws may repeat naturally",
  );
  assert.deepEqual(
    sequence,
    Array.from({ length: 200 }, (_, index) => slurpPostCameraSource("creator-a", index, { companyCanHoldCamera })),
  );
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

// The camera replaced the free-floating framing axis rather than being added alongside it. The
// axis is gone entirely now: emitting both reintroduced the unexplained cameraman underneath the
// fix, and keeping it drawn-but-discarded cost a draw per post and lied in the deep-details panel.
const variation = slurpPostVariation("creator-a", 3);
const produce = slurpPostVariationInstruction(variation, slurpCameraSourceInstruction("selfie"));
assert.doesNotMatch(produce, /Framing for the image:/u);
assert.match(produce, /Camera: their own phone/u);
assert.ok(!("framing" in variation), "the discarded framing axis must not come back");
// The rest of the angle survives, so no situational variety was lost with it.
for (const line of [`Place: ${variation.place}.`, `Moment: ${variation.moment}.`, `Company: ${variation.company}.`]) {
  assert.ok(produce.includes(line), `the variation must keep "${line}"`);
}

// A point-of-view framing is an unexplained camera position that also puts a second body in the
// frame. Every source has to carry the prohibition, or the image model supplies the body.
for (const source of SLURP_CAMERA_SOURCES) {
  const instruction = slurpCameraSourceInstruction(source);
  assert.match(instruction, /no first-person or point-of-view framing/iu, `${source} must forbid POV framing`);
  assert.match(instruction, /Show only the people the company names/u, `${source} must bound who is in frame`);
}

// The feed used to be two posts in three of the same arm's-length phone picture. Hand-held
// self-shots stay the largest share without being the whole page.
const draws = Array.from({ length: 4000 }, (_, index) =>
  slurpPostCameraSource(`creator-${index % 40}`, Math.floor(index / 40), { companyCanHoldCamera: true }),
);
const share = (source: string) => draws.filter((value) => value === source).length / draws.length;
const handHeld = share("selfie") + share("mirror");
assert.ok(handHeld > 0.3, `hand-held self-shots must stay the common case, got ${handHeld.toFixed(2)}`);
assert.ok(handHeld < 0.55, `hand-held self-shots must not dominate the feed, got ${handHeld.toFixed(2)}`);
// Every other source has to be a real part of the mix rather than a rounding error.
for (const source of ["tripod", "screenshot", "archive", "partner"] as const) {
  assert.ok(share(source) > 0.05, `${source} must be visible in the mix, got ${share(source).toFixed(3)}`);
}

console.log("slurp camera source regression checks passed");
