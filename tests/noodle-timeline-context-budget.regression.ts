import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { runInNewContext } from "node:vm";
import {
  NOODLE_TIMELINE_MIN_OUTPUT_TOKENS,
  noodleTimelineMaxTokensForPrompt,
  noodleTimelineRefreshMaxTokens,
} from "../packages/noodle/src/engine/packages/server/src/services/noodle/noodle-post-target.js";

type Message = { role: "system" | "user"; content: string };
type Fit = {
  messages: Message[];
  maxContext?: number;
  maxTokens?: number;
  reservedTokens?: number;
  estimatedTokensBefore: number;
  trimmed: boolean;
};
type FitMessagesToContext = (messages: Message[], options: { maxContext?: number; maxTokens?: number }) => Fit;

// Run the exact fitter that Noodle bundles. The vendored file imports undici, so it is
// evaluated from source instead of imported.
const baseProvider = readFileSync(
  new URL("../sources/engine/packages/server/src/services/llm/base-provider.ts", import.meta.url),
  "utf8",
);
const start = baseProvider.indexOf("const CHARS_PER_TOKEN");
const end = baseProvider.indexOf("export function sanitizeApiError");
assert.ok(start > 0 && end > start, "the vendored context fitter moved; update this regression");
const fitterScope: { fitMessagesToContext?: FitMessagesToContext } = {};
runInNewContext(stripTypeScriptTypes(baseProvider.slice(start, end)).replace(/^export /gm, ""), fitterScope);
const fit = fitterScope.fitMessagesToContext!;

// The shape buildRefreshPrompt sends: rules, the context body, then the JSON format.
const timelineMessages = (contextChars: number): Message[] => [
  { role: "system", content: "s".repeat(4_489) },
  { role: "user", content: "c".repeat(contextChars) },
  { role: "user", content: "f".repeat(1_417) },
];

// The reported failure: a 16k local context with four accounts. The bundled fitter drops the
// whole context body and keeps the full answer budget, so the model never sees the cast.
const requested = noodleTimelineRefreshMaxTokens(4);
const messages = timelineMessages(40_000);
const unguarded = fit(messages, { maxContext: 16_384, maxTokens: requested });
assert.deepEqual(
  unguarded.messages.map((message) => message.content[0]),
  ["s", "f"],
  "precondition: the bundled fitter still deletes a single-shot prompt body; if this changed, revisit the guard",
);
assert.equal(unguarded.maxTokens, requested);

const guarded = noodleTimelineMaxTokensForPrompt(unguarded, requested);
assert.ok(guarded !== null && guarded < requested, "the guard lowers the answer budget instead");
const kept = fit(messages, { maxContext: 16_384, maxTokens: guarded });
assert.equal(kept.trimmed, false);
assert.deepEqual(kept.messages, messages, "the whole prompt reaches the model");
assert.equal(kept.maxTokens, guarded);
assert.ok(
  Math.ceil(kept.estimatedTokensBefore * 1.15) + guarded <= 16_384 - kept.reservedTokens!,
  "15% of the prompt estimate stays free, since the backend can count more tokens than characters / 4",
);

// A prompt that leaves less than the minimum answer fails visibly instead of being cut.
assert.equal(
  noodleTimelineMaxTokensForPrompt(
    fit(timelineMessages(60_000), { maxContext: 16_384, maxTokens: requested }),
    requested,
  ),
  null,
);

// Nothing changes when the prompt already fits, or when the connection has no context limit.
assert.equal(
  noodleTimelineMaxTokensForPrompt(fit(messages, { maxContext: 128_000, maxTokens: requested }), requested),
  requested,
);
assert.equal(noodleTimelineMaxTokensForPrompt(fit(messages, { maxTokens: requested }), requested), requested);

// A smaller answer budget saved on the connection is respected, and is its own minimum.
assert.equal(noodleTimelineMaxTokensForPrompt(fit(messages, { maxContext: 128_000, maxTokens: 600 }), 600), 600);

// Across context sizes, prompt sizes and account counts, a returned budget always keeps the prompt whole.
for (const maxContext of [8_192, 16_384, 32_768, 49_152, 128_000]) {
  for (const accounts of [1, 3, 6]) {
    const budget = noodleTimelineRefreshMaxTokens(accounts);
    for (let contextChars = 0; contextChars <= 200_000; contextChars += 997) {
      const prompt = timelineMessages(contextChars);
      const result = noodleTimelineMaxTokensForPrompt(fit(prompt, { maxContext, maxTokens: budget }), budget);
      if (result === null) continue;
      const label = `maxContext ${maxContext}, ${accounts} accounts, ${contextChars} context chars`;
      assert.ok(result <= budget && result >= Math.min(budget, NOODLE_TIMELINE_MIN_OUTPUT_TOKENS), label);
      const refit = fit(prompt, { maxContext, maxTokens: result });
      assert.equal(refit.trimmed, false, label);
      assert.equal(refit.messages.length, prompt.length, label);
      assert.equal(refit.maxTokens, result, label);
    }
  }
}

// Every timeline call (first try, text-only retry and correction) goes through the wrapper, and only
// the primary connection is wrapped, so a configured fallback still gets the original request.
const service = readFileSync(
  new URL(
    "../packages/noodle/src/engine/packages/server/src/services/noodle/noodle-public-generation.service.ts",
    import.meta.url,
  ),
  "utf8",
);
assert.deepEqual(service.match(/[\w.]*provider\.chatComplete\([^)]*\)/gi), [
  "this.provider.chatComplete(messages, sized)",
  "timelineProvider.chatComplete(requestMessages, completionOptions)",
  "timelineProvider.chatComplete(prompt.textOnlyMessages, completionOptions)",
  "timelineProvider.chatComplete(correctionMessages, completionOptions)",
]);
assert.match(service, /const timelinePrimary = new NoodleTimelineBudgetProvider\(primaryProvider\);/);
assert.match(service, /withConnectionFallbackProvider\(\{ primary: timelinePrimary, \.\.\.fallbackArgs \}\)/);

console.log("noodle timeline context budget regression passed");
