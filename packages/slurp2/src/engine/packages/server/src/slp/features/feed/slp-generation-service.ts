import { buildSlurpDeepDetailsRecord } from "./slp-deep-details-record.js";
import { saveSlurpNewPostDeepDetails } from "../../data/feed/slp-post-deep-details-storage.js";
import type { SlpDeepDetailsFlavour } from "../../../../../shared/src/slp/slp-deep-details.js";
import { prepareSlurpCreatorPost } from "./slp-prepared-post.js";
import { type APIProvider } from "@marinara-engine/shared";
import { createSlpPoll } from "../../../../../shared/src/slp/slp-polls.js";
import { SLP_CREATOR_POST_TITLE_MAX_LENGTH } from "../../../../../shared/src/slp/slp-social.schema.js";
import { type SlpAccount, type SlpCreatorManagedPost } from "../../../../../shared/src/slp/slp-social.types.js";
import { isDebugAgentsEnabled } from "../../../config/runtime-config.js";
import { newId } from "../../../utils/id-generator.js";
import type { DB } from "../../../db/connection.js";
import { describeSlurpPostCondition } from "./slp-post-condition-service.js";
import { planSlurpPostSpice, resolveSlurpPostDial } from "./slp-post-spice.js";
import { logger, logDebugOverride } from "../../../lib/logger.js";
import { clampGenerationMaxOutputTokens } from "../../../services/generation/output-token-limits.js";
import { resolveStoredChatOptions } from "../../../services/generation/generation-parameters.js";
import { slpSamplingOptions } from "../../base/prompting/slp-sampling-options.js";
import { type ConnectionAdmissionMode } from "../../../services/generation/connection-admission.js";
import { resolveCreatorImageConnectionId } from "../../base/media/slp-image-connections.js";
import { resolveSlurpCreatorMenu, resolveSlurpPostGuidance } from "../../data/settings/slp-post-guidance-storage.js";
import { SLURP_BUILT_IN_EXPLICIT_LEVEL, slurpPostLevelInstruction } from "../../modules/feed/slp-post-guidance.js";
import { createCharactersStorage } from "../../../services/storage/characters.storage.js";
import { createConnectionsStorage } from "../../../services/storage/connections.storage.js";
import { createSlurpMessagesStorage, createSlurpStorage } from "../../data/slp-storage.js";
import { listSlurpOtherCreatorSubjects } from "../../data/feed/slp-feed-subjects-storage.js";
import { type SlurpAccount } from "../../modules/records/slp-storage-model.js";
import { createPromptOverridesStorage } from "../../../services/storage/prompt-overrides.storage.js";
import { generateCreatorPostImage, SLURP_SECONDARY_IMAGE_COUNT } from "../media/slp-media-contract.js";
import { finishSlurpPostImage } from "./slp-post-media-operation.js";
import { recordSlurpBeatFacts, resolveSlurpBeatCastContext, resolveSlurpBeatDay } from "./slp-post-beat-service.js";
import { slurpArcBeat, slurpPlannedExplicitLevel } from "../../modules/feed/slp-post-beat.js";
import { slpCreatorUnlockPriceMetadata } from "../../modules/economy/slp-prices.js";
import { persistCreatorPostWithUploadedMedia, type SlpCreatorPostMediaUpload } from "../../base/media/slp-media.js";
import { slpResponseFormat } from "../../base/prompting/slp-response-format.js";
import {
  SLURP_TEASER_INSTRUCTION,
  slurpPostProject,
  slurpPostVariation,
  slurpPostVariationInstruction,
  slurpTeaserPost,
} from "../../modules/feed/slp-post-variation.js";
import { slurpArcPoll, slurpArcRotation, slurpProjectChapter } from "../../modules/projects/slp-arc-progress.js";
import { slurpPurposeMetadata } from "../../modules/feed/slp-post-purpose.js";
import { resolveSlurpCreatorScheduleContext } from "../creators/slp-creators-contract.js";
import { createChatsStorage } from "../../../services/storage/chats.storage.js";
import { type SlpCreatorContentFormat } from "../../base/prompting/slp-content-format.js";
import { resolveSlurpPostLore } from "./slp-post-lore.js";
import { createCharacterGalleryStorage } from "../../../services/storage/character-gallery.storage.js";
import { createGalleryStorage } from "../../../services/storage/gallery.storage.js";
import { pickGalleryAttachmentForAccount } from "./slp-generated-activity-service.js";
import { protectCreatorGeneratedIdentity, type PublicIdentity } from "../../base/identity/slp-identity-protection.js";
import { resolveCreatorCharacterCanon } from "../../data/creators/slp-source-resolve.js";
import { readSlurpCreatorSteering, removeSlurpCreatorNudge } from "../../data/creators/slp-steering-storage.js";
import { resolveSlurpCreatorFlavour } from "../../data/creators/slp-flavour-source.js";
import { resolveSlurpEventInstruction } from "../world/slp-world-contract.js";
import { slpCreatorPublicIdentityFor, protectBoundedCreatorGeneratedText } from "./slp-public-identity.js";
import {
  FormattedCreatorGenerationRequest,
  buildNoodlerPostMessages,
  slpCreatorTitleFromContent,
  completeSlurpCreatorPost,
  slurpLockedTeaserMetadata,
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
  /** A slot held for a teased drop: the drop wins over the player's idea, which waits for the next slot (U). */
  heldDrop?: boolean;
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
  // The composer's AI image toggle is the user's request: it counts like the scheduler's own setting.
  const imagesEnabled = (autoPosting?.imagesEnabled === true || input.request.generateImage === true) && !input.media;

  const connections = createConnectionsStorage(db);
  const fallbackConnection = await connections.getFallbackForMain();
  const provider = createSlurpPostProvider({
    connection: input.connection,
    fallbackConnection,
    admissionMode: input.admissionMode ?? { kind: "foreground" },
  });
  const recentPosts = await noodle.listNoodlerPostsByAccount(account.id, 8);
  const otherCreatorSubjects = await listSlurpOtherCreatorSubjects(db, account.id, input.generatedAt ?? new Date());
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
  // Read the card at post time (not the bio and voice frozen at setup), so a sharper character makes a
  // sharper Creator without a migration. Concealed modes get the stage seed; disclosure limits what, not who.
  const sourceCharacterContext = await resolveCreatorCharacterCanon(db, linkedPublicAccount, disclosureMode);
  const loreContext = await resolveSlurpPostLore(db, {
    settings,
    recentPosts,
    sourceCharacterContext,
    source: linkedPublicAccount,
  });
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
  // The player's steering. The oldest idea is this post's beat (a slot held for a teased drop leaves it for
  // the next one, U); the classic planner has no beats, so there it becomes the post direction instead.
  const steering = await readSlurpCreatorSteering(db, account.id).catch(() => null);
  const nudge =
    input.heldDrop || input.previewOnly || input.request.noodlerPostGuide?.trim() ? null : steering?.nudges[0];
  const classicIdea = nudge && settings.postPlanner !== "beats" ? nudge.text : "";
  const directed = Boolean(input.request.noodlerPostGuide?.trim() || classicIdea);
  let variation = directed
    ? null
    : slurpPostVariation(account.id, sequence, settings.storyImagesEnabled ? settings.storyRate : "off");
  // A project claims this post only if the rotation gives it one. Player direction stands both
  // rotations down for the same reason: their direction is the subject, and a second one fights it.
  const project =
    directed || nudge
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
      input.request.postType === "story" ||
      nudge?.story === true) &&
    imagesEnabled;
  // Same slot the scheduler used to choose free access, so only its teasers read as one.
  const isTeaser =
    input.request.access === "public" && !directed && slurpTeaserPost(account.id, sequence, settings.teaserRate);
  // Where the day stands at publication, before planning: the schedule decides where they are.
  const beatDay =
    settings.postPlanner === "beats"
      ? await resolveSlurpBeatDay(db, {
          accountId: account.id,
          canonText: sourceCharacterContext,
          source: linkedPublicAccount,
          characters: createCharactersStorage(db),
          at: input.publicationTime ?? input.generatedAt ?? new Date(),
        })
      : null;
  // Beats mode keeps the last posts as facts, not quotes, so they are written before planning.
  if (settings.postPlanner === "beats" && !input.previewOnly)
    await recordSlurpBeatFacts(db, account, recentPosts, input.generatedAt ?? new Date());
  // What this post is for, as opposed to what it is about, and how it goes out. Story and teaser
  // are passed in rather than chosen again, so the decisions cannot contradict each other.
  const {
    axes,
    shoot,
    reusedMedia,
    reusedSource,
    opportunity,
    demandTopic,
    continuityInstruction,
    campaignId,
    beat: plannedBeat,
    purpose,
  } = await planSlurpPost(db, {
    account,
    request: input.request,
    strategy,
    sequence,
    directed,
    storyVariation,
    isTeaser,
    imagesEnabled,
    previewOnly: input.previewOnly,
    singlePicture: input.prepareOnly === true,
    slotId: input.slotId,
    at: input.generatedAt ?? new Date(),
    dueAt: input.publicationTime ?? null,
    beats:
      settings.postPlanner === "beats"
        ? {
            canonText: sourceCharacterContext,
            connection: input.connection,
            fallbackConnection,
            arc: project ? slurpArcBeat(project) : null,
            day: beatDay,
            steering,
            nudge,
            life: { account, tags: account.settings.profile.tags ?? [], rate: settings.lifeMomentRate },
            shared: settings.sharedPreseed
              ? { tags: account.settings.profile.tags ?? [], worldEvents: settings.sharedWorldEvents }
              : null,
          }
        : null,
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
        // Why this post goes up and what it leads to: a tease's drop, a drop's tease, a Story's job (3b).
        purpose.line,
        // A count under a label the Creator typed. Never a fan, never their words.
        demandTopic ? `Several subscribers have asked for: ${demandTopic}. Do not name or quote anyone.` : "",
        // A kept promise says what was promised, in the Creator's own label from the request panel.
        // Without it a "request" post had to invent what somebody asked for.
        opportunity?.topic
          ? `You promised a subscriber this: ${opportunity.topic}. This post ${axes.intent === "teaser" ? "teases" : "delivers"} it. Do not name or quote anyone.`
          : "",
      ]
        .filter(Boolean)
        .join("\n")
    : undefined;

  // The post call writes text only. One call for caption and picture made every image an illustration
  // of its caption, so the brief comes from the situation. A directed post has no brief (one call).
  const briefedImage = Boolean(postImages && cameraInstruction && variation);
  const askModelForImagePrompt = postImages && !briefedImage;
  const askModelForScene = briefedImage;
  // A set plans each extra picture as its own scene, the way Storyboard plans keyframes.
  const sceneShots = askModelForScene && axes?.delivery === "multi_image_set" ? SLURP_SECONDARY_IMAGE_COUNT : 0;
  // The Creator's own state reached her direct messages and stopped there, so the feed was
  // written by somebody with no mood, no energy and no memory of last night. A failure here must
  // never cost a post: an unremarkable day is the same as no block at all.
  const conditionInstruction = await describeSlurpPostCondition(db, account.id, input.generatedAt ?? new Date());
  const contentMenu = await resolveSlurpCreatorMenu(db, account.id).catch(() => "");
  // How far this Creator's pictures go. A read failure must not cost a post, and the shipped level
  // is what an install with nothing configured would have used anyway. A collab goes as far as both pages.
  const dialLevel = await resolveSlurpPostDial(db, account.id, plannedBeat?.tie).catch(
    () => SLURP_BUILT_IN_EXPLICIT_LEVEL,
  );
  // Beats plan the heat per post, up to the dial; caption and picture both read this one level.
  const explicitLevel = plannedBeat
    ? slurpPlannedExplicitLevel(dialLevel, plannedBeat.heatFloor ?? 0, account.id, sequence)
    : dialLevel;
  // What makes this post spicy, in this Creator's own way. Locked posts get it; teasers hint at it.
  const spiced = await planSlurpPostSpice(db, {
    account,
    source: linkedPublicAccount,
    disclosureMode,
    access: input.request.access,
    intent: axes?.intent,
    teaser: isTeaser,
    directed,
    explicitLevel,
    dialLevel,
    collabs: settings.creatorCollabs,
    recentPosts,
    sequence,
    variation,
    beat: plannedBeat,
    teasedKind: purpose.spiceKind,
  });
  const { postLevel, angle: spiceAngle, beat } = spiced;
  variation = spiced.variation;
  let flavourShaped: SlpDeepDetailsFlavour | null = null;
  const flavourBrief = await resolveSlurpCreatorFlavour(db, {
    account,
    source: linkedPublicAccount,
    disclosureMode,
    use: storyVariation ? "story" : "post",
    sequence,
    steering,
    ownLines: recentPosts.filter((post) => post.access !== "locked").map((post) => post.content),
    spice: spiced.spice,
    shaped: (value) => (flavourShaped = value),
  });
  const messages = buildNoodlerPostMessages({
    account,
    sourceCharacterContext,
    castContext: await resolveSlurpBeatCastContext(db, beat?.castIds),
    flavourBrief,
    stagePersonality: account.settings.privacy.stagePersonality ?? "",
    stageFacts: account.settings.stage,
    contentMenu,
    disclosureMode,
    publicIdentity,
    recentPosts,
    otherCreatorSubjects,
    // A variation carries its own format, so an automatic post stops always being a caption.
    request: { ...input.request, format, ...(classicIdea ? { noodlerPostGuide: classicIdea } : {}) },
    variationInstruction: variation
      ? slurpPostVariationInstruction(variation, cameraInstruction, { shoot: !!shoot, beat: !!beat })
      : undefined,
    conditionInstruction: conditionInstruction ?? undefined,
    eventInstruction:
      (await resolveSlurpEventInstruction(db, account.id, input.publicationTime ?? input.generatedAt ?? new Date())) ??
      undefined,
    accessInstruction: [
      await resolveSlurpPostGuidance(db, account.id, input.request.access),
      isTeaser ? SLURP_TEASER_INSTRUCTION : "",
      slurpPostLevelInstruction(postLevel),
      spiceAngle?.line ?? "",
    ]
      .filter(Boolean)
      .join("\n\n"),
    askTeaser: input.request.access === "locked",
    project: project ? { project, posts: projectPosts } : undefined,
    allowImagePrompt: askModelForImagePrompt,
    allowScenePlan: askModelForScene,
    sceneShots,
    wardrobePrompt: askModelForScene
      ? slurpWardrobePrompt(wardrobeLooks, input.request.access, recentWardrobeIds, account.displayName)
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
    beat,
    beatCompany: variation?.company,
    beatDay: beat ? beatDay : null,
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
      sceneShots,
      claims: Boolean(beat),
    }),
  } as const;

  const { generated, content, sentMessages, attempts, claimCheck } = await completeSlurpCreatorPost(
    provider,
    messages,
    completionOptions,
    {
      askModelForImagePrompt,
      askModelForScene,
      sceneShots,
      debugMode,
      beat: beat && {
        beat,
        company: variation?.company,
        selfNames: [
          account.displayName,
          publicIdentity?.displayName ?? "",
          ...(publicIdentity?.sourceIdentifiers ?? []),
        ],
      },
    },
  );
  compiledPrompt = sentMessages.map((message) => `# ${message.role}\n${message.content}`).join("\n\n");
  // An idea is used once. Removed only after the model answered, so a failed call keeps it.
  const usedIdea = beat?.nudgeId ?? (classicIdea ? nudge?.id : undefined);
  if (usedIdea) await removeSlurpCreatorNudge(db, account.id, usedIdea).catch(() => undefined);

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
    creatorName: account.displayName,
  });

  // What the picture is and may show, in one place so the two briefs agree on level, shoot and effort.
  const { draftImagePrompt, visualBrief, negativePrompt, shotBriefs, pictureCast } = slurpPostPictureBriefs({
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
    partner: spiceAngle?.partner?.company ?? null,
    cast: beat?.cast,
    modelImagePrompt: generated.imagePrompt,
    stageFacts: account.settings.stage,
    scene: generated.scene,
    selectedWardrobe: wardrobeSelection.look,
    disclosureMode,
    publicIdentity,
    shots: generated.shots.slice(0, sceneShots),
  });

  // Shoot bookkeeping, once the post has text and its picture brief. A set drop opens a shoot later
  // callbacks draw from (its brief keeps their clothes and light); a callback spends a shot. Recorded
  // before persistence because a run that fails on the image still produced the shoot; a shoot left
  // by a run that throws later is pruned with the rest.
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
  const arcPoll = slurpArcPoll(project, (value, max) =>
    protectBoundedCreatorGeneratedText(value, disclosureMode, publicIdentity, max),
  );

  // Deep details, best effort.
  const deepDetailsId = input.previewOnly
    ? null
    : await saveSlurpNewPostDeepDetails(
        db,
        account.id,
        buildSlurpDeepDetailsRecord({
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
          planner: { mode: settings.postPlanner, beat, claimCheck, heat: { dial: dialLevel, planned: explicitLevel } },
          flavour: flavourShaped,
        }),
      );

  const baseInput = {
    authorAccountId: beat?.tie?.pageId ?? account.id,
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
      // The planned beat, so later planning can record what this post established once it publishes.
      ...(beat ? { slurpBeat: { type: beat.type, line: beat.line, anchor: beat.anchor } } : {}),
      // A collab, a sponsored post or a rivalry post: labels, the partner's page, the split, the fee.
      ...(beat?.tie ? { slurpTie: beat.tie } : {}),
      ...(pictureCast && beat?.castIds?.length ? { slurpPictureCast: beat.castIds } : {}),
      // What made it spicy, so unlocks, likes and tips can teach Slurp the player's taste.
      ...spiced.metadata,
      ...(wardrobeSelection.look ? { wardrobeLookId: wardrobeSelection.look.id } : {}),
      ...(wardrobeSelection.fallback
        ? {
            wardrobeSelectionFallback: true,
            ...(wardrobeSelection.requestedId ? { wardrobeRequestedId: wardrobeSelection.requestedId } : {}),
          }
        : {}),
      // Where a reused picture came from. The bytes are a copy, so this is provenance, not a link.
      ...(reusedMedia && reusedSource ? { reusedFromPostId: reusedSource.id } : {}),
      // Stamped at creation like a manual post: a generated locked post keeps its unlock price (not 1).
      ...(input.request.access === "locked"
        ? slpCreatorUnlockPriceMetadata(
            input.request.unlockPrice ??
              (await createSlurpMessagesStorage(db).getCreatorMessaging(account.id)).unlockPrice ??
              settings.walletUnlockCost,
          )
        : {}),
      ...(input.request.executionId ? { noodlerWizardExecutionId: input.request.executionId } : {}),
      ...(input.request.poll ? { poll: createSlpPoll(input.request.poll) } : arcPoll ? { poll: arcPoll } : {}),
      ...(input.request.imageCrop ? { imageCrop: input.request.imageCrop } : {}),
      ...slurpPurposeMetadata(purpose, protectedGenerated.content, { storyline: Boolean(project) }),
      ...slurpLockedTeaserMetadata(input.request.access, generated.teaser, disclosureMode, publicIdentity),
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
      companionIds: pictureCast ? beat?.castIds : undefined,
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
      playerAsked: input.admissionMode?.kind === "foreground", // a player's request (0.3.6)
      negativePromptAdditions: negativePrompt,
      story: storyVariation,
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

  return finishSlurpPostImage({
    db,
    accountName: account.displayName,
    draftImagePrompt,
    resolveImageInput,
    galleryFallback,
    persist,
    review: input.request.reviewImagePromptsBeforeSend === true,
    deepDetailsId,
    story: storyVariation,
    multi: axes?.delivery === "multi_image_set",
    shots: shotBriefs,
    shootId,
  });
}
