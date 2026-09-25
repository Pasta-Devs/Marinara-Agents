import { logger } from "../../../lib/logger.js";
import { generateCreatorPostImage } from "./slp-images-service.js";

type ImageInput = Parameters<typeof generateCreatorPostImage>[0];
type Generated = Awaited<ReturnType<typeof generateCreatorPostImage>>;

export type SlpSecondaryImage = Generated & { imagePrompt: string; position: number };

/** One planned extra picture, briefed like the first. See `slurpSceneShotsInstruction`. */
export type SlpSecondaryShot = { draftPrompt: string; visualBrief?: ImageInput["visualBrief"] };

/** Pictures after the first in a multi-image post. */
export const SLURP_SECONDARY_IMAGE_COUNT = 2;

/**
 * Used only when the post model planned no shots. Each is a complete framing an image model can
 * draw on its own: it never sees the first picture, so "same outfit" or "another photo from the
 * same shoot" told it nothing, and the visual brief it was also given kept image 1's camera.
 */
const SLURP_ALTERNATE_FRAMINGS = [
  "Close-up crop from a three-quarter angle",
  "Candid frame, looking away from the camera",
] as const;

function alternateShot(input: ImageInput, index: number): SlpSecondaryShot {
  const framing = SLURP_ALTERNATE_FRAMINGS[index % SLURP_ALTERNATE_FRAMINGS.length]!;
  return {
    draftPrompt: `${input.draftPrompt}\n${framing}.`,
    visualBrief: input.visualBrief && { ...input.visualBrief, camera: `${input.visualBrief.camera} ${framing}.` },
  };
}

/** Best-effort extra pictures. A failed secondary never turns a valid primary into a failed post. */
export async function generateSlurpSecondaryImages(
  input: ImageInput,
  shots: readonly SlpSecondaryShot[] = [],
): Promise<SlpSecondaryImage[]> {
  const images: SlpSecondaryImage[] = [];
  for (let index = 0; index < SLURP_SECONDARY_IMAGE_COUNT; index += 1) {
    const position = index + 1;
    const shot = shots[index] ?? alternateShot(input, index);
    try {
      const generated = await generateCreatorPostImage({
        ...input,
        draftPrompt: shot.draftPrompt,
        visualBrief: shot.visualBrief,
        previewOnly: false,
      });
      // Stored as what the provider drew from, like the first picture's `imageProviderPrompt`.
      if (generated.stagedMedia) images.push({ ...generated, imagePrompt: generated.providerPrompt, position });
    } catch (error) {
      logger.warn(error, "[slurp] Secondary image %d failed for %s", position, input.account.id);
    }
  }
  return images;
}
