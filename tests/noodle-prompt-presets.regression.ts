import assert from "node:assert/strict";
import {
  mergeNoodlePromptPreset,
  parseNoodlePromptPresetImport,
  sanitizeNoodlePromptPresets,
} from "../packages/noodle/src/engine/packages/client/src/components/noodle/noodle-prompt-presets";

const valid = { name: "Compact", key: "noodle.timelineBase", template: "Write concise posts." };

assert.deepEqual(sanitizeNoodlePromptPresets([valid, valid, { ...valid, name: "Other", template: "Second." }]), [
  valid,
  { name: "Other", key: "noodle.timelineBase", template: "Second." },
]);
assert.equal(sanitizeNoodlePromptPresets([{ ...valid, key: "other" }]).length, 0);
assert.equal(sanitizeNoodlePromptPresets([{ ...valid, name: "", template: "" }]).length, 0);

const replaced = mergeNoodlePromptPreset([valid], { name: "compact", template: "Updated." });
assert.deepEqual(replaced, [{ name: "compact", key: "noodle.timelineBase", template: "Updated." }]);
assert.deepEqual(parseNoodlePromptPresetImport({ marinaraNoodlePrompts: 1, presets: [valid] }), [valid]);
assert.deepEqual(parseNoodlePromptPresetImport({ marinaraNoodlePrompts: 2, presets: [valid] }), []);

const bounded = sanitizeNoodlePromptPresets(
  Array.from({ length: 25 }, (_, index) => ({
    name: `Preset ${index}`,
    key: "noodle.timelineBase",
    template: "x".repeat(25_000),
  })),
);
assert.equal(bounded.length, 20);
assert.equal(bounded[0]?.template.length, 20_000);

const fullShelf = Array.from({ length: 20 }, (_, index) => ({
  name: `Preset ${index}`,
  key: "noodle.timelineBase" as const,
  template: `Prompt ${index}`,
}));
const replacedOldest = mergeNoodlePromptPreset(fullShelf, { name: "Newest", template: "New prompt" });
assert.equal(replacedOldest.length, 20);
assert.equal(replacedOldest[0]?.name, "Newest");
assert.equal(
  replacedOldest.some((preset) => preset.name === "Preset 19"),
  false,
);

console.log("noodle prompt preset regression: ok");
