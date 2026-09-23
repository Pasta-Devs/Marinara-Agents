import type { SlpAccount, SlpIdentityDisclosure } from "../../../../../shared/src/slp/slp-social.types.js";
import { slpIsAdmissionFailure } from "../../base/host/slp-admission.js";
import type { DB } from "../../../db/connection.js";
import { logger, logDebugOverride } from "../../../lib/logger.js";
import { newId } from "../../../utils/id-generator.js";
import { createSlurpStorage } from "../../data/slp-storage.js";
import { type SlurpSettings } from "../../modules/settings/slp-settings.js";
import { SLURP_ENERGY_COST } from "../../modules/creators/slp-creator-state.js";
import { getErrorMessage } from "../../modules/creators/slp-public-support.js";
import { NOODLER_MEDIA_PREFIX, slpCreatorPostMediaUrl } from "../../base/media/slp-media.js";
import { resolveImageConnectionFallback } from "../../../services/generation/media-connection-fallback.js";
import { generateImage, stageImageToDisk, type StagedGalleryImage } from "../../../services/image/image-generation.js";
import { generateSlurpImageWithHost, stageSlurpImageWithHost } from "../../base/host/slp-generation-integrations.js";
import { resolveConnectionImageDefaults } from "../../../services/image/image-generation-defaults.js";
import { compileImagePrompt, resolveImageStyleGuidanceText } from "../../../services/image/image-prompt-compiler.js";
import { resolveImagePromptReviewSize } from "../../../services/image/image-prompt-review.js";
import type { SlurpVisualBrief } from "../../base/media/slp-visual-brief.js";
import { slurpVisualBriefPromptViolatesPolicy } from "../../base/media/slp-visual-brief.js";
import { loadImageGenerationUserSettings } from "../../../services/image/image-generation-settings.js";
import { resolveIllustratorCharacterReferences } from "../../../services/image/illustrator-references.js";
import { createCharactersStorage } from "../../../services/storage/characters.storage.js";
import { createConnectionsStorage } from "../../../services/storage/connections.storage.js";
import { createPromptOverridesStorage } from "../../../services/storage/prompt-overrides.storage.js";
import {
  resolveCreatorImageConnectionId,
  resolveCreatorImageStyleProfileId,
} from "../../base/media/slp-image-connections.js";
import { loadPrompt, NOODLE_IMAGE_POST } from "../../../services/prompt-overrides/index.js";
import {
  generateSlpImageWithRetry,
  SLP_CREATOR_POST_IMAGE_RETRY_LIMIT,
  slpCreatorPostImageRetryAttempts,
  slpImageAuthFailure,
} from "../../base/media/slp-image-retry.js";
import { rewriteSlpImagePrompt } from "../../base/media/slp-image-prompt-rewrite.js";
import { slpImageReferencesSupported } from "../../base/media/slp-image-references.js";
import { resolveImageAppearance } from "./slp-appearance-service.js";
import { type ConnectionAdmissionMode } from "../../../services/generation/connection-admission.js";
import { characterAppearanceFromRow, characterSlpImageContextFromRow } from "./slp-public-images-service.js";
import type { SlpImagePromptReviewItem, ReviewedSlpImagePrompt } from "./slp-public-images-service.js";
import { characterNameFromRow } from "../../modules/creators/slp-public-support.js";
import {
  selectSlpImageProviderPrompt,
  ensureSlpImageAppearance,
  slurpImageLook,
  stripAppearanceLabel,
} from "../../base/media/slp-image-prompt.js";
import { slurpImageExtension } from "../../base/media/slp-image-format.js";
import { slurpPromptContext } from "../../base/prompting/slp-prompt-blocks.js";

const REVIEWED_IMAGE_CLAIM_LEASE_MS = 2 * 60 * 1000;
const REVIEWED_IMAGE_CLAIM_RENEW_MS = 30 * 1000;

function imageClaimLeaseUntil() {
  return new Date(Date.now() + REVIEWED_IMAGE_CLAIM_LEASE_MS).toISOString();
}

/**
 * Apply Slurp's chosen style profile. The profile rides on the defaults, where the compiler reads
 * it, and the connection's own prompt prefixes are dropped: a chosen style replaces them. Both the
 * compiler and the provider added those prefixes, so a picked style used to arrive underneath the
 * connection's positive and negative prompts rather than replacing them.
 */
/**
 * The Engine compiler, minus the "auto" profile's style text. That text is an instruction for a
 * prompt-writing model ("Infer a consistent visual style …"); the Engine's own illustrator replaces
 * it with the style its model inferred, but Slurp has no such step when interpretation is off, so it
 * reached the image model as literal words. The rewrite still receives it as style guidance.
 */
function compileSlurpImagePrompt(input: Parameters<typeof compileImagePrompt>[0]) {
  const compiled = compileImagePrompt(input);
  return compiled.profile.baseStyle === "auto"
    ? compileImagePrompt({ ...input, omitProfileStyleText: true })
    : compiled;
}

type SlurpImageDefaults = ReturnType<typeof resolveConnectionImageDefaults>;

function slurpImageDefaultsForStyle(
  defaults: SlurpImageDefaults,
  styleProfileId: string | null | undefined,
): SlurpImageDefaults {
  if (!defaults || !styleProfileId) return defaults;
  const withoutPrefixes = <V extends object | undefined>(value: V): V =>
    value ? { ...value, promptPrefix: "", negativePromptPrefix: "" } : value;
  return {
    ...defaults,
    styleProfileId,
    automatic1111: withoutPrefixes(defaults.automatic1111),
    comfyui: withoutPrefixes(defaults.comfyui),
    novelai: withoutPrefixes(defaults.novelai),
  };
}

type ImageConnection = NonNullable<Awaited<ReturnType<ReturnType<typeof createConnectionsStorage>["getWithKey"]>>>;

/**
 * NoodleR analog of generateSlpPostImage. The deliberate difference from public
 * Noodle: bytes stage into a NoodleR-owned media namespace and never touch the
 * public gallery or character gallery, so subscriber/PPV output can be served only
 * through the access-checked media endpoint. The staged file's on-disk path is persisted in
 * `metadata.noodlerMediaPath`; callers finalize via `stagedMedia` and derive the access-checked
 * URL from the persisted post id.
 */
export async function generateCreatorPostImage(input: {
  account: SlpAccount;
  linkedPublicAccount: SlpAccount | null;
  disclosureMode: SlpIdentityDisclosure;
  postContent: string;
  draftPrompt: string;
  contentPolicy?: string;
  visualBrief?: SlurpVisualBrief;
  settings: Pick<
    SlurpSettings,
    | "imageGenerationPrompt"
    | "imagePromptInterpretation"
    | "imageGenerationUseAvatarReferences"
    | "imageGenerationIncludeDescriptions"
    | "appearanceProfileMode"
    | "enableImageInterpretation"
    | "imageWidth"
    | "imageHeight"
    | "characterImageInstructions"
    | "promptBlocks"
    | "generationConnectionId"
    | "imageStyleProfileId"
  >;
  characters: ReturnType<typeof createCharactersStorage>;
  promptOverrides: ReturnType<typeof createPromptOverridesStorage>;
  imageConnection: ImageConnection;
  db: DB;
  debugMode: boolean;
  previewOnly?: boolean;
  promptOverride?: { prompt: string; negativePrompt?: string };
  /**
   * The override is a draft this system generated earlier, not a prompt a human reviewed. A retry
   * therefore still runs interpretation and still takes its negative prompt from the compiled
   * template, so a retried image is built the same way the first attempt was.
   */
  retryStoredPrompt?: boolean;
  beforeProviderAttempt?: (attempt: number) => Promise<void>;
  onProviderAttemptFailure?: (attempt: number) => Promise<void>;
  admissionMode?: ConnectionAdmissionMode;
  width?: number;
  height?: number;
  compositionGuard?: string;
  negativePromptAdditions?: string;
  suppressCharacterContext?: boolean;
}): Promise<{
  metadata: Record<string, unknown>;
  preview: Omit<SlpImagePromptReviewItem, "id"> | null;
  stagedMedia: StagedGalleryImage | null;
  /** Exact positive prompt sent to the image provider. Kept out of public post metadata. */
  providerPrompt: string;
}> {
  const imageSettings = await loadImageGenerationUserSettings(input.db);
  const redactIdentity = (value: string) => {
    if (input.disclosureMode === "open" || !input.linkedPublicAccount) return value;
    const terms = [
      input.linkedPublicAccount.displayName,
      input.linkedPublicAccount.handle,
      input.linkedPublicAccount.entityId,
    ].filter((term) => term.trim().length > 0);
    return terms.reduce(
      (text, term) => text.replace(new RegExp(term.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "giu"), "[redacted]"),
      value,
    );
  };
  const creatorStyleProfileId = await resolveCreatorImageStyleProfileId(input.db, input.account.id);
  const imageDefaults = slurpImageDefaultsForStyle(
    resolveConnectionImageDefaults(input.imageConnection),
    creatorStyleProfileId ?? input.settings.imageStyleProfileId,
  );
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
    sourceAccount: input.linkedPublicAccount,
    connectionId: input.settings.generationConnectionId,
    mode: input.settings.appearanceProfileMode,
  });
  let characterDescription = stageAppearance;
  let characterImageInstructions = "";
  let characterPersonality = "";
  let referenceImages: string[] | undefined;
  // Open and Hinted creators both keep image references: the same body, tattoos, and rooms can show
  // up while a Hinted creator's source name and handle stay protected.
  // Personas carry personality, appearance, and an avatar exactly like characters do, but this
  // branch used to require kind === "character". A persona-owned Creator therefore got appearance
  // text and nothing else in every mode, so "Open" quietly meant something weaker for a persona
  // than for a character. Both kinds are eligible.
  const referenceSubject =
    !input.suppressCharacterContext && input.linkedPublicAccount ? input.linkedPublicAccount : null;
  const sourceCharacter =
    input.linkedPublicAccount?.kind === "character"
      ? await input.characters.getById(input.linkedPublicAccount.entityId)
      : null;
  const sourcePersona =
    input.linkedPublicAccount?.kind === "persona"
      ? await input.characters.getPersona(input.linkedPublicAccount.entityId)
      : null;
  const sourceAppearance = sourceCharacter
    ? characterAppearanceFromRow(sourceCharacter)
    : sourcePersona?.appearance?.trim() || "";
  // Every mode shows the same body — it is the page. Reducing a concealed creator to a handful of
  // approved tokens made them shapeless without hiding anything linkable, since a build and a hair
  // colour identify nobody.
  if (!stageAppearance && !input.suppressCharacterContext && sourceAppearance) {
    characterDescription = sourceAppearance;
  }
  if (referenceSubject) {
    // A character keeps its image context in a JSON `data` blob; a persona stores the same fields as
    // plain columns and has no Noodle image-instruction extension to opt in with.
    const row = sourceCharacter
      ? {
          id: sourceCharacter.id,
          avatarPath: sourceCharacter.avatarPath ?? null,
          appearance: characterAppearanceFromRow(sourceCharacter),
          name: characterNameFromRow(sourceCharacter),
          ...characterSlpImageContextFromRow(
            sourceCharacter,
            input.settings.characterImageInstructions[sourceCharacter.id],
          ),
        }
      : sourcePersona
        ? {
            id: sourcePersona.id,
            avatarPath: sourcePersona.avatarPath ?? null,
            appearance: sourcePersona.appearance?.trim() ?? "",
            name: sourcePersona.name,
            personality: sourcePersona.personality?.trim() ?? "",
            imageInstructions: "",
          }
        : null;
    if (row) {
      characterPersonality = row.personality;
      characterImageInstructions = row.imageInstructions;

      if (input.settings.imageGenerationIncludeDescriptions || input.settings.imageGenerationUseAvatarReferences) {
        const referenceResolution = await resolveIllustratorCharacterReferences({
          charactersStore: input.characters,
          chatCharacters: [
            {
              id: row.id,
              name: input.account.displayName || row.name,
              avatarPath: row.avatarPath,
              appearance: row.appearance,
            },
          ],
          persona: null,
          requestedNames: [input.account.displayName],
          promptText: [input.account.displayName, input.postContent, input.draftPrompt].join("\n"),
          maxReferences: 6,
        });
        if (
          !stageAppearance &&
          input.settings.imageGenerationIncludeDescriptions &&
          referenceResolution.appearanceBlock
        ) {
          characterDescription = referenceResolution.appearanceBlock;
        }
        if (
          input.settings.imageGenerationUseAvatarReferences &&
          allowAvatarReferences &&
          referenceResolution.referenceImages.length > 0
        ) {
          referenceImages = Array.from(new Set(referenceResolution.referenceImages)).slice(0, 6);
        }
      }
    }
  }

  // Card appearance carries clothes and costumes; the scene decides what is worn in this picture.
  if (!stageAppearance) characterDescription = slurpImageLook(characterDescription);

  const postPrompt = await loadPrompt(input.promptOverrides, NOODLE_IMAGE_POST, {
    authorName: input.account.displayName,
    postContent: input.postContent,
    visualBrief: input.visualBrief,
    // The look leads, so the subject is the first thing the image model reads; the default
    // template put it after the scene, and the picture began with an action nobody was doing.
    draftPrompt: [stripAppearanceLabel(characterDescription), input.draftPrompt].filter(Boolean).join("\n"),
    userInstructions: input.settings.imageGenerationPrompt,
    characterDescription: "",
    characterImageInstructions,
    // Empty on purpose. The default template concatenates this straight into the prompt the image
    // provider receives, and "arrogant, impatient with staged sentimentality" is not a visual
    // fact — it is noise a diffusion model still tries to draw. The rewrite already treats
    // personality as private context that must never appear in a visual prompt; the template that
    // produces the fallback prompt should not be the one place that disagrees. A custom template
    // that genuinely wants it can still read the character card.
    characterPersonality: "",
  });
  const compiledPrompt = compileSlurpImagePrompt({
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
    ? compileSlurpImagePrompt({
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
    ? compileSlurpImagePrompt({
        kind: "illustration",
        prompt: draftPrompt,
        styleProfiles: imageSettings.styleProfiles,
        imageDefaults,
      })
    : null;
  // A retry resends our own stored draft as the "override". That is the same string the template
  // was just rendered from, so honouring it here would rebuild the retry from the bare draft and
  // drop appearance and image habits — the exact context loss this flag exists to stop. Only a
  // human-reviewed override displaces the template.
  const reviewedOverride = input.retryStoredPrompt ? null : compiledOverride;
  // When no rewrite survives the provider gets the rendered template, not the bare draft: it is the
  // only document carrying appearance notes and the character's image habits, so dropping it made
  // fallback pictures look like someone else. selectSlpImageProviderPrompt caps it on a word
  // boundary, which is what the uncapped stack of appearance, personality and habits needed.
  const rawProviderPrompt = redactIdentity(reviewedOverride?.prompt || compiledPrompt.prompt);
  // The rewriter gets the visual intent only. It receives appearance, personality, and image habits
  // through the labelled `characterContext` block below, so handing it the rendered template too
  // sent the same three values twice and asked it to "preserve the visual facts" in a personality
  // trait list.
  const rawRewriteInput = redactIdentity(reviewedOverride?.prompt || compiledDraft?.prompt || draftPrompt);
  // Custom prompt templates may omit `userInstructions`, so restore configured instructions only
  // when the rendered prompt does not already contain them.
  const configuredImageInstructions = input.settings.imageGenerationPrompt.trim();
  const connectionImageInstructions = input.imageConnection.imagePromptInstructions?.trim() ?? "";
  const imagePromptInstructions = [
    configuredImageInstructions && !postPrompt.includes(configuredImageInstructions) ? configuredImageInstructions : "",
    connectionImageInstructions,
  ]
    .filter(Boolean)
    .join("\n");
  // Redacted like every other value reaching a language model. The appearance block is formatted as
  // "${name}'s Appearance: ..." from the linked source account, so an unredacted context block sent
  // the source's real name to the interpretation model in the same call whose prompt beside it had
  // that name carefully replaced.
  const characterContext = redactIdentity(
    [
      characterDescription ? `Appearance:\n${characterDescription}` : "",
      characterPersonality ? `Personality:\n${characterPersonality}` : "",
      characterImageInstructions ? `Character image preferences:\n${characterImageInstructions}` : "",
      input.contentPolicy ? `Creator content policy:\n${input.contentPolicy}` : "",
    ]
      .filter(Boolean)
      .join("\n\n"),
  );
  // A stored draft we generated ourselves is not a reviewed decision, so a retry still runs
  // interpretation. Only a prompt a human actually approved is sent through untouched.
  const skipInterpretation = Boolean(input.promptOverride) && !input.retryStoredPrompt;
  const rewriteAttempted = Boolean(
    (imagePromptInstructions || characterContext || styleGuidance) &&
    input.settings.enableImageInterpretation !== false &&
    !skipInterpretation,
  );
  const rewrittenPrompt = rewriteAttempted
    ? await rewriteSlpImagePrompt({
        db: input.db,
        prompt: rawRewriteInput,
        postContent: input.postContent,
        interpretationInstruction: input.settings.imagePromptInterpretation,
        instructions: redactIdentity(imagePromptInstructions),
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
    ? compileSlurpImagePrompt({
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
  const finalPromptBase = redactIdentity(
    selectSlpImageProviderPrompt({
      rewrittenPrompt: acceptedRewrittenPrompt,
      // The rendered template already holds the draft, the look, and the image habits. A prefix of
      // the full card appearance plus the typed brief used to go first and push the scene past the
      // length cap, so the image model received an appearance paragraph and no picture.
      rawPrompt: rawProviderPrompt,
      rewriteAttempted,
      onFallback: (reason) =>
        logger.warn("[slurp] Image prompt rewrite unusable (%s); sending the capped draft", reason),
      // Art style and the character's image habits are meant to reach the provider, so a rewrite
      // that applies them is doing its job. Personality never belongs in a visual prompt at any
      // length; the instruction fields are guidance and only leak as a copied block.
      privateContext: [characterPersonality],
      guidanceContext: [configuredImageInstructions, connectionImageInstructions],
    }),
  );
  const finalPrompt = [
    ensureSlpImageAppearance(finalPromptBase, redactIdentity(stageAppearance)),
    input.compositionGuard,
  ]
    .filter(Boolean)
    .join("\n\n");
  // A reviewer who cleared the negative prompt still gets the style profile's own negatives back,
  // for the same reason the positive prompt is recompiled above.
  const baseNegativePrompt =
    input.promptOverride && !input.retryStoredPrompt
      ? redactIdentity(input.promptOverride.negativePrompt?.trim() || "") ||
        reviewedOverride?.negativePrompt ||
        undefined
      : compiledPrompt.negativePrompt || undefined;
  // Deduplicated: the style profile and the level both add "text, watermark" and the like.
  const finalNegativePrompt =
    [
      ...new Set(
        [baseNegativePrompt, input.negativePromptAdditions]
          .filter(Boolean)
          .join(",")
          .split(",")
          .map((term) => term.trim())
          .filter(Boolean),
      ),
    ].join(", ") || undefined;
  const outputWidth = input.width ?? input.settings.imageWidth;
  const outputHeight = input.height ?? input.settings.imageHeight;
  logDebugOverride(
    input.debugMode,
    "[debug/slurp/image] final image prompt for %s:\n%s",
    input.account.displayName,
    finalPrompt,
  );

  if (input.previewOnly) {
    const previewSize = resolveImagePromptReviewSize({
      connection: input.imageConnection,
      prompt: finalPrompt,
      width: outputWidth,
      height: outputHeight,
      imageDefaults,
    });
    return {
      metadata: {},
      preview: {
        kind: "illustration",
        title: `${input.account.displayName} Slurp image`,
        prompt: finalPrompt,
        negativePrompt: finalNegativePrompt,
        width: previewSize.width,
        height: previewSize.height,
      },
      stagedMedia: null,
      providerPrompt: finalPrompt,
    };
  }

  const image = await generateSlpImageWithRetry(
    async (attempt) => {
      await input.beforeProviderAttempt?.(attempt);
      return (
        generateSlurpImageWithHost({
          source: imageSource,
          baseUrl: imageBaseUrl,
          apiKey: input.imageConnection.apiKey || "",
          serviceHint: imageServiceHint,
          request: {
            prompt: finalPrompt,
            negativePrompt: finalNegativePrompt,
            model: imageModel,
            width: outputWidth,
            height: outputHeight,
            imageEndpointId: input.imageConnection.imageEndpointId || undefined,
            comfyWorkflow: input.imageConnection.comfyuiWorkflow || undefined,
            imageDefaults,
            referenceImages,
            debugMode: input.debugMode,
            admissionMode: input.admissionMode,
            fallback: imageFallback,
          },
        }) ??
        generateImage(imageSource, imageBaseUrl, input.imageConnection.apiKey || "", imageServiceHint, {
          prompt: finalPrompt,
          negativePrompt: finalNegativePrompt,
          model: imageModel,
          width: outputWidth,
          height: outputHeight,
          imageEndpointId: input.imageConnection.imageEndpointId || undefined,
          comfyWorkflow: input.imageConnection.comfyuiWorkflow || undefined,
          imageDefaults,
          referenceImages,
          debugMode: input.debugMode,
          admissionMode: input.admissionMode,
          fallback: imageFallback,
        })
      );
    },
    async (error, attempt, maxAttempts) => {
      await input.onProviderAttemptFailure?.(attempt);
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
  // Only a picture that exists costs anything. The preview path returns above, and a failed
  // attempt threw before here, so a Creator is never charged for work that produced nothing.
  try {
    await createSlurpStorage(input.db).adjustCreatorState(input.account.id, { energy: -SLURP_ENERGY_COST.image });
  } catch (error) {
    logger.warn(error, "[slurp] Could not charge image energy for %s", input.account.id);
  }
  const file =
    stageSlurpImageWithHost(
      `${NOODLER_MEDIA_PREFIX}${input.account.id}`,
      image.base64,
      slurpImageExtension(image.base64, image.ext),
    ) ??
    stageImageToDisk(
      `${NOODLER_MEDIA_PREFIX}${input.account.id}`,
      image.base64,
      slurpImageExtension(image.base64, image.ext),
    );
  return {
    metadata: {
      imageGenerated: true,
      imageProvider: provider,
      imageModel: imageModel || "unknown",
      imageStyleProfileId: compiledPrompt.profile.id,
      noodlerMediaPath: file.filePath,
    },
    preview: null,
    stagedMedia: file,
    providerPrompt: finalPrompt,
  };
}

export function createCreatorSlpImagesService(db: DB) {
  const noodle = createSlurpStorage(db);
  const characters = createCharactersStorage(db);
  const connections = createConnectionsStorage(db);
  const promptOverrides = createPromptOverridesStorage(db);

  const generateReviewedImages = async (input: {
    prompts: ReviewedSlpImagePrompt[];
    debugMode: boolean;
    /** Set when the prompts are stored drafts being retried rather than prompts a human approved. */
    retryStoredPrompt?: boolean;
    admissionMode?: ConnectionAdmissionMode;
  }): Promise<
    { ok: true; finalized: number; deferred: number } | { ok: false; error: "missing_connection"; message: string }
  > => {
    const settings = await noodle.getSettings();
    let finalized = 0;
    // Branches where no provider call was made: a claim we could not take, a missing connection,
    // a busy connection. The caller must not read these as a provider failure, or a healthy
    // system backs its own polling off while the user is simply using the connection.
    let deferred = 0;
    for (const promptOverride of input.prompts) {
      const claimToken = newId();
      // Reuses the shared post-image claim; the NoodleR-account check below rejects any
      // non-NoodleR post so a public post id can never be finalized through this route.
      const claimed = await noodle.claimPostImage(promptOverride.id, claimToken, imageClaimLeaseUntil());
      if (!claimed) {
        deferred += 1;
        continue;
      }
      const account = await noodle.getNoodlerAccountById(claimed.authorAccountId);
      if (!account) {
        await noodle.releasePostImageClaim(claimed.id, claimToken);
        continue;
      }
      const imageConnectionId = await resolveCreatorImageConnectionId(db, account.id);
      // Fall back to the default image connection when a creator's mapped
      // override was deleted (getWithKey returns null), instead of silently
      // disabling image generation for that creator.
      const imageConnection =
        (imageConnectionId ? await connections.getWithKey(imageConnectionId) : null) ??
        (await connections.getDefaultForImageGeneration());
      if (!imageConnection) {
        await noodle.releasePostImageClaim(claimed.id, claimToken);
        deferred += 1;
        continue;
      }
      if (!claimed.imagePrompt) {
        await noodle.releasePostImageClaim(claimed.id, claimToken);
        continue;
      }
      const disclosureMode = account.settings.privacy.identityDisclosure ?? "open";
      const linkedPublicAccount = await noodle.resolveAccountSource(account);

      let claimOwned = true;
      const renewClaim = async () => {
        if (!claimOwned) return;
        try {
          claimOwned = await noodle.renewPostImageClaim(claimed.id, claimToken, imageClaimLeaseUntil());
        } catch (error) {
          claimOwned = false;
          logger.warn(error, "[slurp] Failed to renew reviewed image claim for post %s", claimed.id);
        }
      };
      const renewalTimer = setInterval(() => void renewClaim(), REVIEWED_IMAGE_CLAIM_RENEW_MS);
      renewalTimer.unref?.();

      let image: Awaited<ReturnType<typeof generateCreatorPostImage>>;
      try {
        image = await generateCreatorPostImage({
          account,
          linkedPublicAccount,
          disclosureMode,
          postContent: claimed.content,
          draftPrompt: claimed.imagePrompt,
          settings,
          characters,
          promptOverrides,
          imageConnection,
          db,
          debugMode: input.debugMode,
          promptOverride,
          retryStoredPrompt: input.retryStoredPrompt,
          admissionMode: input.admissionMode,
        });
      } catch (error) {
        clearInterval(renewalTimer);
        // A busy connection sent nothing, so it is not an attempt: hand the post back
        // untouched and let a later pass draw it.
        if (slpIsAdmissionFailure(error)) {
          await noodle.releasePostImageClaim(claimed.id, claimToken);
          deferred += 1;
          continue;
        }
        logger.warn(error, "[slurp] Failed to generate reviewed image for %s", account.displayName);
        await renewClaim();
        if (claimOwned) {
          const attempts = slpImageAuthFailure(error)
            ? SLP_CREATOR_POST_IMAGE_RETRY_LIMIT
            : slpCreatorPostImageRetryAttempts(claimed.metadata) + 1;
          await noodle.finalizePostImageClaim(claimed.id, claimToken, {
            imageUrl: null,
            // The prompt survives a provider failure *and* a spent budget. Spending the budget
            // used to delete it, which left the post with no record of what the picture was meant
            // to be and nothing for the user to redraw from — exactly when they most want it,
            // after three failures. The automatic pass is already stopped by the attempt counter
            // in listNoodlerPostsAwaitingImageRetry, so nulling the prompt only destroyed data.
            metadata: {
              imageGenerationFailed: true,
              imageRetryAttempts: attempts,
              imageGenerationError: getErrorMessage(error).slice(0, 500),
            },
          });
        }
        continue;
      }

      clearInterval(renewalTimer);
      await renewClaim();
      if (!claimOwned) {
        image.stagedMedia?.compensate();
        continue;
      }

      // Re-read the profile before finalizing: if disclosure or the linked public identity
      // changed during the (potentially long) provider call, the staged image was built from a
      // now-stale appearance policy, so discard it and finalize as failed rather than publish it.
      const fresh = await noodle.getNoodlerAccountById(claimed.authorAccountId);
      const freshDisclosure = fresh?.settings.privacy.identityDisclosure ?? "open";
      if (
        !fresh ||
        freshDisclosure !== disclosureMode ||
        fresh.sourceKind !== account.sourceKind ||
        fresh.sourceEntityId !== account.sourceEntityId
      ) {
        image.stagedMedia?.compensate();
        await noodle.finalizePostImageClaim(claimed.id, claimToken, {
          imageUrl: null,
          imagePrompt: null,
          metadata: {
            imageGenerationFailed: true,
            imageGenerationError: "Stage profile identity changed during image generation.",
          },
        });
        continue;
      }
      try {
        image.stagedMedia?.promote();
        const ok = await noodle.finalizePostImageClaim(claimed.id, claimToken, {
          imageUrl: slpCreatorPostMediaUrl(claimed.id),
          metadata: image.metadata,
        });
        if (!ok) {
          image.stagedMedia?.compensate();
          continue;
        }
        finalized += 1;
      } catch (error) {
        image.stagedMedia?.compensate();
        try {
          await noodle.releasePostImageClaim(claimed.id, claimToken);
        } catch (releaseError) {
          logger.warn(releaseError, "[slurp] Failed to release reviewed image claim for post %s", claimed.id);
        }
        throw error;
      }
    }
    return { ok: true, finalized, deferred };
  };

  return {
    generateReviewedImages,

    /**
     * Redraw one post that published without its picture. Runs on the reserve poll, so it takes
     * a single post per pass and yields the image connection to anything the user started.
     */
    async retryNextFailedPostImage(): Promise<"idle" | "retried" | "failed"> {
      const [post] = await noodle.listNoodlerPostsAwaitingImageRetry(1);
      if (!post?.imagePrompt) return "idle";
      const result = await generateReviewedImages({
        prompts: [{ id: post.id, prompt: post.imagePrompt }],
        debugMode: false,
        // The stored prompt is our own draft from the failed attempt, not a reviewed one.
        retryStoredPrompt: true,
        admissionMode: { kind: "background" },
      });
      // A missing image connection is a deferral, not a provider failure: nothing was sent, and
      // the poll must keep its normal cadence for the posting work that does not need images.
      if (!result.ok) return "idle";
      if (result.finalized > 0) return "retried";
      return result.deferred > 0 ? "idle" : "failed";
    },
  };
}
