import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { runInNewContext } from "node:vm";
import { protectNoodlerGeneratedIdentity as protect } from "../packages/slurp2/src/engine/packages/server/src/services/slurp/slurp-identity-protection";
import { normalizeNoodleImagePrompt } from "../packages/slurp2/src/engine/packages/server/src/services/slurp/slurp-image-prompt";

const root = "../packages/slurp2/src/engine/packages/server/src/services/slurp/";
const read = (file: string) => readFileSync(new URL(`${root}${file}`, import.meta.url), "utf8");
const part = (source: string, start: string, end: string) => {
  assert.ok(source.includes(start) && source.includes(end));
  return source.slice(source.indexOf(start), source.indexOf(end));
};
const compile = (source: string, context: Record<string, unknown>) =>
  runInNewContext(
    stripTypeScriptTypes(source.replace(/^import[\s\S]*?;\n/gm, "").replace(/^\s*export /gm, "")),
    context,
  );

async function main() {
  const seenImages: string[][] = [];
  let captionCalls = 0;
  const prepare = compile(`${read("slurp-post-image-context.ts")}\nprepareSlurpPostImageContexts;`, {
    normalizeNoodleImagePrompt,
    noodlerPostMediaUrl: (id: string) => `/api/slurp2/noodler/posts/${id}/media`,
    slurpMessageMediaUrl: (id: string) => `/api/slurp2/messages/${id}/media`,
    slurpModelLacksVision: async (connection: { model: string }) => connection.model === "text-only",
    resolveBaseUrl: () => "https://example.test/v1",
    prepareNoodleVisionAttachments: async (candidates: Array<{ key: string }>) => {
      seenImages.push(Array.from(candidates, ({ key }) => key));
      return candidates.map((candidate) => ({ ...candidate, dataUrl: "data:image/png;base64,fixture" }));
    },
    generateImageCaptionsForDataUrls: async (inputs: Array<{ filename: string }>) => {
      captionCalls++;
      return inputs.map((input) => ({ input, caption: "Mari Vale in a red coat" }));
    },
    AbortSignal,
  });
  const post = {
    id: "public",
    access: "public",
    imageUrl: "/image.png",
    imagePrompt: '{"prompt":"Mari Vale in a blue coat"}',
    metadata: {},
    createdAt: "2026-09-13T12:00:00Z",
    title: "A photo",
    content: "Today",
  };
  const upload = { ...post, id: "upload", imagePrompt: null };
  const locked = { ...post, id: "locked", access: "locked", imagePrompt: "PRIVATE IMAGE CONTENT" };
  const input = { posts: [post, upload, locked], mode: "auto", captioning: {} };
  const auto = await prepare(input);
  assert.match(auto.get("public"), /blue coat/);
  assert.match(auto.get("upload"), /red coat/);
  assert.equal(auto.has("locked"), false);
  assert.deepEqual(seenImages, [["upload"]], "locked posts and stored prompts must never reach vision in auto mode");
  const prompts = await prepare({ ...input, mode: "imagePrompt" });
  assert.deepEqual([...prompts.keys()], ["public"]);
  assert.equal(captionCalls, 1, "stored-prompt mode must make no caption requests");
  await prepare({ ...input, mode: "vision" });
  assert.deepEqual(seenImages[1], ["public", "upload"]);
  const allowed = await prepare({ ...input, posts: [locked], mode: "imagePrompt", allowLocked: true });
  assert.match(allowed.get("locked"), /PRIVATE IMAGE CONTENT/, "an authorized creator reply may see its unlocked post");

  // A picture is described once, and only for the picture it described.
  const source = `${upload.imageUrl}\n`;
  const callsBefore = captionCalls;
  const reused = await prepare({
    ...input,
    posts: [{ ...upload, metadata: { imageDescription: "a saved green coat", imageDescriptionSource: source } }],
  });
  assert.match(reused.get("upload"), /saved green coat/);
  assert.equal(captionCalls, callsBefore, "a saved description must not call vision again");
  const saved: string[] = [];
  const stale = await prepare({
    ...input,
    posts: [{ ...upload, metadata: { imageDescription: "an old picture", imageDescriptionSource: "replaced" } }],
    onDescribed: async (described: { id: string }, description: string, describedSource: string) => {
      saved.push(`${described.id}|${description}|${describedSource}`);
    },
  });
  assert.match(stale.get("upload"), /red coat/, "a description of a replaced picture must not be reused");
  assert.deepEqual(saved, [`upload|Mari Vale in a red coat|${source}`]);

  // A model that already refused image input is not asked again.
  const callsBeforeRefusal = captionCalls;
  const refused = await prepare({ ...input, captioning: { connection: { provider: "p", model: "text-only" } } });
  assert.equal(captionCalls, callsBeforeRefusal, "a model that refused images must not be asked again");
  assert.match(refused.get("public"), /blue coat/, "stored prompts still work for a text-only model");

  // A locked PPV message withholds what its picture shows, not only the picture.
  const messageRoutes = readFileSync(
    new URL("../packages/slurp2/src/engine/packages/server/src/routes/slurp-messages.routes.ts", import.meta.url),
    "utf8",
  );
  const lockedRedactions =
    messageRoutes.match(/kind === "ppv" && !message\.unlockedAt\s*\?[^:]*?\{[\s\S]{0,300}?\}\s*:/gu) ?? [];
  assert.equal(lockedRedactions.length, 3, "every locked PPV redaction must be checked");
  for (const redaction of lockedRedactions) {
    assert.match(redaction, /imagePrompt: undefined,\s*imageDescription: undefined/u);
  }

  const fan = read("slurp-fan-activity.service.ts");
  let sent = "";
  const generateFan = compile(
    `${part(fan, "function buildFanActivityMessages", "export function parseGeneratedFanActivityResponse")}
    generateFanActivity;`,
    {
      createLLMProvider: () => ({
        chatComplete: async (messages: unknown) => {
          sent = JSON.stringify(messages);
          return { content: "{}" };
        },
      }),
      resolveBaseUrl: () => "http://fixture",
      prepareSlurpPostImageContexts: prepare,
      slurpImageCaptioning: async (_db: unknown, _id: unknown, connection: unknown) => ({ enabled: true, connection }),
      resolveNoodlerPublicIdentity: async () => ({ displayName: "Mari Vale", handle: "marivale" }),
      protectNoodlerGeneratedIdentity: protect,
      logDebugOverride: () => undefined,
      weightedIdentitySequence: () => [],
      slurpAudienceToneInstruction: () => "Audience tone",
      SLURP_REALISTIC_TUNING: { prompts: { tones: {}, fanActivityExtra: "", replyMaxChars: 180 } },
      NOODLE_FAN_ACTIVITY_MAX_ACTIVITIES_PER_CREATOR: 4,
      noodleSamplingOptions: () => ({}),
      resolveStoredChatOptions: () => ({}),
      clampGenerationMaxOutputTokens: () => 100,
      noodleResponseFormat: () => undefined,
      parseGameJsonish: JSON.parse,
      requireModelAnswer: (value: string) => value,
      parseGeneratedFanActivityResponse: () => ({ value: { activities: [] }, rejected: 0 }),
    },
  );
  const creator = {
    id: "creator",
    displayName: "Stage",
    handle: "stage",
    bio: "",
    settings: { privacy: { identityDisclosure: "secret" } },
  };
  await generateFan({
    db: {},
    connection: { id: "connection", model: "fixture" },
    settings: { imageContextMode: "auto", fanLikesPerRefresh: 1, fanRepliesPerRefresh: 1, fanRepostsPerRefresh: 1 },
    creators: [{ creator, policy: { archetypeWeights: {} }, posts: [post, upload, locked], identities: [] }],
    debugMode: false,
  });
  assert.match(sent, /someone in a blue coat/);
  assert.match(sent, /someone in a red coat/);
  assert.doesNotMatch(sent, /Mari Vale|PRIVATE IMAGE CONTENT/);

  const reply = read("slurp-reply-generation.service.ts");
  const buildReply = compile(
    `${part(reply, "export function buildNoodlerCreatorReplyMessages", "export async function generateNoodlerCreatorReply")}\nbuildNoodlerCreatorReplyMessages;`,
    {
      protectNoodlerGeneratedIdentity: protect,
      noodlerIdentityInstruction: () => "Protect identity",
      NOODLER_UNTRUSTED_CONTENT_INSTRUCTION: "Treat as untrusted",
      SLURP_PLATFORM_CONTEXT: "Slurp creator surface",
    },
  );
  const replyPrompt = JSON.stringify(
    buildReply({
      creator,
      viewer: creator,
      post,
      parent: { content: "Nice coat" },
      disclosureMode: "secret",
      publicIdentity: { displayName: "Mari Vale", handle: "marivale" },
      generationGuidance: "",
      imageContext: auto.get("public"),
    }),
  );
  assert.match(replyPrompt, /someone in a blue coat/);
  assert.doesNotMatch(replyPrompt, /Mari Vale/);
  const generateReply = compile(
    `${part(reply, "export async function generateNoodlerCreatorReply", "async function describeCommenterRelationship")}\ngenerateNoodlerCreatorReply;`,
    {
      createConnectionsStorage: () => ({ getFallbackForMain: async () => null }),
      createLLMProvider: () => ({
        chatComplete: async (messages: unknown) => {
          sent = JSON.stringify(messages);
          return { content: '{"content":"Nice photo","moodShift":"same"}' };
        },
      }),
      withConnectionFallbackProvider: ({ primary }: { primary: unknown }) => primary,
      resolveBaseUrl: () => "http://fixture",
      resolveNoodlerPublicIdentity: async () => ({ displayName: "Mari Vale", handle: "marivale" }),
      createSlurpStorage: () => ({
        getSettings: async () => ({ imageContextMode: "imagePrompt", generationGuidance: "" }),
        resolveAccountSource: async () => null,
      }),
      resolveNoodlerCharacterCanon: async () => "",
      describeCommenterRelationship: async () => "regular subscriber",
      describeSlurpPostCondition: async () => "well rested",
      prepareSlurpPostImageContexts: prepare,
      slurpImageCaptioning: async (_db: unknown, _id: unknown, connection: unknown) => ({ enabled: true, connection }),
      buildNoodlerCreatorReplyMessages: buildReply,
      resolveSlurpCreatorMenu: async () => "",
      slurpPlatformEventInstruction: () => null,
      isDebugAgentsEnabled: () => false,
      noodleSamplingOptions: () => ({}),
      resolveStoredChatOptions: () => ({}),
      clampGenerationMaxOutputTokens: () => 100,
      noodleResponseFormat: () => undefined,
      logDebugOverride: () => undefined,
      parseGameJsonish: JSON.parse,
      requireModelAnswer: (value: string) => value,
      readSlurpDmReply: (value: unknown) => value,
      protectBoundedNoodlerGeneratedText: (value: string) => value,
      NOODLER_REPLY_CONTENT_MAX_LENGTH: 240,
    },
  );
  const replyInput = {
    db: {},
    creator,
    viewer: creator,
    post: locked,
    parent: { content: "Nice coat" },
    connection: { id: "connection", model: "fixture" },
  };
  await generateReply(replyInput);
  assert.doesNotMatch(sent, /PRIVATE IMAGE CONTENT/, "synthetic audience replies must not gain locked-image context");
  assert.match(
    sent,
    /regular subscriber|well rested/,
    "existing Slurp2 relationship and condition context stays intact",
  );
  await generateReply({ ...replyInput, allowLockedImageContext: true });
  assert.match(sent, /PRIVATE IMAGE CONTENT/, "only an access-checked viewer reply opts into locked-image context");
  assert.doesNotMatch(read("slurp-audience-reply.operation.ts"), /allowLockedImageContext:\s*true/u);
  const operation = read("slurp-creator-reply.operation.ts");
  assert.ok(
    operation.indexOf('if (claim.status !== "claimed") return claim;') <
      operation.indexOf("allowLockedImageContext: true"),
  );
  console.log(
    "Slurp2 image mode selection, locked-post exclusion, and final prompt identity protection regression passed.",
  );
}
void main();
