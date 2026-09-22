import assert from "node:assert/strict";
import { buildSlurpDeepDetailsRecord } from "../packages/slurp2/src/engine/packages/server/src/slp/features/feed/slp-deep-details-record";
import { slurpCreatorStrategy } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/creators/slp-creator-strategy";
import { slurpPostVariation } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/feed/slp-post-variation";
import { slurp2Source } from "./slurp2-source";

const variation = slurpPostVariation("deep-creator", 3);
const record = buildSlurpDeepDetailsRecord({
  input: {
    generatedAt: new Date("2026-09-21T10:00:00Z"),
    request: { access: "locked", noodlerPostGuide: "  a quiet morning  " },
    connection: { provider: "openai", model: "gpt-test" },
  },
  sequence: 3,
  completionOptions: { temperature: 0.9, topP: 0.95, maxTokens: 900 },
  attempts: 2,
  opportunity: { id: "opp-1" },
  axes: { intent: "set", delivery: "multi_image_set" },
  isTeaser: false,
  storyVariation: false,
  format: "caption",
  variation,
  campaignId: "camp-1",
  shootId: "shoot-1",
  reusedSource: null,
  demandTopic: "red dress",
  project: { id: "proj-1", title: "Road trip" },
  projectChapter: "Day two",
  camera: "mirror",
  effort: "high",
  strategy: slurpCreatorStrategy("deep-creator", undefined),
  sentMessages: [
    { role: "system", content: "system text" },
    { role: "user", content: "user text" },
  ],
  content: '{"title":"t","content":"c"}',
  generated: { title: "t", content: "c", imagePrompt: null },
  draftImagePrompt: "brief",
  askModelForImagePrompt: false,
});

// Every input the generator used is kept, as it was.
assert.equal(record.direction, "a quiet morning");
assert.deepEqual(record.model, { provider: "openai", model: "gpt-test", temperature: 0.9, topP: 0.95, maxTokens: 900 });
assert.equal(record.attempts, 2);
assert.equal(record.plan.intent, "set");
assert.equal(record.plan.delivery, "multi_image_set");
assert.equal(record.plan.rotatedFormat, variation.format);
assert.deepEqual(record.plan.project, { id: "proj-1", title: "Road trip", chapter: "Day two" });
assert.equal(record.angle?.place, variation.place);
assert.equal(record.messages.length, 2);
assert.equal(record.rawResponse, '{"title":"t","content":"c"}');
assert.equal(record.imageBrief, "brief");
assert.equal(record.providerPrompt, undefined, "the provider prompt is added only after image prompt rewriting");

// The post carries only an id; the record is served by a managed route and deleted with its post.
const generation = slurp2Source(
  "packages/slurp2/src/engine/packages/server/src/slp/features/feed/slp-generation-service.ts",
);
assert.match(generation, /\.\.\.\(deepDetailsId \? \{ deepDetailsId \} : \{\}\)/u);
assert.match(generation, /input\.previewOnly \? null : newId\(\)/u);
assert.match(
  generation,
  /recordSlurpProviderPrompt/u,
  "successful generation records the exact provider prompt privately",
);
const detailsStorage = slurp2Source(
  "packages/slurp2/src/engine/packages/server/src/slp/data/feed/slp-post-deep-details-storage.ts",
);
assert.match(detailsStorage, /providerPrompt/u);
const postStorage = slurp2Source(
  "packages/slurp2/src/engine/packages/server/src/slp/data/feed/slp-feed-post-storage-2.ts",
);
assert.match(postStorage, /deleteSlurpPostDeepDetails\(tx, existing\.metadata\.deepDetailsId\)/u);
const menu = slurp2Source("packages/slurp2/src/engine/packages/client/src/slp/modules/post/SlpCreatorPostMenu.tsx");
assert.match(menu, /ctx\.postManagement && \(\n\s*<SlpDeepDetailsModal/u);

console.log("slurp deep details regression passed");
