import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const agents = JSON.parse(await readFile(new URL("../packages/storyboard/agents.json", import.meta.url), "utf8"));
const storyboard = agents.find((agent) => agent.id === "storyboard");
assert.ok(storyboard, "Storyboard agent definition must exist");

const settings = storyboard.defaultSettings;
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const findTemplate = (collection, id) => {
  const templates = settings[collection];
  assert.ok(Array.isArray(templates), `${collection} must be a template collection`);
  assert.equal(
    templates.filter((template) => template.id === id).length,
    1,
    `${id} must appear exactly once in ${collection}`,
  );
  return templates.find((template) => template.id === id);
};

assert.deepEqual(
  settings.roleplayEpisodeTemplates.map((template) => template.id),
  ["roleplay-completed-episode"],
  "MiniMax H3 must use the proven provider-neutral Roleplay episode contract",
);

const animation = findTemplate("roleplayAnimationTemplates", "roleplay-minimax-h3-cinematic");
assert.equal(
  sha256(animation.promptTemplate),
  "535690b73e8a252ccb7563a23bb9a7d884f8e3c0e979ea5c90ae075f402568e5",
  "MiniMax H3 cinematic addon must match the proven 7:53 PM prompt",
);
assert.match(animation.promptTemplate, /Storyboard \(each shot a separate scene/u);
assert.match(animation.promptTemplate, /\[0s-Xs\] Shot 1/u);
assert.match(animation.promptTemplate, /Camera:/u);
assert.match(animation.promptTemplate, /Audio:/u);
assert.match(animation.promptTemplate, /one to four shots/u);
assert.match(animation.promptTemplate, /\$\{durationSeconds\}/u);

const refinement = findTemplate("animationRefinementTemplates", "minimax-h3-image-aware-shot-planner");
assert.equal(
  sha256(refinement.promptTemplate),
  "31a7fd80fe3c95531371a6a052cdb1c321c0735d5ec76902ab21eb469f3310ee",
  "MiniMax H3 image-aware planner must match the proven 7:53 PM prompt",
);
for (const variable of [
  "title",
  "durationSeconds",
  "aspectRatio",
  "characters",
  "sourceSections",
  "motionIntent",
  "imagePrompt",
]) {
  assert.match(refinement.promptTemplate, new RegExp(`\\$\\{${variable}\\}`, "u"));
}
assert.match(refinement.promptTemplate, /suitable\|simplify\|subtle\|regenerate/u);
assert.match(refinement.promptTemplate, /attached illustration overrides the original plan/u);
assert.match(refinement.promptTemplate, /Do not introduce a new character who is absent/u);

assert.equal(
  settings.roleplayEpisodeTemplateId,
  "roleplay-completed-episode",
  "MiniMax H3 must not replace the provider-neutral Roleplay default",
);
assert.equal(
  settings.roleplayAnimationTemplateId,
  "roleplay-simple-motion",
  "MiniMax H3 must not replace the provider-neutral animation default",
);
assert.equal(
  settings.animationRefinementTemplateId,
  "image-aware-shot-planner",
  "MiniMax H3 must not replace the provider-neutral refinement default",
);

console.log("MiniMax H3 Storyboard prompt chain regression: ok");
