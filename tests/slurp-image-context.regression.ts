import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { runInNewContext } from "node:vm";
import { normalizeNoodleImagePrompt } from "../packages/slurp/src/engine/packages/server/src/services/slurp/slurp-image-prompt";

const root = "../packages/slurp/src/engine/packages/server/src/services/slurp/";
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
    noodlerPostMediaUrl: (id: string) => `/api/slurp/noodler/posts/${id}/media`,
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

  const generation = read("slurp-generation.service.ts");
  const protect = compile(
    `${part(generation, "function escapeRegExp", "export function buildNoodlerPublicIdentity")}
    ${part(generation, "export function protectNoodlerGeneratedIdentity", "export function protectBoundedNoodlerGeneratedText")}
    protectNoodlerGeneratedIdentity;`,
    {},
  );
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
      resolveNoodlerPublicIdentity: async () => ({ displayName: "Mari Vale", handle: "marivale" }),
      protectNoodlerGeneratedIdentity: protect,
      logDebugOverride: () => undefined,
      weightedIdentitySequence: () => [],
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
  console.log(
    "Slurp image mode selection, locked-post exclusion, and final prompt identity protection regression passed.",
  );
}
void main();
