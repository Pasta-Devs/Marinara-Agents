import { logger } from "../../../lib/logger.js";
import { generateCreatorPostImage } from "./slp-images-service.js";

type ImageInput = Parameters<typeof generateCreatorPostImage>[0];
type Generated = Awaited<ReturnType<typeof generateCreatorPostImage>>;

export type SlpSecondaryImage = Generated & { imagePrompt: string; position: number };

/** One visible difference per alternate, so a set reads as several frames rather than copies. */
const SLURP_ALTERNATE_CHANGES = [
  "a closer crop from a slightly different angle",
  "a moment later, looking away from the camera",
] as const;

/** Best-effort alternate shots. A failed secondary never turns a valid primary into a failed post. */
export async function generateSlurpSecondaryImages(input: ImageInput, count = 2): Promise<SlpSecondaryImage[]> {
  const images: SlpSecondaryImage[] = [];
  for (let index = 0; index < count; index += 1) {
    const position = index + 1;
    // Leads the draft so it is read first, and names one concrete change: a bare "change the pose"
    // after the draft was cut off or ignored, and the set came back as three near-copies.
    const imagePrompt = [
      `Another photo from the same moment, ${SLURP_ALTERNATE_CHANGES[index % SLURP_ALTERNATE_CHANGES.length]}, same outfit, place, and light.`,
      input.draftPrompt,
    ].join("\n");
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
