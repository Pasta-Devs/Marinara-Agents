import {
  NOODLER_REPLY_CONTENT_MAX_LENGTH,
  noodleGeneratedNoodlerReplySchema,
  type APIProvider,
  type NoodleAccount,
  type NoodleIdentityDisclosure,
  type NoodleInteraction,
  type NoodlerManagedPost,
} from "@marinara-engine/shared";
import { isDebugAgentsEnabled } from "../../config/runtime-config.js";
import type { DB } from "../../db/connection.js";
import { logDebugOverride } from "../../lib/logger.js";
import { resolveBaseUrl } from "../generation/connection-base-url.js";
import { clampGenerationMaxOutputTokens } from "../generation/output-token-limits.js";
import { resolveStoredChatOptions } from "../generation/generation-parameters.js";
import { noodleImageContext } from "./slurp-image-prompt.js";
import { noodleSamplingOptions } from "./slurp-sampling-options.js";
import { parseGameJsonish } from "../game/jsonish.js";
import { requireModelAnswer } from "./slurp-model-answer.js";
import { withConnectionFallbackProvider } from "../llm/connection-fallback-provider.js";
import type { ChatMessage } from "../llm/base-provider.js";
import { createLLMProvider } from "../llm/provider-registry.js";
import { createConnectionsStorage } from "../storage/connections.storage.js";
import { createSlurpStorage } from "../storage/slurp.storage.js";
import { createSlurpPopulationStorage } from "../storage/slurp-population.storage.js";
import { slurpArcDescription } from "./slurp-arc.js";
import {
  NOODLER_UNTRUSTED_CONTENT_INSTRUCTION,
  noodlerIdentityInstruction,
  protectBoundedNoodlerGeneratedText,
  protectNoodlerGeneratedIdentity,
  resolveNoodlerPublicIdentity,
  type PublicIdentity,
} from "./slurp-generation.service.js";
import { noodleResponseFormat } from "./slurp-response-format.js";
import { resolveSlurpCreatorScheduleContext } from "./slurp-creator-schedule.js";
import { createChatsStorage } from "../storage/chats.storage.js";
import { createCharactersStorage } from "../storage/characters.storage.js";

type GenerationConnection = NonNullable<Awaited<ReturnType<ReturnType<typeof createConnectionsStorage>["getWithKey"]>>>;

export function buildNoodlerCreatorReplyMessages(input: {
  creator: NoodleAccount;
  viewer: NoodleAccount;
  post: NoodlerManagedPost;
  parent: NoodleInteraction;
  disclosureMode: NoodleIdentityDisclosure;
  publicIdentity: PublicIdentity | null;
  generationGuidance: string;
  scheduleContext?: string;
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
}): ChatMessage[] {
  const protect = (value: string | null | undefined) =>
    protectNoodlerGeneratedIdentity(value, input.disclosureMode, input.publicIdentity) ?? "";
  const system = [
    "You write exactly one direct reply from one Slurp creator to one real viewer comment on the creator's post.",
    "Write only as the supplied creator's stage persona. Address the viewer's comment naturally and do not write for the viewer.",
    NOODLER_UNTRUSTED_CONTENT_INSTRUCTION,
    input.generationGuidance.trim(),
    noodlerIdentityInstruction(input.disclosureMode, input.publicIdentity),
    "Keep the reply direct and brief: one or two short sentences, normally under 240 characters.",
    "Let the relationship set the warmth. A stranger gets a friendly but ordinary reply; somebody who has been here a long time or paid for a lot gets recognition, familiarity, and a callback to what they have given you.",
    'Return exactly one JSON object with one string field named "content".',
    "Return JSON only. No prose outside the JSON object.",
  ]
    .filter(Boolean)
    .join("\n");
  const data = {
    creator: {
      displayName: protect(input.creator.displayName),
      handle: protect(input.creator.handle),
      bio: protect(input.creator.bio),
      stageVoice: protect(input.creator.settings.privacy.stagePersonality),
    },
    post: {
      title: protect(input.post.title),
      content: protect(input.post.content),
      // The picture the creator is replying about. Without it every reply talks past the image.
      ...(noodleImageContext(input.post) && { image: noodleImageContext(input.post) }),
    },
    viewer: {
      displayName: protect(input.viewer.displayName),
      handle: protect(input.viewer.handle),
      relationship: input.relationship ?? "no history with this creator yet",
    },
    viewerComment: protect(input.parent.content) || (input.parent.imageUrl ? "[image reply]" : ""),
    scheduleContext: input.scheduleContext ?? "No active Conversation Schedule is available for this Creator today.",
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
  creator: NoodleAccount;
  viewer: NoodleAccount;
  post: NoodlerManagedPost;
  parent: NoodleInteraction;
  connection: GenerationConnection;
  debugMode?: boolean;
}): Promise<string> {
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
  const disclosureMode = input.creator.settings.privacy.identityDisclosure ?? "secret";
  const publicIdentity = await resolveNoodlerPublicIdentity(input.db, input.creator);
  const settings = await createSlurpStorage(input.db).getSettings();
  const source = await createSlurpStorage(input.db).resolveAccountSource(input.creator);
  const scheduleContext = source
    ? await resolveSlurpCreatorScheduleContext(createCharactersStorage(input.db), source, undefined, new Date())
    : undefined;
  // Who this commenter is to this Creator. Read from the funnel and from whether they subscribe,
  // both of which were already recorded and never reached this prompt.
  const relationship = await describeCommenterRelationship(input.db, input.creator.id, input.viewer.id);
  const messages = buildNoodlerCreatorReplyMessages({
    ...input,
    disclosureMode,
    publicIdentity,
    generationGuidance: settings.generationGuidance,
    scheduleContext,
    relationship,
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
    responseFormat: noodleResponseFormat(input.connection.model, "noodler_reply"),
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
  const generated = noodleGeneratedNoodlerReplySchema.parse(
    Array.isArray(parsed) && parsed.length === 1 ? parsed[0] : parsed,
  );
  const protectedContent = protectBoundedNoodlerGeneratedText(
    generated.content,
    disclosureMode,
    publicIdentity,
    NOODLER_REPLY_CONTENT_MAX_LENGTH,
  );
  if (!protectedContent) throw new Error("Slurp creator reply generation returned no usable content.");
  return protectedContent;
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
      const arc = slurpArcDescription(tie.arc);
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
