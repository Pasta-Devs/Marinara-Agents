import type { APIProvider, NoodleAccount } from "@marinara-engine/shared";
import type { DB } from "../../db/connection.js";
import { logger, logDebugOverride } from "../../lib/logger.js";
import { parseGameJsonish } from "../game/jsonish.js";
import { requireModelAnswer } from "./slurp-model-answer.js";
import { resolveBaseUrl } from "../generation/connection-base-url.js";
import { clampGenerationMaxOutputTokens } from "../generation/output-token-limits.js";
import { resolveStoredChatOptions } from "../generation/generation-parameters.js";
import { noodleSamplingOptions } from "./slurp-sampling-options.js";
import { withConnectionFallbackProvider } from "../llm/connection-fallback-provider.js";
import type { ChatMessage } from "../llm/base-provider.js";
import { createLLMProvider } from "../llm/provider-registry.js";
import { createCharactersStorage } from "../storage/characters.storage.js";
import { createConnectionsStorage } from "../storage/connections.storage.js";
import { noodleGeneratedNoodlerPostSchema } from "@marinara-engine/shared";
import { noodleResponseFormat } from "./slurp-response-format.js";
import { noodlerSourceText } from "./slurp-stage-profile-draft.service.js";
import { NOODLER_UNTRUSTED_CONTENT_INSTRUCTION } from "./slurp-generation.service.js";

export type InvitedNoodlePostDraftRequest = {
  guidance?: string;
  connectionId?: string;
  debugMode?: boolean;
};

export type InvitedNoodlePostDraft = {
  title: string | null;
  content: string;
  imagePrompt: string | null;
  access: "public";
  authorAccountId: string;
};

function parseDraft(content: string) {
  const parsed = parseGameJsonish(requireModelAnswer(content, "an invited post draft"));
  return noodleGeneratedNoodlerPostSchema.parse(Array.isArray(parsed) && parsed.length === 1 ? parsed[0] : parsed);
}

export async function generateInvitedNoodlePostDraft(
  db: DB,
  account: NoodleAccount,
  connection: NonNullable<Awaited<ReturnType<ReturnType<typeof createConnectionsStorage>["getWithKey"]>>>,
  request: InvitedNoodlePostDraftRequest,
): Promise<InvitedNoodlePostDraft> {
  const characters = createCharactersStorage(db);
  const character = await characters.getById(account.entityId);
  if (!character) throw new Error("Noodle character not found.");
  const connections = createConnectionsStorage(db);
  const fallback = await connections.getFallbackForMain();
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
    fallbackConnection: fallback,
    fallbackBaseUrl: fallback ? resolveBaseUrl(fallback) : "",
    category: "main",
  });
  const messages: ChatMessage[] = [
    {
      role: "system",
      content: [
        "Write exactly one public Noodle post as the supplied character.",
        "Keep it like a real social post: usually 40-280 characters. Use longer text only when the direction explicitly asks for long-form writing.",
        NOODLER_UNTRUSTED_CONTENT_INSTRUCTION,
        "Return one JSON object with title, content, and imagePrompt set to null.",
        "Return JSON only. Do not create interactions or other accounts.",
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        `Character name: ${account.displayName}`,
        `Character handle: @${account.handle}`,
        // Only the profile fields the draft needs, never the whole stored record
        // (which carries greetings, example dialogue, and unrelated extensions).
        `Character profile:\n${noodlerSourceText(character.data)}`,
        ...(request.guidance?.trim() ? [`Post direction: ${JSON.stringify(request.guidance.trim())}`] : []),
      ].join("\n"),
    },
  ];
  const debugMode = request.debugMode === true;
  logDebugOverride(
    debugMode,
    "[debug/noodle] Invited post draft prompt prepared with %d messages; private prompt content is redacted.",
    messages.length,
  );
  const completionOptions = {
    model: connection.model,
    ...noodleSamplingOptions(
      resolveStoredChatOptions(connection.defaultParameters, connection.provider, connection.model),
      { temperature: 0.9, topP: 0.95 },
    ),
    maxTokens: clampGenerationMaxOutputTokens({
      provider: connection.provider as APIProvider,
      model: connection.model,
      maxTokens: 1024,
      maxTokensOverride: connection.maxTokensOverride,
    }),
    stream: false,
    debugMode,
    // The prompt always asks for imagePrompt (set to null); the strict schema
    // must require the field too, or GPT-5.6 gets conflicting instructions.
    responseFormat: noodleResponseFormat(connection.model, "noodler_post", { allowImagePrompt: true }),
  } as const;
  let response = await provider.chatComplete(messages, completionOptions);
  const raw = response.content ?? "";
  let generated;
  try {
    generated = parseDraft(raw);
  } catch (error) {
    logger.warn(error, "[noodle] Correcting invalid invited post draft response");
    const correctionMessages: ChatMessage[] = [
      ...messages,
      // Some providers reject an empty assistant turn; only echo the prior
      // response back when it actually had content.
      ...(raw.trim() ? [{ role: "assistant" as const, content: raw }] : []),
      {
        role: "user",
        content:
          "Return exactly one valid JSON object with title, content, and imagePrompt set to null. Return JSON only.",
      },
    ];
    response = await provider.chatComplete(correctionMessages, completionOptions);
    generated = parseDraft(response.content ?? "");
  }
  if (!generated.content.trim()) throw new Error("Noodle draft generation returned no content.");
  return {
    title: generated.title?.trim() || null,
    content: generated.content.trim(),
    imagePrompt: null,
    access: "public",
    authorAccountId: account.id,
  };
}
