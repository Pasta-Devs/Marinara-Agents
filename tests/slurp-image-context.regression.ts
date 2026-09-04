import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { noodleImageContext } from "../packages/slurp/src/engine/packages/server/src/services/slurp/slurp-image-prompt.ts";

// A generated image reuses the prompt that produced it, which is free and beats captioning it.
assert.equal(
  noodleImageContext({ imageUrl: "/api/gallery/file/a.png", imagePrompt: "  a cat in a hat  " }),
  "The post has an attached image showing: a cat in a hat",
);
// An uploaded image has no prompt, but the reader must still know a picture is there.
assert.equal(noodleImageContext({ imageUrl: "/api/gallery/file/a.png" }), "The post has an attached image.");
assert.equal(
  noodleImageContext({ imageUrl: "/api/gallery/file/a.png", imagePrompt: "   " }),
  "The post has an attached image.",
);
// No image means no line at all, so callers can spread the result away.
assert.equal(noodleImageContext({ imageUrl: null, imagePrompt: "unused" }), null);
assert.equal(noodleImageContext({}), null);

// Both reaction paths must carry it: this is why replies used to answer "what pic?".
for (const file of ["slurp-fan-activity.service.ts", "slurp-reply-generation.service.ts"]) {
  const source = readFileSync(`packages/slurp/src/engine/packages/server/src/services/slurp/${file}`, "utf8");
  assert.match(source, /noodleImageContext/u, `${file} must give the model the post's image context`);
}

// A locked post keeps its body out of the prompt but still shows its picture.
const fan = readFileSync(
  "packages/slurp/src/engine/packages/server/src/services/slurp/slurp-fan-activity.service.ts",
  "utf8",
);
assert.match(fan, /access === "locked"\s*\n?\s*\? \{ id, title, access, \.\.\.\(image && \{ image \}\) \}/u);
assert.doesNotMatch(fan, /access === "locked" \? \{ id, title, content/u, "locked bodies must never reach the prompt");

console.log("slurp-image-context regression passed");
