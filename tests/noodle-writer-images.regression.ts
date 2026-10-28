import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { runInNewContext } from "node:vm";
import * as noodlePrompt from "../packages/noodle/src/engine/packages/server/src/services/noodle/noodle-prompt.js";
import { selectNoodleVisionRequest } from "../packages/noodle/src/engine/packages/server/src/services/noodle/noodle-model-capabilities.js";
import { noodleTimelinePostTargetInstruction } from "../packages/noodle/src/engine/packages/server/src/services/noodle/noodle-post-target.js";

// "Show images to the writer" (Agents#1223): when it is off, no timeline image reaches the timeline
// writer as an image input on any request, including one whose caption failed. When it is on or was
// never saved, refreshes keep sending images exactly as before.

const servicesDir = "../packages/noodle/src/engine/packages/server/src/services";
const read = (path: string) => readFileSync(new URL(`${servicesDir}/${path}`, import.meta.url), "utf8");

// Run the image, context and message part of the real buildRefreshPrompt. The part before it only
// loads storage rows and context text, which the stubs below stand in for.
const promptService = read("noodle/noodle-public-prompt.service.ts");
const startMarker = "const timelineFeatureInstructions = noodleTimelineFeatureInstructions(input.settings);";
const start = promptService.indexOf(startMarker);
assert.ok(start > 0, "buildRefreshPrompt moved; update this regression");
const promptTailSource = promptService.slice(start + startMarker.length);
assert.ok(promptTailSource.trimEnd().endsWith("}"), "buildRefreshPrompt is no longer the last function in its file");
const promptTail = stripTypeScriptTypes(`async function buildRefreshPromptTail() {${promptTailSource}`);

type Message = { role: string; content: unknown; images?: string[] };
type Prompt = {
  messages: Message[];
  textOnlyMessages: Message[];
  promptForLog: string;
  textOnlyPromptForLog: string;
  visionAttachmentCount: number;
  captionedImageCount: number;
};
type Candidate = noodlePrompt.NoodlePromptImageCandidate;

const at = (minutes: number) => new Date(Date.UTC(2026, 9, 4, 12, minutes)).toISOString();
const snapshot = { displayName: "Alice", handle: "alice", kind: "character", entityId: "alice" };
const post = (id: string, minutes: number, imageUrl: string | null) => ({
  id,
  authorAccountId: "account-alice",
  authorSnapshot: snapshot,
  content: `Post ${id}`,
  imageUrl,
  imagePrompt: null,
  metadata: {},
  createdAt: at(minutes),
});
const recentPosts = [
  post("p3", 3, "/api/global-gallery/file/c.png"),
  post("p2", 2, null),
  post("p1", 1, "/api/global-gallery/file/a.png"),
];
const recentInteractions = [
  {
    id: "r1",
    postId: "p2",
    parentInteractionId: null,
    actorAccountId: "account-alice",
    actorSnapshot: snapshot,
    type: "reply",
    content: "Look",
    imageUrl: "/api/global-gallery/file/r.png",
    createdAt: at(4),
  },
];
const imageCount = 3;
const failedCaptionKey = noodlePrompt.noodlePostImageKey("p1");

async function buildPrompt(settings: Record<string, unknown>, captioning: boolean) {
  const calls = { prepared: 0, captioned: [] as string[] };
  const context = {
    ...noodlePrompt,
    noodleTimelinePostTargetInstruction,
    AbortSignal,
    input: {
      settings: {
        maxGeneratedPostsPerRefresh: 8,
        maxRepliesPerRefresh: 12,
        maxRepostsPerRefresh: 4,
        maxLikesPerRefresh: 18,
        maxImagesPerRefresh: 3,
        enableImagePrompts: false,
        allowGalleryImageAttachments: false,
        ...settings,
      },
      imageCaptioning: { enabled: captioning, connectionId: null, connection: null, provider: null },
      personaAccount: null,
      timeZone: "UTC",
      debugMode: false,
    },
    recentPosts,
    recentInteractions,
    recalledPosts: [],
    recalledInteractions: [],
    activeAccountList: "- Alice (@alice) kind=character",
    personaContext: "No user persona is active.",
    characterContext: "Alice",
    characterScheduleContext: "",
    loreContext: "",
    randomUserContext: "",
    chatContext: "No chats.",
    enhancedTimelineWriting: false,
    timelineFeatureInstructions: [],
    activeCharacters: [{}],
    activeRandomUsers: [],
    system: "system rules",
    lorebookResult: null,
    NOODLE_JSON_OUTPUT_HEADING: "# JSON Output Format",
    formatNoodleCurrentTime: () => "Sunday",
    formatNoodleVisionManifest: (attachments: Candidate[]) =>
      attachments.length > 0 ? `# Attached Noodle Images\n${attachments.map((item) => item.key).join("\n")}` : "",
    prepareNoodleVisionAttachments: async (candidates: Candidate[]) => {
      calls.prepared++;
      return candidates.map((candidate) => ({ ...candidate, dataUrl: `data:image/jpeg;base64,${candidate.key}` }));
    },
    generateImageCaptionsForDataUrls: async (inputs: Array<{ filename: string }>) =>
      inputs.map((item) => {
        calls.captioned.push(item.filename);
        return { input: item, caption: item.filename === failedCaptionKey ? null : `caption of ${item.filename}` };
      }),
  };
  const prompt = (await runInNewContext(`${promptTail}\nbuildRefreshPromptTail();`, context)) as Prompt;
  return { prompt, calls };
}

const imageParts = (messages: Message[]) =>
  messages.reduce(
    (count, message) =>
      count +
      (message.images?.length ?? 0) +
      (Array.isArray(message.content) ? message.content.filter((part) => part?.type !== "text").length : 0),
    0,
  );

// Every request a refresh can send: the first one (with or without images, as the generation service
// picks it) and the correction retry, which repeats the first request's messages.
const generationService = read("noodle/noodle-public-generation.service.ts");
assert.match(generationService, /const initialRequest = selectNoodleVisionRequest\(prompt, visionSupport\);/);
assert.match(generationService, /let requestMessages: ChatMessage\[\] = initialRequest\.messages;/);
assert.match(generationService, /requestMessages = prompt\.textOnlyMessages;/);
assert.match(
  generationService,
  /const correctionMessages = \[\.\.\.requestMessages, \{ role: "user" as const, content: correction \}\];/,
);
function writerRequests(prompt: Prompt) {
  const requests: Message[][] = [];
  for (const visionSupport of [true, null, false]) {
    const initial = selectNoodleVisionRequest(prompt, visionSupport).messages;
    requests.push(initial, [...initial, { role: "user", content: "correction" }]);
  }
  requests.push(prompt.textOnlyMessages, [...prompt.textOnlyMessages, { role: "user", content: "correction" }]);
  return requests;
}
const imagesPerRequest = (prompt: Prompt) => writerRequests(prompt).map(imageParts);

async function main() {
  // Off, captioning off: no image is even read, and no request carries one.
  {
    const { prompt, calls } = await buildPrompt({ showImagesToWriter: false }, false);
    assert.equal(calls.prepared, 0, "no timeline image is read when nothing would use it");
    assert.equal(calls.captioned.length, 0);
    assert.equal(prompt.visionAttachmentCount, 0);
    assert.ok(
      imagesPerRequest(prompt).every((count) => count === 0),
      "no writer request carries images",
    );
    assert.doesNotMatch(prompt.promptForLog, /# Attached Noodle Images|\[attached image:/);
    assert.match(prompt.promptForLog, /p1 by .*: Post p1 \[image not attached\]/);
  }

  // Off, captioning on: captions still reach the writer as text, and a failed caption leaves its
  // image out instead of attaching the raw picture.
  {
    const { prompt, calls } = await buildPrompt({ showImagesToWriter: false }, true);
    assert.equal(calls.prepared, 1);
    assert.equal(calls.captioned.length, imageCount);
    assert.equal(prompt.captionedImageCount, imageCount - 1);
    assert.equal(prompt.visionAttachmentCount, 0, "a failed caption does not fall back to the raw picture");
    assert.ok(
      imagesPerRequest(prompt).every((count) => count === 0),
      "no writer request carries images",
    );
    assert.match(prompt.promptForLog, /p3 by .*\[image description: caption of noodle-post-image:p3\]/);
    assert.match(prompt.promptForLog, /p1 by .*: Post p1 \[image not attached\]/);
  }

  // Never saved (settings from before 1.5.1) or on, captioning off: every image is attached as before.
  for (const settings of [{}, { showImagesToWriter: true }]) {
    const { prompt, calls } = await buildPrompt(settings, false);
    assert.equal(calls.prepared, 1);
    assert.equal(calls.captioned.length, 0);
    assert.equal(prompt.visionAttachmentCount, imageCount);
    assert.deepEqual(
      imagesPerRequest(prompt),
      [imageCount, imageCount, imageCount, imageCount, 0, 0, 0, 0],
      "images go out on the first request and its correction unless the model reports no vision",
    );
    assert.match(prompt.promptForLog, /# Attached Noodle Images/);
  }

  // On, captioning on: a failed caption still falls back to the picture, as before.
  {
    const { prompt } = await buildPrompt({ showImagesToWriter: true }, true);
    assert.equal(prompt.captionedImageCount, imageCount - 1);
    assert.equal(prompt.visionAttachmentCount, 1);
    assert.equal(imageParts(prompt.messages), 1);
    assert.match(prompt.promptForLog, /p1 by .*: Post p1 \[attached image: noodle-post-image:p1\]/);
  }

  // Saved settings: on unless turned off, and only a boolean is stored.
  const storage = read("storage/noodle.storage.ts");
  assert.match(storage, /\n {2}showImagesToWriter: true,\n/);
  assert.match(
    storage,
    /if \("showImagesToWriter" in patch\) patch\.showImagesToWriter = bool\(patch\.showImagesToWriter\);/,
  );
  const clientDefaults = readFileSync(
    new URL(
      "../packages/noodle/src/engine/packages/client/src/components/noodle/noodle-settings-defaults.ts",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(clientDefaults, /\n {2}showImagesToWriter: true,\n/);

  console.log("Noodle writer images regression passed.");
}

void main();
