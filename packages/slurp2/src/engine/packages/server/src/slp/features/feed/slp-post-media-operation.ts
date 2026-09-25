import type { DB } from "../../../db/connection.js";
import { logger } from "../../../lib/logger.js";
import { newId } from "../../../utils/id-generator.js";
import { slpIsAdmissionFailure } from "../../base/host/slp-admission.js";
import { slurpDeepDetailsImageRunRecorder } from "../../data/feed/slp-post-deep-details-storage.js";
import { getErrorMessage } from "../../modules/creators/slp-public-support.js";
import { addSlurpPostMedia } from "../../data/feed/slp-post-media-storage.js";
import { recordSlurpShootSelection } from "../../data/feed/slp-shoot-storage.js";
import { slpCreatorPostMediaUrl } from "../../base/media/slp-media.js";
import {
  generateCreatorPostImage,
  generateSlurpSecondaryImages,
  type SlpSecondaryShot,
} from "../media/slp-media-contract.js";

type Generated = Awaited<ReturnType<typeof generateCreatorPostImage>>;
type ImageInput = Parameters<typeof generateCreatorPostImage>[0];

/** Commit a primary and up to two best-effort alternates as one post. */
export async function persistSlurpGeneratedImageSet<T>(input: {
  db: DB;
  postId: string;
  imagePrompt: string;
  primary: Generated;
  imageInput: ImageInput;
  multi: boolean;
  /** The post model's plan for the extra pictures; generic framings fill any it did not plan. */
  shots?: readonly SlpSecondaryShot[];
  shootId?: string | null;
  persist: (extra: {
    id: string;
    imagePrompt: string;
    imageUrl: string;
    metadata: Record<string, unknown>;
  }) => Promise<T>;
}): Promise<T> {
  const secondary = input.multi ? await generateSlurpSecondaryImages(input.imageInput, input.shots) : [];
  try {
    input.primary.stagedMedia?.promote();
    const post = await input.persist({
      id: input.postId,
      imagePrompt: input.imagePrompt,
      imageUrl: slpCreatorPostMediaUrl(input.postId),
      metadata: input.primary.metadata,
    });
    const promoted = secondary.filter((item) => item.stagedMedia);
    for (const item of promoted) item.stagedMedia!.promote();
    try {
      const stored = await addSlurpPostMedia(
        input.db,
        input.postId,
        promoted.map((item) => ({
          position: item.position,
          imagePrompt: item.imagePrompt,
          mediaPath: item.stagedMedia!.filePath,
          shootId: input.shootId ?? null,
        })),
      );
      if (post && typeof post === "object") {
        const target = post as Record<string, unknown>;
        const existing = Array.isArray(target.images) ? target.images : [];
        target.images = [
          ...existing,
          ...stored.map(({ id, position, imageUrl, imagePrompt }) => ({ id, position, imageUrl, imagePrompt })),
        ];
      }
      if (input.shootId) await recordSlurpShootSelection(input.db, input.shootId, promoted.length + 1);
    } catch (error) {
      for (const item of promoted) item.stagedMedia!.compensate();
      logger.warn(error, "[slurp] Secondary media persistence failed for %s; publishing primary only", input.postId);
    }
    return post;
  } catch (error) {
    input.primary.stagedMedia?.compensate();
    for (const item of secondary) item.stagedMedia?.compensate();
    throw error;
  }
}

type PostImageExtra = {
  id?: string;
  imagePrompt?: string | null;
  imageUrl?: string;
  metadata?: Record<string, unknown>;
};

/**
 * The picture leg of a generated post, after the text is settled: no prompt, no image connection,
 * a review preview, or an immediate generation, each with the gallery and text-only fallbacks.
 * A busy connection still propagates, so the scheduler defers instead of storing a failed image.
 */
export async function finishSlurpPostImage<T>(input: {
  db: DB;
  accountName: string;
  draftImagePrompt: string | null;
  resolveImageInput: (prompt: string) => Promise<ImageInput | null>;
  galleryFallback: () => Promise<PostImageExtra>;
  persist: (extra?: PostImageExtra) => Promise<T>;
  review: boolean;
  deepDetailsId: string | null;
  story: boolean;
  multi: boolean;
  shots: readonly SlpSecondaryShot[];
  shootId: string | null;
}) {
  const { persist, galleryFallback, resolveImageInput } = input;
  const prompt = input.draftImagePrompt;
  if (!prompt) return { post: await persist(await galleryFallback()), imagePromptReview: null };

  const imageInput = await resolveImageInput(prompt);
  if (!imageInput) {
    // A gallery image is a finished picture, so the post is not marked for the retry pass.
    const fallback = await galleryFallback();
    if (fallback.imageUrl) return { post: await persist(fallback), imagePromptReview: null };
    // Keep the prompt: the post publishes without its picture, and the retry pass (or the
    // user) draws it once a connection exists.
    const post = await persist({
      imagePrompt: prompt,
      metadata: {
        imageGenerationFailed: true,
        imageGenerationError: "No image generation connection is configured.",
      },
    });
    return { post, imagePromptReview: null };
  }

  // Manual Guide review path: persist a pending prompt and hand back a preview for the
  // reviewed-image confirmation route to claim and finalize later.
  if (input.review) {
    let preview: Awaited<ReturnType<typeof generateCreatorPostImage>>;
    try {
      preview = await generateCreatorPostImage({
        ...imageInput,
        previewOnly: true,
        onImageRun: slurpDeepDetailsImageRunRecorder(input.db, input.deepDetailsId, "review"),
      });
    } catch (err) {
      if (slpIsAdmissionFailure(err)) throw err;
      logger.warn(err, "[slurp] Failed to prepare image prompt review for %s", input.accountName);
      const fallback = await galleryFallback();
      if (fallback.imageUrl) return { post: await persist(fallback), imagePromptReview: null };
      return {
        post: await persist({
          imagePrompt: prompt,
          metadata: {
            imageGenerationFailed: true,
            imageRetryAttempts: 1,
            imageGenerationError: getErrorMessage(err).slice(0, 500),
          },
        }),
        imagePromptReview: null,
      };
    }
    const post = await persist({
      imagePrompt: prompt,
      metadata: { imagePendingReview: true },
    });
    return {
      post,
      imagePromptReview: preview.preview ? { id: post.id, ...preview.preview } : null,
    };
  }

  // Immediate generation: only a provider failure falls back to a text-only post. Persistence
  // failures propagate so a single run can never both persist an image post and a text fallback.
  let image: Awaited<ReturnType<typeof generateCreatorPostImage>>;
  try {
    image = await generateCreatorPostImage({
      ...imageInput,
      previewOnly: false,
      onImageRun: slurpDeepDetailsImageRunRecorder(input.db, input.deepDetailsId, "generation"),
    });
  } catch (err) {
    // Same rule as the text leg: a busy connection is a deferral, so let it propagate to the
    // scheduler instead of persisting a post permanently marked as image-failed.
    if (slpIsAdmissionFailure(err)) throw err;
    logger.warn(err, "[slurp] Failed to generate image for %s", input.accountName);
    const fallback = await galleryFallback();
    if (fallback.imageUrl) return { post: await persist(fallback), imagePromptReview: null };
    return {
      post: await persist({
        imagePrompt: prompt,
        metadata: {
          imageGenerationFailed: true,
          imageRetryAttempts: 1,
          imageGenerationError: getErrorMessage(err).slice(0, 500),
        },
      }),
      imagePromptReview: null,
    };
  }

  const postId = newId();
  const post = await persistSlurpGeneratedImageSet({
    db: input.db,
    postId,
    imagePrompt: prompt,
    primary: { ...image, metadata: { ...image.metadata, ...(input.story ? { noodlerPostType: "story" } : {}) } },
    imageInput,
    multi: input.multi,
    shots: input.shots,
    shootId: input.shootId,
    persist,
  });
  return { post, imagePromptReview: null };
}
