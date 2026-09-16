/** Slurp prompt presets: saved sets of generation guidance and image prompt. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  exportSlurpPromptPresets,
  importSlurpPromptPresets,
  mergeSlurpPromptPreset,
  sanitizeSlurpPromptPresets,
  SLURP_PROMPT_PRESET_LIMIT,
} from "../packages/slurp2/src/engine/packages/client/src/components/slurp/slurp-prompt-presets";
import { slurp2BackstageSource } from "./slurp2-backstage-source";

const spicy = { name: "Spicy", generationGuidance: "Be bold.", imageGenerationPrompt: "Warm light." };
const calm = { name: "Calm", generationGuidance: "Be gentle.", imageGenerationPrompt: "" };

// Invalid, empty and duplicate entries are dropped; names are unique regardless of case.
assert.deepEqual(
  sanitizeSlurpPromptPresets([spicy, { ...spicy, name: "spicy" }, { name: "", generationGuidance: "x" }, null, calm]),
  [spicy, calm],
);
assert.deepEqual(
  sanitizeSlurpPromptPresets([{ name: "Blank", generationGuidance: " ", imageGenerationPrompt: "" }]),
  [],
);

// Saving replaces a preset with the same name and puts it first.
const updated = mergeSlurpPromptPreset([spicy, calm], { ...calm, name: "calm", generationGuidance: "Softer." });
assert.deepEqual(
  updated.map((preset) => [preset.name, preset.generationGuidance]),
  [
    ["calm", "Softer."],
    ["Spicy", "Be bold."],
  ],
);

// Export and import round-trip; a clashing name gets a suffix; other files are rejected.
const file = JSON.parse(JSON.stringify(exportSlurpPromptPresets([spicy])));
assert.deepEqual(importSlurpPromptPresets([spicy], file), {
  presets: [spicy, { ...spicy, name: "Spicy (2)" }],
  imported: 1,
});
assert.equal(importSlurpPromptPresets([], { marinaraNoodlePrompts: 1, presets: [spicy] }).imported, 0);
const full = Array.from({ length: SLURP_PROMPT_PRESET_LIMIT }, (_, index) => ({ ...spicy, name: `P${index}` }));
assert.equal(importSlurpPromptPresets(full, file).imported, 0, "the preset limit holds on import");

// The server stores presets with the same limits, and a reset never deletes them.
const storage = readFileSync(
  "packages/slurp2/src/engine/packages/server/src/services/storage/slurp.storage.ts",
  "utf8",
);
assert.match(storage, /promptPresets: z\s*\.array\([\s\S]{0,300}?\.max\(20\)/u);
const defaults = readFileSync(
  "packages/slurp2/src/engine/packages/client/src/components/slurp/slurp-settings-defaults.ts",
  "utf8",
);
assert.match(defaults, /SLURP_SETTINGS_NOT_RESET[\s\S]*?"promptPresets"/u);

// Settings saves through the shared helpers and asks before replacing edited prompts.
const settingsView = slurp2BackstageSource();
assert.match(settingsView, /promptPresets: mergeSlurpPromptPreset\(settings\.promptPresets,/u);
assert.match(
  settingsView,
  /differs &&\s*!\(await showConfirmDialog\(\{\s*title: t\("ui\.slurp\.settings\.presets\.applyTitle"\)/u,
);
assert.match(settingsView, /importSlurpPromptPresets\(settings\.promptPresets, JSON\.parse\(await file\.text\(\)\)\)/u);

console.log("slurp2 prompt presets regression passed");
