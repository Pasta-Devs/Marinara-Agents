import { saveSlurpPostDeepDetails } from "../../data/feed/slp-post-deep-details-storage.js";
import { slpIsAdmissionFailure } from "../../base/host/slp-admission.js";
import { buildSlurpDeepDetailsRecord } from "./slp-deep-details-record.js";
import { prepareSlurpCreatorPost } from "./slp-prepared-post.js";
import { slurpDeepDetailsImageRunRecorder } from "../../data/feed/slp-post-deep-details-storage.js";
import { type APIProvider } from "@marinara-engine/shared";
import { createSlpPoll } from "../../../../../shared/src/slp/slp-polls.js";
import { SLP_CREATOR_POST_TITLE_MAX_LENGTH } from "../../../../../shared/src/slp/slp-social.schema.js";
import { type SlpAccount, type SlpCreatorManagedPost } from "../../../../../shared/src/slp/slp-social.types.js";
import { isDebugAgentsEnabled } from "../../../config/runtime-config.js";
import { newId } from "../../../utils/id-generator.js";
import type { DB } from "../../../db/connection.js";
import { describeSlurpPostCondition } from "./slp-post-condition-service.js";
import { logger, logDebugOverride } from "../../../lib/logger.js";
import { clampGenerationMaxOutputTokens } from "../../../services/generation/output-token-limits.js";
import { resolveStoredChatOptions } from "../../../services/generation/generation-parameters.js";
import { slpSamplingOptions } from "../../base/prompting/slp-sampling-options.js";
import { type ConnectionAdmissionMode } from "../../../services/generation/connection-admission.js";
import { resolveCreatorImageConnectionId } from "../../base/media/slp-image-connections.js";
import {
  resolveSlurpCreatorMenu,
  resolveSlurpExplicitLevel,
  resolveSlurpPostGuidance,
} from "../../data/settings/slp-post-guidance-storage.js";
import {
  SLURP_BUILT_IN_EXPLICIT_LEVEL,
  slurpPostLevelInstruction,
  slurpPostSexualLevel,
} from "../../modules/feed/slp-post-guidance.js";
import { createCharactersStorage } from "../../../services/storage/characters.storage.js";
import { createConnectionsStorage } from "../../../services/storage/connections.storage.js";
import { createSlurpStorage } from "../../data/slp-storage.js";
import { type SlurpAccount } from "../../modules/records/slp-storage-model.js";
import { createPromptOverridesStorage } from "../../../services/storage/prompt-overrides.storage.js";
import { generateCreatorPostImage } from "../media/slp-media-contract.js";
import { persistSlurpGeneratedImageSet } from "./slp-post-media-operation.js";
import { slpCreatorUnlockPriceMetadata } from "../../modules/economy/slp-prices.js";
import { persistCreatorPostWithUploadedMedia, type SlpCreatorPostMediaUpload } from "../../base/media/slp-media.js";
import { getErrorMessage } from "../../modules/creators/slp-public-support.js";
import { slpResponseFormat } from "../../base/prompting/slp-response-format.js";
import {
  SLURP_TEASER_INSTRUCTION,
  slurpPostProject,
  slurpPostVariation,
  slurpPostVariationInstruction,
  slurpTeaserPost,
} from "../../modules/feed/slp-post-variation.js";
import { slurpArcRotation, slurpProjectChapter } from "../../modules/projects/slp-arc-progress.js";
import { resolveSlurpCreatorScheduleContext } from "../creators/slp-creators-contract.js";
import { createSlurpMessagesStorage } from "../../data/slp-storage.js";
import { createChatsStorage } from "../../../services/storage/chats.storage.js";
import { type SlpCreatorContentFormat } from "../../base/prompting/slp-content-format.js";
import { slpLorebookTokenBudget } from "../../modules/prompting/slp-prompt.js";
import { processLorebooks } from "../../../services/lorebook/index.js";
import { createCharacterGalleryStorage } from "../../../services/storage/character-gallery.storage.js";
import { createGalleryStorage } from "../../../services/storage/gallery.storage.js";
import { pickGalleryAttachmentForAccount } from "./slp-generated-activity-service.js";
import { protectCreatorGeneratedIdentity, type PublicIdentity } from "../../base/identity/slp-identity-protection.js";
import { resolveCreatorCharacterCanon } from "../../data/creators/slp-source-resolve.js";
import { resolveSlurpEventInstruction } from "../world/slp-world-contract.js";
import { slpCreatorPublicIdentityFor, protectBoundedCreatorGeneratedText } from "./slp-public-identity.js";
import {
  FormattedCreatorGenerationRequest,
  buildNoodlerPostMessages,
  slpCreatorTitleFromContent,
  completeSlurpCreatorPost,
} from "./slp-post-prompt.js";
export type { SlpCreatorContentFormat } from "../../base/prompting/slp-content-format.js";

export {
  protectCreatorGeneratedIdentity,
  stageProfileContainsPublicIdentity,
  stageProfileContainsSourceDetails,
  normalizedDisclosureWords,
  containsIdentity,
  type PublicIdentity,
} from "../../base/identity/slp-identity-protection.js";
import {
  slurpPromptContext,
  type SlurpPromptBlockOverrides,
  type SlurpReusablePromptInstruction,
} from "../../base/prompting/slp-prompt-blocks.js";
import { slurpCameraSourceInstruction, slurpPostCameraSource } from "../../modules/feed/slp-camera-source.js";
import { slurpPostPictureBriefs } from "./slp-post-picture-briefs.js";
import { slurpShootContinuity } from "../../modules/feed/slp-image-brief.js";
import { slurpContentAxesInstruction, slurpIntentFormat } from "../../modules/feed/slp-content-axes.js";
import { planSlurpPost, recordSlurpPostOutcome } from "./slp-post-plan-service.js";
import { slurpShootInstruction } from "../../modules/feed/slp-shoot.js";
import { openSlurpShoot, useSlurpShoot } from "../../data/feed/slp-shoot-storage.js";
import { slurpEffortInstruction, slurpPostEffort } from "../../modules/creators/slp-production-profile.js";
import { slurpCreatorStrategy, slurpStrategyInstruction } from "../../modules/creators/slp-creator-strategy.js";
import { createSlurpPostProvider } from "../../base/host/slp-generation-integrations.js";
import { resolveSlurpWardrobeSelection, slurpWardrobePrompt } from "../../modules/feed/slp-wardrobe-selection.js";
import type { GeneratedCreatorPostResult, PreparedCreatorPostResult } from "./slp-generation-contract.js";
export type { GeneratedCreatorPostResult, PreparedCreatorPostResult } from "./slp-generation-contract.js";

type GenerationConnection = NonNullable<Awaited<ReturnType<ReturnType<typeof createConnectionsStorage>["getWithKey"]>>>;

export type SlpCreatorPostGenerationInput = {
  account: SlpAccount;
  request: FormattedCreatorGenerationRequest;
  connection: GenerationConnection;
  media?: SlpCreatorPostMediaUpload;
  prepareOnly?: boolean;
  /** Scheduler-owned automatic runs pass background so they yield to user generation. */
  admissionMode?: ConnectionAdmissionMode;
  /** Clock captured by the caller so prompt construction and scheduling agree in tests and production. */
  generatedAt?: Date;
  /** Scheduled publication time. Omitted for posts generated for immediate publication. */
  publicationTime?: Date;
  /** False keeps the Story rotation out: "Create posts now" asks for feed posts, not Stories. */
  allowStory?: boolean;
  /** Preview calls use the supplied draft without changing saved settings. */
  promptBlocks?: SlurpPromptBlockOverrides;
  promptInstructions?: SlurpReusablePromptInstruction[];
  /** The scheduled slot this post fills, so its plan and its slot stay one record. */
  slotId?: string | null;
  /** Skip continuity writes when `prepareOnly` is used for a settings preview. */
  previewOnly?: boolean;
};

const SLP_CREATOR_POST_MAX_TOKENS = 2048;

export async function generateCreatorPost(
  db: DB,
  input: SlpCreatorPostGenerationInput & { prepareOnly: true },
): Promise<PreparedCreatorPostResult>;
export async function generateCreatorPost(
  db: DB,
  input: SlpCreatorPostGenerationInput & { prepareOnly?: false },
): Promise<GeneratedCreatorPostResult>;
export async function generateCreatorPost(
  db: DB,
  input: SlpCreatorPostGenerationInput,
): Promise<GeneratedCreatorPostResult | PreparedCreatorPostResult> {
  const noodle = createSlurpStorage(db);
  const { account } = input;
  const settings = await noodle.getSettings();
  const autoPosting = account.settings.scheduler.autoPosting;
  // The composer's AI image toggle is a request from the user, so it counts like the scheduler's
  // own setting. Without this a Creator with scheduled images off could never ask for one.
  const imagesEnabled = (autoPosting?.imagesEnabled === true || input.request.generateImage === true) && !input.media;

  const connections = createConnectionsStorage(db);
  const fallbackConnection = await connections.getFallbackForMain();
  const provider = createSlurpPostProvider({
    connection: input.connection,
    fallbackConnection,
    admissionMode: input.admissionMode ?? { kind: "foreground" },
  });
  const recentPosts = await noodle.listNoodlerPostsByAccount(account.id, 8);
  const disclosureMode = account.settings.privacy.identityDisclosure ?? "open";
  const linkedPublicAccount = await noodle.resolveAccountSource(account as SlurpAccount);
  const scheduleContext = linkedPublicAccount
    ? await resolveSlurpCreatorScheduleContext(
        createCharactersStorage(db),
        linkedPublicAccount,
        undefined,
        input.generatedAt ?? new Date(),
      )
    : undefined;
  // Derive the identity from the row already in hand; resolving it again would re-read it.
  const publicIdentity = await slpCreatorPublicIdentityFor(db, linkedPublicAccount);
  // Read the card at post time rather than relying on the bio and stage voice frozen at setup, so
  // sharpening a character sharpens its Creator and existing Creators improve without a migration.
  // Concealed modes get the same seed the stage profile draft uses; disclosure limits what may be
  // said, not who this is.
  const sourceCharacterContext = await resolveCreatorCharacterCanon(db, linkedPublicAccount, disclosureMode);
  // The Engine's own lorebook scan, as Noodle uses it: off until the player opts in, scoped to this
  // Creator's source, and read-only. Recent posts and the card give keyword entries something to match.
  // Lore is a nicety, so a failed scan costs the post its lore, never the post.
  const loreContext = settings.enableLorebookContext
    ? await processLorebooks(
        db,
        [
          ...recentPosts
            .slice()
            .reverse()
            .map((post) => ({ role: "user", content: post.content })),
          ...(sourceCharacterContext ? [{ role: "user", content: sourceCharacterContext }] : []),
        ],
        null,
        {
          characterIds: linkedPublicAccount?.kind === "character" ? [linkedPublicAccount.entityId] : [],
          personaId: linkedPublicAccount?.kind === "persona" ? linkedPublicAccount.entityId : null,
          tokenBudget: slpLorebookTokenBudget(1),
          generationTriggers: ["slurp"],
          previewOnly: true,
        },
      )
        .then((result) => [result.worldInfoBefore, result.worldInfoAfter].filter(Boolean).join("\n"))
        .catch((error: unknown) => {
          logger.warn(error, "[slurp] Lorebook context failed; generating the post without it");
          return "";
        })
    : "";
  // Rotating angle, skipped for directed posts; one sequence keeps project and variation in step.
  const sequence = await noodle.countNoodlerPostsByAccount(account.id);
  const wardrobeLooks = await noodle.listWardrobeLooks(account.id).catch(() => []);
  const recentWardrobeIds = recentPosts
    .map((post) => (typeof post.metadata.wardrobeLookId === "string" ? post.metadata.wardrobeLookId : null))
    .filter((id): id is string => Boolean(id));
  const prompts = slurpPromptContext({
    promptBlocks: input.promptBlocks ?? settings.promptBlocks,
    promptInstructions: input.promptInstructions ?? settings.promptInstructions,
  });
  const directed = Boolean(input.request.noodlerPostGuide?.trim());
  const variation = directed
    ? null
    : slurpPostVariation(account.id, sequence, settings.storyImagesEnabled ? settings.storyRate : "off");
  // A project claims this post only if the rotation gives it one. Player direction stands both
  // rotations down for the same reason: their direction is the subject, and a second one fights it.
  const project = directed
    ? null
    : slurpPostProject(
        account.id,
        sequence,
        slurpArcRotation(await noodle.listActiveProjects(account.id)),
        settings.projectRate,
      );
  // The project's own posts, not the page's. The page history is already supplied above and says
  // nothing about where this thread had got to.
  const projectPosts = project ? await noodle.listPostsByProject(project.id, 4) : [];
  // How this Creator makes things, as opposed to who they are. Stable for the life of the account,
  // so it biases every post they ever make rather than this one.
  const strategy = slurpCreatorStrategy(account.id, account.settings.strategy);
  const production = strategy.production;
  const effort = slurpPostEffort(production, sequence, account.id);
  // A Story needs a picture; a player-requested Story outranks the rotation. Computed once, here.
  const storyVariation =
    ((input.allowStory !== false && variation?.story === true && settings.storyImagesEnabled) ||
      input.request.postType === "story") &&
    imagesEnabled;
  // Same slot the scheduler used to choose free access, so only its teasers read as one.
  const isTeaser =
    input.request.access === "public" && !directed && slurpTeaserPost(account.id, sequence, settings.teaserRate);
  // What this post is for, as opposed to what it is about, and how it goes out. Story and teaser
  // are passed in rather than chosen again, so the decisions cannot contradict each other.
  const { axes, shoot, reusedMedia, reusedSource, opportunity, demandTopic, continuityInstruction, campaignId } =
    await planSlurpPost(db, {
      account,
      request: input.request,
      strategy,
      sequence,
      directed,
      storyVariation,
      isTeaser,
      imagesEnabled,
      previewOnly: input.previewOnly,
      slotId: input.slotId,
      at: input.generatedAt ?? new Date(),
      dueAt: input.publicationTime ?? null,
    });
  // The rotation varies length; the intent rules out lengths that contradict its job.
  const format = input.request.format ?? (variation ? slurpIntentFormat(axes?.intent, variation.format) : "caption");
  // Text-only by intent, not by failure: no brief, no image call, and no gallery stand-in.
  const textOnly = axes?.delivery === "text_only";
  // A reused picture is the picture: nothing is briefed or generated for this post.
  const postImages = imagesEnabled && !textOnly && !reusedMedia;
  // Drawn after the plan: a planned shoot is not photographed at arm's length. A reused shoot
  // keeps its own camera. See `slp-camera-source.ts`.
  const cameraSource = variation
    ? slurpPostCameraSource(account.id, sequence, {
        companyCanHoldCamera: variation.companyCanHoldCamera,
        prefers: production.prefers,
        intent: axes?.intent,
        effort,
      })
    : null;
  const camera = shoot?.cameraSource ?? cameraSource;
  const cameraInstruction = camera ? slurpCameraSourceInstruction(camera) : undefined;
  // The shoot rides in the content-type block rather than a block of its own: it is part of what
  // this post is for, and a second block would be dead for every post that is not a callback.
  const contentTypeInstruction = axes
    ? [
        slurpContentAxesInstruction(axes),
        // The picture is briefed with this effort; the caption has to know it too, or a quick
        // phone snap gets a caption about a set that took all afternoon.
        postImages && variation ? slurpEffortInstruction(effort) : "",
        shoot ? slurpShootInstruction(shoot) : "",
        // A count under a label the Creator typed. Never a fan, never their words.
        demandTopic ? `Several subscribers have asked for: ${demandTopic}. Do not name or quote anyone.` : "",
      ]
        .filter(Boolean)
        .join("\n")
    : undefined;

  // The post call writes text only. Asking one call for the caption and the
  // picture together is what made every image an illustration of its own caption, so the brief is
  // assembled from the situation instead and the caption never reaches it. A directed post has no
  // variation and therefore no brief, so it keeps the old single-call behaviour.
  const briefedImage = Boolean(postImages && cameraInstruction && variation);
  const askModelForImagePrompt = postImages && !briefedImage;
  const askModelForScene = briefedImage;
  // The Creator's own state reached her direct messages and stopped there, so the feed was
  // written by somebody with no mood, no energy and no memory of last night. A failure here must
  // never cost a post: an unremarkable day is the same as no block at all.
  const conditionInstruction = await describeSlurpPostCondition(db, account.id, input.generatedAt ?? new Date());
  const contentMenu = await resolveSlurpCreatorMenu(db, account.id).catch(() => "");
  // How far this Creator's pictures go. A read failure must not cost a post, and the shipped level
  // is what an install with nothing configured would have used anyway.
  const explicitLevel = await resolveSlurpExplicitLevel(db, account.id).catch(() => SLURP_BUILT_IN_EXPLICIT_LEVEL);
  const messages = buildNoodlerPostMessages({
    account,
    sourceCharacterContext,
    stagePersonality: account.settings.privacy.stagePersonality ?? "",
    stageFacts: account.settings.stage,
    contentMenu,
    disclosureMode,
    publicIdentity,
    recentPosts,
    // A variation carries its own format, so an automatic post stops always being a caption.
    request: { ...input.request, format },
    variationInstruction: variation
      ? slurpPostVariationInstruction(variation, cameraInstruction, { shoot: !!shoot })
      : undefined,
    conditionInstruction: conditionInstruction ?? undefined,
    eventInstruction:
      (await resolveSlurpEventInstruction(db, account.id, input.publicationTime ?? input.generatedAt ?? new Date())) ??
      undefined,
    accessInstruction: [
      await resolveSlurpPostGuidance(db, account.id, input.request.access),
      isTeaser ? SLURP_TEASER_INSTRUCTION : "",
      slurpPostLevelInstruction(
        slurpPostSexualLevel({ level: explicitLevel, access: input.request.access, intent: axes?.intent }),
      ),
    ]
      .filter(Boolean)
      .join("\n\n"),
    project: project ? { project, posts: projectPosts } : undefined,
    allowImagePrompt: askModelForImagePrompt,
    allowScenePlan: askModelForScene,
    wardrobePrompt: askModelForScene
      ? slurpWardrobePrompt(wardrobeLooks, input.request.access, recentWardrobeIds)
      : null,
    imageGenerationPrompt: settings.imageGenerationPrompt,
    generationGuidance: settings.generationGuidance,
    postMaxLength: settings.postMaxLength,
    scheduleContext,
    loreContext,
    promptBlocks: prompts.blocks,
    promptInstructions: prompts.instructions,
    contentTypeInstruction,
    continuityInstruction,
    productionInstruction: slurpStrategyInstruction(strategy),
    generatedAt: input.generatedAt ?? new Date(),
    publicationTime: input.publicationTime,
  });
  let compiledPrompt = messages.map((message) => `# ${message.role}\n${message.content}`).join("\n\n");
  const debugMode = input.request.debugMode === true || isDebugAgentsEnabled();
  logDebugOverride(
    debugMode,
    "[debug/slurp] Prompt prepared with %d messages; private prompt content is redacted.",
    messages.length,
  );
  const completionOptions = {
    model: input.connection.model,
    ...slpSamplingOptions(
      resolveStoredChatOptions(input.connection.defaultParameters, input.connection.provider, input.connection.model),
      { temperature: 0.9, topP: 0.95 },
    ),
    maxTokens: clampGenerationMaxOutputTokens({
      provider: input.connection.provider as APIProvider,
      model: input.connection.model,
      // A long post needs the tokens to finish; a truncated response fails the JSON parse outright.
      maxTokens: Math.max(SLP_CREATOR_POST_MAX_TOKENS, Math.ceil(settings.postMaxLength * 1.2)),
      maxTokensOverride: input.connection.maxTokensOverride,
    }),
    stream: false,
    debugMode,
    responseFormat: slpResponseFormat(input.connection.model, "noodler_post", {
      allowImagePrompt: askModelForImagePrompt,
      allowScenePlan: askModelForScene,
      contentMaxLength: settings.postMaxLength,
    }),
  } as const;

  const { generated, content, sentMessages, attempts } = await completeSlurpCreatorPost(
    provider,
    messages,
    completionOptions,
    { askModelForImagePrompt, askModelForScene, debugMode },
  );
  compiledPrompt = sentMessages.map((message) => `# ${message.role}\n${message.content}`).join("\n\n");

  const protectedContent = protectBoundedCreatorGeneratedText(
    generated.content,
    disclosureMode,
    publicIdentity,
    settings.postMaxLength,
  );
  if (!protectedContent) throw new Error("Slurp generation returned no usable post content.");

  const protectedGenerated = {
    // Every format shows a title now. Weak models still drop the field, so fall back to the
    // opening of the post rather than failing a whole generation over a headline.
    title:
      protectBoundedCreatorGeneratedText(
        generated.title,
        disclosureMode,
        publicIdentity,
        SLP_CREATOR_POST_TITLE_MAX_LENGTH,
      ) ?? slpCreatorTitleFromContent(protectedContent),
    content: protectedContent,
  };

  const wardrobeSelection = resolveSlurpWardrobeSelection({
    looks: askModelForScene ? wardrobeLooks : [],
    access: input.request.access,
    scene: askModelForScene ? generated.scene : null,
    recentIds: recentWardrobeIds,
  });

  // What the picture is, and what it may show. Assembled in one place so the two briefs cannot
  // disagree about the level, the shoot, or the effort.
  const { draftImagePrompt, visualBrief, negativePrompt } = slurpPostPictureBriefs({
    project,
    variation,
    camera,
    effort,
    productionStyle: production.style,
    shoot,
    axes,
    story: storyVariation,
    postImages,
    access: input.request.access,
    explicitLevel,
    modelImagePrompt: generated.imagePrompt,
    stageFacts: account.settings.stage,
    scene: generated.scene,
    selectedWardrobe: wardrobeSelection.look,
    disclosureMode,
    publicIdentity,
  });

  // Shoot bookkeeping, once the post definitely has text and its picture brief. A set drop opens a
  // shoot that later callbacks can draw from, and stores its brief so their pictures keep its
  // clothes and light; a callback that used one spends a shot. Recorded here rather than after
  // persistence because a run that fails on the image still produced the shoot; a shoot left
  // behind by a run that throws later is pruned with the rest.
  let openedShootId: string | null = null;
  if (!input.previewOnly) {
    if (axes?.intent === "set" && camera && variation) {
      const opened = await openSlurpShoot(db, {
        creatorAccountId: account.id,
        place: generated.scene?.setting?.trim() || variation.place, // concrete, so callbacks name it
        company: variation.company,
        cameraSource: camera,
        brief: slurpShootContinuity({
          scene: generated.scene,
          outfit: wardrobeSelection.look?.description ?? generated.scene?.outfit,
        }),
        effort,
        theme: axes.intent,
        campaignId,
        shotsTaken: axes.delivery === "multi_image_set" ? 3 : 1,
        at: input.generatedAt ?? new Date(),
      }).catch((error: unknown) => {
        // A post must never fail over continuity bookkeeping.
        logger.warn(error, "[slurp] Could not open a shoot session; the post stands on its own");
        return null;
      });
      openedShootId = opened?.id ?? null;
    } else if (shoot) {
      await useSlurpShoot(db, shoot).catch((error: unknown) => {
        logger.warn(error, "[slurp] Could not record a shoot reuse; the shoot may be posted from again");
      });
    }
  }
  // Stamped on the post so a later callback can find the pictures this shoot actually produced.
  const shootId = openedShootId ?? shoot?.id ?? null;

  const projectChapter = project ? slurpProjectChapter(project) : null;
  // An open arc choice is posted as a real poll, attached here rather than parsed from the text.
  const arcChoice = project && !project.pollPostId ? (project.choices[project.chapter] ?? null) : null;
  const arcPoll = arcChoice
    ? createSlpPoll({
        question: protectBoundedCreatorGeneratedText(arcChoice.question, disclosureMode, publicIdentity, 240),
        options: arcChoice.options.map((option) =>
          protectBoundedCreatorGeneratedText(option.label, disclosureMode, publicIdentity, 120),
        ),
      })
    : null;

  // Deep details, best effort. ponytail: an unpublished scheduled post leaves its record until the
  // Creator is deleted; sweep records with no post if they add up.
  let deepDetailsId: string | null = input.previewOnly ? null : newId();
  if (deepDetailsId) {
    await saveSlurpPostDeepDetails(db, {
      id: deepDetailsId,
      creatorAccountId: account.id,
      record: buildSlurpDeepDetailsRecord({
        input,
        sequence,
        completionOptions,
        attempts,
        opportunity,
        axes,
        isTeaser,
        storyVariation,
        format,
        variation,
        campaignId,
        shootId,
        reusedSource: reusedMedia ? reusedSource : null,
        demandTopic,
        project,
        projectChapter,
        camera,
        effort,
        visualBrief,
        strategy,
        sentMessages,
        content,
        generated,
        draftImagePrompt,
        askModelForImagePrompt,
        wardrobeSelection,
      }),
    }).catch((error: unknown) => {
      logger.warn(error, "[slurp] Could not record deep details for a post");
      deepDetailsId = null;
    });
  }

  const baseInput = {
    authorAccountId: account.id,
    title: protectedGenerated.title,
    content: protectedGenerated.content,
    source: "generated" as const,
    access: input.request.access,
    projectId: project?.id ?? null,
    // Stamped now rather than resolved later, so editing the project cannot rewrite what a
    // published post was about.
    projectChapter,
    metadata: {
      noodlerContentFormat: format,
      ...(deepDetailsId ? { deepDetailsId } : {}),
      // Persisted so later planning, the scheduled publisher, and the feed read the same decision.
      ...(axes ? { contentIntent: axes.intent, contentDelivery: axes.delivery } : {}),
      ...(shootId ? { shootId } : {}),
      ...(wardrobeSelection.look ? { wardrobeLookId: wardrobeSelection.look.id } : {}),
      ...(wardrobeSelection.fallback
        ? {
            wardrobeSelectionFallback: true,
            ...(wardrobeSelection.requestedId ? { wardrobeRequestedId: wardrobeSelection.requestedId } : {}),
          }
        : {}),
      // Where a reused picture came from. The bytes are a copy, so this is provenance, not a link.
      ...(reusedMedia && reusedSource ? { reusedFromPostId: reusedSource.id } : {}),
      // Stamped at creation like a manual post, so a generated locked post honours the configured
      // unlock price and keeps it across refreshes and edits instead of falling back to 1.
      ...(input.request.access === "locked"
        ? slpCreatorUnlockPriceMetadata(
            (await createSlurpMessagesStorage(db).getCreatorMessaging(account.id)).unlockPrice ??
              settings.walletUnlockCost,
          )
        : {}),
      ...(input.request.executionId ? { noodlerWizardExecutionId: input.request.executionId } : {}),
      ...(input.request.poll ? { poll: createSlpPoll(input.request.poll) } : arcPoll ? { poll: arcPoll } : {}),
      ...(input.request.imageCrop ? { imageCrop: input.request.imageCrop } : {}),
    },
  };

  const resolveImageInput = async (draftPrompt: string) => {
    const slpCreatorImageConnectionId = await resolveCreatorImageConnectionId(db, account.id);
    const imageConnection =
      (slpCreatorImageConnectionId ? await connections.getWithKey(slpCreatorImageConnectionId) : null) ??
      (await connections.getDefaultForImageGeneration());
    if (!imageConnection) return null;
    return {
      account,
      linkedPublicAccount,
      disclosureMode,
      postContent: protectedGenerated.content,
      draftPrompt,
      contentPolicy: contentMenu,
      visualBrief,
      settings,
      characters: createCharactersStorage(db),
      promptOverrides: createPromptOverridesStorage(db),
      imageConnection,
      db,
      debugMode,
      admissionMode: input.admissionMode,
      negativePromptAdditions: negativePrompt,
      ...(storyVariation ? { width: settings.storyImageWidth, height: settings.storyImageHeight } : {}),
    };
  };

  if (input.prepareOnly) {
    let providerPrompt: string | null = null;
    if (input.previewOnly && draftImagePrompt) {
      const previewInput = await resolveImageInput(draftImagePrompt);
      if (previewInput) {
        providerPrompt = (
          await generateCreatorPostImage({
            ...previewInput,
            previewOnly: true,
          })
        ).providerPrompt;
      }
    }
    return prepareSlurpCreatorPost({
      creatorAccountId: account.id,
      reusedMedia,
      title: protectedGenerated.title,
      content: protectedGenerated.content,
      imagePrompt: draftImagePrompt,
      access: input.request.access,
      projectId: project?.id ?? null,
      projectChapter,
      compiledPrompt,
      scene: generated.scene ?? null,
      wardrobeSelection: {
        selectedId: wardrobeSelection.look?.id ?? null,
        requestedId: wardrobeSelection.requestedId,
        fallback: wardrobeSelection.fallback,
      },
      visualBrief: visualBrief ?? null,
      providerPrompt,
      metadata: baseInput.metadata,
      story: storyVariation,
    });
  }

  const persist = async (
    extra: {
      id?: string;
      imagePrompt?: string | null;
      imageUrl?: string | null;
      metadata?: Record<string, unknown>;
    } = {},
  ): Promise<SlpCreatorManagedPost> => {
    const main = {
      ...baseInput,
      ...extra,
      metadata: { ...baseInput.metadata, ...extra.metadata },
    };
    const posts = await noodle.createNoodlerPosts([main]);
    const post = posts?.at(-1);
    if (!post) throw new Error("Failed to persist the generated Slurp post.");
    // Advanced here, after the row lands, rather than when the project was chosen: a generation
    // that failed halfway would otherwise skip a chapter and the thread would have a hole in it.
    if (project) await noodle.advanceProject(account.id, project.id, post.id);
    await recordSlurpPostOutcome(db, {
      account,
      post,
      axes,
      shootId,
      opportunity,
      campaignId,
      at: input.generatedAt ?? new Date(),
      previewOnly: input.previewOnly,
    });
    return post;
  };

  const media = input.media ?? reusedMedia;
  if (media) {
    const postId = newId();
    const post = await persistCreatorPostWithUploadedMedia(account.id, postId, media, (persistedMedia) =>
      persist({
        id: postId,
        imageUrl: persistedMedia.imageUrl,
        metadata: { noodlerMediaPath: persistedMedia.noodlerMediaPath },
      }),
    );
    if (!post) throw new Error("Failed to persist the generated Slurp post.");
    return { post, imagePromptReview: null };
  }

  // A post that ends without a generated picture can still show one from the source character's own
  // gallery, when the player allows it. Best effort: no gallery image is the same as none attached.
  const galleryFallback = async (): Promise<{ imageUrl?: string; metadata?: Record<string, unknown> }> => {
    if (textOnly || !settings.allowGalleryImageAttachments || linkedPublicAccount?.kind !== "character") return {};
    const attachment = await pickGalleryAttachmentForAccount({
      account: linkedPublicAccount,
      chats: createChatsStorage(db),
      gallery: createGalleryStorage(db),
      characterGallery: createCharacterGalleryStorage(db),
    }).catch((error: unknown) => {
      logger.warn(error, "[slurp] Could not attach a gallery image for %s", account.displayName);
      return null;
    });
    return attachment ?? {};
  };

  if (!draftImagePrompt) return { post: await persist(await galleryFallback()), imagePromptReview: null };

  const imageInput = await resolveImageInput(draftImagePrompt);
  if (!imageInput) {
    // A gallery image is a finished picture, so the post is not marked for the retry pass.
    const fallback = await galleryFallback();
    if (fallback.imageUrl) return { post: await persist(fallback), imagePromptReview: null };
    // Keep the prompt: the post publishes without its picture, and the retry pass (or the
    // user) draws it once a connection exists.
    const post = await persist({
      imagePrompt: draftImagePrompt,
      metadata: {
        imageGenerationFailed: true,
        imageGenerationError: "No image generation connection is configured.",
      },
    });
    return { post, imagePromptReview: null };
  }

  // Manual Guide review path: persist a pending prompt and hand back a preview for the
  // reviewed-image confirmation route to claim and finalize later.
  if (input.request.reviewImagePromptsBeforeSend === true) {
    let preview: Awaited<ReturnType<typeof generateCreatorPostImage>>;
    try {
      preview = await generateCreatorPostImage({
        ...imageInput,
        previewOnly: true,
        onImageRun: slurpDeepDetailsImageRunRecorder(db, deepDetailsId, "review"),
      });
    } catch (err) {
      if (slpIsAdmissionFailure(err)) throw err;
      logger.warn(err, "[slurp] Failed to prepare image prompt review for %s", account.displayName);
      const fallback = await galleryFallback();
      if (fallback.imageUrl) return { post: await persist(fallback), imagePromptReview: null };
      return {
        post: await persist({
          imagePrompt: draftImagePrompt,
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
      imagePrompt: draftImagePrompt,
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
      onImageRun: slurpDeepDetailsImageRunRecorder(db, deepDetailsId, "generation"),
    });
  } catch (err) {
    // Same rule as the text leg: a busy connection is a deferral, so let it propagate to the
    // scheduler instead of persisting a post permanently marked as image-failed.
    if (slpIsAdmissionFailure(err)) throw err;
    logger.warn(err, "[slurp] Failed to generate image for %s", account.displayName);
    const fallback = await galleryFallback();
    if (fallback.imageUrl) return { post: await persist(fallback), imagePromptReview: null };
    return {
      post: await persist({
        imagePrompt: draftImagePrompt,
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
    db,
    postId,
    imagePrompt: draftImagePrompt,
    primary: { ...image, metadata: { ...image.metadata, ...(storyVariation ? { noodlerPostType: "story" } : {}) } },
    imageInput,
    multi: axes?.delivery === "multi_image_set",
    shootId,
    persist,
  });
  return { post, imagePromptReview: null };
}

/**
 * Access for an automatic post: locked, except on this Creator's teaser slots, which go out free
 * to fish for subscribers. A player-chosen access never passes through here.
 */
export async function resolveSlurpAutomaticPostAccess(
  noodle: Pick<ReturnType<typeof createSlurpStorage>, "countNoodlerPostsByAccount" | "getSettings">,
  accountId: string,
): Promise<"public" | "locked"> {
  const [sequence, settings] = await Promise.all([noodle.countNoodlerPostsByAccount(accountId), noodle.getSettings()]);
  return slurpTeaserPost(accountId, sequence, settings.teaserRate) ? "public" : "locked";
}
