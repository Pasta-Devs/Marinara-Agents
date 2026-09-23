import { logger } from "../../../lib/logger.js";
import { generateCreatorPostImage } from "./slp-images-service.js";

type ImageInput = Parameters<typeof generateCreatorPostImage>[0];
type Generated = Awaited<ReturnType<typeof generateCreatorPostImage>>;

export type SlpSecondaryImage = Generated & { imagePrompt: string; position: number };

/** Best-effort alternate shots. A failed secondary never turns a valid primary into a failed post. */
export async function generateSlurpSecondaryImages(input: ImageInput, count = 2): Promise<SlpSecondaryImage[]> {
  const images: SlpSecondaryImage[] = [];
  for (let index = 0; index < count; index += 1) {
    const position = index + 1;
    const imagePrompt = [
      input.draftPrompt,
      `Alternate ${position + 1} from the same shoot. Keep the exact outfit, location, lighting, camera source, and effort level. Change only the pose or framing enough to be a distinct photograph.`,
    ].join("\n\n");
    try {
      const generated = await generateCreatorPostImage({
        ...input,
        draftPrompt: imagePrompt,
        compositionGuard: "This is another photograph from the same shoot, not a new scene.",
        previewOnly: false,
      });
      if (generated.stagedMedia) images.push({ ...generated, imagePrompt, position });
    } catch (error) {
      logger.warn(error, "[slurp] Secondary image %d failed for %s", position, input.account.id);
    }
  }
  return images;
}
