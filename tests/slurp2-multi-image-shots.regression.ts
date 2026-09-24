import assert from "node:assert/strict";
import { slpGeneratedCreatorPostSchema } from "../packages/slurp2/src/engine/packages/shared/src/slp/slp-social-generation.schema.ts";
import { slurp2Source } from "./slurp2-source";

const scene = {
  wardrobeId: null,
  setting: "Beach bar at dusk",
  action: "Laughing",
  expression: "Bright",
  visualDirection: "Warm light",
  outfit: "Red sundress",
};
const shot = {
  setting: "Harbour wall at noon",
  action: "Eating gelato",
  expression: "Squinting",
  visualDirection: "Hard sun",
  outfit: "Red sundress",
};

// Planned shots survive parsing; an extra key a model adds is dropped rather than failing the post.
const parsed = slpGeneratedCreatorPostSchema.parse({
  title: "Trip",
  content: "Dump",
  scene,
  shots: [{ ...shot, wardrobeId: "x" }, shot],
});
assert.equal(parsed.shots.length, 2);
assert.equal("wardrobeId" in parsed.shots[0]!, false);
// A malformed shot list never costs the post; it falls back to generic framings.
assert.deepEqual(slpGeneratedCreatorPostSchema.parse({ title: "T", content: "C", scene, shots: "nope" }).shots, []);
assert.deepEqual(slpGeneratedCreatorPostSchema.parse({ title: "T", content: "C", scene }).shots, []);

const postPrompt = slurp2Source("packages/slurp2/src/engine/packages/server/src/slp/features/feed/slp-post-prompt.ts");
assert.match(postPrompt, /sees nothing but that picture's own fields/u);
assert.match(postPrompt, /slurpSceneShotsInstruction\(input\.sceneShots\)/u, "a set asks for its extra shots");

// No secondary tells a memoryless image model to match a picture it never saw.
const multi = slurp2Source(
  "packages/slurp2/src/engine/packages/server/src/slp/features/media/slp-multi-image-service.ts",
);
assert.doesNotMatch(multi, /same outfit, place, and light|another photograph from the same shoot|compositionGuard:/u);
assert.match(multi, /imagePrompt: generated\.providerPrompt/u, "extra pictures store the prompt that was sent");

console.log("slurp2 multi-image shots regression passed");
