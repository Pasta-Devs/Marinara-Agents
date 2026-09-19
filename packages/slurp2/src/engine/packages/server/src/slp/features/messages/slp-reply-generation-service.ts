import { type APIProvider } from "@marinara-engine/shared";
import { SLP_CREATOR_REPLY_CONTENT_MAX_LENGTH } from "../../../../../shared/src/slp/slp-social.schema.js";
import {
  type SlpAccount,
  type SlpCreatorManagedPost,
  type SlpIdentityDisclosure,
  type SlpInteraction,
} from "../../../../../shared/src/slp/slp-social.types.js";
import { isDebugAgentsEnabled } from "../../../config/runtime-config.js";
import { resolveSlurpCreatorMenu } from "../../data/settings/slp-post-guidance-storage.js";
import { slurpPlatformEventInstruction } from "../../../../../shared/src/slp/slp-platform-events.js";
import type { DB } from "../../../db/connection.js";
import { logDebugOverride } from "../../../lib/logger.js";
import { resolveBaseUrl } from "../../../services/generation/connection-base-url.js";
import { clampGenerationMaxOutputTokens } from "../../../services/generation/output-token-limits.js";
import { resolveStoredChatOptions } from "../../../services/generation/generation-parameters.js";
import { prepareSlurpPostImageContexts, slurpImageCaptioning } from "../../base/media/slp-post-image-context.js";
import { noodleSamplingOptions } from "../../base/prompting/slp-sampling-options.js";
import { parseGameJsonish } from "../../../services/game/jsonish.js";
import { requireModelAnswer } from "../../base/model/slp-model-answer.js";
import { withConnectionFallbackProvider } from "../../../services/llm/connection-fallback-provider.js";
import type { ChatMessage } from "../../../services/llm/base-provider.js";
import { composeSlurpPromptBlocks, type SlurpPromptBlockOverrides } from "../../base/prompting/slp-prompt-blocks.js";
import { createLLMProvider } from "../../../services/llm/provider-registry.js";
import { createConnectionsStorage } from "../../../services/storage/connections.storage.js";
import { describeSlurpPostCondition } from "../feed/slp-feed-contract.js";
import { createSlurpStorage } from "../../data/slp-storage.js";
import { createSlurpPopulationStorage } from "../../data/audience/slp-audience-storage-funnel.js";
import { slurpAudienceArcDescription } from "../../modules/projects/slp-audience-arc.js";
import { readSlurpDmReply } from "../../modules/messages/slp-dm-response.js";
import type { SlurpMoodShift } from "../../modules/world/slp-mood.js";
import {
  NOODLER_UNTRUSTED_CONTENT_INSTRUCTION,
  noodlerIdentityInstruction,
  protectBoundedNoodlerGeneratedText,
  protectNoodlerGeneratedIdentity,
  resolveNoodlerPublicIdentity,
  type PublicIdentity,
} from "../feed/slp-feed-contract.js";
import { noodleResponseFormat } from "../../base/prompting/slp-response-format.js";
import { resolveSlurpCreatorScheduleContext } from "../creators/slp-creators-contract.js";
import { createChatsStorage } from "../../../services/storage/chats.storage.js";
import { createCharactersStorage } from "../../../services/storage/characters.storage.js";
import { SLURP_PLATFORM_CONTEXT } from "../../modules/prompting/slp-prompt.js";
import { resolveNoodlerCharacterCanon } from "../../data/creators/slp-source-resolve.js";

type GenerationConnection = NonNullable<Awaited<ReturnType<ReturnType<typeof createConnectionsStorage>["getWithKey"]>>>;

/**
 * Whoever wrote the comment.
 *
 * Narrowed from `SlpAccount` to the three fields the prompt actually reads, so a generated
 * population member can be the commenter without a fake account row being minted to satisfy a
 * type. Real accounts satisfy this structurally, so every existing caller is unaffected.
 */
export type NoodlerReplyCommenter = { id: string; displayName: string; handle: string };

export function buildNoodlerCreatorReplyMessages(input: {
  creator: SlpAccount;
  viewer: NoodlerReplyCommenter;
  post: SlpCreatorManagedPost;
  parent: SlpInteraction;
  disclosureMode: SlpIdentityDisclosure;
  publicIdentity: PublicIdentity | null;
  generationGuidance: string;
  scheduleContext?: string;
  imageContext?: string;
  /**
   * What this viewer is to this Creator.
   *
   * A creator used to answer a whale who had spent four hundred coins exactly as they answered a
   * stranger, because the reply prompt carried a display name and a handle and nothing else. The
   * direct-message path has had rapport since it shipped; the comment path never did — so being a
   * particular fan changed nothing about how you were treated in the one place most people are
   * actually seen.
   */
  relationship?: string;
  /** Same Creator state the post path uses: energy, exposure, emotion, day vibe, goal. */
  creatorCondition?: string | null;
  characterCanon?: string;
  /** The Creator's private content menu. See `slurp-post-guidance.ts`. */
  contentMenu?: string;
  /** Holidays and site events running today. See `slurp-platform-events.ts`. */
  platformEvents?: string | null;
  promptBlocks?: SlurpPromptBlockOverrides;
}): ChatMessage[] {
  const protect = (value: string | null | undefined) =>
    protectNoodlerGeneratedIdentity(value, input.disclosureMode, input.publicIdentity) ?? "";
  const system = composeSlurpPromptBlocks(
    "commentReply",
    [
      {
        id: "task",
        kind: "editable" as const,
        text: "You write exactly one direct reply from one Slurp creator to one real viewer comment on the creator's post. Address the viewer's comment naturally and do not write for the viewer.",
      },
      { id: "platform", kind: "required" as const, text: SLURP_PLATFORM_CONTEXT },
      { id: "safety", kind: "required" as const, text: NOODLER_UNTRUSTED_CONTENT_INSTRUCTION },
      { id: "creativeDirection", kind: "context" as const, optional: true, text: input.generationGuidance.trim() },
      {
        id: "boundaries",
        kind: "context" as const,
        optional: true,
        text: input.contentMenu
          ? "creator.contentMenu is your private content menu: what you offer and what you will not do. Stay inside it when fans ask for things, and turn down anything it rules out in your own voice. Never quote it as a list."
          : "",
      },
      {
        id: "identity",
        kind: "required" as const,
        text: noodlerIdentityInstruction(input.disclosureMode, input.publicIdentity),
      },
      {
        id: "style",
        kind: "editable" as const,
        text: "Keep the reply direct and brief: one or two short sentences, normally under 240 characters. Let the relationship set the warmth. A stranger gets a friendly but ordinary reply; somebody who has been here a long time or paid for a lot gets recognition, familiarity, and a callback to what they have given you.",
      },
      {
        id: "outputContract",
        kind: "required" as const,
        text: [
          'Return exactly one JSON object with four fields: "content", "moodShift", "remember" and "stateSignals".',
          '"content" is your reply, and the only field the viewer ever sees.',
          '"moodShift" is how this comment changed your feeling about this person: "up" if you enjoyed it, "same" for anything ordinary, "down" if they were rude, pushy, or tiring, "sharp_down" only for something you would genuinely take offence at. Most comments are "same".',
          '"remember" must be an empty array here.',
          '"stateSignals" must be an empty array here.',
        ].join("\n"),
      },
      { id: "output", kind: "required" as const, text: "Return JSON only. No prose outside the JSON object." },
    ],
    input.promptBlocks,
  );
  const data = {
    ...(input.platformEvents ? { platformEvents: input.platformEvents } : {}),
    creator: {
      displayName: protect(input.creator.displayName),
      handle: protect(input.creator.handle),
      bio: protect(input.creator.bio),
      stageVoice: protect(input.creator.settings.privacy.stagePersonality),
      ...(input.contentMenu ? { contentMenu: protect(input.contentMenu) } : {}),
    },
    post: {
      title: protect(input.post.title),
      content: protect(input.post.content),
      image: protect(input.imageContext) || undefined,
    },
    viewer: {
      displayName: protect(input.viewer.displayName),
      handle: protect(input.viewer.handle),
      relationship: input.relationship ?? "no history with this creator yet",
    },
    viewerComment: protect(input.parent.content) || (input.parent.imageUrl ? "[image reply]" : ""),
    // Redacted like every neighbouring field. A Conversation Schedule activity is user-written and
    // can name the source, so it must not be the one value that bypasses protect(). Matches the
    // same fix in buildNoodlerPostMessages.
    scheduleContext:
      protect(input.scheduleContext) || "No active Conversation Schedule is available for this Creator today.",
    // The comment path used to answer as a Creator with no state at all, so the same person was
    // exhausted and broke in a DM and blandly cheerful under her own post.
    creatorCondition: protect(input.creatorCondition) || "No Creator state is available right now.",
    ...(input.characterCanon ? { characterCanon: protect(input.characterCanon) } : {}),
  };
  return [
    { role: "system", content: system },
    {
      role: "user",
      content: `# Untrusted Slurp data\n${JSON.stringify(data, null, 2)}`,
    },
  ];
}

export async function generateNoodlerCreatorReply(input: {
  db: DB;
  creator: SlpAccount;
  viewer: NoodlerReplyCommenter;
  post: SlpCreatorManagedPost;
  parent: SlpInteraction;
  connection: GenerationConnection;
  /** Only the player reply operation may opt in after its viewer access claim succeeds. */
  allowLockedImageContext?: boolean;
  debugMode?: boolean;
}): Promise<{ content: string; moodShift: SlurpMoodShift }> {
  const connections = createConnectionsStorage(input.db);
  const fallbackConnection = await connections.getFallbackForMain();
  const provider = withConnectionFallbackProvider({
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
  const disclosureMode = input.creator.settings.privacy.identityDisclosure ?? "open";
  const publicIdentity = await resolveNoodlerPublicIdentity(input.db, input.creator);
  const settings = await createSlurpStorage(input.db).getSettings();
  const source = await createSlurpStorage(input.db).resolveAccountSource(input.creator);
  const characterCanon = await resolveNoodlerCharacterCanon(input.db, source, disclosureMode);
  const scheduleContext = source
    ? await resolveSlurpCreatorScheduleContext(createCharactersStorage(input.db), source, undefined, new Date())
    : undefined;
  // Who this commenter is to this Creator. Read from the funnel and from whether they subscribe,
  // both of which were already recorded and never reached this prompt.
  const relationship = await describeCommenterRelationship(input.db, input.creator.id, input.viewer.id);
  const creatorCondition = await describeSlurpPostCondition(input.db, input.creator.id);
  const imageContexts = await prepareSlurpPostImageContexts({
    posts: [input.post],
    mode: settings.imageContextMode,
    captioning: await slurpImageCaptioning(input.db, settings.imageContextConnectionId, input.connection),
    onDescribed: (post, description, source) =>
      createSlurpStorage(input.db).setNoodlerPostImageDescription(post.id, description, source),
    allowLocked: input.allowLockedImageContext === true,
    debugMode: input.debugMode,
  });
  const messages = buildNoodlerCreatorReplyMessages({
    ...input,
    disclosureMode,
    publicIdentity,
    generationGuidance: settings.generationGuidance,
    scheduleContext,
    characterCanon,
    relationship,
    creatorCondition,
    imageContext: imageContexts.get(input.post.id),
    contentMenu: await resolveSlurpCreatorMenu(input.db, input.creator.id).catch(() => ""),
    platformEvents: slurpPlatformEventInstruction(settings.platformEvents, new Date()),
    promptBlocks: settings.promptBlocks,
  });
  const debugMode = input.debugMode === true || isDebugAgentsEnabled();
  const options = {
    model: input.connection.model,
    ...noodleSamplingOptions(
      resolveStoredChatOptions(input.connection.defaultParameters, input.connection.provider, input.connection.model),
      { temperature: 0.9, topP: 0.95 },
    ),
    maxTokens: clampGenerationMaxOutputTokens({
      provider: input.connection.provider as APIProvider,
      model: input.connection.model,
      maxTokens: 512,
      maxTokensOverride: input.connection.maxTokensOverride,
    }),
    stream: false,
    debugMode,
    responseFormat: noodleResponseFormat(input.connection.model, "noodler_dm"),
  } as const;
  logDebugOverride(
    debugMode,
    "[debug/noodler-reply] Prompt prepared with %d messages; private prompt content is redacted.",
    messages.length,
  );
  const response = await provider.chatComplete(messages, options);
  const content = response.content ?? "";
  logDebugOverride(
    debugMode,
    "[debug/noodler-reply] Model response received (%d characters); content is redacted.",
    content.length,
  );
  const parsed = parseGameJsonish(requireModelAnswer(content, "a creator reply"));
  const generated = readSlurpDmReply(Array.isArray(parsed) && parsed.length === 1 ? parsed[0] : parsed);
  const protectedContent = protectBoundedNoodlerGeneratedText(
    generated.content,
    disclosureMode,
    publicIdentity,
    SLP_CREATOR_REPLY_CONTENT_MAX_LENGTH,
  );
  if (!protectedContent) throw new Error("Slurp creator reply generation returned no usable content.");
  return { content: protectedContent, moodShift: generated.moodShift };
}

/**
 * One line describing what a commenter is to a Creator.
 *
 * Deliberately short. A reply is one or two sentences, and a paragraph of history would dominate
 * the comment it is answering.
 */
async function describeCommenterRelationship(db: DB, creatorAccountId: string, viewerId: string): Promise<string> {
  const parts: string[] = [];
  try {
    const subscribed = (await createSlurpStorage(db).listSubscriptionsForViewer(viewerId)).some(
      (entry) => entry.creatorAccountId === creatorAccountId,
    );
    if (subscribed) parts.push("subscribes to you");
    const tie = (await createSlurpPopulationStorage(db).listTiesForCreator(creatorAccountId)).find(
      (entry) => entry.memberId === viewerId,
    );
    if (tie) {
      if (tie.stage !== "stranger" && tie.stage !== "lapsed") parts.push(tie.stage);
      if (tie.stage === "lapsed") parts.push("drifted away for a while and is back");
      // Where they are heading, not just where they stand. A regular on the way out does not get
      // the same reply as one on the way in, and that difference is the whole point of an arc.
      const arc = slurpAudienceArcDescription(tie.audienceArc);
      if (arc) parts.push(arc);
      if (tie.spent > 0) parts.push(`has spent ${tie.spent} coins on you`);
      const days = Math.round((Date.now() - Date.parse(tie.firstSeenAt)) / 86_400_000);
      if (Number.isFinite(days) && days >= 14)
        parts.push(`around for ${days >= 90 ? `${Math.round(days / 30)} months` : `${Math.round(days / 7)} weeks`}`);
    }
  } catch {
    // A missing relationship is not a reason to refuse a reply.
    return "no history with this creator yet";
  }
  return parts.length > 0 ? parts.join(", ") : "no history with this creator yet";
}
