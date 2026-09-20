import assert from "node:assert/strict";
import { slurpImageBrief } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/feed/slp-image-brief.ts";
import { slurpCameraSourceInstruction } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/feed/slp-camera-source.ts";
import { slurpPostVariation } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/feed/slp-post-variation.ts";
import { slurp2Source } from "./slurp2-source";

const variation = slurpPostVariation("creator-a", 2);
const brief = slurpImageBrief({
  cameraInstruction: slurpCameraSourceInstruction("tripod"),
  variation,
  story: false,
});

// The brief comes from the situation that was decided before any text existed.
assert.ok(brief.includes(variation.place), "the brief must carry where they are");
assert.ok(brief.includes(variation.moment), "the brief must carry what they are in the middle of");
assert.ok(brief.includes(variation.company), "the brief must carry who is around");
assert.match(brief, /Camera: propped up or on a timer/u);
// Without this the rewrite reliably adds undress the situation never called for.
assert.match(brief, /Do not add exposed skin/u);

// A Story still has to be a phone picture, not a production.
assert.match(
  slurpImageBrief({ cameraInstruction: slurpCameraSourceInstruction("selfie"), variation, story: true }),
  /Story/u,
);
assert.doesNotMatch(
  slurpImageBrief({ cameraInstruction: slurpCameraSourceInstruction("selfie"), variation, story: false }),
  /Story/u,
);

// The point of the module: the picture is briefed without the caption. The brief builder takes no
// post text at all, so a caption cannot reach it even by accident.
const source = slurp2Source("packages/slurp2/src/engine/packages/server/src/slp/modules/feed/slp-image-brief.ts");
const signature = /export function slurpImageBrief\(input: \{([\s\S]*?)\}\): string/u.exec(source)?.[1] ?? "";
assert.ok(signature.length > 0, "could not read the brief's parameter type");
for (const field of ["content", "caption", "title", "post", "text"]) {
  assert.doesNotMatch(
    signature,
    new RegExp(`(^|\\s)${field}\\??:`, "u"),
    `the brief must not take "${field}": a picture briefed from the caption is an illustration of it`,
  );
}

// Produce mode must stop asking the post call for an imagePrompt, or the caption-derived brief
// would still be written and the decoupling would be cosmetic.
const generation = slurp2Source(
  "packages/slurp2/src/engine/packages/server/src/slp/features/feed/slp-generation-service.ts",
);
assert.match(generation, /allowImagePrompt: askModelForImagePrompt/u);
assert.match(generation, /const askModelForImagePrompt = imagesEnabled && !briefedImage/u);
// The response schema and the correction turn must agree with the post call, or a produce-mode
// retry would demand a field the prompt no longer asks for.
assert.equal(generation.match(/allowImagePrompt: askModelForImagePrompt/gu)?.length, 2);
assert.match(generation, /content: askModelForImagePrompt/u);

console.log("slurp image brief regression checks passed");
