import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { runInNewContext } from "node:vm";
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

async function verifyApplyConfirmation() {
  const source = readFileSync(
    new URL("../packages/noodle/src/engine/packages/client/src/components/noodle/NoodleHome.tsx", import.meta.url),
    "utf8",
  );
  const applySource = source.slice(
    source.indexOf("const applyPromptPreset ="),
    source.indexOf("const deletePromptPreset ="),
  );
  let confirmed = false;
  let confirmations = 0;
  let saves = 0;
  let draft = "My edited active prompt, not saved as a template.";
  const context = {
    noodlePromptDraft: draft,
    noodlePromptDirty: false,
    showConfirmDialog: async () => {
      confirmations++;
      return confirmed;
    },
    localizeUi: (key: string) => key,
    NOODLE_TIMELINE_BASE_PROMPT_KEY: "noodle.timelineBase",
    saveNoodlePrompt: {
      mutateAsync: async () => {
        saves++;
      },
    },
    setNoodlePromptDraft: (value: string) => {
      draft = value;
    },
    setPromptPresetDialogOpen: () => undefined,
    toast: { success: () => undefined, error: () => assert.fail("Preset application failed") },
  };
  const apply = runInNewContext(stripTypeScriptTypes(`${applySource}\napplyPromptPreset;`), context);
  await apply(valid);
  assert.equal(confirmations, 1, "a different saved preset must warn even after the active prompt was saved");
  assert.equal(saves, 0, "Cancel must not persist the selected preset");
  assert.equal(draft, context.noodlePromptDraft, "Cancel must preserve the current prompt");
  confirmed = true;
  await apply(valid);
  assert.equal(saves, 1);
  assert.equal(draft, valid.template);
  context.noodlePromptDraft = valid.template;
  await apply(valid);
  assert.equal(confirmations, 2, "an identical preset does not replace any text");
}

void verifyApplyConfirmation();
