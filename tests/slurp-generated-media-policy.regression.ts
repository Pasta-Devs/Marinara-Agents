import assert from "node:assert/strict";
import { generatedMediaSettings } from "../packages/slurp/src/engine/packages/server/src/services/slurp/slurp-generated-media-policy";

const settings = {
  enableImagePrompts: true,
  allowGalleryImageAttachments: true,
  maxImagesPerRefresh: 3,
};

assert.equal(generatedMediaSettings(settings, 0), settings, "clean output must preserve the original settings");
assert.deepEqual(generatedMediaSettings(settings, 1), {
  ...settings,
  enableImagePrompts: false,
  allowGalleryImageAttachments: false,
});

console.log("Slurp generated media policy regressions passed.");
