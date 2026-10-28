import type { SlpCreatorManagedPost } from "../../../../../shared/src/slp/slp-social.types.js";
import type { DB } from "../../../db/connection.js";
import { resolveBaseUrl } from "../../../services/generation/connection-base-url.js";
import {
  generateImageCaptionsForDataUrls,
  type ImageCaptioningRuntime,
} from "../../../services/generation/image-captioning-runtime.js";
import { createLLMProvider } from "../../../services/llm/provider-registry.js";
import { createConnectionsStorage } from "../../../services/storage/connections.storage.js";
import { normalizeSlpImagePrompt, slurpIsLegacyImageBrief } from "./slp-image-prompt.js";
import { slpCreatorPostMediaUrl, slurpMessageMediaUrl } from "./slp-media.js";
import {
  isUnsupportedSlpVisionInputError,
  prepareSlpVisionAttachments,
  rememberSlurpVisionRejection,
  slurpModelLacksVision,
} from "./slp-vision.js";
import { slpWithProviderRetry } from "../../base/model/slp-provider-retry.js";
import { slpRequireBackgroundIdle } from "../host/slp-generation-integrations.js";

type GenerationConnection = NonNullable<Awaited<ReturnType<ReturnType<typeof createConnectionsStorage>["getWithKey"]>>>;

export type SlurpImageContextPost = Pick<
  SlpCreatorManagedPost,
  "id" | "access" | "imageUrl" | "imagePrompt" | "metadata" | "createdAt"
>;

/**
 * How Slurp asks for a picture's description. The Engine's chat default asks for the style too, and
 * the writer then talked about brushwork instead of the person (player report); the player can
 * replace this in Settings › Images.
 */
export const SLURP_IMAGE_CAPTION_PROMPT =
  "You describe pictures from a social feed for a writer who cannot see them. " +
  "Write a faithful, concise description of what is visible: the people, their clothing, pose and expression, what they are doing, the place, and any readable text. " +
  "Do not describe the art style, medium, or image quality, and do not add speculation beyond what is visible.";

/**
 * The connection that describes pictures. A text-only Creator model cannot read an image, so the
 * image context setting can point descriptions at an image-capable model. Empty, or a connection
 * that no longer exists, keeps the text connection.
 */
export async function slurpImageCaptioning(
  db: DB,
  connectionId: string | null,
  textConnection: GenerationConnection,
  /** The player's caption instructions; blank uses SLURP_IMAGE_CAPTION_PROMPT. */
  prompt = "",
  /** False inside a run that holds the text connection's background slot. */
  bookConnection = true,
): Promise<ImageCaptioningRuntime> {
  const connection =
    (connectionId ? await createConnectionsStorage(db).getWithKey(connectionId) : null) ?? textConnection;
  // The run's slot covers only its own connection: on another one, each caption waits like other background work.
  const yieldToForeground = !bookConnection && connection.id !== textConnection.id;
  const provider = slpWithProviderRetry(
    createLLMProvider(
      connection.provider,
      resolveBaseUrl(connection),
      connection.apiKey,
      connection.maxContext,
      connection.openrouterProvider,
      connection.maxTokensOverride,
      connection.claudeFastMode === "true",
      connection.treatAsLocalEndpoint === "true",
      connection.defaultParameters,
      // Booked as foreground work, like the reply it describes pictures for. A caller that already holds the
      // connection's background slot passes false: a foreground booking inside it would hold off other work.
      bookConnection ? connection.id : undefined,
    ),
  );
  const instructions = prompt.trim() || SLURP_IMAGE_CAPTION_PROMPT;
  // The Engine's caption helper swallows provider errors, so a refusal is only visible here. Older Engines
  // hardcode its one system message (the chat default), so Slurp's instructions replace it here.
  const guardedProvider = Object.assign(Object.create(provider) as typeof provider, {
    chatComplete: async (...[messages, ...rest]: Parameters<typeof provider.chatComplete>) => {
      if (yieldToForeground) slpRequireBackgroundIdle(connection.id);
      try {
        const own = messages.map((message) =>
          message.role === "system" ? { ...message, content: instructions } : message,
        );
        return await provider.chatComplete(own, ...rest);
      } catch (error) {
        if (isUnsupportedSlpVisionInputError(error)) rememberSlurpVisionRejection(connection);
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
/**
 * How every picture reaches a prompt. A stored prompt carries style tags and a caption says "an
 * anime illustration", so fans started reviewing the art style (#38). In the world a picture is a
 * photo of the Creator; the label says so once per picture.
 */
const PICTURE_SEEN =
  "an ordinary photo in this world: react to what it shows, never to art style, drawing, rendering or picture quality";

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
    // Legacy drafts are rule prose, not a description of the picture.
    const prompt = slurpIsLegacyImageBrief(post.imagePrompt) ? null : normalizeSlpImagePrompt(post.imagePrompt);
    const saved =
      post.metadata.imageDescriptionSource === imageSource(post) && typeof post.metadata.imageDescription === "string"
        ? post.metadata.imageDescription.trim()
        : "";
    if (input.mode !== "vision" && prompt) {
      contexts.set(post.id, `Picture, from its prompt (${PICTURE_SEEN}): ${prompt}`);
    } else if (saved) {
      // Already paid for, so even prompt-only mode may use it.
      contexts.set(post.id, `Picture (${PICTURE_SEEN}): ${saved}`);
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
  const attachments = await prepareSlpVisionAttachments(
    visionPosts.map((post) => ({
      key: post.id,
      postId: post.id,
      interactionId: null,
      imageUrl: post.imageUrl!,
      createdAt: post.createdAt,
      // Messages keep their generated pictures the same way posts do.
      ...(typeof post.metadata.noodlerMediaPath === "string" &&
      (post.imageUrl === slpCreatorPostMediaUrl(post.id) || post.imageUrl === slurpMessageMediaUrl(post.id))
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
    contexts.set(image.filename, `Picture (${PICTURE_SEEN}): ${caption}`);
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
