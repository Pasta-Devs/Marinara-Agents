import assert from "node:assert/strict";
import { buildSlurpDeepDetailsRecord } from "../packages/slurp2/src/engine/packages/server/src/slp/features/feed/slp-deep-details-record";
import { slurpCreatorStrategy } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/creators/slp-creator-strategy";
import { slurpPostVariation } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/feed/slp-post-variation";
import {
  newSlurpImageRun,
  recordSlurpImageRun,
  trackSlurpImageAttempt,
} from "../packages/slurp2/src/engine/packages/server/src/slp/features/media/slp-image-run";
import { buildSlpDeepDetailsFlow } from "../packages/slurp2/src/engine/packages/client/src/slp/modules/post/slp-deep-details-flow";
import { slurp2Source } from "./slurp2-source";

const variation = slurpPostVariation("deep-creator", 3);
const record = buildSlurpDeepDetailsRecord({
  input: {
    generatedAt: new Date("2026-09-21T10:00:00Z"),
    request: { access: "locked", noodlerPostGuide: "  a quiet morning  " },
    connection: { id: "txt-0", name: "Main", provider: "openai", model: "gpt-test" },
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
assert.deepEqual(record.model, {
  provider: "openai",
  model: "gpt-test",
  connectionId: "txt-0",
  connectionName: "Main",
  temperature: 0.9,
  topP: 0.95,
  maxTokens: 900,
});
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
  /slurpDeepDetailsImageRunRecorder\(input\.db, input\.deepDetailsId, "generation"\)/u,
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

async function imageRunRegression() {
  // An image run keeps every provider attempt in order, and never a credential.
  const connection = {
    id: "img-1",
    name: "Krea",
    provider: "image_generation",
    model: "krea-2",
    apiKey: "sk-secret",
    baseUrl: "https://user:pass@example.test",
  };
  const settings = {
    imageGenerationIncludeDescriptions: true,
    imageGenerationUseAvatarReferences: false,
    enableImageInterpretation: true,
  };
  const saved: unknown[] = [];
  const recorder = { trigger: "retry" as const, record: async (run: unknown) => void saved.push(run) };
  const run = newSlurpImageRun({ imageConnection: connection, settings, onImageRun: recorder });
  let calls = 0;
  const result = await recordSlurpImageRun(run, recorder, async () => {
    for (let attempt = 1; ; attempt += 1) {
      try {
        await trackSlurpImageAttempt(run, attempt, "host", async () => {
          calls += 1;
          if (calls === 1) throw new Error("401 Invalid session");
          return "ok";
        });
        return { preview: null, stagedMedia: { filePath: "/media/p.png" } };
      } catch {
        if (attempt >= 2) throw new Error("gave up");
      }
    }
  });
  assert.equal(result.stagedMedia.filePath, "/media/p.png");
  assert.equal(saved.length, 1, "a finished run is recorded once");
  assert.equal(run.trigger, "retry");
  assert.deepEqual(
    run.attempts.map((attempt) => [attempt.attempt, attempt.ok, attempt.error]),
    [
      [1, false, "401 Invalid session"],
      [2, true, null],
    ],
  );
  assert.deepEqual(run.result, { status: "saved", mediaPath: "/media/p.png", error: null });
  assert.doesNotMatch(JSON.stringify(run), /sk-secret|user:pass|example\.test/u, "no credential reaches the record");

  // The flowchart draws the post and the chosen image run as one ordered graph.
  run.styleProfile = { ...run.styleProfile, id: "digital", name: "Digital Painting", chosenBy: "creator" };
  run.rewrite = {
    status: "rejected",
    input: "draft",
    output: "leaky",
    reason: "copied a private block",
    model: { connectionId: "txt-1", connectionName: "GLM", model: "glm-5" },
  };
  run.attempts[1]!.servedBy = { id: "img-2", name: "Z-Image", model: "z-image-turbo" };
  run.finalPrompt = "a woman at a window, digital painting, concept art";
  const response = {
    post: {
      id: "p1",
      title: "t",
      content: "c",
      access: "locked",
      source: "noodler",
      createdAt: "2026-09-24T00:00:00Z",
      updatedAt: "2026-09-24T00:00:00Z",
      imageUrl: null,
      imagePrompt: null,
      images: [],
      metadata: {},
    },
    creator: { id: "a", displayName: "A", handle: "a" },
    details: { ...record, imageRuns: [run] },
    plan: null,
    links: [],
    stats: { likes: 0, replies: 0, unlocks: 0 },
  };
  const graph = buildSlpDeepDetailsFlow(response, run)!;
  assert.deepEqual(
    graph.nodes.filter((node) => node.kind === "step" || node.kind === "model").map((node) => node.id),
    [
      "plan",
      "angle",
      "writing-prompt",
      "write",
      "brief",
      "template",
      "style",
      "rewrite",
      "final",
      "provider",
      "result",
    ],
  );
  const node = (id: string) => graph.nodes.find((entry) => entry.id === id)!;
  assert.equal(node("write").model, "gpt-test · Main");
  assert.equal(node("rewrite").model, "glm-5 · GLM");
  assert.equal(node("rewrite").status, "rejected");
  assert.equal(node("provider").status, "retried", "a fallback or a failed first attempt is a retry");
  assert.ok(
    node("provider").outputs.some((row) => row.label === "Served by fallback" && row.value?.includes("Z-Image")),
  );
  const finalPrompt = node("final").outputs.find((row) => row.label === "Final prompt");
  assert.equal(finalPrompt?.text, run.finalPrompt, "the exact final prompt opens from the node");
  assert.ok(
    node("write")
      .inputs.find((row) => row.label === "Chat")
      ?.text?.includes("system text"),
  );
  assert.ok(graph.edges.some((edge) => edge.from === "style-profile" && edge.to === "style"));
  assert.ok(graph.edges.some((edge) => edge.from === "final" && edge.to === "provider"));
  // The map: every input a step reads names where it came from, and each source links to its users.
  for (const entry of graph.nodes.filter((item) => item.kind === "step" || item.kind === "model")) {
    for (const input of entry.inputs.filter((item) => item.value || item.text)) {
      assert.ok(input.from, `${entry.id} input "${input.label}" has no origin`);
    }
  }
  assert.match(node("style-profile").outputs.find((row) => row.label === "Profile")?.from ?? "", /Creator profile/u);
  assert.ok(graph.edges.some((edge) => edge.from === "source-creator" && edge.to === "strategy"));
  assert.ok(graph.edges.some((edge) => edge.from === "source-prompts" && edge.to === "template"));
  assert.equal(buildSlpDeepDetailsFlow({ ...response, details: null }, null), null);

  // Without a recorded run the picture half still explains itself.
  const reused = buildSlpDeepDetailsFlow(
    { ...response, details: { ...record, plan: { ...record.plan, reusedFromPostId: "old-post" } } },
    null,
  )!;
  assert.ok(
    reused.nodes.some((entry) => entry.id === "reuse"),
    "a reused picture shows where it came from",
  );
  const legacy = buildSlpDeepDetailsFlow(
    { ...response, details: { ...record, providerPrompt: "an older exact prompt, long enough" } },
    null,
  )!;
  const legacyFinal = legacy.nodes.find((entry) => entry.id === "final")!;
  assert.equal(
    legacyFinal.outputs.find((entry) => entry.label === "Final prompt")?.text,
    "an older exact prompt, long enough",
  );

  // A failed run is still recorded, with its error.
  const failed = newSlurpImageRun({ imageConnection: connection, settings });
  await assert.rejects(
    recordSlurpImageRun(failed, recorder, async () => {
      throw new Error("timeout");
    }),
  );
  assert.equal(saved.length, 2);
  assert.deepEqual(failed.result, { status: "failed", mediaPath: null, error: "timeout" });

  // Every path that owns a Deep details record hands it the run.
  for (const [path, trigger] of [
    ["packages/slurp2/src/engine/packages/server/src/slp/features/feed/slp-generation-service.ts", '"review"'],
    ["packages/slurp2/src/engine/packages/server/src/slp/features/feed/reserve/slp-reserve-operation.ts", '"reserve"'],
    [
      "packages/slurp2/src/engine/packages/server/src/slp/features/media/slp-reviewed-images-service.ts",
      '"retry" : "reviewed"',
    ],
  ] as const) {
    assert.ok(slurp2Source(path).includes(trigger), `${path} records its image run`);
  }
  assert.match(detailsStorage, /\.slice\(-SLP_DEEP_DETAILS_IMAGE_RUN_LIMIT\)/u, "old runs are dropped past the cap");
}

void imageRunRegression().then(
  () => console.log("slurp deep details regression passed"),
  (error: unknown) => {
    console.error(error);
    process.exit(1);
  },
);
