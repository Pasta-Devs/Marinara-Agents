import { existsSync, readFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import { PROFESSOR_MARI_ID } from "@marinara-engine/shared";
import { type SlpAccount, type SlpBootstrap } from "../../../../../shared/src/slp/slp-social.types.js";
import type { DB } from "../../../db/connection.js";
import type { SlurpSettings } from "../../modules/settings/slp-settings.js";
import { logger, logDebugOverride } from "../../../lib/logger.js";
import { newId } from "../../../utils/id-generator.js";
import { resolveImageConnectionFallback } from "../../../services/generation/media-connection-fallback.js";
import { loadImageGenerationUserSettings } from "../../../services/image/image-generation-settings.js";
import { generateImage, stageImageToDisk, type StagedGalleryImage } from "../../../services/image/image-generation.js";
import { resolveConnectionImageDefaults } from "../../../services/image/image-generation-defaults.js";
import { compileImagePrompt, resolveImageStyleGuidanceText } from "../../../services/image/image-prompt-compiler.js";
import { resolveImagePromptReviewSize } from "../../../services/image/image-prompt-review.js";
import type { SlurpVisualBrief } from "../../base/media/slp-visual-brief.js";
import { slurpVisualBriefPromptViolatesPolicy, slurpVisualBriefText } from "../../base/media/slp-visual-brief.js";
import {
  readIllustratorAppearance,
  resolveIllustratorCharacterReferences,
} from "../../../services/image/illustrator-references.js";
import { createCharacterGalleryStorage } from "../../../services/storage/character-gallery.storage.js";
import { createCharactersStorage } from "../../../services/storage/characters.storage.js";
import { createConnectionsStorage } from "../../../services/storage/connections.storage.js";
import { createSlurpStorage } from "../../data/slp-storage.js";
import { createPromptOverridesStorage } from "../../../services/storage/prompt-overrides.storage.js";
import { loadPrompt, NOODLE_IMAGE_POST } from "../../../services/prompt-overrides/index.js";
import { generateSlpImageWithRetry } from "../../base/media/slp-image-retry.js";
import { rewriteSlpImagePrompt } from "../../base/media/slp-image-prompt-rewrite.js";
import { slpImageReferencesSupported } from "../../base/media/slp-image-references.js";
import { resolveImageAppearance } from "./slp-appearance-service.js";
import {
  ensureSlpImageAppearance,
  selectSlpImageProviderPrompt,
  stripAppearanceLabel,
} from "../../base/media/slp-image-prompt.js";
import {
  resolveCreatorImageConnectionId,
  resolveCreatorImageStyleProfileId,
} from "../../base/media/slp-image-connections.js";
import type { ConnectionAdmissionMode } from "../../../services/generation/connection-admission.js";
import {
  characterGalleryImageUrl,
  characterNameFromRow,
  galleryImageUrl,
  getErrorMessage,
  parseRecord,
} from "../../modules/creators/slp-public-support.js";
import { bootstrapVisibleSlp } from "../../data/creators/slp-creator-accounts.js";
import { slurpPromptContext } from "../../base/prompting/slp-prompt-blocks.js";

type ImageConnection = NonNullable<Awaited<ReturnType<ReturnType<typeof createConnectionsStorage>["getWithKey"]>>>;

export type SlpImagePromptReviewItem = {
  id: string;
  kind: "illustration";
  title: string;
  prompt: string;
  negativePrompt?: string;
  width: number;
  height: number;
};

export type ReviewedSlpImagePrompt = Pick<SlpImagePromptReviewItem, "id" | "prompt" | "negativePrompt">;

export type StagedSlpPostMedia = {
  file: StagedGalleryImage;
  characterGalleryInput?: {
    characterId: string;
    filePath: string;
    prompt: string;
    provider: string;
    model: string;
    width: number;
    height: number;
  };
};

const SLP_SERVICE_DIR = dirname(fileURLToPath(import.meta.url));
const CLIENT_PUBLIC_DIR = resolve(SLP_SERVICE_DIR, "../../../../client/public");
const PROFESSOR_MARI_REFERENCE_ASSETS = [
  "sprites/mari/Mari_profile.png",
  "sprites/mari/chibi-professor-mari.png",
] as const;
const REVIEWED_IMAGE_CLAIM_LEASE_MS = 2 * 60 * 1000;
const REVIEWED_IMAGE_CLAIM_RENEW_MS = 30 * 1000;

function imageClaimLeaseUntil() {
  return new Date(Date.now() + REVIEWED_IMAGE_CLAIM_LEASE_MS).toISOString();
}

function readProfessorMariReferenceImages(): string[] {
  return PROFESSOR_MARI_REFERENCE_ASSETS.flatMap((relativePath) => {
    const filePath = resolve(CLIENT_PUBLIC_DIR, relativePath);
    if (!existsSync(filePath)) return [];
    try {
      return [readFileSync(filePath).toString("base64")];
    } catch {
      return [];
    }
  });
}

/**
 * The card's own appearance field, and nothing else.
 *
 * This used to fall back to the whole `description` when a card had no appearance field. Many
 * downloaded cards have none, so their entire description — backstory, personality, scenario —
 * was appended to every image prompt. A Creator's Stage appearance is the place to set a look.
 */
export function characterAppearanceFromRow(row: { data: unknown }) {
  return readIllustratorAppearance(parseRecord(row.data)) ?? "";
}

/**
 * `applyInstructions` is Slurp's own per-character choice. Until a character has one, the Engine's
 * Noodle-named checkbox still decides, so an upgrade changes nothing for anybody.
 */
export function characterSlpImageContextFromRow(row: { data: unknown }, applyInstructions?: boolean) {
  const data = parseRecord(row.data);
  const extensions = parseRecord(data.extensions);
  return {
    personality: typeof data.personality === "string" ? data.personality.trim() : "",
    imageInstructions:
      (applyInstructions ?? extensions.applyConversationImageInstructionsToNoodle === true) &&
      typeof extensions.conversationImageInstructions === "string"
        ? extensions.conversationImageInstructions.trim()
        : "",
  };
}

export async function generateSlpPostImage(input: {
  account: SlpAccount;
  referenceAccounts: SlpAccount[];
  postContent: string;
  draftPrompt: string;
  contentPolicy?: string;
  visualBrief?: SlurpVisualBrief;
  settings: SlurpSettings;
  characters: ReturnType<typeof createCharactersStorage>;
  characterGallery: ReturnType<typeof createCharacterGalleryStorage>;
  promptOverrides: ReturnType<typeof createPromptOverridesStorage>;
  imageConnection: ImageConnection;
  db: DB;
  debugMode: boolean;
  previewOnly?: boolean;
  promptOverride?: { prompt: string; negativePrompt?: string };
  admissionMode?: ConnectionAdmissionMode;
}) {
  const imageSettings = await loadImageGenerationUserSettings(input.db);
  const creatorStyleProfileId = await resolveCreatorImageStyleProfileId(input.db, input.account.id);
  const imageDefaults = resolveConnectionImageDefaults(input.imageConnection);
  const selectedStyleProfileId = creatorStyleProfileId ?? input.settings.imageStyleProfileId;
  if (imageDefaults && selectedStyleProfileId) {
    imageDefaults.styleProfileId = selectedStyleProfileId;
    for (const providerDefaults of [imageDefaults.automatic1111, imageDefaults.comfyui, imageDefaults.novelai]) {
      if (providerDefaults) {
        providerDefaults.promptPrefix = "";
        providerDefaults.negativePromptPrefix = "";
      }
    }
  }
  const imageModel = input.imageConnection.model || "";
  const imageBaseUrl = input.imageConnection.baseUrl || "https://image.pollinations.ai";
  const imageSource = input.imageConnection.imageGenerationSource || imageModel;
  const imageServiceHint = input.imageConnection.imageService || imageSource;
  const imageFallback = await resolveImageConnectionFallback(
    createConnectionsStorage(input.db),
    input.imageConnection.id,
  );
  const allowAvatarReferences = slpImageReferencesSupported(input.imageConnection, imageFallback);
  // The Creator's own appearance, written on the Creator rather than borrowed from a card.
  //
  // It is applied unconditionally, unlike the block below it. `imageGenerationIncludeDescriptions`
  // decides whether to pull the *source character's* description into the picture; it was never
  // meant to decide whether the picture knows who the Creator is. With it off, a Creator with no
  // linked source, or a source card with an empty Appearance field, the image model received a
  // scene containing nobody and invented somebody — a different somebody every post.
  const stageAppearance = await resolveImageAppearance({
    db: input.db,
    account: input.account,
    connectionId: input.settings.generationConnectionId,
    mode: input.settings.appearanceProfileMode,
  });
  let characterDescription = stageAppearance;
  let characterImageInstructions = "";
  let characterPersonality = "";
  let referenceImages: string[] | undefined;

  if (input.account.kind === "character") {
    const character = await input.characters.getById(input.account.entityId);
    if (character) {
      const imageContext = characterSlpImageContextFromRow(
        character,
        input.settings.characterImageInstructions[character.id],
      );
      if (!stageAppearance) characterDescription = characterAppearanceFromRow(character);
      characterPersonality = imageContext.personality;
      characterImageInstructions = imageContext.imageInstructions;

      if (input.settings.imageGenerationIncludeDescriptions || input.settings.imageGenerationUseAvatarReferences) {
        const referenceAccountByEntityId = new Map(
          [input.account, ...input.referenceAccounts]
            .filter((account) => account.kind === "character")
            .map((account) => [account.entityId, account]),
        );
        const referenceRows = await Promise.all(
          Array.from(referenceAccountByEntityId.keys()).map((characterId) =>
            characterId === character.id ? Promise.resolve(character) : input.characters.getById(characterId),
          ),
        );
        const chatCharacters = referenceRows
          .filter((row): row is NonNullable<typeof row> => !!row)
          .map((row) => {
            const account = referenceAccountByEntityId.get(row.id);
            return {
              id: row.id,
              name: account?.displayName || characterNameFromRow(row),
              avatarPath: row.avatarPath ?? null,
              appearance: characterAppearanceFromRow(row),
            };
          });
        const referenceResolution = await resolveIllustratorCharacterReferences({
          charactersStore: input.characters,
          chatCharacters,
          persona: null,
          requestedNames: [input.account.displayName],
          promptText: [input.account.displayName, input.postContent, input.draftPrompt].join("\n"),
          maxReferences: 6,
        });
        if (!stageAppearance && referenceResolution.appearanceBlock) {
          characterDescription = referenceResolution.appearanceBlock;
        }
        if (input.settings.imageGenerationUseAvatarReferences && allowAvatarReferences) {
          const builtInMariReferences =
            input.account.entityId === PROFESSOR_MARI_ID ? readProfessorMariReferenceImages() : [];
          const combinedReferences = [...builtInMariReferences, ...referenceResolution.referenceImages];
          if (combinedReferences.length > 0) referenceImages = Array.from(new Set(combinedReferences)).slice(0, 6);
        }
      }
    }
  }

  const postPrompt = await loadPrompt(input.promptOverrides, NOODLE_IMAGE_POST, {
    authorName: input.account.displayName,
    postContent: input.postContent,
    visualBrief: input.visualBrief,
    draftPrompt: input.draftPrompt,
    userInstructions: input.settings.imageGenerationPrompt,
    characterDescription: stripAppearanceLabel(characterDescription),
    characterImageInstructions,
    // Empty on purpose. The default template concatenates this straight into the prompt the image
    // provider receives, and "arrogant, impatient with staged sentimentality" is not a visual
    // fact — it is noise a diffusion model still tries to draw. The rewrite already treats
    // personality as private context that must never appear in a visual prompt; the template that
    // produces the fallback prompt should not be the one place that disagrees. A custom template
    // that genuinely wants it can still read the character card.
    characterPersonality: "",
  });
  const compiledPrompt = compileImagePrompt({
    kind: "illustration",
    prompt: postPrompt,
    styleProfiles: imageSettings.styleProfiles,
    imageDefaults,
  });
  const styleGuidance = resolveImageStyleGuidanceText(imageSettings.styleProfiles, compiledPrompt.profile.id);
  // A reviewed prompt replaces the generated wording, but the style profile is composition rather
  // than wording, so recompile the approved text instead of sending it bare. The compiler omits
  // style values the prompt already carries, so an approved prompt is never double-styled.
  const overridePrompt = input.promptOverride?.prompt.trim();
  const compiledOverride = overridePrompt
    ? compileImagePrompt({
        kind: "illustration",
        prompt: overridePrompt,
        styleProfiles: imageSettings.styleProfiles,
        imageDefaults,
      })
    : null;
  // The rewrite is skipped when interpretation is off and discarded when it leaks, and both land on
  // this fallback. Sending the bare draft there dropped the style profile exactly like the review
  // path did, so the draft is compiled too.
  const draftPrompt = input.draftPrompt.trim();
  const compiledDraft = draftPrompt
    ? compileImagePrompt({
        kind: "illustration",
        prompt: draftPrompt,
        styleProfiles: imageSettings.styleProfiles,
        imageDefaults,
      })
    : null;
  const rawFinalPrompt = compiledOverride?.prompt || compiledPrompt.prompt;
  const rawProviderPrompt = compiledOverride?.prompt || compiledDraft?.prompt || draftPrompt;
  const configuredImageInstructions = input.settings.imageGenerationPrompt.trim();
  const connectionImageInstructions = input.imageConnection.imagePromptInstructions?.trim() ?? "";
  const imagePromptInstructions = [
    configuredImageInstructions && !postPrompt.includes(configuredImageInstructions) ? configuredImageInstructions : "",
    connectionImageInstructions,
  ]
    .filter(Boolean)
    .join("\n");
  const characterContext = [
    characterDescription ? `Appearance:\n${characterDescription}` : "",
    characterPersonality ? `Personality:\n${characterPersonality}` : "",
    characterImageInstructions ? `Character image preferences:\n${characterImageInstructions}` : "",
    input.contentPolicy ? `Creator content policy:\n${input.contentPolicy}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
  const rewriteAttempted = Boolean(
    (imagePromptInstructions || characterContext || styleGuidance) &&
    input.settings.enableImageInterpretation !== false &&
    !input.promptOverride,
  );
  const rewrittenPrompt = rewriteAttempted
    ? await rewriteSlpImagePrompt({
        db: input.db,
        prompt: rawFinalPrompt,
        postContent: input.postContent,
        interpretationInstruction: input.settings.imagePromptInterpretation,
        instructions: imagePromptInstructions,
        characterContext,
        styleGuidance,
        promptBlocks: slurpPromptContext(input.settings).blocks,
        connectionId: input.settings.generationConnectionId,
      })
    : null;
  // The style profile is an Engine setting, not something the interpretation model owns. The
  // rewrite is a text transformation, and it freely drops the style's positive tags and wording,
  // so the rewritten text is compiled again before it reaches the provider. Without this the style
  // applied only when the rewrite was skipped, failed, or was rejected — which is exactly why the
  // setting looked intermittent rather than broken. The compiler dedupes against the prompt it is
  // given, so a rewrite that kept its style is not styled twice.
  const compiledRewrittenPrompt = rewrittenPrompt
    ? compileImagePrompt({
        kind: "illustration",
        prompt: rewrittenPrompt,
        styleProfiles: imageSettings.styleProfiles,
        imageDefaults,
      })
    : null;
  const acceptedRewrittenPrompt =
    input.visualBrief && rewrittenPrompt && slurpVisualBriefPromptViolatesPolicy(input.visualBrief, rewrittenPrompt)
      ? null
      : compiledRewrittenPrompt?.prompt || rewrittenPrompt;
  const finalPromptBase = selectSlpImageProviderPrompt({
    rewrittenPrompt: acceptedRewrittenPrompt,
    rawPrompt: rawProviderPrompt,
    fallbackPrefix: [
      characterDescription ? `Appearance: ${stripAppearanceLabel(characterDescription)}` : "",
      input.visualBrief ? slurpVisualBriefText(input.visualBrief) : "",
    ]
      .filter(Boolean)
      .join("\n"),
    rewriteAttempted,
    onFallback: (reason) => logger.warn("[slurp] Image prompt rewrite unusable (%s); sending the capped draft", reason),
    // Art style and the character's image habits are meant to reach the provider, so a rewrite
    // that applies them is doing its job. Personality never belongs in a visual prompt at any
    // length; the instruction fields are guidance and only leak as a copied block.
    privateContext: [characterPersonality],
    guidanceContext: [configuredImageInstructions, connectionImageInstructions],
  });
  const finalPrompt = ensureSlpImageAppearance(finalPromptBase, stageAppearance);
  // A reviewer who cleared the negative prompt still gets the style profile's own negatives back,
  // for the same reason the positive prompt is recompiled above.
  const finalNegativePrompt = input.promptOverride
    ? input.promptOverride.negativePrompt?.trim() || compiledOverride?.negativePrompt || undefined
    : compiledPrompt.negativePrompt || undefined;
  logDebugOverride(
    input.debugMode,
    "[debug/noodle/image] final image prompt for %s:\n%s",
    input.account.displayName,
    finalPrompt,
  );
  if (finalNegativePrompt) {
    logDebugOverride(input.debugMode, "[debug/noodle/image] negative prompt:\n%s", finalNegativePrompt);
  }

  if (input.previewOnly) {
    const previewSize = resolveImagePromptReviewSize({
      connection: input.imageConnection,
      prompt: finalPrompt,
      width: input.settings.imageWidth,
      height: input.settings.imageHeight,
      imageDefaults,
    });
    return {
      imageUrl: null,
      metadata: {},
      preview: {
        kind: "illustration" as const,
        title: `${input.account.displayName} Noodle image`,
        prompt: finalPrompt,
        negativePrompt: finalNegativePrompt,
        width: previewSize.width,
        height: previewSize.height,
      },
      stagedMedia: null,
    };
  }

  const image = await generateSlpImageWithRetry(
    () =>
      generateImage(imageSource, imageBaseUrl, input.imageConnection.apiKey || "", imageServiceHint, {
        prompt: finalPrompt,
        negativePrompt: finalNegativePrompt,
        model: imageModel,
        width: input.settings.imageWidth,
        height: input.settings.imageHeight,
        imageEndpointId: input.imageConnection.imageEndpointId || undefined,
        comfyWorkflow: input.imageConnection.comfyuiWorkflow || undefined,
        imageDefaults,
        referenceImages,
        debugMode: input.debugMode,
        fallback: imageFallback,
        admissionMode: input.admissionMode,
      }),
    (error, attempt, maxAttempts) => {
      logger.warn(
        error,
        "[slurp] Image generation attempt %d/%d failed for %s",
        attempt,
        maxAttempts,
        input.account.displayName,
      );
    },
  );
  const provider = input.imageConnection.provider ?? "image_generation";
  const file = stageImageToDisk(
    input.account.kind === "character" ? `characters/${input.account.entityId}` : "noodle",
    image.base64,
    image.ext,
  );
  if (input.account.kind === "character") {
    return {
      imageUrl: characterGalleryImageUrl(input.account.entityId, file.filePath),
      metadata: {
        imageGenerated: true,
        imageProvider: provider,
        imageModel: imageModel || "unknown",
        imageStyleProfileId: compiledPrompt.profile.id,
      },
      preview: null,
      stagedMedia: {
        file,
        characterGalleryInput: {
          characterId: input.account.entityId,
          filePath: file.filePath,
          prompt: finalPrompt,
          provider,
          model: imageModel || "unknown",
          width: input.settings.imageWidth,
          height: input.settings.imageHeight,
        },
      } satisfies StagedSlpPostMedia,
    };
  }
  return {
    imageUrl: galleryImageUrl(file.filePath, "noodle"),
    metadata: {
      imageGenerated: true,
      imageProvider: provider,
      imageModel: imageModel || "unknown",
      imageStyleProfileId: compiledPrompt.profile.id,
    },
    preview: null,
    stagedMedia: { file } satisfies StagedSlpPostMedia,
  };
}

export function createPublicSlpImagesService(db: DB) {
  const noodle = createSlurpStorage(db);
  const characters = createCharactersStorage(db);
  const connections = createConnectionsStorage(db);
  const characterGallery = createCharacterGalleryStorage(db);
  const promptOverrides = createPromptOverridesStorage(db);

  return {
    async generateReviewedImages(input: {
      prompts: ReviewedSlpImagePrompt[];
      debugMode: boolean;
    }): Promise<{ ok: true; bootstrap: SlpBootstrap } | { ok: false; error: "missing_connection"; message: string }> {
      const settings = await noodle.getSettings();

      for (const promptOverride of input.prompts) {
        const claimToken = newId();
        const post = await noodle.claimPostImage(promptOverride.id, claimToken, imageClaimLeaseUntil());
        if (!post) continue;
        const account = await noodle.getAccountById(post.authorAccountId);
        if (!account) {
          await noodle.releasePostImageClaim(post.id, claimToken);
          continue;
        }
        const selectedConnectionId = await resolveCreatorImageConnectionId(db, account.id);
        const imageConnection =
          (selectedConnectionId ? await connections.getWithKey(selectedConnectionId) : null) ??
          (await connections.getDefaultForImageGeneration());
        if (!imageConnection) {
          await noodle.releasePostImageClaim(post.id, claimToken);
          return {
            ok: false,
            error: "missing_connection",
            message: "Select a Slurp image generation connection first.",
          };
        }
        if (!post.imagePrompt) {
          await noodle.releasePostImageClaim(post.id, claimToken);
          continue;
        }
        let claimOwned = true;
        const renewClaim = async () => {
          if (!claimOwned) return;
          try {
            claimOwned = await noodle.renewPostImageClaim(post.id, claimToken, imageClaimLeaseUntil());
          } catch (error) {
            claimOwned = false;
            logger.warn(error, "[slurp] Failed to renew reviewed image claim for post %s", post.id);
          }
        };
        const renewalTimer = setInterval(() => void renewClaim(), REVIEWED_IMAGE_CLAIM_RENEW_MS);
        renewalTimer.unref?.();
        let generatedImage: Awaited<ReturnType<typeof generateSlpPostImage>>;
        try {
          generatedImage = await generateSlpPostImage({
            account,
            referenceAccounts: [account],
            postContent: post.content,
            draftPrompt: post.imagePrompt,
            settings,
            characters,
            characterGallery,
            promptOverrides,
            imageConnection,
            db,
            debugMode: input.debugMode,
            promptOverride,
          });
        } catch (error) {
          logger.warn(error, "[slurp] Failed to generate reviewed image for %s", account.displayName);
          clearInterval(renewalTimer);
          await renewClaim();
          if (claimOwned) {
            await noodle.finalizePostImageClaim(post.id, claimToken, {
              imageUrl: null,
              imagePrompt: null,
              metadata: {
                imageGenerationFailed: true,
                imageGenerationError: getErrorMessage(error).slice(0, 500),
              },
            });
          }
          continue;
        }

        clearInterval(renewalTimer);
        await renewClaim();
        if (!claimOwned) {
          generatedImage.stagedMedia?.file.compensate();
          continue;
        }
        try {
          generatedImage.stagedMedia?.file.promote();
          await db.transaction(async (tx) => {
            const txSlp = createSlurpStorage(tx);
            const txCharacterGallery = createCharacterGalleryStorage(tx);
            const galleryImage = generatedImage.stagedMedia?.characterGalleryInput
              ? await txCharacterGallery.create(generatedImage.stagedMedia.characterGalleryInput)
              : null;
            const finalized = await txSlp.finalizePostImageClaim(post.id, claimToken, {
              imageUrl: generatedImage.imageUrl,
              metadata: {
                ...generatedImage.metadata,
                ...(galleryImage ? { characterGalleryImageId: galleryImage.id } : {}),
              },
            });
            if (!finalized) throw new Error("Reviewed Noodle image claim was lost during finalization.");
          });
        } catch (error) {
          generatedImage.stagedMedia?.file.compensate();
          try {
            await noodle.releasePostImageClaim(post.id, claimToken);
          } catch (releaseError) {
            logger.warn(releaseError, "[slurp] Failed to release reviewed image claim for post %s", post.id);
          }
          throw error;
        } finally {
          clearInterval(renewalTimer);
        }
      }
      return {
        ok: true,
        bootstrap: await bootstrapVisibleSlp(noodle, characters),
      };
    },
  };
}
