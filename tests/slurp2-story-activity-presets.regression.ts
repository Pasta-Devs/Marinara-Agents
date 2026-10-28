import assert from "node:assert/strict";
import {
  SLURP_STORY_ACTIVITY_PRESET_ORDER,
  SLURP_STORY_ACTIVITY_PRESETS,
  slurpStoryActivityPresetFor,
} from "../packages/slurp2/src/engine/packages/client/src/slp/modules/creator/slp-story-activity-presets.ts";

// Each preset's patch is detected as that preset, and presets are distinct.
for (const preset of SLURP_STORY_ACTIVITY_PRESET_ORDER) {
  assert.equal(slurpStoryActivityPresetFor(SLURP_STORY_ACTIVITY_PRESETS[preset]), preset);
}
assert.equal(
  new Set(SLURP_STORY_ACTIVITY_PRESET_ORDER.map((p) => JSON.stringify(SLURP_STORY_ACTIVITY_PRESETS[p]))).size,
  3,
);
// A mix that matches no preset is Custom, not rounded to the nearest one.
assert.equal(slurpStoryActivityPresetFor({ ...SLURP_STORY_ACTIVITY_PRESETS.lively, sharedWorldEvents: true }), null);
// A fresh install (events suggest, storylines off, shared ideas off) reads as Calm.
assert.equal(
  slurpStoryActivityPresetFor({
    storyAutomation: "suggest",
    arcAutoMode: "off",
    sharedPreseed: false,
    sharedWorldEvents: false,
  }),
  "calm",
);

console.log("slurp2 story activity presets regression checks passed");
