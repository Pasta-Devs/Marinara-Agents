/**
 * Artwork for pool ads.
 *
 * An ad is not a post: it has no creator account, no persona, and no identity to protect, so it
 * does not go through the post image pipeline. It only needs a prompt, a connection, and a file,
 * which is what this does.
 */
import type { DB } from "../../../db/connection.js";
import { logger } from "../../../lib/logger.js";
import { resolveConnectionImageDefaults } from "../../../services/image/image-generation-defaults.js";
import { generateImage, stageImageToDisk } from "../../../services/image/image-generation.js";
import { createConnectionsStorage } from "../../../services/storage/connections.storage.js";
import { createSlurpStorage } from "../../data/slp-storage.js";
import type { GarnishAd } from "../../../services/garnish-ads/garnish-ads.types.js";
import type { GarnishAdsStorage } from "../../../services/garnish-ads/garnish-ads.storage.js";
import { generateSlpImageWithRetry } from "../../base/media/slp-image-retry.js";
import { rewriteSlpImagePrompt } from "../../base/media/slp-image-prompt-rewrite.js";
import { selectSlpImageProviderPrompt } from "../../base/media/slp-image-prompt.js";
import { garnishAdImageUrl, garnishAdMediaNamespace, unlinkGarnishAdImage } from "./slp-garnish-image.js";
import { slurpPromptContext } from "../../base/prompting/slp-prompt-blocks.js";

/** Ads read as feed content, so the artwork is product photography rather than a poster. */
function adImagePrompt(ad: GarnishAd): string {
  return [
    `Advertising photograph for a fictional brand called "${ad.brand}", advertising "${ad.product}".`,
    ad.copy,
    ad.categories.length ? `Themes: ${ad.categories.join(", ")}.` : "",
    "Product or lifestyle photography for a social feed. Clean, well lit, intentional composition.",
    "No text, no words, no lettering, no logo, no watermark, no user interface.",
  ]
    .filter(Boolean)
    .join("\n");
}

const AD_IMAGE_NEGATIVE_PROMPT =
  "text, words, lettering, caption, typography, logo, watermark, signature, user interface, browser chrome, collage, border, frame";

export type GarnishAdImageOutcome = "generated" | "unavailable" | "failed";

/**
 * Generate and store one ad's image, replacing any previous file. Returns the outcome rather
 * than throwing, so a batch of ads is never abandoned halfway because one image failed.
 */
export async function generateGarnishAdImage(
  db: DB,
  pool: GarnishAdsStorage,
  ad: GarnishAd,
  /** Preferred connections in order (ad connection, then the Slurp image connection). */
  connectionIds: ReadonlyArray<string | null | undefined> = [],
): Promise<GarnishAdImageOutcome> {
  const connections = createConnectionsStorage(db);
  // A stored id can be blank, deleted, or point at a text connection. Skip those and fall through to
  // the next choice, not straight to the Engine default.
  let connection: Awaited<ReturnType<typeof connections.getWithKey>> = null;
  for (const id of connectionIds) {
    const candidate = id?.trim() ? await connections.getWithKey(id.trim()) : null;
    if (candidate?.provider === "image_generation") {
      connection = candidate;
      break;
    }
  }
  connection ??= await connections.getDefaultForImageGeneration();
  if (!connection) return "unavailable";

  const model = connection.model || "";
  const source = connection.imageGenerationSource || model;
  // Ads honour the same interpretation setting and rewrite pass as post images.
  const settings = await createSlurpStorage(db).getSettings();
  const rawPrompt = adImagePrompt(ad);
  const imagePromptInstructions = [
    settings.imageGenerationPrompt.trim(),
    connection.imagePromptInstructions?.trim() ?? "",
  ]
    .filter(Boolean)
    .join("\n");
  const rewriteAttempted = Boolean(imagePromptInstructions) && settings.enableImageInterpretation !== false;
  const prompt = selectSlpImageProviderPrompt({
    rewrittenPrompt: rewriteAttempted
      ? await rewriteSlpImagePrompt({
          db,
          prompt: rawPrompt,
          interpretationInstruction: settings.imagePromptInterpretation,
          instructions: imagePromptInstructions,
          promptBlocks: slurpPromptContext(settings).blocks,
        })
      : null,
    rawPrompt,
    rewriteAttempted,
    onFallback: (reason) =>
      logger.warn(
        "[garnish-ads] Image prompt rewrite unusable for %s (%s); sending the capped draft",
        ad.brand,
        reason,
      ),
  });
  try {
    const image = await generateSlpImageWithRetry(
      () =>
        generateImage(
          source,
          connection.baseUrl || "https://image.pollinations.ai",
          connection.apiKey || "",
          connection.imageService || source,
          {
            prompt,
            negativePrompt: AD_IMAGE_NEGATIVE_PROMPT,
            model,
            width: 1024,
            height: 640,
            imageEndpointId: connection.imageEndpointId || undefined,
            comfyWorkflow: connection.comfyuiWorkflow || undefined,
            imageDefaults: resolveConnectionImageDefaults(connection),
            debugMode: false,
            admissionMode: { kind: "background" },
          },
        ),
      (error, attempt, maxAttempts) =>
        logger.warn(error, "[garnish-ads] Image attempt %d/%d failed for %s", attempt, maxAttempts, ad.brand),
    );
    const file = stageImageToDisk(garnishAdMediaNamespace(ad.id), image.base64, image.ext);
    const previousUrl = ad.imageUrl;
    file.promote();
    try {
      // Replace in place rather than via add(), which moves the ad to the end of the pool and
      // would reshuffle which ad lands in which feed slot every time an image is generated.
      const stored = await pool.listAll();
      await pool.replaceAll(
        stored.map((row) => (row.id === ad.id ? { ...row, imageUrl: garnishAdImageUrl(ad.id, file.filePath) } : row)),
      );
    } catch (error) {
      file.compensate();
      throw error;
    }
    // Only once the replacement is committed, so a failed write never leaves the ad imageless.
    unlinkGarnishAdImage(ad.id, previousUrl);
    return "generated";
  } catch (error) {
    logger.warn(error, "[garnish-ads] Could not generate an image for %s", ad.brand);
    return "failed";
  }
}
