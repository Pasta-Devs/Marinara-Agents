import type { SlpAccount, SlpIdentityDisclosure } from "../../../../../shared/src/slp/slp-social.types.js";
import type { DB } from "../../../db/connection.js";
import { logger, logDebugOverride } from "../../../lib/logger.js";
import { createSlurpStorage } from "../../data/slp-storage.js";
import { type SlurpSettings } from "../../modules/settings/slp-settings.js";
import { SLURP_ENERGY_COST } from "../../modules/creators/slp-creator-state.js";
import { NOODLER_MEDIA_PREFIX, slpCompactGeneratedImage } from "../../base/media/slp-media.js";
import { resolveImageConnectionFallback } from "../../../services/generation/media-connection-fallback.js";
import { generateImage, stageImageToDisk, type StagedGalleryImage } from "../../../services/image/image-generation.js";
import { generateSlurpImageWithHost, stageSlurpImageWithHost } from "../../base/host/slp-generation-integrations.js";
import {
  resolveConnectionImageDefaults,
  resolveImageGenerationService,
} from "../../../services/image/image-generation-defaults.js";
import { compileImagePrompt, resolveImageStyleGuidanceText } from "../../../services/image/image-prompt-compiler.js";
import { resolveImagePromptReviewSize } from "../../../services/image/image-prompt-review.js";
import type { SlurpVisualBrief } from "../../base/media/slp-visual-brief.js";
import type { SlpDeepDetailsImageRun } from "../../../../../shared/src/slp/slp-deep-details.js";
import { slurpVisualBriefPromptViolatesPolicy } from "../../base/media/slp-visual-brief.js";
import { loadImageGenerationUserSettings } from "../../../services/image/image-generation-settings.js";
import { resolveIllustratorCharacterReferences } from "../../../services/image/illustrator-references.js";
import { createCharactersStorage } from "../../../services/storage/characters.storage.js";
import { createConnectionsStorage } from "../../../services/storage/connections.storage.js";
import { createPromptOverridesStorage } from "../../../services/storage/prompt-overrides.storage.js";
import {
  getCreatorImageConnections,
  resolveCreatorImageStyleProfileId,
} from "../../base/media/slp-image-connections.js";
import { loadPrompt, NOODLE_IMAGE_POST } from "../../../services/prompt-overrides/index.js";
import { generateSlpImageWithRetry } from "../../base/media/slp-image-retry.js";
import { rewriteSlpImagePrompt } from "../../base/media/slp-image-prompt-rewrite.js";
import { slpImageReferencesSupported } from "../../base/media/slp-image-references.js";
import { resolveImageAppearance } from "./slp-appearance-service.js";
import { resolveSlurpImageCompanions, slurpCompanionReferenceImages } from "./slp-image-companions.js";
import { newSlurpImageRun, recordSlurpImageRun, slurpImageRunStyle, trackSlurpImageAttempt } from "./slp-image-run.js";
import { type ConnectionAdmissionMode } from "../../../services/generation/connection-admission.js";
import { characterAppearanceFromRow, characterSlpImageContextFromRow } from "./slp-public-images-service.js";
import type { SlpImagePromptReviewItem } from "./slp-public-images-service.js";
import { characterNameFromRow } from "../../modules/creators/slp-public-support.js";
import { parseRecord } from "../../modules/records/slp-storage-model.js";
import { slpResolveCardMacros } from "../../base/prompting/slp-prompt-safety.js";
import {
  selectSlpImageProviderPrompt,
  slurpApplyImageLook,
  slurpApplyImageSubject,
  slurpImageCompanionBlocks,
  slurpImageNamesPerson,
  slurpWithoutImageSubject,
  slurpImageSubjectName,
  slurpSplitStyleLead,
  slurpImageIdentityContext,
  slurpLookForWriter,
  slurpArtStyle,
  slurpStyledImagePrompt,
  slurpImageLook,
  slurpPromptFamily,
  slurpWithoutCameraDevice,
  stripAppearanceLabel,
} from "../../base/media/slp-image-prompt.js";
import { slurpViewpointForFamily, slurpViewpointIn } from "../../modules/feed/slp-camera-source.js";
import {
  slurpImageNegativePrompt,
  slurpImageNegativeTerms,
  slurpImageNegativeWithCompany,
} from "../../modules/feed/slp-image-brief.js";
import { slurpPromptContext } from "../../base/prompting/slp-prompt-blocks.js";

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

type CreatorPostImageInput = {
  account: SlpAccount;
  linkedPublicAccount: SlpAccount | null;
  /**
   * Other Creators this post is about (its beat's `castIds`, kept on the post as `slurpPictureCast`).
   * The prompt writer gets their looks and puts them in the picture only when the post calls for
   * it; a reference picture goes along only for somebody the final prompt names.
   */
  companionIds?: unknown;
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
    | "imageAppearanceMode"
    | "appearanceProfileMode"
    | "enableImageInterpretation"
    | "imageWidth"
    | "imageHeight"
    | "storyImageWidth"
    | "storyImageHeight"
    | "characterImageInstructions"
    | "creatorImageNames"
    | "creatorImagePrefixes"
    | "promptBlocks"
    | "generationConnectionId"
    | "imagePromptConnectionId"
    | "modelBudget"
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
  /** The player asked for this picture: its prompt rewrite never spends the world's AI budget (0.3.6). */
  playerAsked?: boolean;
  width?: number;
  height?: number;
  /** A Story picture: drawn at the Story size unless the caller names its own size. */
  story?: boolean;
  compositionGuard?: string;
  /**
   * This path's own negative terms. Absent, every Creator picture gets the shared ones (no phone,
   * no second copy of the Creator) plus its visual brief's level; an empty string means none.
   */
  negativePromptAdditions?: string;
  /** False when the picture is not the Creator's work, so the Creator spends no energy on it. */
  chargeEnergy?: boolean;
  suppressCharacterContext?: boolean;
  suppressStageAppearance?: boolean;
  suppressCreatorDetails?: boolean;
  /**
   * Receives this run's Deep details record once it ends, successful or not. Only callers that own
   * a Deep details record pass it; the run is built either way so the pipeline has one shape.
   */
  onImageRun?: { trigger: SlpDeepDetailsImageRun["trigger"]; record: (run: SlpDeepDetailsImageRun) => Promise<void> };
};

type CreatorPostImageResult = {
  metadata: Record<string, unknown>;
  preview: Omit<SlpImagePromptReviewItem, "id"> | null;
  stagedMedia: StagedGalleryImage | null;
  /** Exact positive prompt sent to the image provider. Also stored as `metadata.imageProviderPrompt`. */
  providerPrompt: string;
};

/**
 * NoodleR analog of generateSlpPostImage. The deliberate difference from public
 * Noodle: bytes stage into a NoodleR-owned media namespace and never touch the
 * public gallery or character gallery, so subscriber/PPV output can be served only
 * through the access-checked media endpoint. The staged file's on-disk path is persisted in
 * `metadata.noodlerMediaPath`; callers finalize via `stagedMedia` and derive the access-checked
 * URL from the persisted post id.
 */
export async function generateCreatorPostImage(input: CreatorPostImageInput): Promise<CreatorPostImageResult> {
  const run = newSlurpImageRun(input);
  return recordSlurpImageRun(run, input.onImageRun, () => generateCreatorPostImageRun(input, run));
}

async function generateCreatorPostImageRun(
  input: CreatorPostImageInput,
  run: SlpDeepDetailsImageRun,
): Promise<CreatorPostImageResult> {
  const imageSettings = await loadImageGenerationUserSettings(input.db);
  const companions = await resolveSlurpImageCompanions(input.db, input.companionIds, input.account.id);
  // A companion whose identity is not open keeps its source hidden too.
  const hiddenSources = [
    input.disclosureMode === "open" ? null : input.linkedPublicAccount,
    ...companions.map((companion) =>
      (companion.account.settings.privacy.identityDisclosure ?? "open") === "open" ? null : companion.source,
    ),
  ].filter((source): source is SlpAccount => Boolean(source));
  const redactIdentity = (value: string) => {
    if (hiddenSources.length === 0) return value;
    const terms = hiddenSources
      .flatMap((source) => [source.displayName, source.handle, source.entityId])
      .filter((term) => term.trim().length > 0);
    return terms.reduce(
      (text, term) => text.replace(new RegExp(term.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "giu"), "[redacted]"),
      value,
    );
  };
  const creatorStyleProfileId = await resolveCreatorImageStyleProfileId(input.db, input.account.id);
  const imageConnectionChoice = await getCreatorImageConnections(input.db);
  run.connection.chosenBy =
    imageConnectionChoice.creatorConnectionIds[input.account.id] === input.imageConnection.id
      ? "creator"
      : imageConnectionChoice.defaultConnectionId === input.imageConnection.id
        ? "slurp"
        : "engine";
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
  run.connection.hasFallback = Boolean(imageFallback);
  run.connection.fallback = imageFallback
    ? { id: imageFallback.connectionId, name: imageFallback.connectionName, model: imageFallback.model || null }
    : null;

  // The Creator's own appearance, written on the Creator rather than borrowed from a card.
  //
  // It is applied by default, unlike the block below it. Artwork requests can turn it off.
  // `imageGenerationIncludeDescriptions` decides whether to pull the *source character's* description; it was never
  // meant to decide whether the picture knows who the Creator is. With it off, a Creator with no
  // linked source, or a source card with an empty Appearance field, the image model received a
  // scene containing nobody and invented somebody — a different somebody every post.
  const includeAppearance = input.settings.imageGenerationIncludeDescriptions;
  const stageAppearance =
    input.suppressStageAppearance || !includeAppearance
      ? ""
      : input.suppressCharacterContext
        ? input.account.settings.stage?.appearance?.trim() || ""
        : await resolveImageAppearance({
            db: input.db,
            account: input.account,
            sourceAccount: input.linkedPublicAccount,
            connectionId: input.settings.generationConnectionId,
            mode: input.settings.appearanceProfileMode,
            foreground: input.admissionMode?.kind === "foreground",
          });
  let characterDescription = stageAppearance;
  let appearanceSource: SlpDeepDetailsImageRun["appearance"]["source"] = stageAppearance ? "stage" : "none";
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
  if (includeAppearance && !stageAppearance && !input.suppressCharacterContext && sourceAppearance) {
    characterDescription = sourceAppearance;
    appearanceSource = "source-card";
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
          appearanceSource = "reference";
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
  // A character the image model knows is drawn from their name (0.3.5, player report). The card's
  // own name, on by default per Creator, only for an open identity; an OC's switch can be turned off.
  const sourceName = sourceCharacter ? characterNameFromRow(sourceCharacter) : sourcePersona?.name?.trim() || "";
  const subjectName =
    !input.suppressCreatorDetails &&
    !input.suppressCharacterContext &&
    input.disclosureMode === "open" &&
    input.settings.creatorImageNames?.[input.account.id] !== false &&
    sourceName &&
    sourceName !== "Character"
      ? slurpImageSubjectName(input.visualBrief?.knownAs, [sourceName, input.account.displayName])
      : "";
  const sourceCard = sourceCharacter ? parseRecord(sourceCharacter.data) : null;
  const identityContext = subjectName
    ? slurpImageIdentityContext(
        subjectName,
        typeof sourceCard?.description === "string" ? slpResolveCardMacros(sourceCard.description, subjectName) : "",
      )
    : "";
  // The people the post is about: their look for the writer, their card for a reference picture.
  const companionCards = await Promise.all(
    companions.map(async ({ account, source }) => {
      const character = source?.kind === "character" ? await input.characters.getById(source.entityId) : null;
      const persona = source?.kind === "persona" ? await input.characters.getPersona(source.entityId) : null;
      const appearance = character ? characterAppearanceFromRow(character) : persona?.appearance?.trim() || "";
      const row = character ?? persona;
      return {
        name: account.displayName,
        // Their own "The image model knows this character" switch, for an open identity only.
        known:
          (account.settings.privacy.identityDisclosure ?? "open") === "open" &&
          input.settings.creatorImageNames?.[account.id] !== false
            ? (character ? characterNameFromRow(character) : persona?.name?.trim()) || ""
            : "",
        // Descriptions off keeps every look out of the prompt, the companions' too; references stay.
        look: includeAppearance
          ? account.settings.stage?.appearance?.trim() || (appearance ? slurpImageLook(appearance) : "")
          : "",
        card: row ? { id: row.id, avatarPath: row.avatarPath ?? null, appearance } : null,
      };
    }),
  );
  const companionContext = companionCards.some((companion) => companion.look)
    ? [
        "Other people this post is about. Put one in the picture only when the post or the scene calls for them; otherwise leave them out. Whoever is in it looks like this:",
        ...companionCards
          .filter((companion) => companion.look)
          .map((companion) => `${companion.name}: ${companion.look}`),
      ].join("\n")
    : "";
  run.appearance = { source: appearanceSource, text: redactIdentity(characterDescription) };
  run.referenceImages = referenceImages?.length ?? 0;

  const postPrompt = await loadPrompt(input.promptOverrides, NOODLE_IMAGE_POST, {
    authorName: input.suppressCreatorDetails ? "" : input.account.displayName,
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
  const compileStyled = (prompt: string) =>
    compileSlurpImagePrompt({
      kind: "illustration",
      prompt,
      styleProfiles: imageSettings.styleProfiles,
      imageDefaults,
    });
  const compiledPrompt = compileStyled(postPrompt);
  const styleGuidance = resolveImageStyleGuidanceText(imageSettings.styleProfiles, compiledPrompt.profile.id);
  run.styleProfile = slurpImageRunStyle(
    compiledPrompt.profile,
    creatorStyleProfileId ? "creator" : input.settings.imageStyleProfileId ? "slurp" : "none",
  );
  run.templatePrompt = redactIdentity(postPrompt);
  run.styledPrompt = redactIdentity(compiledPrompt.prompt);
  // A reviewed prompt replaces the generated wording, but the style profile is composition rather
  // than wording, so recompile the approved text instead of sending it bare. The compiler omits
  // style values the prompt already carries, so an approved prompt is never double-styled.
  const overridePrompt = input.promptOverride?.prompt.trim();
  const compiledOverride = overridePrompt ? compileStyled(overridePrompt) : null;
  // The rewrite is skipped when interpretation is off and discarded when it leaks, and both land on
  // this fallback. Sending the bare draft there dropped the style profile exactly like the review
  // path did, so the draft is compiled too.
  const draftPrompt = input.draftPrompt.trim();
  const compiledDraft = draftPrompt ? compileStyled(draftPrompt) : null;
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
  const rawRewriteInput = redactIdentity(reviewedOverride?.prompt || compiledDraft?.prompt || draftPrompt);
  // The rewriter gets the bare draft: context and style arrive labelled below and the style is compiled
  // onto its output, so a styled draft came back reworded and the picture carried its tags twice.
  const rewriteInput = redactIdentity(draftPrompt) || rawRewriteInput;
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
  const lookMode = input.settings.imageAppearanceMode ?? "writer";
  const characterContext = redactIdentity(
    [
      identityContext,
      characterDescription && slurpLookForWriter(lookMode) ? `Appearance:\n${characterDescription}` : "",
      characterPersonality ? `Personality:\n${characterPersonality}` : "",
      characterImageInstructions ? `Character image preferences:\n${characterImageInstructions}` : "",
      companionContext,
      input.contentPolicy ? `Creator content policy:\n${input.contentPolicy}` : "",
    ]
      .filter(Boolean)
      .join("\n\n"),
  );
  // A stored draft we generated ourselves is not a reviewed decision, so a retry still runs
  // interpretation. Only a prompt a human actually approved is sent through untouched.
  const skipInterpretation = Boolean(input.promptOverride) && !input.retryStoredPrompt;
  let rewriteAttempted = Boolean(
    (imagePromptInstructions || characterContext || styleGuidance) &&
    input.settings.enableImageInterpretation !== false &&
    !skipInterpretation,
  );
  // Slurp's own viewpoint phrase for this picture (PERSPECTIVE-RESEARCH.md): the rewrite keeps it, the
  // device filter never cuts it, and the image model gets it in its own words below.
  const viewpoint = slurpViewpointIn(input.visualBrief?.camera ?? "") ?? slurpViewpointIn(input.draftPrompt);
  let rewriteFailure: string | null = null;
  const rewrittenPrompt = rewriteAttempted
    ? await rewriteSlpImagePrompt({
        db: input.db,
        prompt: rewriteInput,
        postContent: input.postContent,
        interpretationInstruction: input.settings.imagePromptInterpretation,
        instructions: redactIdentity(imagePromptInstructions),
        characterContext,
        styleGuidance,
        promptBlocks: slurpPromptContext(input.settings).blocks,
        connectionId: input.settings.imagePromptConnectionId || input.settings.generationConnectionId,
        viewpoint: viewpoint?.phrase,
        budget: input.playerAsked ? undefined : input.settings.modelBudget,
        onBudgetSkip: () => {
          rewriteAttempted = false;
        },
        onFailure: (reason) => {
          rewriteFailure = reason;
        },
        onRequest: ({ messages, ...model }) => {
          run.rewrite.model = model;
          run.rewrite.messages = messages;
        },
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
  const known = [rawRewriteInput, characterDescription].join("\n");
  const rewriteViolatesPolicy = slurpVisualBriefPromptViolatesPolicy(input.visualBrief, rewrittenPrompt, known);
  const acceptedRewrittenPrompt = rewriteViolatesPolicy ? null : compiledRewrittenPrompt?.prompt || rewrittenPrompt;
  let usedRewrite = Boolean(acceptedRewrittenPrompt);
  if (rewriteAttempted) {
    run.rewrite = {
      ...run.rewrite,
      status: !rewrittenPrompt ? "failed" : rewriteViolatesPolicy ? "rejected" : "accepted",
      input: rewriteInput,
      output: rewrittenPrompt ? redactIdentity(rewrittenPrompt) : null,
      reason: rewriteViolatesPolicy ? "the rewrite broke the scene's content level" : null,
    };
  }
  const finalPromptBase = redactIdentity(
    selectSlpImageProviderPrompt({
      rewrittenPrompt: acceptedRewrittenPrompt,
      rawPrompt: rawProviderPrompt,
      fallbackPrefix: redactIdentity(stripAppearanceLabel(characterDescription)),
      fallbackScene: rawRewriteInput,
      rewriteAttempted,
      rewriteFailure: rewriteViolatesPolicy ? "the rewrite broke the scene's content level" : rewriteFailure,
      onFallback: (reason) => {
        usedRewrite = false;
        if (run.rewrite.status === "accepted") run.rewrite = { ...run.rewrite, status: "rejected", reason };
        else if (run.rewrite.status === "failed") run.rewrite = { ...run.rewrite, reason };
        logger.warn("[slurp] Image prompt rewrite unusable (%s); sending the capped draft", reason);
      },
      // Art style and the character's image habits are meant to reach the provider, so a rewrite
      // that applies them is doing its job. Personality never belongs in a visual prompt at any
      // length; the instruction fields are guidance and only leak as a copied block.
      privateContext: [characterPersonality],
      guidanceContext: [configuredImageInstructions, connectionImageInstructions],
    }),
  );
  // Every path lands here, so the device is removed here: the caption or a stored draft may still
  // say "I held my phone up" (R1-050). A prompt a human approved is sent as written.
  const keep = viewpoint ? [viewpoint.phrase] : [];
  const withoutDevice = slurpWithoutCameraDevice(finalPromptBase, keep) || finalPromptBase;
  // A rewrite that dropped the viewpoint gets it back, so a selfie still reads as one.
  const finalPromptScene = skipInterpretation
    ? finalPromptBase
    : viewpoint && !withoutDevice.includes(viewpoint.phrase)
      ? `${withoutDevice}\n${viewpoint.phrase}`
      : withoutDevice;
  // The Creator's medium: an anime, furry or dragon Creator is drawn, so the brief's photo words go
  // and their style leads. A photo-style Creator, and a prompt a human approved, stay as they are.
  const styleSource = `${characterDescription}\n${characterImageInstructions}`;
  const artStyle = skipInterpretation ? null : slurpArtStyle(styleSource);
  // The viewpoint in the image model's words: tags for a tag model, e621 tags for a drawn furry.
  const promptFamily = slurpPromptFamily({
    promptMode: compiledPrompt.profile.promptMode,
    service: resolveImageGenerationService(input.imageConnection),
    model: imageModel,
    furry: Boolean(artStyle?.tag.includes("furry")),
  });
  // The look and the name go behind the style profile's own tags, in front of the scene.
  const [styleLead, writtenBody] = slurpSplitStyleLead(
    skipInterpretation ? finalPromptScene : slurpViewpointForFamily(finalPromptScene, promptFamily),
    compileStyled("").prompt,
  );
  // The name, or the player's own words for it, leads the look only for an open identity; a reviewed
  // prompt stays as written. Tags the writer put behind the body tags move to the front.
  const ownWords = !input.suppressCreatorDetails && !input.suppressCharacterContext && input.disclosureMode === "open";
  const imagePrefix = (ownWords && input.settings.creatorImagePrefixes?.[input.account.id]?.trim()) || "";
  const [finalPromptBody, subject] = skipInterpretation
    ? [writtenBody, imagePrefix || subjectName]
    : slurpWithoutImageSubject(writtenBody, imagePrefix || subjectName, promptFamily);
  // One copy of the look: the writer's words, Slurp's insert, or the writer's plus the missing traits.
  const finalPromptLook = slurpApplyImageLook(
    finalPromptBody,
    redactIdentity(stageAppearance || stripAppearanceLabel(characterDescription)),
    lookMode,
    usedRewrite,
  );
  const namedLook = skipInterpretation
    ? finalPromptLook
    : slurpApplyImageSubject(finalPromptLook, subject, promptFamily);
  const ownBlock = namedLook.slice(0, namedLook.length - finalPromptBody.length);
  // Everybody else the scene names gets their own block, between the Creator's and the scene.
  const blocks = () =>
    slurpImageCompanionBlocks(finalPromptBody, companionCards, promptFamily, lookMode, usedRewrite, ownBlock);
  const people = skipInterpretation ? "" : redactIdentity(blocks());
  const finalPromptSubject = styleLead + ownBlock + people + finalPromptBody;
  const finalPrompt = [
    artStyle ? slurpStyledImagePrompt(finalPromptSubject, styleSource) : finalPromptSubject,
    input.compositionGuard,
  ]
    .filter(Boolean)
    .join("\n\n");
  // Two people only when the writer put a companion in the picture; left out, the one-person rule stands.
  // The scene, not the Creator's block: a companion page of the same character is not a second person.
  const inPicture = companionCards.filter((c) => slurpImageNamesPerson(finalPromptBody, [c.name, c.known]));
  const companionNamed = inPicture.length > 0;
  // A reviewer who cleared the negative prompt still gets the style profile's own negatives back,
  // for the same reason the positive prompt is recompiled above.
  const baseNegativePrompt =
    input.promptOverride && !input.retryStoredPrompt
      ? redactIdentity(input.promptOverride.negativePrompt?.trim() || "") ||
        reviewedOverride?.negativePrompt ||
        undefined
      : compiledPrompt.negativePrompt || undefined;
  const finalNegativePrompt = slurpImageNegativeTerms(
    baseNegativePrompt,
    // The one-person rule is lifted here, after the writer decided who is in the picture: the brief's
    // own negatives keep it, and a companion the final prompt names takes it away.
    companionNamed && input.negativePromptAdditions
      ? slurpImageNegativeWithCompany(input.negativePromptAdditions)
      : (input.negativePromptAdditions ??
          slurpImageNegativePrompt(input.visualBrief?.sexualLevel, companionNamed, viewpoint?.source)),
    artStyle?.negative,
  );
  // Chosen here rather than by each caller, so a scheduled or redrawn Story is a Story too (R1-052).
  const outputWidth = input.width ?? (input.story ? input.settings.storyImageWidth : input.settings.imageWidth);
  const outputHeight = input.height ?? (input.story ? input.settings.storyImageHeight : input.settings.imageHeight);
  if (referenceImages?.length) {
    referenceImages = await slurpCompanionReferenceImages(input.characters, inPicture, finalPrompt, referenceImages);
    run.referenceImages = referenceImages.length;
  }
  run.finalPrompt = finalPrompt;
  run.negativePrompt = finalNegativePrompt ?? null;
  run.size = { width: outputWidth ?? null, height: outputHeight ?? null };
  // For Deep details: the viewpoint as the image model got it. A human-approved prompt kept its own words.
  run.viewpoint =
    viewpoint && !skipInterpretation
      ? { ...viewpoint, family: promptFamily, phrase: slurpViewpointForFamily(viewpoint.phrase, promptFamily) }
      : null;
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

  const providerRequest = {
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
  };
  const image = await generateSlpImageWithRetry(
    async (attempt) => {
      await input.beforeProviderAttempt?.(attempt);
      const hosted = generateSlurpImageWithHost({
        source: imageSource,
        baseUrl: imageBaseUrl,
        apiKey: input.imageConnection.apiKey || "",
        serviceHint: imageServiceHint,
        request: providerRequest,
      });
      return trackSlurpImageAttempt(
        run,
        attempt,
        hosted ? "host" : "bundled",
        () =>
          hosted ??
          generateImage(
            imageSource,
            imageBaseUrl,
            input.imageConnection.apiKey || "",
            imageServiceHint,
            providerRequest,
          ),
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
  if (input.chargeEnergy !== false) {
    try {
      await createSlurpStorage(input.db).adjustCreatorState(input.account.id, { energy: -SLURP_ENERGY_COST.image });
    } catch (error) {
      logger.warn(error, "[slurp] Could not charge image energy for %s", input.account.id);
    }
  }
  const stored = await slpCompactGeneratedImage(image);
  const file =
    stageSlurpImageWithHost(`${NOODLER_MEDIA_PREFIX}${input.account.id}`, stored.base64, stored.ext) ??
    stageImageToDisk(`${NOODLER_MEDIA_PREFIX}${input.account.id}`, stored.base64, stored.ext);
  return {
    metadata: {
      imageGenerated: true,
      imageProvider: provider,
      imageModel: imageModel || "unknown",
      imageStyleProfileId: compiledPrompt.profile.id,
      noodlerMediaPath: file.filePath,
      // What the provider actually drew from, so every surface that shows or edits the picture's
      // prompt shows this rather than the draft it started as.
      imageProviderPrompt: finalPrompt,
    },
    preview: null,
    stagedMedia: file,
    providerPrompt: finalPrompt,
  };
}
