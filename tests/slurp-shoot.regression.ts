import assert from "node:assert/strict";
import {
  SLURP_SHOOT_MAX_AGE_MS,
  SLURP_SHOOT_MAX_SHOTS,
  slurpShootInstruction,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/feed/slp-shoot.ts";
import { slurpImageBrief } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/feed/slp-image-brief.ts";
import { slurpCameraSourceInstruction } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/feed/slp-camera-source.ts";
import { slurpPostVariation } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/feed/slp-post-variation.ts";
import { slurp2Source } from "./slurp2-source";

// A shoot that supplies a week of posts stops being continuity and becomes the repetition the
// variation rotation exists to prevent.
assert.ok(SLURP_SHOOT_MAX_SHOTS >= 2 && SLURP_SHOOT_MAX_SHOTS <= 4, "a shoot must be a batch, not a season");
assert.ok(SLURP_SHOOT_MAX_AGE_MS <= 7 * 24 * 60 * 60_000, '"one more from yesterday" must not mean three weeks ago');

// The gap has to be stated out loud, or the model writes the callback as if the picture were taken
// this minute and the Creator is back in yesterday's room with no explanation.
const instruction = slurpShootInstruction({
  place: "out of the house entirely",
  company: "alone and glad of it",
  cameraSource: "tripod",
  shotsUsed: 1,
});
assert.match(instruction, /not something happening now/u);
assert.match(instruction, /out of the house entirely/u);
assert.doesNotMatch(instruction, /already posted from this one/u);
assert.match(
  slurpShootInstruction({ place: "p", company: "c", cameraSource: "tripod", shotsUsed: 2 }),
  /already posted from this one/u,
);

// A reused shoot replaces today's place and company. The photograph was taken then, so it cannot
// show where the Creator is standing now.
const variation = slurpPostVariation("creator-a", 5);
const reused = slurpImageBrief({
  cameraInstruction: slurpCameraSourceInstruction("tripod"),
  variation,
  shoot: { place: "a hotel room", company: "somebody else is nearby but out of frame" },
});
assert.match(reused, /Where: a hotel room\./u);
assert.ok(!reused.includes(`Where: ${variation.place}.`), "a reused shoot must not show today's place");
// "In the middle of" describes right now, which a two-day-old photograph cannot be.
assert.doesNotMatch(reused, /What they are in the middle of/u);
assert.match(reused, /took at an earlier shoot/u);

// Without a shoot the brief is unchanged.
const fresh = slurpImageBrief({ cameraInstruction: slurpCameraSourceInstruction("tripod"), variation });
assert.match(fresh, /What they are in the middle of/u);
assert.ok(fresh.includes(`Where: ${variation.place}.`));

// A callback must reuse the shoot's own camera. Today's rotation does not apply to a picture taken
// two days ago, and a tripod shoot cannot become a selfie after the fact.
const generation = slurp2Source(
  "packages/slurp2/src/engine/packages/server/src/slp/features/feed/slp-generation-service.ts",
);
assert.match(generation, /const camera = shoot\?\.cameraSource \?\? cameraSource/u);
// Continuity bookkeeping must never cost a post.
assert.match(generation, /Could not open a shoot session/u);
assert.match(generation, /Could not record a shoot reuse/u);

console.log("slurp shoot regression checks passed");
