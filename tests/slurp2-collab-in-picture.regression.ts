import assert from "node:assert/strict";
import { slurpPostPictureBriefs } from "../packages/slurp2/src/engine/packages/server/src/slp/features/feed/slp-post-picture-briefs.ts";
import { slurpTiePutsCastInPicture } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/feed/slp-tie-beats.ts";
import { slurpPostVariation } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/feed/slp-post-variation.ts";
import type { SlurpExplicitLevel } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/feed/slp-post-guidance.ts";
import { slurp2Source } from "./slurp2-source";

// Which tie beats put their cast in the picture.
assert.equal(slurpTiePutsCastInPicture({ kind: "collab", id: "c1", partnerId: "kai" }), true, "a collab drop");
assert.equal(slurpTiePutsCastInPicture({ kind: "collab", id: "c1", partnerId: "kai", announce: true }), false);
assert.equal(slurpTiePutsCastInPicture({ kind: "collab", id: "c1", partnerId: "kai", echo: true }), false);
assert.equal(slurpTiePutsCastInPicture({ kind: "couple", id: "k1", partnerId: "kai", moment: "date" }), true);
assert.equal(slurpTiePutsCastInPicture({ kind: "couple", id: "k1", partnerId: "kai", moment: "launch" }), true);
assert.equal(slurpTiePutsCastInPicture({ kind: "couple", id: "k1", partnerId: "kai", moment: "breakup" }), false);
assert.equal(slurpTiePutsCastInPicture({ kind: "couple", id: "k1", partnerId: "kai", moment: "cameo" }), false);
assert.equal(
  slurpTiePutsCastInPicture({ kind: "couple", id: "k1", partnerId: "kai", moment: "date", secret: true }),
  false,
  "a secret couple never shows the partner's face",
);
assert.equal(slurpTiePutsCastInPicture({ kind: "couple", id: "k1", partnerId: "kai", pageId: "page" }), true);
assert.equal(slurpTiePutsCastInPicture({ kind: "rival", id: "r1", partnerId: "kai" }), false);
assert.equal(slurpTiePutsCastInPicture(null), false);

const scene = {
  wardrobeId: null,
  setting: "a hotel room with city lights",
  action: "kneeling on the bed together",
  expression: "laughing",
  visualDirection: "warm lamp light",
  outfit: "matching black robes",
};
const collab = { kind: "collab", id: "c1", partnerId: "kai" } as const;
const briefs = (level: SlurpExplicitLevel, castInPicture?: readonly string[], partner?: string | null) =>
  slurpPostPictureBriefs({
    project: null,
    variation: slurpPostVariation("creator-a", 3),
    camera: "tripod",
    effort: "medium",
    axes: { intent: "set" },
    postImages: true,
    access: "locked",
    explicitLevel: level,
    partner,
    cast: ["Kai"],
    beat: castInPicture ? { cast: castInPicture, tie: collab } : { cast: ["Kai"], tie: { ...collab, announce: true } },
    modelImagePrompt: null,
    scene,
    disclosureMode: "open",
    publicIdentity: null,
  });

// A collab's joint post draws the partner at every level, the negative prompt lets a second person in,
// and the cast's looks and references reach the image service.
for (const level of ["none", "suggestive", "nudity", "explicit"] as const) {
  const result = briefs(level, ["Kai"]);
  assert.match(result.draftImagePrompt ?? "", /Two people: the Creator and Kai\./u, level);
  assert.doesNotMatch(result.draftImagePrompt ?? "", /The only person|may be in the photo too/u, level);
  assert.doesNotMatch(result.negativePrompt ?? "", /second person|extra people/u, level);
  assert.match(result.negativePrompt ?? "", /duplicate person/u, "a doubled Creator stays out");
  assert.equal(result.pictureCast, true, level);
}
assert.match(briefs("explicit", ["Kai"]).draftImagePrompt ?? "", /explicit adult content with their partner/u);
assert.match(briefs("nudity", ["Kai", "Noor"]).draftImagePrompt ?? "", /Three people: the Creator and Kai and Noor\./u);

// A post whose beat does not put the cast in the picture is unchanged.
const alone = briefs("explicit");
assert.match(alone.draftImagePrompt ?? "", /The only person in the photo\./u);
assert.match(alone.negativePrompt ?? "", /second person, extra people/u);
assert.equal(alone.pictureCast, false);
assert.match(briefs("suggestive").draftImagePrompt ?? "", /Kai may be in the photo too/u);
// The spice gate's partner still works as before.
assert.match(briefs("explicit", undefined, "Jonas").draftImagePrompt ?? "", /Two people: the Creator and Jonas\./u);

// The generation service hands the post's beat to the picture briefs.
assert.match(
  slurp2Source("packages/slurp2/src/engine/packages/server/src/slp/features/feed/slp-generation-service.ts"),
  /slurpPostPictureBriefs\(\{[^}]*\n\s+beat,\n/u,
);

console.log("slurp2 collab in picture regression checks passed");
