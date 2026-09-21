import { type APIProvider } from "@marinara-engine/shared";
import { completeSlurpCampaignStageFor } from "../../data/feed/slp-campaign-storage.js";
import { createSlpPoll } from "../../../../../shared/src/slp/slp-polls.js";
import { SLP_CREATOR_POST_TITLE_MAX_LENGTH } from "../../../../../shared/src/slp/slp-social.schema.js";
import { type SlpAccount, type SlpCreatorManagedPost } from "../../../../../shared/src/slp/slp-social.types.js";
import { isDebugAgentsEnabled } from "../../../config/runtime-config.js";
import { newId } from "../../../utils/id-generator.js";
import type { DB } from "../../../db/connection.js";
import { describeSlurpPostCondition } from "./slp-post-condition-service.js";
import { logger, logDebugOverride } from "../../../lib/logger.js";
import { resolveBaseUrl } from "../../../services/generation/connection-base-url.js";
import { clampGenerationMaxOutputTokens } from "../../../services/generation/output-token-limits.js";
import { resolveStoredChatOptions } from "../../../services/generation/generation-parameters.js";
import { slpSamplingOptions } from "../../base/prompting/slp-sampling-options.js";
import { withConnectionFallbackProvider } from "../../../services/llm/connection-fallback-provider.js";
import { withConnectionAdmissionProvider } from "../../../services/generation/connection-admission.js";
import {
  isConnectionAdmissionFailure,
  type ConnectionAdmissionMode,
} from "../../../services/generation/connection-admission.js";
import type { ChatMessage } from "../../../services/llm/base-provider.js";
import { createLLMProvider } from "../../../services/llm/provider-registry.js";
import { resolveCreatorImageConnectionId } from "../../base/media/slp-image-connections.js";
import { resolveSlurpCreatorMenu, resolveSlurpPostGuidance } from "../../data/settings/slp-post-guidance-storage.js";
import { createCharactersStorage } from "../../../services/storage/characters.storage.js";
import { createConnectionsStorage } from "../../../services/storage/connections.storage.js";
import { createSlurpStorage } from "../../data/slp-storage.js";
import { type SlurpAccount } from "../../modules/records/slp-storage-model.js";
import { createPromptOverridesStorage } from "../../../services/storage/prompt-overrides.storage.js";
import { generateCreatorPostImage } from "../media/slp-media-contract.js";
import { slpCreatorUnlockPriceMetadata } from "../../modules/economy/slp-prices.js";
import {
  NOODLER_MEDIA_PREFIX,
  persistCreatorPostWithUploadedMedia,
  slpCreatorPostMediaUrl,
  type SlpCreatorPostMediaUpload,
} from "../../base/media/slp-media.js";
import type { SlpImagePromptReviewItem } from "../media/slp-media-contract.js";
import { getErrorMessage } from "../../modules/creators/slp-public-support.js";
import { slpResponseFormat } from "../../base/prompting/slp-response-format.js";
import {
  SLURP_TEASER_INSTRUCTION,
  slurpPostProject,
  slurpPostVariation,
  slurpPostVariationInstruction,
  slurpTeaserPost,
} from "../../modules/feed/slp-post-variation.js";
import { slurpArcImageLine } from "../../modules/projects/slp-arc-progress.js";
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
// The disclosure privacy core lives in a leaf module so tests can execute it instead of grepping
// this file, which cannot be imported without a database and an LLM provider.
import { protectCreatorGeneratedIdentity, type PublicIdentity } from "../../base/identity/slp-identity-protection.js";
import { resolveCreatorCharacterCanon } from "../../data/creators/slp-source-resolve.js";
import { slurpPlatformEventInstruction } from "../../../../../shared/src/slp/slp-platform-events.js";
import { slpCreatorPublicIdentityFor, protectBoundedCreatorGeneratedText } from "./slp-public-identity.js";
import {
  FormattedCreatorGenerationRequest,
  buildNoodlerPostMessages,
  slpCreatorTitleFromContent,
  parseCreatorPost,
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
import { slurpImageBrief } from "../../modules/feed/slp-image-brief.js";
import { slurpContentAxesInstruction } from "../../modules/feed/slp-content-axes.js";
import { planSlurpPost } from "./slp-post-plan-service.js";
import { stageImageToDisk, type StagedGalleryImage } from "../../../services/image/image-generation.js";
import { completeSlurpOpportunity } from "../../data/feed/slp-opportunity-storage.js";
import { slurpShootInstruction } from "../../modules/feed/slp-shoot.js";
import { openSlurpShoot, useSlurpShoot } from "../../data/feed/slp-shoot-storage.js";
import { slurpEffortInstruction, slurpPostEffort } from "../../modules/creators/slp-production-profile.js";
import { slurpCreatorStrategy, slurpStrategyInstruction } from "../../modules/creators/slp-creator-strategy.js";

export type GeneratedCreatorPostResult = {
  post: SlpCreatorManagedPost;
  imagePromptReview: SlpImagePromptReviewItem | null;
};

export type PreparedCreatorPostResult = {
  title: string | null;
  content: string;
  imagePrompt: string | null;
  access: "public" | "locked";
  /** The project this post continues, carried through to publication. Null for a loose post. */
  projectId: string | null;
  projectChapter: string | null;
  metadata: Record<string, unknown>;
  /** The exact system and user messages used for this prepared result. */
  compiledPrompt: string;
  /** A reused picture staged for the payload. The caller promotes it once the row is durable. */
  stagedMedia?: StagedGalleryImage | null;
};

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
  const fallbackProvider = withConnectionFallbackProvider({
    primary: createLLMProvider(
      input.connection.provider,
      resolveBaseUrl(input.connection),
      input.connection.apiKey,
      input.connection.maxContext,
      input.connection.openrouterProvider,
      input.connection.maxTokensOverride,
      input.connection.claudeFastMode === "true",
      input.connection.treatAsLocalEndpoint === "true",
      input.connection.defaultParameters,
    ),
    primaryConnectionId: input.connection.id,
    fallbackConnection,
    fallbackBaseUrl: fallbackConnection ? resolveBaseUrl(fallbackConnection) : "",
    category: "main",
  });
  // The fallback wrapper takes no admission mode — passing one silently dropped it, which left
  // every automatic post unadmitted and, worse, never ran `beforeAttempt`, so the daily budget
  // was never claimed and the reserve poll regenerated a post on every pass. Admission goes on
  // the outside, where the composed provider's calls actually pass through it.
  const provider = withConnectionAdmissionProvider(
    fallbackProvider,
    input.connection.id,
    input.admissionMode ?? { kind: "foreground" },
  );
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
  // The rotating angle for this post. Skipped when the player has directed the post themselves —
  // their direction is the angle, and a second one would fight it.
  // One sequence for both rotations, so the project and the variation cannot drift out of step.
  const sequence = await noodle.countNoodlerPostsByAccount(account.id);
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
  const format = input.request.format ?? variation?.format ?? "caption";
  // Decide who is holding the camera before anything describes the picture, so the framing is a
  // consequence of a camera that exists rather than a free-floating instruction. See
  // `slp-camera-source.ts`.
  // How this Creator makes things, as opposed to who they are. Stable for the life of the account,
  // so it biases every post they ever make rather than this one.
  const strategy = slurpCreatorStrategy(account.id, account.settings.strategy);
  const production = strategy.production;
  const cameraSource = variation
    ? slurpPostCameraSource(account.id, sequence, {
        companyCanHoldCamera: variation.companyCanHoldCamera,
        prefers: production.prefers,
      })
    : null;
  // A Story is a picture with a line under it, so a run that produces no image publishes an
  // ordinary post instead. The flag is only honoured on the path that commits an image below.
  // A Story the player asked for outranks the rotation, which never fires on a directed post.
  // Hoisted above the prompt build because the axes below need it; computing it twice
  // would let the two copies disagree about whether this post is a Story.
  const storyVariation =
    ((input.allowStory !== false && variation?.story === true && settings.storyImagesEnabled) ||
      input.request.postType === "story") &&
    imagesEnabled;
  // Same slot the scheduler used to choose free access, so only its teasers read as one.
  const isTeaser =
    input.request.access === "public" && !directed && slurpTeaserPost(account.id, sequence, settings.teaserRate);
  // What this post is for, as opposed to what it is about, and how it goes out. Story and teaser
  // are passed in rather than chosen again, so the decisions cannot contradict each other.
  const { axes, shoot, reusedMedia, reusedSource, opportunity } = await planSlurpPost(db, {
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
  // Text-only by intent, not by failure: no brief, no image call, and no gallery stand-in.
  const textOnly = axes?.delivery === "text_only";
  // A reused picture is the picture: nothing is briefed or generated for this post.
  const postImages = imagesEnabled && !textOnly && !reusedMedia;
  // A reused shoot keeps its own camera. The rotation's choice for today does not apply to a
  // picture that was taken two days ago.
  const camera = shoot?.cameraSource ?? cameraSource;
  const cameraInstruction = camera ? slurpCameraSourceInstruction(camera) : undefined;
  // The shoot rides in the content-type block rather than a block of its own: it is part of what
  // this post is for, and a second block would be dead for every post that is not a callback.
  const contentTypeInstruction = axes
    ? [slurpContentAxesInstruction(axes), shoot ? slurpShootInstruction(shoot) : ""].filter(Boolean).join("\n")
    : undefined;

  // The post call writes text only. Asking one call for the caption and the
  // picture together is what made every image an illustration of its own caption, so the brief is
  // assembled from the situation instead and the caption never reaches it. A directed post has no
  // variation and therefore no brief, so it keeps the old single-call behaviour.
  const briefedImage = Boolean(postImages && cameraInstruction && variation);
  const askModelForImagePrompt = postImages && !briefedImage;
  // The Creator's own state reached her direct messages and stopped there, so the feed was
  // written by somebody with no mood, no energy and no memory of last night. A failure here must
  // never cost a post: an unremarkable day is the same as no block at all.
  const conditionInstruction = await describeSlurpPostCondition(db, account.id, input.generatedAt ?? new Date());
  // The busiest thread's newest long-term notes. Best effort: a post must never fail over memory.
  const fanMemory = await createSlurpMessagesStorage(db)
    .listThreadsForCreators([account.id])
    .then((threads) =>
      (threads[0]?.notes ?? [])
        .filter((note) => note.tier === "longterm")
        .slice(-3)
        .map((note) => note.text),
    )
    .catch(() => [] as string[]);
  const messages = buildNoodlerPostMessages({
    account,
    fanMemory,
    sourceCharacterContext,
    stagePersonality: account.settings.privacy.stagePersonality ?? "",
    contentMenu: await resolveSlurpCreatorMenu(db, account.id).catch(() => ""),
    disclosureMode,
    publicIdentity,
    recentPosts,
    // A variation carries its own format, so an automatic post stops always being a caption.
    request: { ...input.request, format },
    variationInstruction: variation ? slurpPostVariationInstruction(variation, cameraInstruction) : undefined,
    conditionInstruction: conditionInstruction ?? undefined,
    eventInstruction:
      slurpPlatformEventInstruction(
        settings.platformEvents,
        input.publicationTime ?? input.generatedAt ?? new Date(),
      ) ?? undefined,
    accessInstruction: [
      await resolveSlurpPostGuidance(db, account.id, input.request.access),
      isTeaser ? SLURP_TEASER_INSTRUCTION : "",
    ]
      .filter(Boolean)
      .join("\n\n"),
    project: project ? { project, posts: projectPosts } : undefined,
    allowImagePrompt: askModelForImagePrompt,
    imageGenerationPrompt: settings.imageGenerationPrompt,
    generationGuidance: settings.generationGuidance,
    postMaxLength: settings.postMaxLength,
    scheduleContext,
    loreContext,
    promptBlocks: prompts.blocks,
    promptInstructions: prompts.instructions,
    contentTypeInstruction,
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
      contentMaxLength: settings.postMaxLength,
    }),
  } as const;

  let response = await provider.chatComplete(messages, completionOptions);
  let content = response.content ?? "";
  logDebugOverride(
    debugMode,
    "[debug/slurp] Model response attempt 1 received (%d characters); content is redacted.",
    content.length,
  );
  let generated;
  try {
    generated = parseCreatorPost(content);
  } catch {
    // Automatic posts used to get one attempt where a foreground post got two, so a scheduled post
    // failed outright on malformed output that a manual post recovered from — and the slot was lost
    // with the first call already paid for. The correction turn reuses the admission this run was
    // already granted and only fires on the failure path, so both paths now recover the same way.
    const correctionMessages: ChatMessage[] = [
      ...messages,
      { role: "assistant", content },
      {
        role: "user",
        content: askModelForImagePrompt
          ? "The response was not one valid Slurp-post JSON object. Return exactly one object with title, content, and imagePrompt. title and imagePrompt must both be non-empty. Do not include a poll. Return JSON only."
          : "The response was not one valid Slurp-post JSON object. Return exactly one object with title and content only. Do not include a poll or image prompt. Return JSON only.",
      },
    ];
    compiledPrompt = correctionMessages.map((message) => `# ${message.role}\n${message.content}`).join("\n\n");
    logDebugOverride(
      debugMode,
      "[debug/slurp] Correction prompt prepared with %d messages; private prompt content is redacted.",
      correctionMessages.length,
    );
    response = await provider.chatComplete(correctionMessages, completionOptions);
    content = response.content ?? "";
    logDebugOverride(
      debugMode,
      "[debug/slurp] Model response attempt 2 received (%d characters); content is redacted.",
      content.length,
    );
    generated = parseCreatorPost(content);
  }

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

  // Identity protection applies to the image prompt too, not only post text. The arc's chapter line
  // joins the prompt before protection, so a chapter naming a real place is redacted the same way.
  const arcImageLine = slurpArcImageLine(project);
  // Produce mode briefs the picture from the situation, never from the caption the model just
  // wrote. Identity protection still applies: the brief carries the Creator's own place and
  // company, so a Secret Creator's details must be redacted here exactly as they are in the text.
  const imageDraft =
    cameraInstruction && variation
      ? slurpImageBrief({
          cameraInstruction,
          variation,
          story: storyVariation,
          shoot,
          effortInstruction: slurpEffortInstruction(slurpPostEffort(production, sequence)),
        })
      : generated.imagePrompt;
  const draftImagePrompt = postImages
    ? protectCreatorGeneratedIdentity(
        imageDraft && arcImageLine ? `${imageDraft}\n${arcImageLine}` : imageDraft,
        disclosureMode,
        publicIdentity,
      )
    : null;

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
        place: variation.place,
        company: variation.company,
        cameraSource: camera,
        brief: draftImagePrompt,
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
      // Persisted so later planning, the scheduled publisher, and the feed read the same decision.
      ...(axes ? { contentIntent: axes.intent, contentDelivery: axes.delivery } : {}),
      ...(shootId ? { shootId } : {}),
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

  if (input.prepareOnly) {
    // A scheduled post publishes later, so a reused picture is staged now and rides in the payload
    // like a generated one. The reserve promotes it once the row is durable, or drops it.
    const stagedReuse = reusedMedia
      ? stageImageToDisk(
          `${NOODLER_MEDIA_PREFIX}${account.id}`,
          reusedMedia.buffer.toString("base64"),
          reusedMedia.extension,
        )
      : null;
    return {
      stagedMedia: stagedReuse,
      title: protectedGenerated.title,
      content: protectedGenerated.content,
      imagePrompt: draftImagePrompt,
      access: input.request.access,
      projectId: project?.id ?? null,
      projectChapter,
      compiledPrompt,
      // The scheduled path returns here, before the image-commit branch that stamps the story flag,
      // so a scheduled Story used to publish as an ordinary post. Carry the intent in the prepared
      // payload instead; publishDueNoodlerPreparedPosts drops it again if no image ever attached,
      // which keeps the "a Story is a picture with a line under it" rule intact.
      metadata: {
        ...baseInput.metadata,
        ...(stagedReuse ? { noodlerMediaPath: stagedReuse.filePath } : {}),
        ...(storyVariation ? { noodlerPostType: "story" } : {}),
      },
    };
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
    // The plan is closed here for the same reason, and links what it produced.
    if (opportunity) {
      await Promise.all([
        completeSlurpOpportunity(db, opportunity.id, { postId: post.id, at: input.generatedAt ?? new Date() }),
        completeSlurpCampaignStageFor(db, opportunity.id, { postId: post.id, at: input.generatedAt ?? new Date() }),
      ]).catch((error: unknown) => {
        logger.warn(error, "[slurp] Could not close a content plan; the post stands on its own");
      });
    }
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

  const slpCreatorImageConnectionId = await resolveCreatorImageConnectionId(db, account.id);
  // Fall back to the default image connection when a creator's mapped override
  // was deleted (getWithKey returns null), rather than skipping image generation.
  const imageConnection =
    (slpCreatorImageConnectionId ? await connections.getWithKey(slpCreatorImageConnectionId) : null) ??
    (await connections.getDefaultForImageGeneration());
  if (!imageConnection) {
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

  const imageInput = {
    account,
    linkedPublicAccount,
    disclosureMode,
    postContent: protectedGenerated.content,
    draftPrompt: draftImagePrompt,
    settings,
    characters: createCharactersStorage(db),
    promptOverrides: createPromptOverridesStorage(db),
    imageConnection,
    db,
    debugMode,
    admissionMode: input.admissionMode,
    // A Story is shown in a tall frame and cropped to portrait in the composer, so generate it at
    // 4:5 rather than at the feed post size the player configured.
    ...(storyVariation ? { width: settings.storyImageWidth, height: settings.storyImageHeight } : {}),
  };

  // Manual Guide review path: persist a pending prompt and hand back a preview for the
  // reviewed-image confirmation route to claim and finalize later.
  if (input.request.reviewImagePromptsBeforeSend === true) {
    let preview: Awaited<ReturnType<typeof generateCreatorPostImage>>;
    try {
      preview = await generateCreatorPostImage({
        ...imageInput,
        previewOnly: true,
      });
    } catch (err) {
      if (isConnectionAdmissionFailure(err)) throw err;
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
    });
  } catch (err) {
    // Same rule as the text leg: a busy connection is a deferral, so let it propagate to the
    // scheduler instead of persisting a post permanently marked as image-failed.
    if (isConnectionAdmissionFailure(err)) throw err;
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

  // One operation owns promotion and exactly one committed post: the serving URL is derived from
  // a pre-generated id so the image URL and media metadata persist together in a single insert.
  const postId = newId();
  try {
    image.stagedMedia?.promote();
    const post = await persist({
      id: postId,
      imagePrompt: draftImagePrompt,
      imageUrl: slpCreatorPostMediaUrl(postId),
      metadata: { ...image.metadata, ...(storyVariation ? { noodlerPostType: "story" } : {}) },
    });
    return { post, imagePromptReview: null };
  } catch (err) {
    image.stagedMedia?.compensate();
    throw err;
  }
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
