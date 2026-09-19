import type { SlpCreatorManagedPost } from "../../../../../shared/src/slp/slp-social.types.js";
import type { DB } from "../../../db/connection.js";
import { resolveBaseUrl } from "../../../services/generation/connection-base-url.js";
import {
  generateImageCaptionsForDataUrls,
  type ImageCaptioningRuntime,
} from "../../../services/generation/image-captioning-runtime.js";
import { createLLMProvider } from "../../../services/llm/provider-registry.js";
import { createConnectionsStorage } from "../../../services/storage/connections.storage.js";
import { normalizeNoodleImagePrompt } from "./slp-image-prompt.js";
import { noodlerPostMediaUrl, slurpMessageMediaUrl } from "./slp-media.js";
import {
  isUnsupportedNoodleVisionInputError,
  prepareNoodleVisionAttachments,
  rememberSlurpVisionRejection,
  slurpModelLacksVision,
} from "./slp-vision.js";

type GenerationConnection = NonNullable<Awaited<ReturnType<ReturnType<typeof createConnectionsStorage>["getWithKey"]>>>;

export type SlurpImageContextPost = Pick<
  SlpCreatorManagedPost,
  "id" | "access" | "imageUrl" | "imagePrompt" | "metadata" | "createdAt"
>;

/**
 * The connection that describes pictures. A text-only Creator model cannot read an image, so the
 * image context setting can point descriptions at an image-capable model. Empty, or a connection
 * that no longer exists, keeps the text connection.
 */
export async function slurpImageCaptioning(
  db: DB,
  connectionId: string | null,
  textConnection: GenerationConnection,
): Promise<ImageCaptioningRuntime> {
  const connection =
    (connectionId ? await createConnectionsStorage(db).getWithKey(connectionId) : null) ?? textConnection;
  const provider = createLLMProvider(
    connection.provider,
    resolveBaseUrl(connection),
    connection.apiKey,
    connection.maxContext,
    connection.openrouterProvider,
    connection.maxTokensOverride,
    connection.claudeFastMode === "true",
    connection.treatAsLocalEndpoint === "true",
    connection.defaultParameters,
  );
  // The Engine's caption helper swallows provider errors, so a refusal is only visible here.
  const guardedProvider = Object.assign(Object.create(provider) as typeof provider, {
    chatComplete: async (...args: Parameters<typeof provider.chatComplete>) => {
      try {
        return await provider.chatComplete(...args);
      } catch (error) {
        if (isUnsupportedNoodleVisionInputError(error)) rememberSlurpVisionRejection(connection);
        throw error;
      }
    },
  });
  return { enabled: true, connectionId: connection.id, connection, provider: guardedProvider };
}

/**
 * Which picture a saved description belongs to. Generated media keeps one URL across a redraw, so
 * the file path is part of it: a replaced picture must not inherit the old picture's description.
 */
function imageSource(post: SlurpImageContextPost): string {
  const mediaPath = typeof post.metadata.noodlerMediaPath === "string" ? post.metadata.noodlerMediaPath : "";
  return `${post.imageUrl}\n${mediaPath}`;
}

/**
 * Only pass allowLocked after an access-checked creator-reply claim.
 *
 * A picture is described once. `onDescribed` keeps the description, and the next call reads it
 * back instead of paying the vision model again for the same pixels.
 */
export async function prepareSlurpPostImageContexts(input: {
  posts: readonly SlurpImageContextPost[];
  mode: "auto" | "imagePrompt" | "vision";
  captioning: ImageCaptioningRuntime;
  allowLocked?: boolean;
  debugMode?: boolean;
  onDescribed?: (post: SlurpImageContextPost, description: string, source: string) => Promise<void>;
}): Promise<Map<string, string>> {
  const contexts = new Map<string, string>();
  const visionPosts: SlurpImageContextPost[] = [];
  for (const post of input.posts) {
    if ((!input.allowLocked && post.access === "locked") || !post.imageUrl) continue;
    const prompt = normalizeNoodleImagePrompt(post.imagePrompt);
    const saved =
      post.metadata.imageDescriptionSource === imageSource(post) && typeof post.metadata.imageDescription === "string"
        ? post.metadata.imageDescription.trim()
        : "";
    if (input.mode !== "vision" && prompt) {
      contexts.set(post.id, `Intended image (stored image prompt): ${prompt}`);
    } else if (saved) {
      // Already paid for, so even prompt-only mode may use it.
      contexts.set(post.id, `Image description: ${saved}`);
    } else if (input.mode !== "imagePrompt") {
      visionPosts.push(post);
    }
  }
  if (!visionPosts.length) return contexts;
  if (
    input.captioning.connection &&
    (await slurpModelLacksVision(input.captioning.connection, resolveBaseUrl(input.captioning.connection)))
  )
    return contexts;
  const attachments = await prepareNoodleVisionAttachments(
    visionPosts.map((post) => ({
      key: post.id,
      postId: post.id,
      interactionId: null,
      imageUrl: post.imageUrl!,
      createdAt: post.createdAt,
      // Messages keep their generated pictures the same way posts do.
      ...(typeof post.metadata.noodlerMediaPath === "string" &&
      (post.imageUrl === noodlerPostMediaUrl(post.id) || post.imageUrl === slurpMessageMediaUrl(post.id))
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
    if (!caption) continue;
    contexts.set(image.filename, `Image description: ${caption}`);
    const post = visionPosts.find((candidate) => candidate.id === image.filename);
    // Keeping it is a saving, not a requirement: a failed write only means describing it again.
    const onDescribed = input.onDescribed;
    if (post && onDescribed) {
      await Promise.resolve()
        .then(() => onDescribed(post, caption, imageSource(post)))
        .catch(() => undefined);
    }
  }
  return contexts;
}
