import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const agents = JSON.parse(
  await readFile(new URL("../packages/storyboard/agents.json", import.meta.url), "utf8"),
);
const storyboard = agents.find((agent) => agent.id === "storyboard");
assert.ok(storyboard, "Storyboard agent definition must exist");

const settings = storyboard.defaultSettings;
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

const episode = findTemplate("roleplayEpisodeTemplates", "roleplay-minimax-h3-episode");
assert.match(episode.promptTemplate, /MiniMax H3 Roleplay Storyboard planner/u);
assert.match(episode.promptTemplate, /exact first frame at time T=0/u);
assert.match(episode.promptTemplate, /integrated_multimodal_description/u);
assert.match(episode.promptTemplate, /overall_soundscape/u);
assert.match(episode.promptTemplate, /non_diegetic_music/u);
assert.match(episode.promptTemplate, /\$\{durationSeconds\}/u);

const animation = findTemplate("roleplayAnimationTemplates", "roleplay-minimax-h3-cinematic");
assert.match(animation.promptTemplate, /Storyboard \(each shot a separate scene/u);
assert.match(animation.promptTemplate, /\[0s-Xs\] Shot 1/u);
assert.match(animation.promptTemplate, /Camera:/u);
assert.match(animation.promptTemplate, /Audio:/u);
assert.match(animation.promptTemplate, /one to four shots/u);
assert.match(animation.promptTemplate, /\$\{durationSeconds\}/u);

const refinement = findTemplate(
  "animationRefinementTemplates",
  "minimax-h3-image-aware-shot-planner",
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
