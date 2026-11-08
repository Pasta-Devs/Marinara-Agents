import { existsSync, readFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import {
  noodleTextMentionsHandle,
  PROFESSOR_MARI_ID,
  stripMacroComments,
  type NoodleAccount,
  type NoodleBootstrap,
} from "@marinara-engine/shared";
import type { PackageNoodleSettings } from "../storage/noodle.storage.js";
import type { DB } from "../../db/connection.js";
import { logger, logDebugOverride } from "../../lib/logger.js";
import { newId } from "../../utils/id-generator.js";
import { resolveImageConnectionFallback } from "../generation/media-connection-fallback.js";
import { generateImage, stageImageToDisk, type StagedGalleryImage } from "../image/image-generation.js";
import { resolveConnectionImageDefaults } from "../image/image-generation-defaults.js";
import { resolveImagePromptReviewSize } from "../image/image-prompt-review.js";
import { loadImageGenerationUserSettings } from "../image/image-generation-settings.js";
import {
  normalizeIllustratorAppearance,
  readIllustratorAppearance,
  resolveIllustratorCharacterReferences,
} from "../image/illustrator-references.js";
import { createCharacterGalleryStorage } from "../storage/character-gallery.storage.js";
import { createCharactersStorage } from "../storage/characters.storage.js";
import { createConnectionsStorage } from "../storage/connections.storage.js";
import { createNoodleStorage } from "../storage/noodle.storage.js";
import { createPromptOverridesStorage } from "../storage/prompt-overrides.storage.js";
import { loadPrompt, NOODLE_IMAGE_POST } from "../prompt-overrides/index.js";
import { generateNoodleImageWithRetry } from "./noodle-image-retry.js";
import { noodleImageExtension } from "./noodle-image-format.js";
import { compileNoodleImagePrompts } from "./noodle-image-prompt.js";
import { rewriteNoodleImagePrompt } from "./noodle-image-prompt-rewrite.js";
import type { ConnectionAdmissionMode } from "../generation/connection-admission.js";
import {
  bootstrapVisibleNoodle,
  characterGalleryImageUrl,
  characterNameFromRow,
  galleryImageUrl,
  getErrorMessage,
  parseRecord,
} from "./noodle-public-support.js";

type ImageConnection = NonNullable<Awaited<ReturnType<ReturnType<typeof createConnectionsStorage>["getWithKey"]>>>;

export type NoodleImagePromptReviewItem = {
  id: string;
  kind: "illustration";
  title: string;
  prompt: string;
  negativePrompt?: string;
  width: number;
  height: number;
};

export type ReviewedNoodleImagePrompt = Pick<NoodleImagePromptReviewItem, "id" | "prompt" | "negativePrompt">;

export type StagedNoodlePostMedia = {
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

const NOODLE_SERVICE_DIR = dirname(fileURLToPath(import.meta.url));
const CLIENT_PUBLIC_DIR = resolve(NOODLE_SERVICE_DIR, "../../../../client/public");
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
 * A card's Image Generation Appearance Override (Pasta-Devs/Marinara-Engine#7053) when it is on and has text, else
 * null. Characters keep it in `data.extensions` with a boolean flag; persona rows keep it in their own columns, with
 * the flag stored as text.
 * ponytail: Noodle bundles sources/engine, whose shared helpers and illustrator-references predate #7053 and never
 * read the override, so Noodle reads it here and hands it to them as the card's appearance. Once sources/engine
 * carries the Engine's readImageAppearanceOverride and override-aware resolver, use those instead.
 */
export function imageAppearanceOverride(fields: Record<string, unknown>) {
  if (fields.imageAppearanceEnabled !== true && fields.imageAppearanceEnabled !== "true") return null;
  return normalizeIllustratorAppearance(fields.imageAppearance);
}

function characterImageAppearanceOverride(row: { data: unknown }) {
  return imageAppearanceOverride(parseRecord(parseRecord(row.data).extensions));
}

/** The appearance image prompts use for a character: its Image Generation Appearance Override first. */
export function characterAppearanceFromRow(row: { data: unknown }) {
  const data = parseRecord(row.data);
  return (
    characterImageAppearanceOverride(row) ??
    readIllustratorAppearance(data) ??
    normalizeIllustratorAppearance(data.description) ??
    ""
  );
}

/** The user's persona as the illustrator references take it, with its Image Generation Appearance Override first. */
async function personaImageReference(
  characters: ReturnType<typeof createCharactersStorage>,
  account: NoodleAccount | null | undefined,
) {
  const row = account ? await characters.getPersona(account.entityId) : null;
  if (!account || !row) return null;
  // The rows carry the override columns, which are newer than the vendored persona schema.
  const appearanceOverride = imageAppearanceOverride(row as Record<string, unknown>);
  return {
    id: row.id,
    name: account.displayName || row.name,
    avatarPath: row.avatarPath ?? null,
    appearance: appearanceOverride ?? row.appearance,
    appearanceOverride,
  };
}

export function characterNoodleImageContextFromRow(row: { data: unknown }) {
  const data = parseRecord(row.data);
  const extensions = parseRecord(data.extensions);
  return {
    personality: typeof data.personality === "string" ? data.personality.trim() : "",
    imageInstructions:
      extensions.applyConversationImageInstructionsToNoodle === true &&
      typeof extensions.conversationImageInstructions === "string"
        ? extensions.conversationImageInstructions.trim()
        : "",
  };
}

/** The image connection a character picked in Noodle's Edit profile, if it still exists. */
async function characterImageConnection(input: {
  account: NoodleAccount;
  characters: ReturnType<typeof createCharactersStorage>;
  db: DB;
}): Promise<ImageConnection | null> {
  if (input.account.kind !== "character") return null;
  const character = await input.characters.getById(input.account.entityId);
  const connectionId = parseRecord(parseRecord(character?.data).extensions).noodleImageConnectionId;
  if (typeof connectionId !== "string" || !connectionId) return null;
  const connection = await createConnectionsStorage(input.db).getWithKey(connectionId);
  return connection?.provider === "image_generation" ? connection : null;
}

export async function generateNoodlePostImage(baseInput: {
  account: NoodleAccount;
  referenceAccounts: NoodleAccount[];
  /** The user's persona account; a character's post that names it, or @mentions it, depicts the persona too. */
  personaAccount?: NoodleAccount | null;
  postContent: string;
  draftPrompt: string;
  settings: PackageNoodleSettings;
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
  // ponytail: the override only replaces a resolved Noodle connection; with none, callers skip images.
  const input = {
    ...baseInput,
    imageConnection: (await characterImageConnection(baseInput)) ?? baseInput.imageConnection,
  };
  const imageSettings = await loadImageGenerationUserSettings(input.db);
  const imageDefaults = resolveConnectionImageDefaults(input.imageConnection);
  const imageModel = input.imageConnection.model || "";
  const imageBaseUrl = input.imageConnection.baseUrl || "https://image.pollinations.ai";
  const imageSource = input.imageConnection.imageGenerationSource || imageModel;
  const imageServiceHint = input.imageConnection.imageService || imageSource;
  const imageFallback = await resolveImageConnectionFallback(
    createConnectionsStorage(input.db),
    input.imageConnection.id,
  );
  let characterDescription = "";
  let appearanceOverrides = "";
  let characterImageInstructions = "";
  let characterPersonality = "";
  let referenceImages: string[] | undefined;

  if (input.account.kind === "character") {
    const character = await input.characters.getById(input.account.entityId);
    if (character) {
      const imageContext = characterNoodleImageContextFromRow(character);
      characterPersonality = imageContext.personality;
      characterImageInstructions = imageContext.imageInstructions;

      if (input.settings.imageGenerationIncludeDescriptions || input.settings.imageGenerationUseAvatarReferences) {
        // The line the appearance block writes for each card with an override, so those lines can be found in it.
        const overrideLines = new Set<string>();
        const noteOverride = (name: string, override: string | null | undefined) => {
          if (override) overrideLines.add(`${name}'s Appearance: ${override}`);
        };
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
            const name = account?.displayName || characterNameFromRow(row);
            noteOverride(name, characterImageAppearanceOverride(row));
            return {
              id: row.id,
              name,
              avatarPath: row.avatarPath ?? null,
              appearance: characterAppearanceFromRow(row),
            };
          });
        const personaAccount = input.personaAccount ?? null;
        const persona = await personaImageReference(input.characters, personaAccount);
        if (persona) noteOverride(persona.name, persona.appearanceOverride);
        // The resolver finds the persona's name in the post; an @mention of its handle asks for it by name too.
        const personaMentioned =
          !!personaAccount &&
          noodleTextMentionsHandle(`${input.postContent}\n${input.draftPrompt}`, personaAccount.handle);
        // The resolver also matches cards outside this refresh, from these rows. It reads a card's appearance
        // from extensions.appearance and names it by its own name, so the override goes there under that name.
        // Listed once, before the resolver runs, so every override line is noted where it is read.
        const allRows = (await input.characters.list()).map((row) => {
          const override = characterImageAppearanceOverride(row);
          if (!override) return row;
          const data = parseRecord(row.data);
          noteOverride(stripMacroComments(typeof data.name === "string" ? data.name : "").trim(), override);
          return {
            ...row,
            data: { ...data, extensions: { ...parseRecord(data.extensions), appearance: override } },
          };
        });
        const referenceResolution = await resolveIllustratorCharacterReferences({
          charactersStore: { list: async () => allRows },
          chatCharacters,
          persona,
          requestedNames: [input.account.displayName, ...(persona && personaMentioned ? [persona.name] : [])],
          promptText: [input.account.displayName, input.postContent, input.draftPrompt].join("\n"),
          maxReferences: 6,
        });
        if (input.settings.imageGenerationIncludeDescriptions && referenceResolution.appearanceBlock) {
          characterDescription = referenceResolution.appearanceBlock;
          appearanceOverrides = characterDescription
            .split("\n")
            .filter((line) => overrideLines.has(line))
            .join("\n");
        }
        if (input.settings.imageGenerationUseAvatarReferences) {
          const builtInMariReferences =
            input.account.entityId === PROFESSOR_MARI_ID ? readProfessorMariReferenceImages() : [];
          const combinedReferences = [...builtInMariReferences, ...referenceResolution.referenceImages];
          if (combinedReferences.length > 0) referenceImages = Array.from(new Set(combinedReferences)).slice(0, 6);
        }
      }
    }
  }

  const postPromptContext = {
    authorName: input.account.displayName,
    postContent: input.postContent,
    draftPrompt: input.draftPrompt,
    userInstructions: input.settings.imageGenerationPrompt,
    characterDescription,
    characterImageInstructions,
    characterPersonality,
  };
  const postPrompt = await loadPrompt(input.promptOverrides, NOODLE_IMAGE_POST, postPromptContext);
  const enableImageInterpretation =
    (input.settings as PackageNoodleSettings & { enableImageInterpretation?: boolean }).enableImageInterpretation !==
    false;
  // Include descriptions: the rewrite model gets the appearance notes, the user's persona's included, as character
  // context, so the prompt it edits leaves them out; without a rewrite they are added as written
  // (Pasta-Devs/Marinara-Agents#1282). Each card's Image Generation Appearance Override among them is also added
  // word for word after a rewrite, below (Pasta-Devs/Marinara-Agents#2182).
  const rewritePostPrompt =
    characterDescription && enableImageInterpretation && !input.promptOverride
      ? await loadPrompt(input.promptOverrides, NOODLE_IMAGE_POST, { ...postPromptContext, characterDescription: "" })
      : postPrompt;
  const {
    styleGuidance,
    literal: compiledPrompt,
    forRewrite,
  } = compileNoodleImagePrompts(
    {
      kind: "illustration",
      prompt: postPrompt,
      styleProfiles: imageSettings.styleProfiles,
      imageDefaults,
    },
    rewritePostPrompt,
  );
  const imagePromptInstructions = input.imageConnection.imagePromptInstructions?.trim();
  const characterContext = [
    characterDescription ? `Appearance:\n${characterDescription}` : "",
    characterPersonality ? `Personality:\n${characterPersonality}` : "",
    characterImageInstructions ? `Character image preferences:\n${characterImageInstructions}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
  const rewriteRequested = Boolean(
    (imagePromptInstructions || characterContext || styleGuidance) &&
    enableImageInterpretation &&
    !input.promptOverride,
  );
  const rewrittenPrompt = rewriteRequested
    ? await rewriteNoodleImagePrompt({
        db: input.db,
        prompt: forRewrite.prompt,
        instructions: imagePromptInstructions,
        characterContext,
        styleGuidance,
        noodleConnectionId: input.settings.generationConnectionId,
        extraGuidance: [characterImageInstructions],
      })
    : null;
  // The connection's Image Prompting Instructions, the poster's appearance notes, personality and image
  // habits, and the profile's Style text guide the rewrite model only. Without a rewrite the image model
  // gets the base prompt with the appearance notes; pasted instructions reached it as stray words
  // (Pasta-Devs/Marinara-Agents#1278, Pasta-Devs/Marinara-Agents#1282). The one exception is an Image Generation
  // Appearance Override: it is written for image prompts, so after a rewrite each depicted card's override line goes
  // out as written, as the Engine's Illustrator sends it (Pasta-Devs/Marinara-Engine#7053,
  // Pasta-Devs/Marinara-Agents#2182). Without a rewrite the appearance notes already carry it, and a prompt the
  // user reviewed is sent as they left it.
  if (rewriteRequested && !rewrittenPrompt) {
    logger.warn(
      "[noodle] Image prompt rewrite gave no prompt for %s; sending the base prompt without the image instructions",
      input.account.displayName,
    );
  } else if (!rewriteRequested && imagePromptInstructions && !input.promptOverride) {
    logDebugOverride(
      input.debugMode,
      "[debug/noodle/image] Interpret image prompts is off; the image connection's instructions were not applied for %s",
      input.account.displayName,
    );
  }
  const finalPrompt = rewrittenPrompt
    ? [rewrittenPrompt, appearanceOverrides].filter(Boolean).join("\n\n")
    : input.promptOverride?.prompt.trim() || compiledPrompt.prompt;
  if (rewrittenPrompt && appearanceOverrides) {
    logDebugOverride(
      input.debugMode,
      "[debug/noodle/image] Image Generation Appearance Override added as written for %s:\n%s",
      input.account.displayName,
      appearanceOverrides,
    );
  }
  const finalNegativePrompt = input.promptOverride
    ? input.promptOverride.negativePrompt?.trim() || undefined
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

  const image = await generateNoodleImageWithRetry(
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
        "[noodle] Image generation attempt %d/%d failed for %s",
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
    noodleImageExtension(image.base64, image.ext),
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
      } satisfies StagedNoodlePostMedia,
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
    stagedMedia: { file } satisfies StagedNoodlePostMedia,
  };
}

export function createPublicNoodleImagesService(db: DB) {
  const noodle = createNoodleStorage(db);
  const characters = createCharactersStorage(db);
  const connections = createConnectionsStorage(db);
  const characterGallery = createCharacterGalleryStorage(db);
  const promptOverrides = createPromptOverridesStorage(db);

  return {
    async generateReviewedImages(input: {
      prompts: ReviewedNoodleImagePrompt[];
      debugMode: boolean;
    }): Promise<
      { ok: true; bootstrap: NoodleBootstrap } | { ok: false; error: "missing_connection"; message: string }
    > {
      const settings = await noodle.getSettings();
      const imageConnection = settings.imageGenerationConnectionId
        ? await connections.getWithKey(settings.imageGenerationConnectionId)
        : await connections.getDefaultForImageGeneration();
      if (!imageConnection) {
        return {
          ok: false,
          error: "missing_connection",
          message: "Select a Noodle image generation connection first.",
        };
      }

      for (const promptOverride of input.prompts) {
        const claimToken = newId();
        const post = await noodle.claimPostImage(promptOverride.id, claimToken, imageClaimLeaseUntil());
        if (!post) continue;
        const account = await noodle.getAccountById(post.authorAccountId);
        if (!account) {
          await noodle.releasePostImageClaim(post.id, claimToken);
          continue;
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
            logger.warn(error, "[noodle] Failed to renew reviewed image claim for post %s", post.id);
          }
        };
        const renewalTimer = setInterval(() => void renewClaim(), REVIEWED_IMAGE_CLAIM_RENEW_MS);
        renewalTimer.unref?.();
        let generatedImage: Awaited<ReturnType<typeof generateNoodlePostImage>>;
        try {
          generatedImage = await generateNoodlePostImage({
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
          logger.warn(error, "[noodle] Failed to generate reviewed image for %s", account.displayName);
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
            const txNoodle = createNoodleStorage(tx);
            const txCharacterGallery = createCharacterGalleryStorage(tx);
            const galleryImage = generatedImage.stagedMedia?.characterGalleryInput
              ? await txCharacterGallery.create(generatedImage.stagedMedia.characterGalleryInput)
              : null;
            const finalized = await txNoodle.finalizePostImageClaim(post.id, claimToken, {
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
            logger.warn(releaseError, "[noodle] Failed to release reviewed image claim for post %s", post.id);
          }
          throw error;
        } finally {
          clearInterval(renewalTimer);
        }
      }
      return {
        ok: true,
        bootstrap: await bootstrapVisibleNoodle(noodle, characters),
      };
    },
  };
}
