import assert from "node:assert/strict";
import {
  noodleModelRejectsVisionInput,
  noodleVisionModelKey,
  rememberNoodleVisionRejection,
} from "../packages/noodle/src/engine/packages/server/src/services/noodle/noodle-vision-support";

assert.equal(noodleVisionModelKey("nanogpt", "zai-org/glm-5.2"), '["nanogpt","zai-org/glm-5.2"]');
assert.notEqual(
  noodleVisionModelKey("nanogpt:team", "glm-5.2"),
  noodleVisionModelKey("nanogpt", "team:glm-5.2"),
  "provider and model separators must not create key collisions",
);
assert.equal(noodleModelRejectsVisionInput("nanogpt", "zai-org/glm-5.2"), false);

rememberNoodleVisionRejection("nanogpt", "zai-org/glm-5.2");
assert.equal(
  noodleModelRejectsVisionInput("nanogpt", "zai-org/glm-5.2"),
  true,
  "a model that rejected image input once must start text-only on the next refresh",
);
assert.equal(
  noodleModelRejectsVisionInput("nanogpt", "openai/gpt-5"),
  false,
  "one model's refusal must not disable image input for every other model",
);
assert.equal(
  noodleModelRejectsVisionInput("openrouter", "zai-org/glm-5.2"),
  false,
  "the same model name on another provider must keep its own capability",
);

console.log("Noodle vision support regressions passed.");
