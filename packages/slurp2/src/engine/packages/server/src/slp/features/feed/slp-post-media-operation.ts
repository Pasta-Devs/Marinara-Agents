import type { DB } from "../../../db/connection.js";
import { logger } from "../../../lib/logger.js";
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
