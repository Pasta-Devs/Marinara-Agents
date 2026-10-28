import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  applyGlmThinkingParameters,
  glm53ReasoningEffort,
  isGlm53MandatoryReasoningModel,
} from "../sources/engine/packages/server/src/services/llm/providers/glm-request-compat.js";

for (const model of ["z-ai/glm-5.3-flash", "z-ai/glm-5.3", "z-ai/glm-5.3:thinking"]) {
  assert.equal(isGlm53MandatoryReasoningModel(model), true);
  for (const providerKind of ["nanogpt", "custom"]) {
    const body: Record<string, unknown> = {};
    assert.equal(
      applyGlmThinkingParameters(body, {
        model,
        providerKind,
        baseUrl: providerKind === "nanogpt" ? "https://nano-gpt.com/api/v1" : "https://api.z.ai/api/paas/v4",
        reasoningEffort: "none",
        enableThinking: false,
      }),
      true,
    );
    assert.deepEqual(
      body,
      providerKind === "nanogpt"
        ? { enable_thinking: true, reasoning_effort: "low" }
        : { thinking: { type: "enabled" }, reasoning_effort: "low" },
    );
    const defaultBody: Record<string, unknown> = {};
    applyGlmThinkingParameters(defaultBody, {
      model,
      providerKind,
      baseUrl: providerKind === "nanogpt" ? "https://nano-gpt.com/api/v1" : "https://api.z.ai/api/paas/v4",
      enableThinking: false,
    });
    assert.deepEqual(
      defaultBody,
      providerKind === "nanogpt" ? { enable_thinking: true } : { thinking: { type: "enabled" } },
    );
  }
}
assert.deepEqual(["none", "minimal", "low", "medium", "high", "xhigh", "max"].map(glm53ReasoningEffort), [
  "low",
  "low",
  "low",
  "high",
  "high",
  "max",
  "max",
]);
assert.equal(glm53ReasoningEffort(undefined), null);
for (const model of ["glm-5.2", "glm-5.30", "qwen3"]) {
  assert.equal(isGlm53MandatoryReasoningModel(model), false);
  const body: Record<string, unknown> = {};
  const handled = applyGlmThinkingParameters(body, {
    model,
    providerKind: "nanogpt",
    baseUrl: "https://nano-gpt.com/api/v1",
    reasoningEffort: "none",
    enableThinking: false,
  });
  assert.equal(handled, model !== "qwen3");
  assert.deepEqual(body, model !== "qwen3" ? { enable_thinking: false } : {});
}

// Both transport methods use the corrected shared normalizer, including JSON
// timeline requests. Keep this wiring proof beside the actual body assertions.
const provider = readFileSync(
  new URL("../sources/engine/packages/server/src/services/llm/providers/openai.provider.ts", import.meta.url),
  "utf8",
);
for (const [start, end] of [
  ["async *chat(", "async chatComplete("],
  ["async chatComplete(", "async countTokens("],
]) {
  const startIndex = provider.indexOf(start);
  assert.notEqual(startIndex, -1);
  const endIndex = provider.indexOf(end, startIndex + start.length);
  const method = provider.slice(startIndex, endIndex === -1 ? undefined : endIndex);
  assert.match(method, /this\.applyChatCompletionsReasoning\(body, options\)/u);
}
assert.match(provider, /applyGlmThinkingParameters\(body, \{/u);
console.log("Noodle captured GLM5.3 request compatibility regression passed.");
