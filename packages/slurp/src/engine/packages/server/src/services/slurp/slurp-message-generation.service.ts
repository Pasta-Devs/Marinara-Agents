/**
 * Generate one creator reply inside a direct-message thread.
 *
 * Deliberately shaped like `slurp-reply-generation.service.ts`: same provider construction, same
 * identity protection, same JSON contract. A DM differs from a comment reply only in what the
 * prompt is told — the history, the rapport, and whether the creator is even awake — so the
 * machinery around it is reused rather than rebuilt.
 */
import { noodleGeneratedNoodlerReplySchema, type APIProvider, type NoodleAccount } from "@marinara-engine/shared";
import { isDebugAgentsEnabled } from "../../config/runtime-config.js";
import type { DB } from "../../db/connection.js";
import { logDebugOverride } from "../../lib/logger.js";
import { resolveBaseUrl } from "../generation/connection-base-url.js";
import { clampGenerationMaxOutputTokens } from "../generation/output-token-limits.js";
import { resolveStoredChatOptions } from "../generation/generation-parameters.js";
import { noodleSamplingOptions } from "./slurp-sampling-options.js";
import { parseGameJsonish } from "../game/jsonish.js";
import { requireModelAnswer } from "./slurp-model-answer.js";
import { withConnectionFallbackProvider } from "../llm/connection-fallback-provider.js";
import type { ChatMessage } from "../llm/base-provider.js";
import { createLLMProvider } from "../llm/provider-registry.js";
import { createConnectionsStorage } from "../storage/connections.storage.js";
import { createSlurpStorage, type SlurpAccount } from "../storage/slurp.storage.js";
import { createCharactersStorage } from "../storage/characters.storage.js";
import {
  NOODLER_UNTRUSTED_CONTENT_INSTRUCTION,
  noodlerIdentityInstruction,
  protectBoundedNoodlerGeneratedText,
  protectNoodlerGeneratedIdentity,
  resolveNoodlerPublicIdentity,
} from "./slurp-generation.service.js";
import { noodleResponseFormat } from "./slurp-response-format.js";
import { resolveSlurpCreatorScheduleContext } from "./slurp-creator-schedule.js";
import { resolveSlurpCreatorAvailability, type SlurpCreatorAvailability } from "./slurp-creator-schedule-context.js";
import { describeSlurpRapport, type SlurpRapport } from "./slurp-rapport.js";
import type { SlurpMessage } from "../storage/slurp-messages.storage.js";
import type { SlurpDmPolicy } from "./slurp-messaging.js";

type GenerationConnection = NonNullable<Awaited<ReturnType<ReturnType<typeof createConnectionsStorage>["getWithKey"]>>>;

/** A DM has more room than a comment reply, but not enough to become a monologue. */
export const SLURP_MESSAGE_CONTENT_MAX_LENGTH = 900;

/** How many turns of history the model sees. Enough to hold a thread, short enough to stay cheap. */
const HISTORY_TURNS = 16;

export function buildSlurpMessageChat(input: {
  creator: NoodleAccount;
  viewer: NoodleAccount;
  history: SlurpMessage[];
  rapport: SlurpRapport;
  availability: SlurpCreatorAvailability;
  subscribed: boolean;
  dmPolicy: SlurpDmPolicy;
  isRequest: boolean;
  generationGuidance: string;
  scheduleContext?: string;
  disclosureMode: Parameters<typeof noodlerIdentityInstruction>[0];
  publicIdentity: Parameters<typeof noodlerIdentityInstruction>[1];
}): ChatMessage[] {
  const protect = (value: string | null | undefined) =>
    protectNoodlerGeneratedIdentity(value, input.disclosureMode, input.publicIdentity) ?? "";
  const system = [
    "You write exactly one direct message from one Slurp creator to one fan, inside a private chat.",
    "Write only as the supplied creator's stage persona. Never write the fan's side of the conversation.",
    NOODLER_UNTRUSTED_CONTENT_INSTRUCTION,
    input.generationGuidance.trim(),
    noodlerIdentityInstruction(input.disclosureMode, input.publicIdentity),
    // The whole point of the rapport score: the same words from a stranger and from a whale must
    // not get the same answer, and the model needs to be told which one it is talking to.
    "Let the relationship set the warmth. A stranger gets a short, guarded, professional reply. A long-standing paying fan gets warmth, familiarity, and callbacks to what they have paid for.",
    input.subscribed
      ? "This fan is a paying subscriber right now. Treat them as one."
      : "This fan is not subscribed. You may flirt, but paid content stays behind the paywall, and it is fair to say so.",
    input.isRequest
      ? "This is an unanswered message request, not an open conversation. Keep it brief and a little cautious."
      : "",
    input.availability.online
      ? ""
      : `You are not free right now: ${input.availability.activity ?? "you are away"}. Answer anyway, but let it show — you are replying between other things.`,
    "This is a private chat, so write like one: lowercase is fine, contractions are fine, emojis are fine if they suit the persona.",
    "Keep it to a chat message, not an essay. One to four sentences unless the fan asked something that needs more.",
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
      dmPolicy: input.dmPolicy,
    },
    fan: {
      displayName: protect(input.viewer.displayName),
      handle: protect(input.viewer.handle),
      subscribed: input.subscribed,
    },
    relationship: describeSlurpRapport(input.rapport, protect(input.viewer.displayName) || "this fan"),
    scheduleContext: input.scheduleContext ?? "No active Conversation Schedule is available for this Creator today.",
    conversation: input.history.slice(-HISTORY_TURNS).map((message) => ({
      from: message.role === "creator" ? "you" : "the fan",
      // A tip is a message with no words. Rendering it as one is what lets the creator thank
      // the fan for it, which is the single most obvious thing a real creator does.
      text:
        message.kind === "tip"
          ? `[tipped you ${message.price} coins${message.content ? `: ${protect(message.content)}` : ""}]`
          : message.kind === "ppv"
            ? `[sent locked content for ${message.price} coins${message.unlockedAt ? ", which the fan unlocked" : ", still locked"}]`
            : protect(message.content),
      at: message.createdAt,
    })),
  };

  return [
    { role: "system", content: system },
    { role: "user", content: `# Untrusted Slurp data\n${JSON.stringify(data, null, 2)}` },
  ];
}

export async function generateSlurpMessageReply(input: {
  db: DB;
  // A `SlurpAccount`, not a bare `NoodleAccount`: resolving the creator's Engine source for the
  // schedule needs the source columns, and only the Slurp account carries them.
  creator: SlurpAccount;
  viewer: NoodleAccount;
  history: SlurpMessage[];
  rapport: SlurpRapport;
  subscribed: boolean;
  dmPolicy: SlurpDmPolicy;
  isRequest: boolean;
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
  const slurp = createSlurpStorage(input.db);
  const disclosureMode = input.creator.settings.privacy.identityDisclosure ?? "secret";
  const publicIdentity = await resolveNoodlerPublicIdentity(input.db, input.creator);
  const settings = await slurp.getSettings();
  const source = await slurp.resolveAccountSource(input.creator);
  const characters = createCharactersStorage(input.db);
  const [scheduleContext, availability] = await Promise.all([
    source ? resolveSlurpCreatorScheduleContext(characters, source, undefined, new Date()) : Promise.resolve(undefined),
    source
      ? resolveSlurpCreatorAvailability(characters, source, undefined, new Date())
      : Promise.resolve({ online: true, activity: null, minutesUntilOnline: 0 }),
  ]);
  const messages = buildSlurpMessageChat({
    ...input,
    availability,
    disclosureMode,
    publicIdentity,
    generationGuidance: settings.generationGuidance,
    scheduleContext,
  });
  const debugMode = input.debugMode === true || isDebugAgentsEnabled();
  const response = await provider.chatComplete(messages, {
    model: input.connection.model,
    ...noodleSamplingOptions(
      resolveStoredChatOptions(input.connection.defaultParameters, input.connection.provider, input.connection.model),
      { temperature: 0.95, topP: 0.95 },
    ),
    maxTokens: clampGenerationMaxOutputTokens({
      provider: input.connection.provider as APIProvider,
      model: input.connection.model,
      maxTokens: 768,
      maxTokensOverride: input.connection.maxTokensOverride,
    }),
    stream: false,
    debugMode,
    responseFormat: noodleResponseFormat(input.connection.model, "noodler_reply"),
  });
  const content = response.content ?? "";
  logDebugOverride(
    debugMode,
    "[debug/slurp-message] Model response received (%d characters); content is redacted.",
    content.length,
  );
  const parsed = parseGameJsonish(requireModelAnswer(content, "a direct message"));
  const generated = noodleGeneratedNoodlerReplySchema.parse(
    Array.isArray(parsed) && parsed.length === 1 ? parsed[0] : parsed,
  );
  const protectedContent = protectBoundedNoodlerGeneratedText(
    generated.content,
    disclosureMode,
    publicIdentity,
    SLURP_MESSAGE_CONTENT_MAX_LENGTH,
  );
  if (!protectedContent) throw new Error("Slurp direct-message generation returned no usable content.");
  return protectedContent;
}
