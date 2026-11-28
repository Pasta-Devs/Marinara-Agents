import assert from "node:assert/strict";
import {
  slurpImageBrief,
  slurpPictureOutfit,
  slurpShootContinuity,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/feed/slp-image-brief.ts";
import { slurpCameraSourcePhoto } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/feed/slp-camera-source.ts";
import { slurpPostVariation } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/feed/slp-post-variation.ts";

// An outfit that says "no clothes" with an intensifier in front is no outfit at a body-showing level.
// The brief used to write "Wearing completely naked." because only a line that started with the bare word counted.
for (const outfit of [
  "completely naked",
  "Completely naked.",
  "fully nude",
  "totally nude, bare skin",
  "stark naked",
  "entirely unclothed",
  "nothing at all",
  "naked",
  "completely bare",
]) {
  assert.equal(slurpPictureOutfit({ level: "explicit", scene: outfit }), "", outfit);
  assert.equal(slurpPictureOutfit({ level: "nudity", selected: outfit }), "", outfit);
}

// Real clothes, or clothes with a bare word in them, stay.
for (const outfit of ["bare feet and a silk robe", "a towel, nothing else underneath", "nude-colour slip dress"]) {
  assert.equal(slurpPictureOutfit({ level: "explicit", scene: outfit }), outfit, outfit);
}
// At a clothed level the outfit is the writer's, whatever it says.
assert.equal(slurpPictureOutfit({ level: "none", scene: "fully nude" }), "fully nude");

const brief = slurpImageBrief({
  cameraPhoto: slurpCameraSourcePhoto("tripod"),
  variation: slurpPostVariation("creator-a", 1),
  sexualLevel: "nudity",
  scene: {
    wardrobeId: null,
    setting: "a tiled shower",
    action: "rinsing her hair",
    expression: "eyes closed",
    visualDirection: "steam, soft light",
    outfit: "completely naked",
  },
});
assert.doesNotMatch(brief, /Wearing/u, "a bare outfit writes no 'Wearing' line");
assert.doesNotMatch(
  slurpShootContinuity({
    bare: true,
    scene: {
      wardrobeId: null,
      setting: "a tiled shower",
      action: "x",
      expression: "x",
      visualDirection: "x",
      outfit: "fully nude",
    },
  }) ?? "",
  /Wearing/u,
  "a shoot keeps no bare outfit as clothes",
);

console.log("slurp2 bare outfit regression checks passed");
