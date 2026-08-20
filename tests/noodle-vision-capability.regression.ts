import assert from "node:assert/strict";
import {
  canRetryNoodleVisionRequest,
  readNoodleVisionSupport,
  resolveNoodleVisionSupport,
  selectNoodleVisionRequest,
} from "../packages/noodle/src/engine/packages/server/src/services/noodle/noodle-model-capabilities";

const catalog = {
  data: [
    { id: "vision-model", capabilities: { vision: true } },
    { id: "text-model", capabilities: { vision: false } },
    { id: "unknown-model" },
  ],
};

assert.equal(readNoodleVisionSupport(catalog, "vision-model"), true);
assert.equal(readNoodleVisionSupport(catalog, "text-model"), false);
assert.equal(readNoodleVisionSupport(catalog, "unknown-model"), null);
assert.equal(readNoodleVisionSupport(catalog, "missing-model"), null);

const prompt = {
  messages: ["vision"],
  textOnlyMessages: ["text"],
  promptForLog: "vision prompt",
  textOnlyPromptForLog: "text prompt",
};
assert.deepEqual(selectNoodleVisionRequest(prompt, false), {
  messages: prompt.textOnlyMessages,
  promptForLog: prompt.textOnlyPromptForLog,
  attemptKind: "text_only_fallback",
});
for (const support of [true, null]) {
  assert.deepEqual(selectNoodleVisionRequest(prompt, support), {
    messages: prompt.messages,
    promptForLog: prompt.promptForLog,
    attemptKind: "initial",
  });
}
assert.equal(canRetryNoodleVisionRequest("initial", 1), true);
assert.equal(canRetryNoodleVisionRequest("initial", 0), false);
assert.equal(canRetryNoodleVisionRequest("text_only_fallback", 1), false);

async function main() {
  const requests: Array<{ url: string; authorization: string | null }> = [];
  const request = async (url: string | URL, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    requests.push({ url: String(url), authorization: headers.get("authorization") });
    return new Response(JSON.stringify(catalog), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  assert.equal(
    await resolveNoodleVisionSupport(
      {
        provider: "nanogpt",
        baseUrl: "https://nano-gpt.com/api/v1/",
        apiKey: "test-key",
        model: "text-model",
      },
      request,
    ),
    false,
  );
  assert.deepEqual(requests, [
    {
      url: "https://nano-gpt.com/api/v1/models?detailed=true",
      authorization: "Bearer test-key",
    },
  ]);

  assert.equal(
    await resolveNoodleVisionSupport(
      {
        provider: "openrouter",
        baseUrl: "https://openrouter.ai/api/v1",
        apiKey: "test-key",
        model: "text-model",
      },
      request,
    ),
    null,
  );
  assert.equal(requests.length, 1);

  assert.equal(
    await resolveNoodleVisionSupport(
      {
        provider: "nanogpt",
        baseUrl: "http://nano-gpt.example/api/v1",
        apiKey: "test-key",
        model: "text-model",
      },
      request,
    ),
    null,
  );
  assert.equal(requests.length, 1);

  console.log("Noodle vision capability regressions passed.");
}

void main();
