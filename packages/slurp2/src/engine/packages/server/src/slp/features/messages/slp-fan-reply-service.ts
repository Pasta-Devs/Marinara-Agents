/**
 * The fan's side of a conversation, on demand.
 *
 * A viewer chatting with a Creator can ask for a reply, because `replyToSlurpMessage` writes the
 * Creator's words. Playing the Creator there was no mirror of that: a persona-operated Creator is
 * written by hand, and nothing wrote the fan's answer, so the tool existed on one side only.
 *
 * This is the other direction and nothing more — one answer from the audience member in this
 * thread, in their own Fan Type voice, asked for by the player who owns the Creator.
 */
import type { APIProvider } from "@marinara-engine/shared";
import type { DB } from "../../../db/connection.js";
import { createConnectionsStorage } from "../../../services/storage/connections.storage.js";
import { createLLMProvider } from "../../../services/llm/provider-registry.js";
import { withConnectionFallbackProvider } from "../../../services/llm/connection-fallback-provider.js";
import { resolveBaseUrl } from "../../../services/generation/connection-base-url.js";
import { resolveStoredChatOptions } from "../../../services/generation/generation-parameters.js";
import { clampGenerationMaxOutputTokens } from "../../../services/generation/output-token-limits.js";
import { parseGameJsonish } from "../../../services/game/jsonish.js";
import { requireModelAnswer } from "../../base/model/slp-model-answer.js";
import { slpSamplingOptions } from "../../base/prompting/slp-sampling-options.js";
import { composeSlurpPromptBlocks, slurpPromptContext } from "../../base/prompting/slp-prompt-blocks.js";
import { resolveSlurpTextConnection } from "../../base/identity/slp-connection.js";
import { createSlurpStorage, createSlurpMessagesStorage } from "../../data/slp-storage.js";
import { createSlurpPopulationStorage } from "../../data/audience/slp-audience-storage-funnel.js";
import { resolveSlurpCharacterFanVoice } from "../../data/creators/slp-source-resolve.js";
import {
  SLURP_FAN_VOICE_PROMPT_MAX,
  slurpFanMemoryForPrompt,
  slurpFanVoiceForPrompt,
  slurpResolveFanType,
} from "../../../../../shared/src/slp/slp-fan-types.js";
import { NOODLER_UNTRUSTED_CONTENT_INSTRUCTION } from "../feed/slp-feed-contract.js";
import type { SlurpMessage } from "../../data/messages/slp-messages-storage-types.js";

export type SlurpFanReplyOutcome =
  | { status: "replied"; message: SlurpMessage }
  | { status: "nothing_to_answer" | "no_connection" | "ineligible" | "empty" };

/** How much of the conversation the fan is answering. Long enough to hold a thread of talk. */
const HISTORY = 12;
const MAX_LENGTH = 600;

export async function replyAsSlurpFan(
  db: DB,
  input: { threadId: string; creatorAccountId: string; guidance?: string },
): Promise<SlurpFanReplyOutcome> {
  const slurp = createSlurpStorage(db);
  const messages = createSlurpMessagesStorage(db);
  const thread = await messages.getThreadById(input.threadId);
  if (!thread || thread.creatorAccountId !== input.creatorAccountId) return { status: "ineligible" };
  if (thread.state !== "active" && thread.state !== "request") return { status: "ineligible" };

  const history = await messages.listMessages(thread.id, HISTORY);
  // The fan answers the Creator. With nothing from the Creator yet there is nothing to answer.
  if (!history.some((message) => message.role === "creator")) return { status: "nothing_to_answer" };

  const [creator, settings] = await Promise.all([
    slurp.getNoodlerAccountById(thread.creatorAccountId),
    slurp.getSettings(),
  ]);
  if (!creator) return { status: "ineligible" };

  const connection = await resolveSlurpTextConnection(
    createConnectionsStorage(db),
    settings.modelBudget.connectionId ?? settings.generationConnectionId,
  );
  if (!connection) return { status: "no_connection" };

  const population = createSlurpPopulationStorage(db);
  const member = await population.get(thread.viewerAccountId).catch(() => null);
  const tie = (await population.listTiesForCreator(creator.id).catch(() => [])).find(
    (entry) => entry.memberId === thread.viewerAccountId,
  );
  const fanAccount = member ? null : await slurp.getNoodlerAccountById(thread.viewerAccountId);
  const characterVoice = await resolveSlurpCharacterFanVoice(
    db,
    fanAccount?.entityId,
    SLURP_FAN_VOICE_PROMPT_MAX,
  ).catch(() => undefined);
  const speaker = member?.displayName ?? fanAccount?.displayName ?? "a reader";
  const voice = characterVoice ?? slurpFanVoiceForPrompt(slurpResolveFanType(settings.fanTypes, member ?? {}).voice);

  const connections = createConnectionsStorage(db);
  const fallbackConnection = await connections.getFallbackForMain();
  const provider = withConnectionFallbackProvider({
    primary: createLLMProvider(
      connection.provider,
      resolveBaseUrl(connection),
      connection.apiKey,
      connection.maxContext,
      connection.openrouterProvider,
      connection.maxTokensOverride,
      connection.claudeFastMode === "true",
      connection.treatAsLocalEndpoint === "true",
      connection.defaultParameters,
    ),
    primaryConnectionId: connection.id,
    fallbackConnection,
    fallbackBaseUrl: fallbackConnection ? resolveBaseUrl(fallbackConnection) : "",
    category: "main",
  });

  const data = {
    creator: { displayName: creator.displayName, handle: creator.handle, bio: creator.bio },
    fan: { name: speaker, voice, ...(tie ? { memory: slurpFanMemoryForPrompt(tie) } : {}) },
    conversation: history.map((message) => ({
      from: message.role === "creator" ? creator.displayName : speaker,
      kind: message.kind,
      content: message.content,
    })),
    ...(input.guidance ? { whatTheFanIsAskingFor: input.guidance } : {}),
  };
  const shared = [
    NOODLER_UNTRUSTED_CONTENT_INSTRUCTION,
    "You are writing one short message a fan sends to a Slurp creator. Write only the fan's words.",
    "Never write as the creator, and never answer on their behalf.",
    'Return exactly one JSON object with one string field named "content". Return JSON only.',
  ];
  const response = await provider.chatComplete(
    [
      {
        role: "system" as const,
        content: composeSlurpPromptBlocks(
          "pendingOpener",
          [
            {
              id: "task",
              kind: "editable",
              text: "Write this fan's next message in the conversation below, in their own voice. One or two sentences, no greeting, and never speak for the creator.",
            },
            { id: "safety", kind: "required", text: shared.join("\n") },
            { id: "output", kind: "required", text: shared.at(-1) ?? "Return JSON only." },
            { id: "source", kind: "context", text: "The supplied Slurp data follows." },
          ],
          slurpPromptContext(settings).blocks,
        ),
      },
      { role: "user" as const, content: `# Untrusted Slurp data\n${JSON.stringify(data, null, 2)}` },
    ],
    {
      model: connection.model,
      ...slpSamplingOptions(
        resolveStoredChatOptions(connection.defaultParameters, connection.provider, connection.model),
        {
          temperature: 0.95,
          topP: 0.95,
        },
      ),
      maxTokens: clampGenerationMaxOutputTokens({
        provider: connection.provider as APIProvider,
        model: connection.model,
        maxTokens: 320,
        maxTokensOverride: connection.maxTokensOverride,
      }),
      stream: false,
    },
  );
  const parsed = parseGameJsonish(requireModelAnswer(response.content ?? "", "a fan reply"));
  const unwrapped = Array.isArray(parsed) && parsed.length === 1 ? parsed[0] : parsed;
  const content = String((unwrapped as { content?: unknown })?.content ?? "")
    .trim()
    .slice(0, MAX_LENGTH);
  if (!content) return { status: "empty" };

  const message = await messages.appendMessage(thread.id, {
    senderAccountId: thread.viewerAccountId,
    role: "viewer",
    kind: "text",
    content,
  });
  return message ? { status: "replied", message } : { status: "ineligible" };
}
