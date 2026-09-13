import type { NoodlerManagedPost } from "@marinara-engine/shared";
import {
  generateImageCaptionsForDataUrls,
  type ImageCaptioningRuntime,
} from "../generation/image-captioning-runtime.js";
import { normalizeNoodleImagePrompt } from "./slurp-image-prompt.js";
import { noodlerPostMediaUrl } from "./slurp-media.js";
import { prepareNoodleVisionAttachments } from "./slurp-vision.js";

export type SlurpImageContextPost = Pick<
  NoodlerManagedPost,
  "id" | "access" | "imageUrl" | "imagePrompt" | "metadata" | "createdAt"
>;

/** Only pass allowLocked after an access-checked creator-reply claim. */
export async function prepareSlurpPostImageContexts(input: {
  posts: readonly SlurpImageContextPost[];
  mode: "auto" | "imagePrompt" | "vision";
  captioning: ImageCaptioningRuntime;
  allowLocked?: boolean;
  debugMode?: boolean;
}): Promise<Map<string, string>> {
  const contexts = new Map<string, string>();
  const visionPosts: SlurpImageContextPost[] = [];
  for (const post of input.posts) {
    if ((!input.allowLocked && post.access === "locked") || !post.imageUrl) continue;
    const prompt = normalizeNoodleImagePrompt(post.imagePrompt);
    if (input.mode !== "vision" && prompt) {
      contexts.set(post.id, `Intended image (stored image prompt): ${prompt}`);
    } else if (input.mode !== "imagePrompt") {
      visionPosts.push(post);
    }
  }
  if (!visionPosts.length) return contexts;
  const attachments = await prepareNoodleVisionAttachments(
    visionPosts.map((post) => ({
      key: post.id,
      postId: post.id,
      interactionId: null,
      imageUrl: post.imageUrl!,
      createdAt: post.createdAt,
      ...(post.imageUrl === noodlerPostMediaUrl(post.id) && typeof post.metadata.noodlerMediaPath === "string"
        ? { mediaPath: post.metadata.noodlerMediaPath }
        : {}),
    })),
  );
  const captions = await generateImageCaptionsForDataUrls(
    attachments.map((attachment) => ({ filename: attachment.key, imageDataUrl: attachment.dataUrl })),
    input.captioning,
    AbortSignal.timeout(120_000),
    input.debugMode,
  );
  for (const { input: image, caption } of captions) {
    if (caption) contexts.set(image.filename, `Image description: ${caption}`);
  }
  return contexts;
}
