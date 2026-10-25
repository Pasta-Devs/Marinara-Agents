import assert from "node:assert/strict";
import { test } from "node:test";
import { forgeStoryMemoryText } from "../packages/gacha-forge/src/story-memory.mjs";
import {
  forgeMemoryContext,
  forgeComposeMemoryPrompt,
  fitForgeMemoryPrompt,
} from "../packages/gacha-forge/src/story-memory-fit.mjs";

const estimateMessages = (messages) => messages.reduce((sum, message) => sum + [...message.content].length + 4, 0);
const details = [
  { kind: "chapter", title: "High relevance", content: "HIGH_RELEVANCE: the lighthouse keeper survived." },
  { kind: "character-story", title: "Trust", content: "SECOND_RELEVANCE: Mira gave the keeper a key." },
  { kind: "chat", title: "Bread", content: "LOW_RELEVANCE: the keeper likes rye bread." },
];
const previousChapter =
  "# Previous chapter in full\nLAST_CHAPTER_FIRST_LINE\nThe complete canonical path.\nLAST_CHAPTER_LAST_LINE";
const makeContext = (options = {}) =>
  forgeMemoryContext(
    { overview: "Mari refused the sacrifice.", details, maxContext: 10000, ...options },
    {
      prefix: `${previousChapter}\n\nCURRENT_BEATS: The bridge opened.`,
      fate: "IRREVOCABLE: Mari chose to help Mira.",
      renderMemory: forgeStoryMemoryText,
    },
  );
const builder = (scenario, { history }) => {
  assert.equal(typeof history, "string", "legacy type checks see a string, never the descriptor");
  return [
    { role: "system", content: "FIXED_LORE: Do not invent an outcome." },
    { role: "user", content: `${scenario}\n${history}` },
  ];
};
const prompt = (context = makeContext()) => forgeComposeMemoryPrompt(builder, ["SCENARIO", { history: context }]);

test("a fitting memory request keeps every input byte, original reply cap and ordinary builder behavior", () => {
  const context = makeContext();
  const messages = prompt(context);
  const original = JSON.stringify(messages);
  const fit = fitForgeMemoryPrompt(messages, { maxContext: 10000, maxTokens: 300, estimateMessages });
  assert.equal(fit.fits, true);
  assert.equal(fit.droppedDetails, 0);
  assert.equal(fit.maxTokens, 300);
  assert.equal(fit.messages, messages);
  assert.equal(JSON.stringify(fit.messages), original);
  assert.ok(Object.getOwnPropertySymbols(messages[0]).length > 0);
  assert.equal(JSON.stringify(messages).includes("maxContext"), false, "symbol metadata never enters provider JSON");
  const ordinary = [{ role: "user", content: "ordinary" }];
  assert.equal(
    forgeComposeMemoryPrompt(() => ordinary, [{ untouched: true }]),
    ordinary,
  );
});

test("absent or non-positive reply caps remain unchanged with and without memory metadata", () => {
  const messages = prompt();
  const ordinary = [{ role: "user", content: "ordinary" }];
  for (const maxTokens of [undefined, null, 0, -1, Number.NaN]) {
    for (const input of [messages, ordinary]) {
      const result = fitForgeMemoryPrompt(input, { maxContext: 10000, maxTokens, estimateMessages });
      assert.equal(result.fits, true);
      assert.equal(result.maxTokens, maxTokens, "Remaining context must never become an invented reply cap");
      assert.equal(result.messages, input);
      assert.equal(result.droppedDetails, 0);
    }
  }
});

test("full-request fitting removes only the lowest-ranked complete optional detail block", () => {
  const context = makeContext();
  const messages = prompt(context);
  const expectedContext = makeContext({ details: details.slice(0, 2) });
  const expected = builder("SCENARIO", { history: expectedContext.text });
  const reserve = 300;
  const ceiling = estimateMessages(expected) + reserve + 512;
  const fit = fitForgeMemoryPrompt(messages, { maxContext: ceiling, maxTokens: reserve, estimateMessages });
  assert.equal(fit.fits, true);
  assert.equal(fit.droppedDetails, 1);
  assert.equal(fit.maxTokens, reserve);
  assert.equal(JSON.stringify(fit.messages), JSON.stringify(expected));
  const actual = fit.messages.map((message) => message.content).join("\n");
  assert.ok(actual.includes(previousChapter), "The entire previous chapter stays byte-for-byte intact");
  for (const text of [
    "Mari refused the sacrifice.",
    "CURRENT_BEATS",
    "IRREVOCABLE",
    "FIXED_LORE",
    "HIGH_RELEVANCE",
    "SECOND_RELEVANCE",
  ])
    assert.ok(actual.includes(text));
  assert.ok(!actual.includes("LOW_RELEVANCE"));
  assert.ok(estimateMessages(fit.messages) + fit.maxTokens + 512 <= ceiling);
  assert.ok(messages[1].content.includes("LOW_RELEVANCE"), "the original reusable messages are immutable");
});

test("metadata survives choice/language object spreads and retries count the entire new request", () => {
  const original = prompt();
  const wrapped = original.map((message, index) => ({
    ...message,
    content: message.content + (index === 0 ? "\nLANGUAGE RULE" : ""),
  }));
  const noDetails = prompt(makeContext({ details: [] }));
  noDetails[0].content += "\nLANGUAGE RULE";
  const retry = { role: "assistant", content: "A previous incomplete response." };
  const ceiling = estimateMessages([...noDetails, retry]) + 200 + 512;
  const first = fitForgeMemoryPrompt(wrapped, { maxContext: ceiling, maxTokens: 200, estimateMessages });
  const again = fitForgeMemoryPrompt([...first.messages, retry], {
    maxContext: ceiling,
    maxTokens: 200,
    estimateMessages,
  });
  assert.equal(again.fits, true);
  assert.equal(again.maxTokens, 200);
  assert.equal(JSON.stringify(again.messages), JSON.stringify([...noDetails, retry]));
  assert.ok(estimateMessages(again.messages) + again.maxTokens + 512 <= ceiling);
});

test("a user-authored duplicate is never rewritten to make a memory prompt fit", () => {
  const context = makeContext();
  const messages = forgeComposeMemoryPrompt(
    (history, userContent) => [{ role: "user", content: `${history}\nUSER_AUTHORED_COPY:\n${userContent}` }],
    [context, context.text],
  );
  const original = JSON.stringify(messages);
  const fit = fitForgeMemoryPrompt(messages, { maxContext: 1000, maxTokens: 500, estimateMessages });
  assert.equal(fit.fits, false);
  assert.equal(fit.reason, "memory-context-ambiguous");
  assert.equal(fit.messages, messages);
  assert.equal(JSON.stringify(fit.messages), original);
});

test("a builder-transformed context is not guessed or replaced", () => {
  const context = makeContext();
  const messages = forgeComposeMemoryPrompt((history) => [{ role: "user", content: history.toUpperCase() }], [context]);
  const original = JSON.stringify(messages);
  const fit = fitForgeMemoryPrompt(messages, { maxContext: 1000, maxTokens: 500, estimateMessages });
  assert.equal(fit.fits, false);
  assert.equal(fit.reason, "memory-context-ambiguous");
  assert.equal(JSON.stringify(messages), original);
});

test("a legacy output-floor overshoot is bounded after optional details, retaining all required canon", () => {
  const messages = prompt(makeContext({ maxContext: 1000 }));
  const fit = fitForgeMemoryPrompt(messages, { maxContext: 10000, maxTokens: 18000, estimateMessages });
  assert.equal(fit.fits, true);
  assert.equal(fit.droppedDetails, 3);
  assert.ok(fit.maxTokens > 0 && fit.maxTokens < 18000);
  assert.ok(
    estimateMessages(fit.messages) + fit.maxTokens + 512 <= 1000,
    "the descriptor's catalog/connection ceiling also applies",
  );
  const body = fit.messages.map((message) => message.content).join("\n");
  assert.ok(body.includes(previousChapter));
  assert.match(body, /Mari refused the sacrifice/u);
  assert.match(body, /CURRENT_BEATS/u);
  assert.match(body, /IRREVOCABLE/u);
  assert.match(body, /FIXED_LORE/u);
});

test("required-input overflow fails explicitly rather than deleting overview, live beats or user lore", () => {
  const messages = prompt(makeContext({ details: [], maxContext: 100 }));
  const original = JSON.stringify(messages);
  const fit = fitForgeMemoryPrompt(messages, { maxContext: 100, maxTokens: 300, estimateMessages });
  assert.equal(fit.fits, false);
  assert.equal(fit.reason, "context-too-large");
  assert.equal(fit.messages, messages);
  assert.equal(JSON.stringify(messages), original);
});

test("unknown context never invents a ceiling; ordinary jobs remain byte-for-byte untouched", () => {
  const messages = prompt(makeContext({ maxContext: null }));
  const fit = fitForgeMemoryPrompt(messages, { maxContext: 0, maxTokens: 300, estimateMessages });
  assert.equal(fit.fits, false);
  assert.equal(fit.reason, "context-unknown");
  const ordinary = [{ role: "user", content: "x".repeat(2000) }];
  const result = fitForgeMemoryPrompt(ordinary, { maxContext: 1, maxTokens: 300, estimateMessages });
  assert.deepEqual(result, { messages: ordinary, maxTokens: 300, fits: true, droppedDetails: 0 });
  assert.equal(result.messages, ordinary);
});

test("a known descriptor bound works when the saved connection override is unset", () => {
  const messages = prompt(makeContext({ maxContext: 2000 }));
  const result = fitForgeMemoryPrompt(messages, { maxContext: 0, maxTokens: 300, estimateMessages });
  assert.equal(result.fits, true);
  assert.ok(estimateMessages(result.messages) + result.maxTokens + 512 <= 2000);
});
